import * as React from 'react';
import {
  Streamlit,
  withStreamlitConnection,
  type ComponentProps,
} from 'streamlit-component-lib';
import { DataGrid } from '@/components/data-grid/DataGrid';
import type { ColumnDefinition, HierarchicalData } from '@/types/data-grid';

interface Row extends HierarchicalData<Row> {
  [key: string]: any;
}

interface CellEdit {
  row_id: string | number;
  field: string;
  value: any;
}

function FancyGrid({ args, theme }: ComponentProps) {
  const columnDefs = (args.column_defs ?? []) as ColumnDefinition<Row>[];

  // Local copy of the data so cell edits are reflected immediately in the grid;
  // reset whenever Python sends different data.
  const dataKey = JSON.stringify(args.data ?? []);
  const [data, setData] = React.useState<Row[]>(args.data ?? []);
  const edits = React.useRef<CellEdit[]>([]);
  const selectedIds = React.useRef<(string | number)[]>([]);

  React.useEffect(() => {
    setData(args.data ?? []);
    edits.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  const pushState = () => {
    Streamlit.setComponentValue({
      selected_ids: selectedIds.current,
      edits: edits.current,
    });
  };

  const handleCellEdit = (rowId: string | number, field: string, value: any) => {
    setData(prev => prev.map(r => (r.id === rowId ? { ...r, [field]: value } : r)));
    edits.current = [...edits.current, { row_id: rowId, field, value }];
    pushState();
  };

  const handleSelectionChange = (ids: (string | number)[]) => {
    selectedIds.current = ids;
    pushState();
  };

  // Follow Streamlit's light/dark theme.
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme?.base === 'dark');
  }, [theme?.base]);

  // ponytail: auto height via ResizeObserver; open popovers/dropdowns can clip
  // at the iframe edge — pass height= from Python if that bites.
  React.useEffect(() => {
    if (args.height) {
      Streamlit.setFrameHeight(args.height);
      return;
    }
    const ro = new ResizeObserver(() => Streamlit.setFrameHeight());
    ro.observe(document.body);
    Streamlit.setFrameHeight();
    return () => ro.disconnect();
  }, [args.height]);

  return (
    <div className="p-1">
      <DataGrid<Row>
        data={data}
        columnDefs={columnDefs}
        defaultPageSize={args.default_page_size ?? 10}
        pageSizeOptions={args.page_size_options ?? [10, 25, 50, 100]}
        enableRowSelection={args.enable_row_selection ?? true}
        enableGroupingPanel={args.enable_grouping_panel ?? false}
        isTreeData={args.is_tree_data ?? false}
        treeColumn={args.tree_column ?? undefined}
        storageKey={args.storage_key ?? 'fancyUiGridStreamlit'}
        onCellEdit={handleCellEdit}
        onSelectionChange={handleSelectionChange}
      />
    </div>
  );
}

export default withStreamlitConnection(FancyGrid);
