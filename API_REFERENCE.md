# API Reference: DataGrid Component

This document provides an API reference for the `<DataGrid />` component and its related types, primarily `ColumnDefinition`.

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
| `sortable`          | `boolean`                                 | `false`     | If true, allows users to sort the grid by this column by clicking the header.                                                                 |
| `filterable`        | `boolean`                                 | `false`     | If true, enables filtering UI for this column.                                                                                                |
| `filterType`        | `'text' \| 'number' \| 'date' \| 'date-tree' \| 'select' \| 'boolean'` | `undefined` | Specifies the type of filter UI to render if `filterable` is true.                                                                  |
| `filterOptions`     | `{ label: string, value: any }[]`         | `undefined` | An array of options for `select` type filters. If not provided for a 'select' filter, unique values from the column will be used.          |
| `dateTreeBuckets`   | `{ year: string, months: string[] }[]`    | `undefined` | Year/month buckets for `date-tree` filters. Auto-derived from the column's data (expects `YYYY-MM-...` strings) when not supplied.          |
| `hideable`          | `boolean`                                 | `true`      | If true (default), this column can be hidden via the Column Visibility Toggle. Set to `false` to prevent hiding.                           |
| `editable`          | `boolean`                                 | `false`     | If true, cells in this column can be edited by the user (double-click or Enter/F2). Requires `onCellEdit` prop on `DataGrid`.            |
| `pinned`            | `'left' \| 'right' \| null`               | `null`      | Pins the column to the specified side. Pinned columns remain visible during horizontal scrolling.                                         |
| `groupable`         | `boolean`                                 | `true`      | If true (default), this column can be dragged to the grouping panel (if `enableGroupingPanel` is true on `DataGrid`).                        |
| `headerRenderer`    | `() => React.ReactNode`                   | `undefined` | A function that returns a React node to render custom content in the column header, instead of just `headerText`.                             |
| `cellRenderer`      | `(value: any, row: TData) => React.ReactNode` | `undefined` | Renders custom cell content (formatted values, badges, action buttons, ...). Takes precedence over built-in cell rendering; not applied to the tree expander column or while a cell is being edited. |
| `aggregate`         | `'sum' \| 'avg' \| 'min' \| 'max' \| 'count'` | `undefined` | When rows are grouped, the group header row shows this aggregate computed over the group's rows for this column.                          |
| `defaultWidth`      | `string \| number`                        | `150px`     | The default width of the column (e.g., `'200px'` or `200`).                                                                                   |
| `minWidth`          | `string \| number`                        | `50px`      | The minimum width the column can be resized to (e.g., `'100px'` or `100`).                                                                   |
| `resizable`         | `boolean`                                 | `true`      | If true (default), the column's width can be changed by dragging its header border.                                                            |
| `reorderable`       | `boolean`                                 | `true`      | If true (default), the column can be reordered by dragging its header (applies to unpinned columns).                                         |
| `iconName`          | `string`                                  | `undefined` | Name of a Lucide icon (e.g., 'Users', 'Mail') to display in the column header.                                                                |


## Filter Types

### `text`
*   Simple text input for substring matching.

### `number`
*   Input for numeric values.
*   Supports operators: `=`, `!=`, `<`, `<=`, `>`, `>=`, `between`.
*   The `between` operator shows two input fields for min and max values.

### `date`
*   Allows filtering by date.
*   Offers predefined ranges: "Any Date", "Today", "Yesterday", "Last 7 Days", "Last 30 Days", "This Month", "Last Month".
*   Supports a "Custom Range" option with start and end date pickers.

### `date-tree`
*   Hierarchical year → month checkbox tree derived from the column's `YYYY-MM-...` values.
*   Checking a year selects all of its months; an indeterminate state shows partial selections.
*   Buckets are matched on the raw `YYYY-MM` string prefix, so timezone shifts can never move a value into the wrong bucket.

### `select`
*   Searchable multi-select checkbox list for filtering by specific values.
*   Populated by `filterOptions` or unique values from the column.
*   A type-to-filter box narrows the visible options; any number of values can be checked (a row passes if it matches any checked value).

### `boolean`
*   Dropdown select with "Any", "Yes", "No" options.

## Clipboard

With the grid focused, **Ctrl/Cmd+C** copies (first match wins):
*   The selected cell range (if it spans more than one cell) as tab-separated text.
*   All selected rows (if any) as tab-separated text with a header row — paste-ready for Excel/Sheets.
*   Otherwise, the value of the focused cell.

## Range Selection

When `enableRangeSelection` is on (default), a rectangular cell range can be selected by dragging across cells, Shift+clicking a second corner, or extending with Shift+arrow keys. Escape clears the range. Group header rows inside a range are skipped when copying. The range is defined over the rows/columns as currently displayed, so it resets whenever filtering, sorting, pagination, or grouping changes the display list.

## Context Menu

When `enableContextMenu` is on (default), right-clicking a cell opens a menu with:
*   **Copy** / **Copy with Headers** — the current range (or the clicked cell), honoring the clipboard precedence above.
*   **Copy Row** — the clicked row's visible columns as TSV.
*   **Pin Column Left / Right / Unpin Column** — pin state of the clicked column.
*   **Hide Column** — hides the clicked column (when `hideable` isn't `false`).
*   **Export as CSV / XLSX** — same as the toolbar export (current filtered + sorted view).

## Master-Detail

Pass `detailRenderer={(row) => <YourPanel row={row} />}` to add an expander column. Expanding a row inserts a full-width panel under it rendering arbitrary React content. Notes:
*   Detail expansion is transient — it is not persisted to `localStorage`.
*   With `virtualized`, panels get a fixed height of `detailRowHeight` px (scrolling internally if needed) so the window math stays exact; without virtualization they auto-size.
*   Works alongside row selection, grouping, pinned columns, and `getRowStyle`.

## State Persistence

The grid automatically persists the following states to `localStorage` under the key given by the `storageKey` prop (default `ngxMatDataGridState`):
*   Column widths
*   Column order (for unpinned columns)
*   Pinned columns (left and right)
*   Active column filters
*   Sort configuration (field and direction)
*   Selected page size
*   Expanded row IDs (for tree data)
*   Visible columns (from the column visibility toggle)
*   Grouped by columns (from the grouping panel)
*   Expanded group keys

This state is loaded when the grid initializes.
