# Fancy UI Grid

[![CI](https://github.com/doktorigi/Fancy-UI-Grid/actions/workflows/ci.yml/badge.svg)](https://github.com/doktorigi/Fancy-UI-Grid/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A feature-rich, open-source React data grid built with Next.js, ShadCN UI components, and Tailwind CSS. Designed to be highly customizable and performant, inspired by enterprise-grade data grids — free under the MIT license.

## Features

* **Column Sorting** — click column headers to sort data.
* **Row Selection** — checkboxes per row, plus "select all on page".
* **Column Resizing** — drag header borders to resize columns.
* **Global Search (Quick Filter)** — filter across all visible columns, or restrict it to specific fields with `globalFilterFields`.
* **Per-Column Filtering** — Text, Numeric (`=`, `!=`, `<`, `<=`, `>`, `>=`, `between`), Date (presets like "Today", "Last 7 days", plus custom ranges), searchable Multi-Select checkbox lists, Date Tree (year → month checkboxes), and Boolean filter types in a popover UI.
* **Row Styling** — `getRowStyle` callback returns inline styles per data row (e.g. status-colored rows); the background carries onto pinned cells so it isn't masked while scrolling.
* **Filtered Data Callback** — `onFilteredDataChange` fires with the filtered + sorted rows whenever they change, for external KPIs/summaries.
* **Clear All Filters** — one-click button showing the active filter count.
* **Cell Editing** — double-click or Enter/F2 on editable cells.
* **Custom Cell Renderers** — supply a `cellRenderer` per column to render anything: formatted currency, badges, action buttons, etc.
* **Column Pinning** — pin columns left or right; they stay visible during horizontal scroll.
* **Column Reordering** — drag and drop unpinned column headers.
* **Column Visibility Toggle** — show/hide columns from a dropdown.
* **Pagination** — first/prev/next/last controls with selectable page size.
* **Row Virtualization** — set `virtualized` and pagination is replaced by windowed rendering in a scrollable viewport; tens of thousands of rows scroll smoothly. Viewport height is configurable via `virtualizedMaxHeight`.
* **Master-Detail Rows** — supply a `detailRenderer` and every row gets an expander that opens a full-width detail panel (any React content). Works with virtualization via a fixed `detailRowHeight`.
* **Cell Range Selection** — Excel-style: drag across cells, Shift+click, or Shift+arrow keys to select a rectangular range; Ctrl/Cmd+C copies it as TSV.
* **Context Menu** — right-click any cell for Copy / Copy with Headers / Copy Row, pin/unpin or hide the column, and CSV/XLSX export.
* **Row Grouping** — drag a column header to the grouping panel to group rows, with expand/collapse.
* **Group Aggregations** — declare `aggregate: 'sum' | 'avg' | 'min' | 'max' | 'count'` on a column and the group header shows the computed value.
* **Tree Data** — render hierarchical parent/child data with expand/collapse and indentation.
* **Copy to Clipboard** — Ctrl/Cmd+C copies the focused cell, or all selected rows (with headers) as tab-separated text ready to paste into a spreadsheet.
* **Export to CSV & XLSX** — exports the current filtered/sorted view, with CSV formula-injection protection.
* **Grid State Persistence** — column widths, order, pins, filters, sort, page size, visibility, and grouping are saved to `localStorage` (configurable key per grid instance).
* **Fill Handle** — drag the square at the corner of a range selection to fill editable cells below/above/beside it: constant-step numeric sources extend as a series (1, 2 → 3, 4, …), everything else repeats. On by default when `onCellEdit` is provided (`enableFillHandle`).
* **Clipboard Paste** — Ctrl/Cmd+V pastes TSV (straight from Excel or another grid) into editable cells starting at the selection; a single copied value fills the whole selected range. On by default with `onCellEdit` (`enableClipboardPaste`).
* **Undo / Redo** — Ctrl/Cmd+Z and Ctrl/Cmd+Y (or Ctrl+Shift+Z) walk back and reapply grid-driven edits — inline edits, pastes, and fills each undo as one batch. On by default with `onCellEdit` (`enableUndoRedo`).
* **Status Bar** — slim footer with the filtered/total row count, selection count, and live **Sum / Avg / Min / Max / Count** for the selected cell range, Excel-style. On by default (`enableStatusBar`).
* **Column Header Groups** — give columns a `group: 'Premium'` label and contiguous runs render under one spanning header row; the Columns menu gains group-level show/hide checkboxes.
* **Find in Grid** — Ctrl/Cmd+F (or the Find button) opens a find bar that highlights matching cells across all pages, with next/previous navigation that jumps pages or scrolls the virtualized viewport. On by default (`enableFind`).
* **Row Drag Reorder** — set `enableRowReorder` with an `onRowsReordered` callback and each row gets a grip handle for drag-and-drop reordering; the handle deactivates while sorting or grouping is applied (the visual order wouldn't stick).
* **Range Charts (Chart Selection)** — select a cell range, right-click, and choose **Chart Selection…** to open a dialog charting the selected data: grouped bars, lines (with crosshair tooltip and direct end-labels), stacked area, or pie (single series; slices beyond 8 fold into "Other"). The first text column in the range becomes the category axis and every numeric column a series, colored from a CVD-validated 8-slot categorical palette (`--chart-1`…`--chart-8`, separate light/dark steps, fixed assignment order). Pure SVG — no chart library. Extraction/scale logic lives in `src/lib/rangeChart.ts`; disable with `enableRangeChart={false}`.
* **In-Cell Sparklines** — declare `sparkline: { type: 'line' | 'area' | 'bar' | 'winloss' }` on a column whose value is a `number[]` (or supply a `values` accessor) and the cell renders an inline SVG mini chart: 2px line with the latest point accented, zero-baseline bars, or sign-only win/loss blocks. Hovering shows a per-point tooltip (optional `labels` such as months, and a `format` callback). Colors default to the theme primary, with a CVD-validated blue/red pair for positives/negatives (`--sparkline-positive` / `--sparkline-negative`, separate light and dark values). Pure geometry lives in `src/lib/sparkline.ts`.
* **Comprehensive Keyboard Navigation** — arrow keys, Space to select/toggle, Enter/F2 to edit, Escape to cancel, Ctrl/Cmd+C to copy.
* **Theming** — Light, Dark, and System themes.

## Getting Started (run the demo)

```bash
git clone https://github.com/doktorigi/Fancy-UI-Grid.git
cd Fancy-UI-Grid
npm install
npm run dev
```

The demo app starts on `http://localhost:9002`. The grid is showcased in the "Repricing Results" view (`src/components/bulk-repricing/ResultsView.tsx`).

## Using the Grid in Your Own Project

The grid is distributed ShadCN-style: copy the source into your project rather than installing a package.

1. **Copy these files** into your Next.js/React + Tailwind project:
   * `src/components/data-grid/` (the whole folder)
   * `src/types/data-grid.ts`
   * `src/lib/utils.ts` and `src/lib/exportUtils.ts`
   * The grid-specific styles from `src/app/globals.css` (the `.sticky-header-cell`, `.sticky-body-cell`, `.pinned-*-shadow`, `.cell-focused`, `.group-header-row`, and column-drag rules)

2. **Install the npm dependencies** the grid uses:

   ```bash
   npm install date-fns xlsx lucide-react clsx tailwind-merge
   ```

3. **Add the ShadCN UI components** the grid builds on (skip any you already have):

   ```bash
   npx shadcn@latest add table input checkbox button dropdown-menu popover select calendar label skeleton avatar
   ```

4. **Use it:**

   ```tsx
   import { DataGrid } from '@/components/data-grid/DataGrid';
   import type { ColumnDefinition } from '@/types/data-grid';

   interface Person { id: number; name: string; age: number; salary: number; }

   const columns: ColumnDefinition<Person>[] = [
     { field: 'name', headerText: 'Name', sortable: true, filterable: true, filterType: 'text' },
     { field: 'age', headerText: 'Age', sortable: true, filterable: true, filterType: 'number', aggregate: 'avg' },
     {
       field: 'salary', headerText: 'Salary', sortable: true, aggregate: 'sum',
       cellRenderer: (value) => <span>${Number(value).toLocaleString()}</span>,
     },
   ];

   export default function People({ data }: { data: Person[] }) {
     return (
       <DataGrid<Person>
         data={data}
         columnDefs={columns}
         enableRowSelection
         enableGroupingPanel
         storageKey="peopleGrid"
       />
     );
   }
   ```

See [`API_REFERENCE.md`](API_REFERENCE.md) for every prop and column option.

## Using the Grid in Streamlit

The grid is also available as a Streamlit custom component — selection and cell edits flow back to Python:

```bash
pip install "git+https://github.com/doktorigi/Fancy-UI-Grid.git#subdirectory=streamlit-component"
```

```python
from fancy_ui_grid import fancy_ui_grid
result = fancy_ui_grid(data, column_defs, key="grid")  # data: list of dicts or DataFrame
```

See [`streamlit-component/README.md`](streamlit-component/README.md) for details.

## Keyboard Shortcuts

| Keys | Action |
| --- | --- |
| Arrow keys | Move cell focus |
| Shift + Arrow keys | Extend the cell range selection |
| Space | Select/deselect row, or toggle tree node / group |
| Enter / F2 | Edit the focused cell (if editable) |
| Escape | Cancel editing, or clear the range selection / context menu / find bar |
| Ctrl/Cmd + C | Copy the selected cell range, selected rows, or focused cell as TSV |
| Ctrl/Cmd + V | Paste TSV into editable cells at the selection |
| Ctrl/Cmd + Z | Undo the last grid-driven edit batch |
| Ctrl/Cmd + Y (or Ctrl+Shift+Z) | Redo |
| Ctrl/Cmd + F | Open find-in-grid (Enter = next match, Shift+Enter = previous) |

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and the [`good first issue` label](https://github.com/doktorigi/Fancy-UI-Grid/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).

## License

[MIT](LICENSE) — free for personal and commercial use.
