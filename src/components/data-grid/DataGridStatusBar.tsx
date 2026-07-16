import * as React from 'react';
import type { RangeStats } from '@/lib/gridProcessing';

interface DataGridStatusBarProps {
  filteredRowCount: number;
  totalRowCount: number;
  selectedRowCount: number;
  rangeCellCount: number; // cells in the current range selection (0 = no range)
  rangeStats: RangeStats | null;
}

const formatStat = (value: number): string =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function DataGridStatusBar({
  filteredRowCount,
  totalRowCount,
  selectedRowCount,
  rangeCellCount,
  rangeStats,
}: DataGridStatusBarProps) {
  const showRangeStats = rangeCellCount > 1 && rangeStats && rangeStats.count > 0;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-1.5 text-xs text-muted-foreground">
      <span>
        Rows: {filteredRowCount === totalRowCount
          ? filteredRowCount.toLocaleString()
          : `${filteredRowCount.toLocaleString()} of ${totalRowCount.toLocaleString()}`}
      </span>
      {selectedRowCount > 0 && <span>Selected: {selectedRowCount.toLocaleString()}</span>}
      {showRangeStats && (
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:ml-auto" aria-label="Range statistics">
          {rangeStats.numericCount > 0 && (
            <>
              <span>Sum: <span className="font-medium text-foreground">{formatStat(rangeStats.sum)}</span></span>
              <span>Avg: <span className="font-medium text-foreground">{formatStat(rangeStats.avg!)}</span></span>
              <span>Min: <span className="font-medium text-foreground">{formatStat(rangeStats.min!)}</span></span>
              <span>Max: <span className="font-medium text-foreground">{formatStat(rangeStats.max!)}</span></span>
            </>
          )}
          <span>Count: <span className="font-medium text-foreground">{rangeStats.count.toLocaleString()}</span></span>
        </span>
      )}
    </div>
  );
}
