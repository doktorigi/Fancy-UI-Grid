import assert from 'node:assert';
import { test } from 'node:test';
import {
  computeColumnBounds,
  getConditionalCellStyle,
} from './conditionalFormatting';
import { computeAggregate } from './gridProcessing';
import type { ColumnDefinition, ConditionalFormatRule, ProcessedRow } from '@/types/data-grid';

interface DemoData {
  id: number;
  name: string;
  revenue: number;
  status: string;
}

const mockRows: ProcessedRow<DemoData>[] = [
  { id: 1, originalRow: { id: 1, name: 'Alpha', revenue: 100, status: 'Active' }, level: 0, hasChildren: false, revenue: 100, status: 'Active' },
  { id: 2, originalRow: { id: 2, name: 'Beta', revenue: 50, status: 'Pending' }, level: 0, hasChildren: false, revenue: 50, status: 'Pending' },
  { id: 3, originalRow: { id: 3, name: 'Gamma', revenue: -20, status: 'Failed' }, level: 0, hasChildren: false, revenue: -20, status: 'Failed' },
];

test('computeColumnBounds finds min and max across numeric cells', () => {
  const bounds = computeColumnBounds(mockRows, 'revenue');
  assert.strictEqual(bounds.min, -20);
  assert.strictEqual(bounds.max, 100);
});

test('getConditionalCellStyle applies value matching rules correctly', () => {
  const rules: ConditionalFormatRule<DemoData>[] = [
    { field: 'revenue', operator: '<', value: 0, style: { color: 'red' } },
    { field: 'status', operator: '=', value: 'Active', style: { color: 'green' } },
  ];

  const styleFailed = getConditionalCellStyle(mockRows[2], 'revenue', rules);
  assert.deepStrictEqual(styleFailed, { color: 'red' });

  const styleActive = getConditionalCellStyle(mockRows[0], 'status', rules);
  assert.deepStrictEqual(styleActive, { color: 'green' });
});

test('getConditionalCellStyle generates dataBar gradient style', () => {
  const rules: ConditionalFormatRule<DemoData>[] = [
    { field: 'revenue', dataBar: { min: 0, max: 100, color: 'rgba(0,0,255,0.5)' } },
  ];

  const styleBeta = getConditionalCellStyle(mockRows[1], 'revenue', rules);
  assert.ok(String(styleBeta?.background).includes('linear-gradient(90deg, rgba(0,0,255,0.5) 50%'));
});

test('computeAggregate handles multiple aggregate functions', () => {
  const colDef: ColumnDefinition<DemoData> = {
    field: 'revenue',
    headerText: 'Revenue',
    aggregate: ['sum', 'avg'],
  };

  const result = computeAggregate(mockRows, colDef);
  assert.strictEqual(result, 'Sum: 130 | Avg: 43.33');
});
