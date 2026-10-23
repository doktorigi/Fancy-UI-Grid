import * as React from 'react';
import {
  Streamlit,
  withStreamlitConnection,
  type ComponentProps,
} from 'streamlit-component-lib';
import { DataGrid } from '@/components/data-grid/DataGrid';
import type { BatchSaveResult, ColumnDefinition, GridDataSource, GridEdit, HierarchicalData, ServerRowsRequest, ServerRowsResult } from '@/types/data-grid';

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
  const serverParams = React.useRef<any>(null);
  const requests = React.useRef(new Map<string, { request: ServerRowsRequest<Row>; resolve: (result: ServerRowsResult<Row>) => void; reject: (error: Error) => void; cleanup: () => void }>());
  const batchRequest = React.useRef<{ id: string; edits: GridEdit<Row>[]; resolve: (result: BatchSaveResult) => void } | null>(null);
  const serial = React.useRef(0);
  const instanceId = React.useRef(`grid-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  React.useEffect(() => {
    setData(args.data ?? []);
    edits.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  const pushState = () => {
    Streamlit.setComponentValue({
      selected_ids: selectedIds.current,
      edits: edits.current,
      server_params: serverParams.current,
      server_requests: Array.from(requests.current, ([id, pending]) => ({ id, request: pending.request })),
      batch_request: batchRequest.current ? { id: batchRequest.current.id, edits: batchRequest.current.edits } : null,
    });
  };
  const pushRef = React.useRef(pushState);
  pushRef.current = pushState;

  const dataSource = React.useMemo<GridDataSource<Row> | undefined>(() => args.data_source_enabled ? {
    getRows: (request, signal) => new Promise((resolve, reject) => {
      if (signal.aborted) { reject(new Error('Cancelled')); return; }
      const id = `${instanceId.current}-${++serial.current}`;
      const abort = () => { requests.current.delete(id); reject(new Error('Cancelled')); };
      signal.addEventListener('abort', abort, { once: true });
      requests.current.set(id, { request, resolve, reject, cleanup: () => signal.removeEventListener('abort', abort) });
      pushRef.current();
    }),
  } : undefined, [args.data_source_enabled]);

  React.useEffect(() => {
    for (const response of args.server_responses ?? []) {
      const pending = requests.current.get(response.id);
      if (!pending) continue;
      requests.current.delete(response.id);
      pending.cleanup();
      if (response.error) pending.reject(new Error(response.error));
      else pending.resolve(response.result);
    }
    const response = args.batch_response;
    const pending = batchRequest.current;
    if (response && pending && pending.id === response.id) {
      batchRequest.current = null;
      pending.resolve(response.result);
    }
  }, [args.server_responses, args.batch_response]);

  const handleBatchSave = async (changes: GridEdit<Row>[]) => {
    const result = args.batch_save_enabled ? await new Promise<BatchSaveResult>(resolve => {
      batchRequest.current = { id: `${instanceId.current}-save-${++serial.current}`, edits: changes, resolve };
      pushState();
    }) : undefined;
    if (result?.errors?.length || result?.message) return result;
    const byId = new Map<string | number, Record<string, any>>();
    changes.forEach(change => byId.set(change.rowId, { ...byId.get(change.rowId), [change.field]: change.value }));
    setData(prev => prev.map(row => byId.has(row.id) ? { ...row, ...byId.get(row.id) } : row));
    edits.current = changes.map(change => ({ row_id: change.rowId, field: change.field, value: change.value }));
    pushState();
    return result;
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

  const handleServerParamsChange = (params: any) => {
    serverParams.current = params;
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
        enableFloatingFilters={args.enable_floating_filters ?? false}
        pivotMode={args.pivot_mode ?? false}
        enablePivotToggle={args.enable_pivot_toggle}
        pivotColumns={args.pivot_columns ?? []}
        pivotValues={args.pivot_values}
        density={args.density ?? 'normal'}
        enableDensitySelector={args.enable_density_selector ?? true}
        enableSavedViews={args.enable_saved_views ?? true}
        savedViews={args.saved_views ?? []}
        enableFormulaColumns={args.enable_formula_columns ?? true}
        formulaColumns={args.formula_columns ?? []}
        isTreeData={args.is_tree_data ?? false}
        treeColumn={args.tree_column ?? undefined}
        storageKey={args.storage_key ?? 'fancyUiGridStreamlit'}
        conditionalFormats={args.conditional_formats}
        serverSide={args.server_side ?? false}
        dataSource={dataSource}
        dataSourceVersion={args.data_source_version}
        serverRowModelOptions={args.server_row_model_options}
        virtualized={args.virtualized ?? false}
        virtualizedMaxHeight={args.viewport_height ?? 500}
        editMode={args.edit_mode ?? 'cell'}
        onBatchSave={handleBatchSave}
        totalRowCount={args.total_row_count}
        onServerParamsChange={handleServerParamsChange}
        onCellEdit={handleCellEdit}
        onSelectionChange={handleSelectionChange}
      />
    </div>
  );
}

export default withStreamlitConnection(FancyGrid);
