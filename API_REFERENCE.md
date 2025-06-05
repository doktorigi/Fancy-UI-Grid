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
| `filterType`        | `'text' \| 'number' \| 'date' \| 'select' \| 'boolean'` | `undefined` | Specifies the type of filter UI to render if `filterable` is true.                                                                  |
| `filterOptions`     | `{ label: string, value: any }[]`         | `undefined` | An array of options for `select` type filters. If not provided for a 'select' filter, unique values from the column will be used.          |
| `hideable`          | `boolean`                                 | `true`      | If true (default), this column can be hidden via the Column Visibility Toggle. Set to `false` to prevent hiding.                           |
| `editable`          | `boolean`                                 | `false`     | If true, cells in this column can be edited by the user (double-click or Enter/F2). Requires `onCellEdit` prop on `DataGrid`.            |
| `pinned`            | `'left' \| 'right' \| null`               | `null`      | Pins the column to the specified side. Pinned columns remain visible during horizontal scrolling.                                         |
| `groupable`         | `boolean`                                 | `true`      | If true (default), this column can be dragged to the grouping panel (if `enableGroupingPanel` is true on `DataGrid`).                        |
| `headerRenderer`    | `() => React.ReactNode`                   | `undefined` | A function that returns a React node to render custom content in the column header, instead of just `headerText`.                             |
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

### `select`
*   Dropdown select for filtering by specific values.
*   Populated by `filterOptions` or unique values from the column.

### `boolean`
*   Dropdown select with "Any", "Yes", "No" options.

## State Persistence

The grid automatically persists the following states to `localStorage` under the key `ngxMatDataGridState`:
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
