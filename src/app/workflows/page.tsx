"use client";
import * as React from 'react';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createInMemoryDataSource } from '@/lib/inMemoryDataSource';
import { createHttpDataSource } from '@/lib/serverRowModel';
import type { ColumnDefinition, GridEdit } from '@/types/data-grid';

interface Order { id: number; region: string; status: string; amount: number; limit: number; active: boolean; date: string; }
const REGIONS = ['CA', 'NY', 'TX', 'FL'];
const columns: ColumnDefinition<Order>[] = [
  { field: 'id', headerText: 'ID', sortable: true, defaultWidth: 90 },
  { field: 'region', headerText: 'Region', sortable: true, filterable: true, filterType: 'select', editable: true, editor: 'select', editorOptions: REGIONS.map(value => ({ label: value, value })), filterOptions: REGIONS.map(value => ({ label: value, value })) },
  { field: 'status', headerText: 'Status', filterable: true, filterType: 'select', editable: true, editor: 'select', editorOptions: ['Draft', 'Approved'].map(value => ({ label: value, value })), filterOptions: ['Draft', 'Approved'].map(value => ({ label: value, value })) },
  { field: 'amount', headerText: 'Amount', sortable: true, filterable: true, filterType: 'number', editable: true, editor: 'number', aggregate: ['sum', 'avg'], validation: { required: true, min: 0, max: 1000000 } },
  { field: 'limit', headerText: 'Limit', sortable: true, filterable: true, filterType: 'number', editable: true, editor: 'number', validation: { required: true, min: 0 } },
  { field: 'active', headerText: 'Active', filterable: true, filterType: 'boolean', editable: true, editor: 'boolean' },
  { field: 'date', headerText: 'Date', sortable: true, filterable: true, filterType: 'date', editable: true, editor: 'date' },
];
const makeRow = (index: number): Order => ({ id: index + 1, region: REGIONS[index % 4], status: index % 3 ? 'Approved' : 'Draft', amount: 100 + index % 10000, limit: 20000, active: index % 5 !== 0, date: `2026-10-${String(index % 28 + 1).padStart(2, '0')}` });
const validate = (row: Order) => row.amount > row.limit ? { amount: 'Amount must not exceed Limit.' } : null;
function applyChanges(rows: Order[], edits: GridEdit<Order>[]) {
  const changes = new Map<number | string, Partial<Order>>();
  edits.forEach(edit => changes.set(edit.rowId, { ...changes.get(edit.rowId), [edit.field]: edit.value }));
  return rows.map(row => changes.has(row.id) ? { ...row, ...changes.get(row.id) } : row);
}

export default function WorkflowsPage() {
  const [rows, setRows] = React.useState(() => Array.from({ length: 500 }, (_, i) => makeRow(i)));
  const [saveCount, setSaveCount] = React.useState(0);
  const [rejectNextSave, setRejectNextSave] = React.useState(false);
  const previewRows = React.useRef<Order[]>([]);
  if (!previewRows.current.length) previewRows.current = Array.from({ length: 25000 }, (_, i) => makeRow(i));
  const previewSource = React.useMemo(() => createInMemoryDataSource(() => previewRows.current, columns), []);
  const [endpoint, setEndpoint] = React.useState('http://127.0.0.1:9010');
  const [connectedEndpoint, setConnectedEndpoint] = React.useState('');
  const remoteSource = React.useMemo(() => connectedEndpoint ? createHttpDataSource<Order>(`${connectedEndpoint}/rows`) : previewSource, [connectedEndpoint, previewSource]);
  const saveRemote = async (edits: GridEdit<Order>[]) => {
    if (!connectedEndpoint) { previewRows.current = applyChanges(previewRows.current, edits); return; }
    const response = await fetch(`${connectedEndpoint}/edits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edits) });
    if (!response.ok) throw new Error(`Save failed (${response.status}).`);
    return response.json();
  };

  return <main className="mx-auto max-w-[1400px] space-y-10 px-6 py-8">
    <header><a className="text-sm underline" href="../">Back to Fancy UI Grid</a><h1 className="mt-3 text-3xl font-bold">Editing and server data</h1><p className="mt-2 text-muted-foreground">Review bulk changes, validate business rules, and explore data loaded on demand.</p></header>
    <section aria-label="Batch editing demo" className="space-y-3">
      <h2 className="text-xl font-semibold">Review before you save</h2>
      <p className="text-sm text-muted-foreground">Edit or paste into 500 rows. Amount must be non-negative and cannot exceed Limit. Pending values stay in the grid until you save or discard them.</p>
      <div className="flex flex-wrap items-center gap-4 text-sm"><span>Saved batches: {saveCount}</span><span>Committed amount: {rows.reduce((sum, row) => sum + row.amount, 0).toLocaleString()}</span><label className="flex items-center gap-2"><input type="checkbox" checked={rejectNextSave} onChange={event => setRejectNextSave(event.target.checked)} />Simulate a failed save</label></div>
      <DataGrid data={rows} columnDefs={columns} editMode="batch" validateRow={validate} virtualized virtualizedMaxHeight={420}
        storageKey="workflow-batch-v1" enableFloatingFilters enableFormulaColumns={false} enableGroupingPanel
        onBatchSave={async edits => {
          await new Promise(resolve => setTimeout(resolve, 250));
          if (rejectNextSave) { setRejectNextSave(false); throw new Error('Demo save failed. Your draft is intact; try Save all again.'); }
          setRows(previous => applyChanges(previous, edits)); setSaveCount(count => count + 1);
        }} />
    </section>
    <section aria-label="Server data demo" className="space-y-3">
      <h2 className="text-xl font-semibold">Explore a large dataset</h2>
      <p className="text-sm text-muted-foreground">The preview simulates a server with 25,000 rows. Connect the SQLite example for one million database records. Use Views to try grouping or pivoting; totals cover all matching records.</p>
      <div className="flex flex-wrap items-center gap-2"><Input className="max-w-xs" aria-label="Backend address" value={endpoint} onChange={event => setEndpoint(event.target.value)} /><Button onClick={() => setConnectedEndpoint(endpoint.replace(/\/$/, ''))}>Connect SQLite</Button><Button variant="outline" onClick={() => setConnectedEndpoint('')}>Use preview</Button><span className="text-sm">{connectedEndpoint ? 'SQLite database' : 'Browser preview'}</span></div>
      <DataGrid data={[]} columnDefs={columns} dataSource={remoteSource} serverRowModelOptions={{ blockSize: 100, maxCachedBlocks: 6, maxConcurrentRequests: 2 }}
        storageKey="workflow-server-v1" enableGroupingPanel enableFloatingFilters enablePivotToggle enableFormulaColumns={false}
        editMode="batch" onBatchSave={saveRemote} validateRow={validate}
        savedViews={[
          { id: 'regions', name: 'Regions with totals', state: { groupedBy: ['region'], pivotMode: false } },
          { id: 'region-status', name: 'Region by status', state: { groupedBy: ['region'], pivotMode: true, pivotColumns: ['status'], pivotValues: [{ field: 'amount', aggregate: 'sum' }, { field: 'amount', aggregate: 'avg' }] } },
          { id: 'all-orders', name: 'All orders', state: { groupedBy: [], pivotMode: false, columnFilters: {}, globalFilter: '', multiSortConfig: [] } },
        ]} />
    </section>
  </main>;
}
