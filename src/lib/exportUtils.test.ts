import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeCsvCell, prepareXlsxCellValue } from './exportUtils';

const dangerousValues = [
  '=SUM(A1:A2)',
  '+SUM(A1:A2)',
  '-SUM(A1:A2)',
  '@SUM(A1:A2)',
  '\tSUM(A1:A2)',
  '\rSUM(A1:A2)',
  '|SUM(A1:A2)',
];

test('escapeCsvCell neutralizes formula-like values', () => {
  for (const value of dangerousValues) {
    assert.equal(escapeCsvCell(value), `"\t${value.replace(/"/g, '""')}"`);
  }
});

test('escapeCsvCell keeps normal CSV escaping behavior', () => {
  assert.equal(escapeCsvCell('plain'), 'plain');
  assert.equal(escapeCsvCell('contains,comma'), '"contains,comma"');
  assert.equal(escapeCsvCell('contains "quote"'), '"contains ""quote"""');
  assert.equal(escapeCsvCell(null), '');
  assert.equal(escapeCsvCell(undefined), '');
});

test('prepareXlsxCellValue preserves native spreadsheet values', () => {
  const date = new Date('2026-07-09T00:00:00Z');

  assert.equal(prepareXlsxCellValue(42), 42);
  assert.equal(prepareXlsxCellValue(true), true);
  assert.equal(prepareXlsxCellValue(date), date);
});

test('prepareXlsxCellValue neutralizes formula-like strings', () => {
  for (const value of dangerousValues) {
    assert.equal(prepareXlsxCellValue(value), `\t${value}`);
  }
});
