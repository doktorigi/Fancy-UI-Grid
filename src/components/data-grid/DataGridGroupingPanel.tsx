
import * as React from 'react';
import type { ColumnDefinition } from '@/types/data-grid';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataGridGroupingPanelProps<TData> {
  groupedColumns: ColumnDefinition<TData>[]; // Columns currently in the grouping panel
  allColumnsMap: Map<keyof TData & string, ColumnDefinition<TData>>;
  onUngroupColumn: (field: keyof TData & string) => void;
  onDropColumn: (field: keyof TData & string) => void;
}

export function DataGridGroupingPanel<TData>({
  groupedColumns,
  allColumnsMap,
  onUngroupColumn,
  onDropColumn,
}: DataGridGroupingPanelProps<TData>) {
  const [isDragOver, setIsDragOver] = React.useState(false);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const field = event.dataTransfer.getData('text/plain') as keyof TData & string;
    const columnDef = allColumnsMap.get(field);
    if (field && columnDef && columnDef.groupable !== false) {
      onDropColumn(field);
    }
  };

  return (
    <div
      className={cn(
        "grouping-panel",
        isDragOver && "outline outline-2 outline-primary outline-offset-[-2px]"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label="Column grouping panel. Drag column headers here to group."
    >
      {groupedColumns.length === 0 ? (
        <span className="grouping-panel-placeholder">Drag a column header here to group by that column</span>
      ) : (
        groupedColumns.map((colDef) => (
          <div key={colDef.field} className="grouping-panel-pill" aria-label={`Grouped by ${colDef.headerText}`}>
            <span>{colDef.headerText}</span>
            <Button
              variant="ghost"
              size="icon"
              className="grouping-panel-pill-remove h-5 w-5"
              onClick={() => onUngroupColumn(colDef.field)}
              aria-label={`Remove ${colDef.headerText} from grouping`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
