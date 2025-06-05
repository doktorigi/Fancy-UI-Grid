import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { HierarchicalData, ProcessedRow } from '@/types/data-grid';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getCellValue = <TData extends HierarchicalData<TData>>(
  processedRow: ProcessedRow<TData>,
  field: keyof TData & string
): any => {
  if (processedRow.isGroupHeader) {
    // For exports, group headers won't typically have values for data fields.
    // They are usually filtered out before calling this for data cell generation.
    return ''; 
  }
  // originalRow should always exist for non-group-header ProcessedRow
  return processedRow.originalRow ? processedRow.originalRow[field] : (processedRow as any)[field];
};
