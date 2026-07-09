# Fancy UI Grid

A feature-rich, open-source React data grid built with Next.js, ShadCN UI components, and Tailwind CSS. Designed to be highly customizable and performant, inspired by enterprise-grade data grids — free under the MIT license.

## Features

* **Column Sorting** — click column headers to sort data.
* **Row Selection** — checkboxes per row, plus "select all on page".
* **Column Resizing** — drag header borders to resize columns.
* **Global Search (Quick Filter)** — filter across all visible columns.
* **Per-Column Filtering** — Text, Numeric (`=`, `!=`, `<`, `<=`, `>`, `>=`, `between`), Date (presets like "Today", "Last 7 days", plus custom ranges), Multi-Select, and Boolean filter types in a popover UI.
* **Clear All Filters** — one-click button showing the active filter count.
* **Cell Editing** — double-click or Enter/F2 on editable cells.
* **Custom Cell Renderers** — supply a `cellRenderer` per column to render anything: formatted currency, badges, action buttons, etc.
* **Column Pinning** — pin columns left or right; they stay visible during horizontal scroll.
* **Column Reordering** — drag and drop unpinned column headers.
* **Column Visibility Toggle** — show/hide columns from a dropdown.
* **Pagination** — first/prev/next/last controls with selectable page size.
* **Row Grouping** — drag a column header to the grouping panel to group rows, with expand/collapse.
* **Group Aggregations** — declare `aggregate: 'sum' | 'avg' | 'min' | 'max' | 'count'` on a column and the group header shows the computed value.
* **Tree Data** — render hierarchical parent/child data with expand/collapse and indentation.
* **Copy to Clipboard** — Ctrl/Cmd+C copies the focused cell, or all selected rows (with headers) as tab-separated text ready to paste into a spreadsheet.
* **Export to CSV & XLSX** — exports the current filtered/sorted view, with CSV formula-injection protection.
* **Grid State Persistence** — column widths, order, pins, filters, sort, page size, visibility, and grouping are saved to `localStorage` (configurable key per grid instance).
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
| Space | Select/deselect row, or toggle tree node / group |
| Enter / F2 | Edit the focused cell (if editable) |
| Escape | Cancel editing |
| Ctrl/Cmd + C | Copy focused cell, or selected rows as TSV |

## Contributing

Issues and pull requests are welcome. Run `npm run typecheck` and `npm run build` before submitting — both must pass.

## License

[MIT](LICENSE) — free for personal and commercial use.
