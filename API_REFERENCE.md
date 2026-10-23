# API Reference: DataGrid Component

This document provides an API reference for the `<DataGrid />` component and its related types, primarily `ColumnDefinition`.

## Batch editing and lazy server data

See [advanced workflows](docs/advanced-workflows.md) for complete request/response types, editor/validation contracts, SQLite examples, and supported combinations.

| Prop | Default | Behavior |
| --- | --- | --- |
| `editMode` | `'cell'` | `'batch'` stages changes until Save all succeeds. |
| `onBatchSave(edits)` | — | One sync/async callback receiving `GridEdit[]` with `rowId`, `field`, `oldValue`, `value`. Return void/{} to succeed, or `{ errors?, message? }` to reject. |
| `validateRow(row)` | — | Return a row error string, field-error map, or null. |
| `onPendingEditsChange(edits)` | — | Receives the current coalesced draft. |
| `dataSource` | — | `getRows(request, signal)` returns `Promise<ServerRowsResult>`. Enables lazy virtual scrolling. |
| `serverRowModelOptions` | `{ blockSize: 100, maxCachedBlocks: 10, maxConcurrentRequests: 4 }` | Global cache and request limits. |
| `dataSourceVersion` | — | Change after external writes to invalidate cached rows. |

New `ColumnDefinition` options: `editor` (`text` / `number` / `date` / `boolean` / `select`), `editorOptions`, `cellEditor`, `validation`, and `validate(value, row)`. Column validation accepts `required`, `min`, `max`, `minLength`, `maxLength`, and regex `pattern`.

## `<DataGrid />` Component Props

The `DataGrid` component is highly configurable through its props.

| Prop                 | Type                                                                 | Default        | Description                                                                                                                               |
| -------------------- | -------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `data`               | `TData[]`                                                            | - (Required)   | Array of data objects to display. `TData` should extend `HierarchicalData`.                                                               |
| `columnDefs`         | `ColumnDefinition<TData>[]`                                          | - (Required)   | Array of column definition objects.                                                                                                       |
| `defaultPageSize`    | `number`                                                             | `10`           | Initial number of items per page.                                                                                                         |
| `pageSizeOptions`    | `number[]`                                                           | `[10,25,50,100]` | Array of page size options for the dropdown in the pagination control.                                                                    |
| `enableRowSelection` | `boolean`                                                            | `true`         | If true, checkboxes are rendered for row selection.                                                                                       |
| `onCellEdit`         | `(rowId: string \| number, field: keyof TData & string, value: any) => void` | `undefined`    | Callback function triggered when a cell's value is successfully edited and committed.                                                         |
| `isTreeData`         | `boolean`                                                            | `false`        | If true, enables tree data rendering mode. Expects `children` property in `TData` items.                                                |
| `treeColumn`         | `keyof TData & string`                                               | First col field| Specifies which column should display tree expander controls and indentation. Defaults to the `field` of the first column definition. |
| `enableGroupingPanel`| `boolean`                                                            | `false`        | If true, displays the column grouping panel above the grid.                                                                             |
| `enableFloatingFilters` | `boolean`                                                         | `false`        | If true, renders an inline quick-filter row directly beneath column headers (also toggleable via the toolbar **Quick Filters** button). |
| `pivotMode`          | `boolean`                                                            | `false`        | If true, enables interactive Pivot Table Mode with cross-tabulated dynamic columns, value aggregations, and Row + Column Grand Totals. |
| `enablePivotToggle`  | `boolean`                                                            | Auto           | Shows the **Pivot Mode** toggle button in the toolbar (defaults to `true` when `enableGroupingPanel` or `pivotMode` is enabled).       |
| `pivotColumns`       | `(keyof TData & string)[]`                                           | `[]`           | Initial columns whose distinct values are pivoted into dynamic column headers.                                                            |
| `pivotValues`        | `PivotValueConfig<TData>[]`                                          | Derived        | Array of `{ field, aggregate, headerText? }` metrics for pivot cells. Defaults to columns that define `aggregate`.                        |
| `density`            | `'compact' \| 'normal' \| 'comfortable'`                             | `'normal'`     | Initial row density controlling cell padding, font sizing, and default virtualized row height (`32px`, `48px`, `58px`).                   |
| `enableDensitySelector` | `boolean`                                                         | `true`         | Shows the row density switcher dropdown in the toolbar.                                                                                   |
| `onDensityChange`    | `(density: GridDensity) => void`                                     | `undefined`    | Callback fired when the user switches row density.                                                                                        |
| `enableSavedViews`   | `boolean`                                                            | `true`         | Shows the **Views** preset manager in the toolbar to save, load, update, and delete named grid snapshots.                                 |
| `savedViews`         | `GridViewPreset<TData>[]`                                            | `[]`           | Built-in or initial named view presets (`{ id, name, state }`) merged with user-saved views in `localStorage`.                            |
| `onSavedViewsChange` | `(views: GridViewPreset<TData>[]) => void`                           | `undefined`    | Callback fired when user-saved views are added, updated, or deleted.                                                                      |
| `enableFormulaColumns` | `boolean`                                                          | `true`         | Shows the **Formulas** calculated column builder in the toolbar.                                                                          |
| `formulaColumns`     | `FormulaColumnConfig[]`                                              | `[]`           | Initial or controlled calculated formula columns (`{ field, headerText, formula, aggregate?, filterType? }`).                             |
| `onFormulaColumnsChange` | `(columns: FormulaColumnConfig[]) => void`                       | `undefined`    | Callback fired when formula columns are added, edited, or removed via the toolbar.                                                        |
| `storageKey`         | `string`                                                             | `'ngxMatDataGridState'` | The `localStorage` key used for state persistence. Set a unique key per grid instance so multiple grids don't overwrite each other's saved state. |
| `virtualized`        | `boolean`                                                            | `false`        | If true, pagination is replaced with windowed (virtualized) rendering inside a scrollable viewport — suitable for tens of thousands of rows.   |
| `rowHeight`          | `number`                                                             | `44`           | Fixed row height in px used by the virtualization window math. Only used when `virtualized` is true.                                          |
| `virtualizedMaxHeight` | `number`                                                           | `500`          | Height (px) of the scroll viewport when `virtualized` is true.                                                                               |
| `detailRenderer`     | `(row: TData) => React.ReactNode`                                    | `undefined`    | Enables master-detail: an expander column is added and each expanded row shows a full-width panel rendered by this function.                  |
| `detailRowHeight`    | `number`                                                             | `300`          | Fixed detail panel height (px) used by the virtualization window math; the panel scrolls internally if its content is taller. Panels auto-size when not virtualized. |
| `enableRangeSelection` | `boolean`                                                          | `true`         | Excel-style rectangular cell range selection via mouse drag, Shift+click, or Shift+arrow keys. Ctrl/Cmd+C copies the range as TSV.            |
| `enableContextMenu`  | `boolean`                                                            | `true`         | Right-click context menu on cells: copy (cell/range/row, with headers), pin/unpin column, hide column, export CSV/XLSX.                       |
| `getRowStyle`        | `(row: TData) => React.CSSProperties \| undefined`                   | `undefined`    | Returns inline styles for a data row (e.g. a status background color). A returned `backgroundColor` is also applied to that row's pinned cells so the color isn't masked during horizontal scroll. |
| `onFilteredDataChange` | `(rows: TData[]) => void`                                          | `undefined`    | Fires with the filtered + sorted data rows (group headers excluded) whenever they change — useful for driving external KPIs/summaries.         |
| `globalFilterFields` | `(keyof TData & string)[]`                                           | `undefined`    | Restricts the global search box to these fields. Omit to search all visible columns.                                                          |
| `globalFilterPlaceholder` | `string`                                                        | `'Search all columns...'` | Placeholder text for the global search box.                                                                                          |
| `serverSide`         | `boolean`                                                            | `false`        | If true, disables client-side filtering, sorting, and slicing; grid relies on host/server data responses.                              |
| `totalRowCount`      | `number`                                                             | `undefined`    | Total row count across all pages when `serverSide` is enabled.                                                                           |
| `onServerParamsChange` | `(params: { page, pageSize, sortConfig, multiSortConfig, columnFilters, globalFilter }) => void` | `undefined` | Callback fired whenever pagination, single/multi-column sorting, or filtering state changes in `serverSide` mode. |
| `conditionalFormats` | `ConditionalFormatRule<TData>[]`                                     | `undefined`    | Array of declarative conditional formatting rules (operators, custom styles, color scales, data bars).                                  |

### `TData` Type Constraint

The generic type `TData` used in `data` and `columnDefs` must extend `HierarchicalData<TData>`. The `HierarchicalData` interface requires:

```typescript
interface HierarchicalData<TData = any> {
  id: string | number; // Unique identifier for the row
  children?: HierarchicalData<TData>[]; // Optional array of child items for tree data
  [key: string]: any; // Allows for other properties
}
```

## `ColumnDefinition<TData>` Structure

Each object in the `columnDefs` prop array defines a column in the grid.

| Property            | Type                                      | Default     | Description                                                                                                                                   |
| ------------------- | ----------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `field`             | `keyof TData & string`                    | - (Required)| The key in your `TData` object that this column should display data from.                                                                     |
| `headerText`        | `string`                                  | - (Required)| The text to display in the column header.                                                                                                     |
| `sortable`          | `boolean`                                 | `false`     | If true, allows users to sort the grid by this column by clicking the header (or Shift+clicking for multi-column sort).                       |
| `filterable`        | `boolean`                                 | `false`     | If true, enables filtering UI for this column (both in the header popover and in the Floating Filter Row).                                   |
| `filterType`        | `'text' \| 'number' \| 'date' \| 'date-tree' \| 'select' \| 'boolean'` | `undefined` | Specifies the type of filter UI to render if `filterable` is true.                                                                  |
| `filterOptions`     | `{ label: string, value: any }[]`         | `undefined` | An array of options for `select` type filters. If not provided for a 'select' filter, unique values from the column will be used.          |
| `dateTreeBuckets`   | `{ year: string, months: string[] }[]`    | `undefined` | Year/month buckets for `date-tree` filters. Auto-derived from the column's data (expects `YYYY-MM-...` strings) when not supplied.          |
| `hideable`          | `boolean`                                 | `true`      | If true (default), this column can be hidden via the Column Visibility Toggle. Set to `false` to prevent hiding.                           |
| `editable`          | `boolean`                                 | `false`     | If true, cells in this column can be edited by the user (double-click or Enter/F2). Requires `onCellEdit` prop on `DataGrid`.            |
| `pinned`            | `'left' \| 'right' \| null`               | `null`      | Pins the column to the specified side. Pinned columns remain visible during horizontal scrolling.                                         |
| `groupable`         | `boolean`                                 | `true`      | If true (default), this column can be dragged to the grouping panel or used as a Row Group in Pivot Mode.                                  |
| `pivotable`         | `boolean`                                 | `true`      | If true (default), this column can be used as a cross-tab Pivot Column in Pivot Mode.                                                        |
| `headerRenderer`    | `() => React.ReactNode`                   | `undefined` | A function that returns a React node to render custom content in the column header, instead of just `headerText`.                             |
| `cellRenderer`      | `(value: any, row: TData) => React.ReactNode` | `undefined` | Renders custom cell content (formatted values, badges, action buttons, ...). Takes precedence over built-in cell rendering; not applied to the tree expander column or while a cell is being edited. |
| `aggregate`         | `AggregateFunction \| AggregateFunction[]`| `undefined` | Single function (`'sum' \| 'avg' \| 'min' \| 'max' \| 'count'`) or array of metrics computed over grouped rows, footer totals, and default pivot values. |
| `defaultWidth`      | `string \| number`                        | `150px`     | The default width of the column (e.g., `'200px'` or `200`).                                                                                   |
| `minWidth`          | `string \| number`                        | `50px`      | The minimum width the column can be resized to (e.g., `'100px'` or `100`).                                                                   |
| `resizable`         | `boolean`                                 | `true`      | If true (default), the column's width can be changed by dragging its header border.                                                            |
| `reorderable`       | `boolean`                                 | `true`      | If true (default), the column can be reordered by dragging its header (applies to unpinned columns).                                         |
| `iconName`          | `string`                                  | `undefined` | Name of a Lucide icon (e.g., 'Users', 'Mail') to display in the column header.                                                                |
| `formula`           | `string`                                  | `undefined` | Excel-style formula expression evaluated per row (e.g., `"=ROUND(([newPrice] - [oldPrice]) / [oldPrice] * 100, 1)"`).                         |


## Column Formulas & Calculated Columns

Columns can compute their values dynamically via `ColumnDefinition.formula` or via the toolbar **Formulas** builder (`formulaColumns`):
*   **Field References**: Use `[fieldName]` (or bare identifiers) to reference any row field or another formula column.
*   **Functions**: `IF`, `IFS`, `IFERROR`, `COALESCE`, `ROUND`, `FLOOR`, `CEIL`, `ABS`, `SQRT`, `POW`, `MOD`, `MIN`, `MAX`, `SUM`, `AVG`, `CONCAT`, `UPPER`, `LOWER`, `TRIM`, `LEN`, `LEFT`, `RIGHT`, `AND`, `OR`, `NOT`, `ISBLANK`, `ISNUMBER`.
*   **Safety**: Evaluated by a deterministic AST parser (`src/lib/formulaEngine.ts`) without `eval`/`Function`, with automatic cycle detection (`#CYCLE!`) and division-by-zero handling (`#DIV/0!`).

## Saved Views & Row Density Switcher

*   **Saved Views (`enableSavedViews`, `savedViews`)**: Captures and restores a `GridViewStateSnapshot` containing `globalFilter`, `columnFilters`, `multiSortConfig`, `groupedBy`, `visibleColumns`, `columnOrder`, `pinnedColumns`, `columnWidths`, `pivotMode`, `pivotColumns`, `pivotValues`, `floatingFiltersOpen`, `density`, `pageSize`, and `formulaColumns`.
*   **Row Density (`density`, `enableDensitySelector`)**: Switches between `compact` (`32px`), `normal` (`48px`), and `comfortable` (`58px`) row spacing.


## Multi-Column Sorting

*   **Click** a sortable column header to cycle single-column sorting: `asc → desc → unsorted`.
*   **Shift + Click** additional column headers to build a multi-column sort hierarchy. Each sorted column header displays an arrow (`↑` / `↓`) along with its 1-based priority badge (`1`, `2`, `3`…).
*   Shift+clicking an already sorted column toggles `asc → desc → removed` without disturbing the priority order of other sorted columns.

## Floating Filter Row (Quick Filters)

When `enableFloatingFilters` is `true` (or toggled on via the toolbar **Quick Filters** button):
*   `text` columns render an instant substring input.
*   `number` columns accept plain numbers (`42`), operator prefixes (`>100`, `<=50`, `!=0`), or ranges (`10..50`, `10 - 50`).
*   `select`, `boolean`, `date`, and `date-tree` columns render compact inline `<select>` controls synchronized with the column filter popovers.

## Interactive Pivot Table Mode

When `pivotMode` is `true` (or toggled via the toolbar **Pivot Mode** button):
*   The **Pivot Configuration Panel** appears above the toolbar with three interactive zones: **Rows** (row group dimensions), **Columns** (cross-tabulated header dimensions), and **Values** (aggregated measures with selectable `Sum`, `Avg`, `Min`, `Max`, or `Count`).
*   Distinct values of the Pivot Columns generate dynamic cross-tab columns grouped under spanning headers, plus a **Row Totals** summary column group and a **Grand Total** footer row computed over the underlying filtered dataset.
