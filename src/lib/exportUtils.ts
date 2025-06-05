import * as XLSX from 'xlsx';
import type { ColumnDefinition, HierarchicalData, ProcessedRow } from '@/types/data-grid';
import { getCellValue } from './utils'; // Assuming getCellValue is moved here or imported

function downloadBrowserFile(content: string | ArrayBuffer, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function escapeCsvCell(cellValue: any): string {
  if (cellValue === null || typeof cellValue === 'undefined') {
    return '';
  }
  const stringValue = String(cellValue);
  // If the string contains a comma, double quote, or newline, wrap it in double quotes
  // and escape any existing double quotes by doubling them.
  if (/[",\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function exportToCsv<TData extends HierarchicalData<TData>>(
  rowsToExport: ProcessedRow<TData>[],
  visibleColumns: ColumnDefinition<TData>[],
  fileNamePrefix: string = 'export'
) {
  const headerRow = visibleColumns.map(col => escapeCsvCell(col.headerText)).join(',');
  
  const dataRows = rowsToExport.map(row =>
    visibleColumns.map(col => escapeCsvCell(getCellValue(row, col.field))).join(',')
  );

  const csvContent = [headerRow, ...dataRows].join('\r\n');
  const fileName = `${fileNamePrefix}_${new Date().toISOString().slice(0,10)}.csv`;
  downloadBrowserFile(csvContent, fileName, 'text/csv;charset=utf-8;');
}

export function exportToXlsx<TData extends HierarchicalData<TData>>(
  rowsToExport: ProcessedRow<TData>[],
  visibleColumns: ColumnDefinition<TData>[],
  fileNamePrefix: string = 'export'
) {
  const header = visibleColumns.map(col => col.headerText);
  
  const data = rowsToExport.map(row =>
    visibleColumns.map(col => {
      const value = getCellValue(row, col.field);
      // XLSX library can handle dates, numbers, booleans directly
      if (value instanceof Date) return value;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value;
      return String(value ?? ''); // Ensure null/undefined become empty strings
    })
  );

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...data]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  const fileName = `${fileNamePrefix}_${new Date().toISOString().slice(0,10)}.xlsx`;
  // XLSX.writeFile will trigger download
  XLSX.writeFile(workbook, fileName, { bookType: 'xlsx', type: 'array' });
}
