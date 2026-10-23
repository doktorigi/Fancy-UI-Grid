# Batch editing and server datasets

Run `npm run dev`, then open `/workflows` for both interactive examples. The repricing app also stages premium edits before saving.

## Batch editing

```tsx
const columns: ColumnDefinition<Order>[] = [
  { field: 'amount', headerText: 'Amount', editable: true, editor: 'number',
    validation: { required: true, min: 0 } },
  { field: 'status', headerText: 'Status', editable: true, editor: 'select',
    editorOptions: [{ label: 'Draft', value: 'draft' }, { label: 'Approved', value: 'approved' }] },
];

<DataGrid
  data={rows}
  columnDefs={columns}
  editMode="batch"
  validateRow={row => row.amount > row.limit
    ? { amount: 'Amount must not exceed Limit.' } : null}
  onBatchSave={async edits => {
    // edits: [{ rowId, field, oldValue, value }]
    const response = await saveOrderChanges(edits);
    if (response.errors?.length) return response;
    setRows(response.rows);
  }}
/>
```

Inline edits, paste, and fill use the same draft and validation path. Repeated changes to one cell coalesce, retaining the original value; reverting to that value removes the pending change. Undo/redo works on draft operations, including a whole paste or fill. Formulas in local grids recalculate from the draft.

The toolbar shows pending changes and validation errors. **Review changes** displays original and pending values in pages of 50. Discard individual cells or the whole draft. Save submits one callback, locks editing while it is pending, and clears the draft and undo history only on success. Throwing, returning `{ message: '...' }`, or returning `{ errors: [...] }` preserves the draft. Errors use `{ rowId, field?, message }`; omitting `field` reports a row error.

The callback owns persistence. Update local `data` before resolving. With a datasource, successful saves invalidate its cache and reload from the top. A local `onCellEdit` callback is not called in batch mode. A batch callback is required to enable editing in React batch mode.

`oldValue` supports optimistic concurrency checks. A changed value in fresh `data` is flagged as a conflict; a backend must check unloaded rows too. Drafts survive filtering, paging, and cache eviction. They are intentionally held only in memory, not in saved views or localStorage. A backend should validate and commit the whole batch atomically; the SQLite example demonstrates this.

### Editors and validation

| Column option | Behavior |
| --- | --- |
| `editor` | `text`, `number`, `date`, `boolean`, or `select`. Number, boolean, and date types can be inferred from `filterType`. |
| `editorOptions` | Select options `{ label, value }`; string, numeric, and boolean values retain their types. |
| `validation` | `required`, `min`, `max`, `minLength`, `maxLength`, and regex `pattern`. |
| `validate(value, row)` | Synchronous custom cell validation; return an error string or null. |
| `cellEditor` | React component receiving `{ value, row, column, onChange, onCommit, onCancel }`. |

`validateRow(row)` returns a string, a map of field names to messages, or null. Validation sees all pending changes in the row, so a paste can update interdependent fields together. Invalid pasted values remain visible with an explanation. Dates use `YYYY-MM-DD`; booleans accept true/false or 1/0 from clipboard text. `onPendingEditsChange(edits)` lets a host display draft counts elsewhere.

Existing immediate editing remains the default (`editMode="cell"`, `onCellEdit`). It also supports the new editors and validation; an invalid operation does not reach the callback.

## Server-side row model

```tsx
import { createHttpDataSource } from '@/lib/serverRowModel';

const source = useMemo(() => createHttpDataSource<Order>('/api/orders/rows'), []);

<DataGrid
  data={[]}
  columnDefs={columns}
  dataSource={source}
  serverRowModelOptions={{ blockSize: 100, maxCachedBlocks: 10, maxConcurrentRequests: 4 }}
  enableGroupingPanel
  enablePivotToggle
/>
```

A datasource implements `getRows(request, signal): Promise<ServerRowsResult>`. Keep its identity stable (for example, with `useMemo`). The HTTP helper POSTs JSON and passes the abort signal to `fetch`. Options can supply request headers/credentials. A changed `dataSourceVersion` or **Refresh data** invalidates the cache. Sorting, filtering, grouping, and pivot changes create a fresh query, abort old requests, and ignore late responses.

### Request

```json
{
  "startRow": 0,
  "endRow": 100,
  "groupKeys": ["CA"],
  "rowGroupColumns": ["region"],
  "sortModel": [{ "field": "amount", "direction": "desc" }],
  "filterModel": { "active": { "type": "boolean", "value": true } },
  "globalFilter": "",
  "globalFilterFields": ["region", "amount"],
  "pivotMode": false,
  "pivotColumns": [],
  "valueColumns": [{ "field": "amount", "aggregate": "sum" }]
}
```

Ranges are zero-based, start-inclusive/end-exclusive, within the requested group route. An empty `groupKeys` requests root rows. Return one group row per distinct key when the route is shorter than `rowGroupColumns`; expanding a group fetches the next level. Group keys may be strings, numbers, booleans, or null and must preserve their types.

### Response

```json
{
  "rows": [{ "data": { "id": 42, "region": "CA", "amount": 350 } }],
  "rowCount": 1,
  "aggregates": { "amount": { "sum": 350, "avg": 350 } }
}
```

`rowCount` is the exact filtered count at the requested level. Return exactly the requested block length, clipped at `rowCount`. Every record needs a stable, globally unique `data.id`. Group rows additionally include:

```json
{
  "data": { "id": "group:CA", "region": "CA" },
  "group": {
    "key": "CA",
    "childCount": 250000,
    "leafCount": 250000,
    "aggregates": { "amount": { "sum": 1274500000 } }
  }
}
```

`childCount` is optional and counts immediate children, while `leafCount` counts underlying records. Root aggregates cover **all filtered records**, not just the block. Group aggregates cover that group's records. Do not average averages; compute an average from the underlying records.

In pivot mode, return already pivoted rows, `pivotResultColumns` (serializable column definitions), and `grandTotalValues` keyed by generated column field. The schema must be identical for every block in the query. The backend handles sorting these generated fields. The SQLite example returns cross-tab columns, row totals, and grand totals.

The grid renders only a viewport plus a small buffer. It caches blocks globally across routes, deduplicates requests, limits concurrent fetching, and evicts least-recently-used blocks. The visible working set is retained even if it requires more than `maxCachedBlocks`; expanded group identities are retained separately. Errors have a Retry action. Scrollbar compression avoids browser element-height limits for million-row datasets.

### Scope and compatibility

- The older `serverSide` / `onServerParamsChange` controlled paging API remains available. `dataSource` opts into the new lazy model and virtual scrolling.
- The backend is authoritative for filtering, sorting, grouping, pivoting, aggregates, and calculated values. Use database views or backend expressions for calculated fields. The local formula builder is hidden in datasource mode.
- Remote totals describe committed data until a successful save reloads them. Cell selection, clipboard, charts, find, and export operate on the loaded viewport; full-dataset export belongs in the backend. Row selection retains explicit loaded row IDs; selecting all matching unloaded records is not implemented.
- Datasource rows have a fixed height. Client tree data, arbitrary-height master-detail panels, and drag row reordering are available in local mode. Remote hierarchy uses the group-route protocol.
- Refresh and query changes collapse remote groups and return to the top; pending edits remain available for review/save/discard.

## SQLite example with one million rows

```bash
pip install -e streamlit-component
python examples/sqlite_server.py --rows 1000000 --database grid-demo.db
npm run dev
```

Open `http://localhost:9002/workflows` and click **Connect SQLite**. The server binds to `127.0.0.1:9010`; `--origin` changes its permitted browser origin. It creates the database only when the table is empty. The `/rows` endpoint uses parameterized SQLite queries and server-owned column definitions for identifiers. `/edits` performs validation and old-value checks inside an all-or-nothing transaction. This is a local reference service; supply your application's authentication and authorization when adapting it.

The default browser preview uses `createInMemoryDataSource`, which simulates requests over 25,000 browser-held rows. It is a demonstration adapter, not the database scalability path.

## Streamlit

```python
from fancy_ui_grid import fancy_ui_grid
from fancy_ui_grid.server import SQLiteDataSource

source = SQLiteDataSource("orders.db", "orders", column_defs)
result = fancy_ui_grid(
    [], column_defs,
    data_source=source.get_rows,
    edit_mode="batch",
    on_batch_save=source.save_edits,
    server_row_model_options={"blockSize": 100, "maxCachedBlocks": 6},
    enable_grouping_panel=True,
    enable_pivot_toggle=True,
    key="orders",
)
```

`data_source` and `on_batch_save` are optional Python callables and require a unique `key`. The bridge pairs requests and responses by ID across reruns, retains a bounded response history, and does not replay an already handled save in that history. A rejected save returns its errors to the still-open draft. Python batch callbacks receive the same camelCase edits as React (`rowId`, `oldValue`, `field`, `value`). The existing returned `edits` list retains snake_case `row_id` for compatibility.

For a database primary key named something other than `id`, pass `id_field="order_id"` to `SQLiteDataSource` and include that field in the server column definitions. The adapter exposes its value as `data.id` and uses the original key for saves.

Without a Python save callback, Streamlit batch mode commits locally and reports all saved edits together; persistence remains the host's responsibility. `virtualized`, `viewport_height`, and `data_source_version` are also exposed. Run `streamlit run streamlit-component/server_example.py` for the complete SQLite integration.

## Verification

```bash
npm test
npm run typecheck
npm run test:browser
npm run build
npm --prefix streamlit-component/frontend run build
cd streamlit-component
python -m unittest test_server test_transport -v
python smoke_test.py
```

Install browser binaries once with `npx playwright install chromium`. To include the live million-row browser acceptance test, start the SQLite example and set `GRID_SQLITE_URL=http://127.0.0.1:9010` before `npm run test:browser`. That test checks the last row, a bounded rendered row count, filtering, lazy groups, and full-dataset pivot totals. It is a functional acceptance test, not a cross-device performance benchmark.

To exercise Python reruns and persistence in a real iframe, run `streamlit run streamlit-component/server_example.py --server.port 8503` and set `GRID_STREAMLIT_URL=http://localhost:8503` before running the browser tests. The Streamlit test rejects an invalid batch, corrects it, saves, refreshes, and restores the example record.
