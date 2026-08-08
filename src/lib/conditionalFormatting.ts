import type { ConditionalFormatRule, HierarchicalData, ProcessedRow } from '@/types/data-grid';
import { getCellValue } from './utils';

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

function interpolateColor(color1: string, color2: string, ratio: number): string {
  const rgb1 = parseHexColor(color1) || { r: 239, g: 246, b: 255 }; // Light blue fallback
  const rgb2 = parseHexColor(color2) || { r: 29, g: 78, b: 216 }; // Dark blue fallback
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * clampedRatio);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * clampedRatio);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * clampedRatio);

  return `rgb(${r}, ${g}, ${b})`;
}

function evaluateRuleMatch(val: any, rule: ConditionalFormatRule): boolean {
  if (!rule.operator) return true;

  const numVal = parseFloat(String(val));
  const isNum = !isNaN(numVal);
  const targetNum = typeof rule.value === 'number' ? rule.value : parseFloat(String(rule.value));

  switch (rule.operator) {
    case '=':
      return isNum && !isNaN(targetNum) ? numVal === targetNum : String(val) === String(rule.value);
    case '!=':
      return isNum && !isNaN(targetNum) ? numVal !== targetNum : String(val) !== String(rule.value);
    case '<':
      return isNum && numVal < targetNum;
    case '>':
      return isNum && numVal > targetNum;
    case '<=':
      return isNum && numVal <= targetNum;
    case '>=':
      return isNum && numVal >= targetNum;
    case 'contains':
      return String(val ?? '').toLowerCase().includes(String(rule.value ?? '').toLowerCase());
    case 'startsWith':
      return String(val ?? '').toLowerCase().startsWith(String(rule.value ?? '').toLowerCase());
    case 'endsWith':
      return String(val ?? '').toLowerCase().endsWith(String(rule.value ?? '').toLowerCase());
    case 'between': {
      if (!isNum) return false;
      const min = typeof rule.value === 'number' ? rule.value : parseFloat(String(rule.value));
      const max = typeof rule.value2 === 'number' ? rule.value2 : parseFloat(String(rule.value2));
      return numVal >= min && numVal <= max;
    }
    default:
      return false;
  }
}

export interface DerivedColumnBounds {
  min: number;
  max: number;
}

export function computeColumnBounds<TData extends HierarchicalData<TData>>(
  rows: ProcessedRow<TData>[],
  field: keyof TData & string
): DerivedColumnBounds {
  let min = Infinity;
  let max = -Infinity;

  rows.forEach((row) => {
    if (row.isGroupHeader) return;
    const val = getCellValue(row, field);
    const num = parseFloat(String(val));
    if (!isNaN(num)) {
      if (num < min) min = num;
      if (num > max) max = num;
    }
  });

  return {
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 100 : max,
  };
}

export function getConditionalCellStyle<TData extends HierarchicalData<TData>>(
  row: ProcessedRow<TData>,
  field: keyof TData & string,
  rules: ConditionalFormatRule<TData>[],
  columnBounds?: DerivedColumnBounds
): React.CSSProperties | undefined {
  if (!rules || rules.length === 0) return undefined;

  const cellVal = getCellValue(row, field);
  let mergedStyle: React.CSSProperties = {};

  for (const rule of rules) {
    if (rule.field && rule.field !== field) continue;

    // Check value-based match rule
    if (rule.operator && evaluateRuleMatch(cellVal, rule)) {
      if (rule.style) {
        mergedStyle = { ...mergedStyle, ...rule.style };
      }
    }

    // Check color scale
    if (rule.colorScale) {
      const num = parseFloat(String(cellVal));
      if (!isNaN(num)) {
        const min = rule.colorScale.min ?? columnBounds?.min ?? 0;
        const max = rule.colorScale.max ?? columnBounds?.max ?? 100;
        const range = max - min || 1;
        const ratio = (num - min) / range;
        const bg = interpolateColor(rule.colorScale.minColor, rule.colorScale.maxColor, ratio);
        mergedStyle.backgroundColor = bg;
      }
    }

    // Check data bar
    if (rule.dataBar) {
      const num = parseFloat(String(cellVal));
      if (!isNaN(num)) {
        const min = rule.dataBar.min ?? columnBounds?.min ?? 0;
        const max = rule.dataBar.max ?? columnBounds?.max ?? 100;
        const range = max - min || 1;
        const pct = Math.max(0, Math.min(100, ((num - min) / range) * 100));
        const color = rule.dataBar.color || 'rgba(59, 130, 246, 0.25)';
        mergedStyle.background = `linear-gradient(90deg, ${color} ${pct}%, transparent ${pct}%)`;
      }
    }
  }

  return Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined;
}
