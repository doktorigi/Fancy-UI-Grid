# Next.js Feature-Rich Data Grid

This project is a feature-rich data grid component built with Next.js, React, ShadCN UI components, and Tailwind CSS. It's designed to be highly customizable and performant, inspired by enterprise-grade data grids.

## Getting Started

To get started with the project:

1.  Clone the repository (if applicable).
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```
    This will typically start the app on `http://localhost:9002`.

The main example and usage of the `DataGrid` component can be found in `src/app/page.tsx`.

## Features Implemented

The `DataGrid` component currently supports a wide range of features:

*   **Column Sorting:** Click column headers to sort data.
*   **Row Selection:** Checkboxes for selecting rows, including a "select all on page" option.
*   **Column Resizing:** Drag header borders to resize columns.
*   **Global Search (Quick Filter):** Filter data across all visible columns.
*   **Per-Column Filtering:**
    *   Supports Text, Numeric, Date, Multi-Select (for unique string values), and Boolean filter types.
    *   Popover-based UI for each filter.
    *   Date filters include predefined ranges (e.g., "Today", "Last 7 days", "This Month") and custom date/range pickers.
    *   Numeric filters include operators: `=`, `!=`, `<`, `<=`, `>`, `>=`, and `between`.
*   **Cell Editing:** Double-click or use Enter/F2 on editable cells to modify their content.
*   **Column Pinning:** Pin columns to the left or right, keeping them visible during horizontal scroll.
*   **Pagination:**
    *   Navigation controls (First, Previous, Next, Last).
    *   Selectable page size.
    *   Display of current page and total pages.
*   **Enhanced Footer & Status Bar:**
    *   Information on total items, selected rows, and items displayed per page.
    *   Table footer row showing the count of data rows rendered on the current page.
*   **Tree Data Display:**
    *   Render hierarchical (parent/child) data.
    *   Expand/collapse functionality for parent nodes.
    *   Indentation for visual hierarchy (configurable via `treeColumn` prop).
*   **Custom Cell Renderers:**
    *   `isActive` column uses Check/X icons.
    *   "Name" column example combines Avatar, full name, and email (when `isTreeData` is true and `firstName` is the `treeColumn`).
*   **Grid State Persistence:** Key grid states (column widths, order, pinned columns, filters, sort config, page size, expanded tree rows, visible columns, grouping) are saved to `localStorage` and restored.
*   **Comprehensive Keyboard Navigation:**
    *   Arrow key navigation between cells.
    *   Spacebar to select/deselect rows or toggle tree nodes.
    *   Enter/F2 to initiate cell editing.
    *   Escape to cancel edits.
*   **Column Visibility Toggle:** Dropdown menu to show/hide columns, with preferences saved to `localStorage`.
*   **Column Reordering:** Drag and drop unpinned column headers to reorder them.
*   **Dynamic Column Grouping Panel:**
    *   Drag column headers to a panel to group data by that column.
    *   Supports single-level grouping with expand/collapse.
    *   Remove columns from grouping via the panel.
    *   (Note: Grouping is disabled if `isTreeData` is true).
*   **Export to CSV & XLSX:** Buttons to export the current grid view (filtered and sorted) to CSV or XLSX formats.
*   **Theme Switching (UI):** User interface to switch between Light, Dark, and System themes, with preferences persisted.

## Core Component: `DataGrid`

The primary component is `<DataGrid />` located in `src/components/data-grid/DataGrid.tsx`.

See `API_REFERENCE.md` for a detailed overview of props and column definitions.

## Further Development

This project serves as a strong foundation. Potential future enhancements include:
*   Advanced tree data operations (hierarchical filtering/sorting).
*   Multi-level column grouping.
*   Group row aggregations.
*   Context menu for actions (e.g., export).
*   Virtualization for very large datasets.
