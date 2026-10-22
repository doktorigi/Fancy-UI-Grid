import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileFormula,
  validateFormula,
  evaluateFormula,
  applyFormulaColumnsToRows,
  slugifyFormulaField,
} from './formulaEngine';

test('evaluateFormula evaluates arithmetic expressions with bracketed and bare field references', () => {
  const row = { price: 120, quantity: 3, discount: 0.1 };
  assert.equal(evaluateFormula('=[price] * [quantity]', row), 360);
  assert.equal(evaluateFormula('price * quantity * (1 - discount)', row), 324);
  assert.equal(evaluateFormula('=([price] - 20) / 4 + 5', row), 30);
});

test('evaluateFormula handles IF, IFS, AND, OR, NOT, and comparison operators', () => {
  const highRow = { revenue: 150000, margin: 0.32, status: 'Active' };
  const lowRow = { revenue: 40000, margin: 0.12, status: 'Pending' };

  const tierFormula = "=IF([revenue] >= 100000 && [margin] > 0.25, 'Enterprise', 'Standard')";
  assert.equal(evaluateFormula(tierFormula, highRow), 'Enterprise');
  assert.equal(evaluateFormula(tierFormula, lowRow), 'Standard');

  const ifsFormula = "=IFS([margin] >= 0.3, 'A', [margin] >= 0.2, 'B', TRUE, 'C')";
  assert.equal(evaluateFormula(ifsFormula, highRow), 'A');
  assert.equal(evaluateFormula(ifsFormula, lowRow), 'C');
});

test('evaluateFormula supports ROUND, ABS, MIN, MAX, SUM, AVG, IFERROR, and COALESCE', () => {
  const row = { oldPrice: 80, newPrice: 95, fallback: 50, zero: 0 };
  assert.equal(
    evaluateFormula('=ROUND(([newPrice] - [oldPrice]) / [oldPrice] * 100, 2)', row),
    18.75
  );
  assert.equal(evaluateFormula('=ABS([oldPrice] - [newPrice])', row), 15);
  assert.equal(evaluateFormula('=MIN([oldPrice], [newPrice], [fallback])', row), 50);
  assert.equal(evaluateFormula('=MAX([oldPrice], [newPrice], [fallback])', row), 95);
  assert.equal(evaluateFormula('=AVG([oldPrice], [newPrice])', row), 87.5);
  assert.equal(evaluateFormula('= [newPrice] / [zero]', row), '#DIV/0!');
  assert.equal(evaluateFormula('=IFERROR([newPrice] / [zero], 0)', row), 0);
  assert.equal(evaluateFormula('=COALESCE([missingField], [fallback])', row), 50);
});

test('evaluateFormula supports string concatenation and string functions', () => {
  const row = { firstName: 'Ada', lastName: 'Lovelace', sku: '  abc-12345  ' };
  assert.equal(evaluateFormula("=[firstName] & ' ' & UPPER([lastName])", row), 'Ada LOVELACE');
  assert.equal(evaluateFormula('=CONCAT(LEFT([firstName], 1), ".", [lastName])', row), 'A.Lovelace');
  assert.equal(evaluateFormula('=UPPER(TRIM([sku]))', row), 'ABC-12345');
  assert.equal(evaluateFormula('=RIGHT(TRIM([sku]), 5)', row), '12345');
});

test('validateFormula extracts referenced fields and reports syntax errors', () => {
  const ok = validateFormula('=ROUND([price] * (1 - [discount]), 2)');
  assert.equal(ok.valid, true);
  assert.deepEqual(ok.referencedFields, ['price', 'discount']);

  const bad = validateFormula('=ROUND([price * 2)');
  assert.equal(bad.valid, false);
  assert.ok(bad.error && bad.error.length > 0);
});

test('applyFormulaColumnsToRows evaluates chained formula columns and detects cycles', () => {
  const rows = [
    { id: 1, price: 100, cost: 60, units: 5 },
    { id: 2, price: 50, cost: 40, units: 10 },
  ];

  const enriched = applyFormulaColumnsToRows(rows, [
    { field: 'unitProfit', formula: '=[price] - [cost]' },
    { field: 'totalProfit', formula: '=[unitProfit] * [units]' },
    { field: 'cycleA', formula: '=[cycleB] + 1' },
    { field: 'cycleB', formula: '=[cycleA] + 1' },
  ]);

  assert.equal((enriched[0] as any).unitProfit, 40);
  assert.equal((enriched[0] as any).totalProfit, 200);
  assert.equal((enriched[1] as any).unitProfit, 10);
  assert.equal((enriched[1] as any).totalProfit, 100);
  assert.equal((enriched[0] as any).cycleA, '#CYCLE!');
  assert.equal((enriched[0] as any).cycleB, '#CYCLE!');
});

test('slugifyFormulaField generates unique safe field keys', () => {
  assert.equal(slugifyFormulaField('Margin %', []), 'calc_margin_pct');
  assert.equal(
    slugifyFormulaField('Margin %', ['calc_margin_pct']),
    'calc_margin_pct_2'
  );
  assert.equal(compileFormula('=1+1').error, undefined);
});
