# Fancy UI Grid contributor roadmap

Help shape the next version of Fancy UI Grid. This list has **18 proposed features: six easy, six medium, and six big projects**. Pick something that interests you; documentation, examples, testing, and design contributions are welcome too.

Reviewed against **v1.1.0 on October 23, 2026**. These are contribution ideas, not release commitments. AG Grid's documentation provides examples of useful behavior; the scopes and implementation suggestions below are specific to Fancy UI Grid.

## Pick a contribution

| Level | Good fit for | How to approach it |
| --- | --- | --- |
| [Easy](#easy-features) | Learning React/TypeScript, UI work, documentation | One small feature with a focused demo; E1, E2, and E4 are the best starting points. |
| [Medium](#medium-features) | Comfortable with React state, public APIs, and tests | Agree on the API and edge cases in an issue, then deliver focused PRs. |
| [Big](#big-features) | Experienced frontend/backend contributors | Start with a design issue and split the work into independently reviewable milestones. |

Search [open issues](https://github.com/doktorigi/Fancy-UI-Grid/issues) for the roadmap ID before starting. Use the **Feature / roadmap contribution** issue template to propose a scope or volunteer for an existing issue. Include the ID in the issue title, for example `[E2] Search the column chooser`. IDs below are roadmap references, not GitHub issue numbers. Check the issue for current ownership and status.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks, and the React/Streamlit workflow.

## Already available

Build on the existing [features](README.md#features): sorting, column and floating filters, row grouping, local tree data, master-detail, flat column header groups, pivot tables, calculated columns, saved views, density controls, conditional formatting, range charts, sparklines, CSV/XLSX export, clipboard/fill/undo, and row virtualization. v1.1.0 also includes validated batch editing and a lazy server row model with grouping, pivoting, and full-query totals.

The larger server tasks below extend that row model. Today, row selection stores explicit loaded IDs, and export uses the loaded viewport in datasource mode. See [current server limitations](docs/advanced-workflows.md#scope-and-compatibility).

## Easy features

These scopes are deliberately small. A maintainer can label a scoped issue `good first issue` once it has clear acceptance criteria and someone available to help.

### E1. Column header help tooltips

Explain unfamiliar fields without making headers wider.

- **First contribution:** Add an optional plain-text header description and display it on hover and keyboard focus using the existing tooltip component. Cell values already have native tooltips; this task is specifically configurable header help.
- **Done when:** Missing descriptions preserve current behavior; help works with custom header content and does not trigger sorting, dragging, or filtering; include a demo and document the option.
- **Start here:** [DataGridHeaderCell.tsx](src/components/data-grid/DataGridHeaderCell.tsx), [public types](src/types/data-grid.ts), [tooltip component](src/components/ui/tooltip.tsx).
- **AG Grid example:** [Tooltips](https://www.ag-grid.com/react-data-grid/tooltips/).

### E2. Search the column chooser

Make the Columns menu easier to use in wide datasets.

- **First contribution:** Add a search input matching header labels and field names, a clear control, and a no-matches message.
- **Done when:** Search never changes column visibility by itself; hidden columns remain searchable; grouped checkboxes clearly affect the full group, including unmatched children; typing and keyboard navigation work inside the menu.
- **Start here:** [ColumnVisibilityToggle.tsx](src/components/data-grid/ColumnVisibilityToggle.tsx).
- **AG Grid example:** [Columns Tool Panel](https://www.ag-grid.com/react-data-grid/tool-panel-columns/).

### E3. Custom empty-state messages

Let applications explain why a table is empty and what the user can do next.

- **First contribution:** Add separate configurable text for an empty local dataset and a local dataset with no filter matches. Show a clear-filters action only for the latter.
- **Done when:** Defaults remain useful, clearing filters restores matching rows, and remote loading/error/retry states keep their existing behavior. A broader overlay API can follow separately.
- **Start here:** [DataGrid.tsx](src/components/data-grid/DataGrid.tsx), [public types](src/types/data-grid.ts).
- **AG Grid example:** [Overlays & Loading](https://www.ag-grid.com/react-data-grid/overlays-overview/).

### E4. Configurable export filenames

Let an application download `orders_2026-10-23.csv` instead of the generic grid filename.

- **First contribution:** Expose the existing export helper's filename prefix through a documented grid prop and a serializable Streamlit option.
- **Done when:** Toolbar and context-menu CSV/XLSX downloads use the same prefix; the default, date suffix, and file extensions remain compatible; verify the downloaded names.
- **Start here:** [exportUtils.ts](src/lib/exportUtils.ts), [DataGrid.tsx](src/components/data-grid/DataGrid.tsx), [Streamlit bridge](streamlit-component/frontend/src/FancyGrid.tsx), [Python wrapper](streamlit-component/fancy_ui_grid/__init__.py).
- **AG Grid example:** [CSV Export filename options](https://www.ag-grid.com/react-data-grid/csv-export/).

### E5. Keyboard shortcuts help dialog

Make the grid's existing keyboard features discoverable inside the demo and embedded grid.

- **First contribution:** Add a Help button opening a compact dialog of the shortcuts already implemented. Start with button access; adding a new global hotkey is outside this task.
- **Done when:** Windows/Linux and Mac key labels are understandable; unavailable editing actions are omitted or explained; Escape closes the dialog and restores focus to the trigger.
- **Start here:** [documented shortcuts](README.md#keyboard--mouse-shortcuts), [DataGrid.tsx](src/components/data-grid/DataGrid.tsx), [dialog component](src/components/ui/dialog.tsx).
- **AG Grid inspiration:** [Keyboard Interaction](https://www.ag-grid.com/react-data-grid/keyboard-navigation/); the help dialog is our proposed addition.

### E6. Excel-friendly UTF-8 CSV option

Help spreadsheet users open names and labels containing accented or non-Latin characters correctly.

- **First contribution:** Add an opt-in UTF-8 byte order mark (BOM) to CSV downloads. Keep the current default and XLSX behavior.
- **Done when:** The downloaded bytes contain exactly one BOM when enabled and none when disabled; accented text and non-Latin characters survive an import; quoting and formula-injection protection still pass their existing checks.
- **Start here:** [exportUtils.ts](src/lib/exportUtils.ts), [export tests](src/lib/exportUtils.test.ts), [DataGrid.tsx](src/components/data-grid/DataGrid.tsx).
- **AG Grid inspiration:** [CSV Export](https://www.ag-grid.com/react-data-grid/csv-export/); the BOM option is a Fancy UI Grid proposal, not a claim about AG Grid's API.

## Medium features

### M1. Localization and translated interface text

Let applications translate grid controls without maintaining a fork.

- **First contribution:** Introduce a typed message dictionary with English fallbacks for the toolbar, pagination, filters, and status bar; provide one additional locale as an example.
- **Done when:** Missing keys fall back safely, counts support plural forms, accessible labels are translated, and React/Streamlit accept the same serializable messages. Follow-up PRs can cover the remaining dialogs and locale-aware number/date formatting; right-to-left layout is a separate scope.
- **Start here:** [grid components](src/components/data-grid/), [public types](src/types/data-grid.ts), [Python wrapper](streamlit-component/fancy_ui_grid/__init__.py).
- **AG Grid example:** [Localisation](https://www.ag-grid.com/react-data-grid/localisation/).

### M2. Collapsible column header groups

Let users collapse a group such as Pricing to its summary columns.

- **First contribution:** Extend the existing flat `group` labels with stable group IDs and an open/closed state for one group level. Keep the existing flat API working.
- **Done when:** Collapsing a group preserves explicit column visibility preferences, pins and header alignment stay correct, keyboard controls work, and saved views restore expansion state. Agree on split groups across pin boundaries; nested groups are a later milestone.
- **Start here:** [header rendering in DataGrid.tsx](src/components/data-grid/DataGrid.tsx), [ColumnVisibilityToggle.tsx](src/components/data-grid/ColumnVisibilityToggle.tsx), [savedViews.ts](src/lib/savedViews.ts).
- **AG Grid example:** [Column Groups](https://www.ag-grid.com/react-data-grid/column-groups/).

### M3. Custom aggregation functions

Support domain-specific summaries such as median, distinct count, and weighted average.

- **First contribution:** Add a named aggregation registry for local row groups, with a distinct-count example. Keep the five built-in functions compatible.
- **Done when:** Empty/null inputs are defined, nested groups produce correct results from underlying records, and saved state stores function names. Scope pivot support separately; server/Streamlit requests must use documented names mapped to backend implementations, never serialized JavaScript callbacks.
- **Start here:** [gridProcessing.ts](src/lib/gridProcessing.ts), [pivotTable.ts](src/lib/pivotTable.ts), [public types](src/types/data-grid.ts), [processing tests](src/lib/gridProcessing.test.ts).
- **AG Grid example:** [Custom Aggregation Functions](https://www.ag-grid.com/react-data-grid/aggregation-custom-functions/).

### M4. Pinned summary rows

Keep application-provided totals or targets visible at the top or bottom while scrolling.

- **First contribution:** Add read-only pinned top/bottom rows outside the normal row collection. Existing group and pivot totals remain separate.
- **Done when:** Cells align during resizing and horizontal scrolling, pinned rows stay outside paging/filtering/selection/editing, and export inclusion is explicit. Support fixed-height virtualization; remote applications provide authoritative summaries.
- **Start here:** [DataGrid.tsx](src/components/data-grid/DataGrid.tsx), [grid styles](src/app/globals.css), [public types](src/types/data-grid.ts).
- **AG Grid example:** [Row Pinning](https://www.ag-grid.com/react-data-grid/row-pinning/).

### M5. Import and export saved views

Let teammates share a useful grid configuration as a JSON file.

- **First contribution:** Add Export view and Import view actions using the existing saved-view snapshot. Include a format version and an import preview.
- **Done when:** Filters, dates, formulas, column layout, and density round-trip; malformed files are rejected clearly; unknown fields and unsupported versions are handled explicitly. Import must not overwrite an existing view silently. Export configuration only, excluding rows and pending edits.
- **Start here:** [DataGridViewsMenu.tsx](src/components/data-grid/DataGridViewsMenu.tsx), [savedViews.ts](src/lib/savedViews.ts), [saved-view tests](src/lib/savedViews.test.ts).
- **AG Grid inspiration:** [Serializable Grid State](https://www.ag-grid.com/react-data-grid/grid-state/).

### M6. Custom context-menu actions

Let host applications add actions such as Open record or Copy record link.

- **First contribution:** Add a typed React callback for appending items to the existing menu, including labels, disabled states, separators, and row/column context.
- **Done when:** Built-in actions remain available, actions receive the correct record after sorting/filtering, keyboard operation and focus return work, and read-only rows can disable actions. Streamlit support should use action IDs and events in a separate PR.
- **Start here:** [context menu in DataGrid.tsx](src/components/data-grid/DataGrid.tsx), [public types](src/types/data-grid.ts).
- **AG Grid example:** [Context Menu customization](https://www.ag-grid.com/react-data-grid/context-menu/).

## Big features

Each item is an epic with room for several contributors. The first milestone should settle the contract and provide a small working slice before expanding compatibility.

### B1. Advanced AND/OR filter builder

Express rules such as `(Region = East OR Region = West) AND Revenue > 100000` through a visual builder.

- **Milestones:** Define a JSON filter-expression model and local evaluator; add an accessible nested condition editor; persist it in saved views; extend server requests, the SQLite adapter, and Streamlit transport.
- **Done when:** Nested expressions, nulls, dates, and numeric comparisons have predictable behavior; local and backend fixtures agree; unsupported operators fail clearly. Define how advanced rules combine with column/global filters and use parameterized backend queries.
- **Start here:** [filter types](src/types/data-grid.ts), [gridProcessing.ts](src/lib/gridProcessing.ts), [filter UI](src/components/data-grid/DataGridFilterPopover.tsx), [SQLite adapter](streamlit-component/fancy_ui_grid/server.py).
- **AG Grid example:** [Advanced Filter](https://www.ag-grid.com/react-data-grid/filter-advanced/).

### B2. Column virtualization for very wide grids

Keep hundreds or thousands of columns usable by rendering only the horizontal viewport plus a buffer.

- **Milestones:** Establish a wide-grid benchmark; implement a horizontal window with pinned columns; integrate grouped/pivot headers; preserve editing, range selection, clipboard, find, and focus when columns enter or leave the DOM.
- **Done when:** A reproducible demo with 1,000 columns renders a bounded number of cells per visible row, keyboard navigation reaches offscreen fields, and resize/reorder/pinning remain correct. Report measurements and environment; agree on performance targets in the design issue.
- **Start here:** [DataGrid.tsx](src/components/data-grid/DataGrid.tsx), [DataGridHeaderCell.tsx](src/components/data-grid/DataGridHeaderCell.tsx), [browser tests](tests/).
- **Dependencies:** Coordinate the header contract with M2 and focus behavior with B6.
- **AG Grid example:** [Row and Column DOM Virtualisation](https://www.ag-grid.com/react-data-grid/dom-virtualisation/).

### B3. Select all matching server records

Select an entire filtered dataset without downloading every row ID into the browser.

- **Milestones:** Design query-bound selection state with excluded IDs; implement the header checkbox and counts; add a backend selection resolver and Streamlit events; define group-selection semantics separately.
- **Done when:** Selection survives cache eviction, exclusions work for unloaded records, filter changes cannot silently broaden a previous selection, and counts come from the backend. Retain explicit-ID selection compatibility and demonstrate behavior with the million-row SQLite example.
- **Start here:** [selection types](src/types/data-grid.ts), [DataGrid.tsx](src/components/data-grid/DataGrid.tsx), [useServerRowModel.ts](src/hooks/useServerRowModel.ts), [SQLite adapter](streamlit-component/fancy_ui_grid/server.py).
- **AG Grid inspiration:** [Server-Side Row Selection](https://www.ag-grid.com/react-data-grid/server-side-model-selection/). Our proposed selection is bound to a query; its filtering semantics must be specified independently.

### B4. Full-dataset server export

Download all matching records, including records that were never loaded into the viewport.

- **Milestones:** Define a backend export request using the current query and visible columns; build a streaming CSV example; add progress/cancellation and UI download handling; add XLSX and selected-only export as later milestones.
- **Done when:** Exported row counts and ordering match the backend query, exports cover committed values with pending drafts clearly explained, and the browser does not fetch the whole dataset into the grid cache. Define snapshot behavior while data changes and preserve spreadsheet escaping protections.
- **Start here:** [current export helpers](src/lib/exportUtils.ts), [server query types](src/types/data-grid.ts), [SQLite HTTP example](examples/sqlite_server.py), [Python adapter](streamlit-component/fancy_ui_grid/server.py).
- **Dependencies:** All-matching export can ship independently; selected-only full export builds on B3.
- **AG Grid inspiration:** [CSV Export options](https://www.ag-grid.com/react-data-grid/csv-export/). Backend export jobs are our proposed extension, not a claim that AG Grid automatically exports unloaded server rows.

### B5. Live data transactions

Update changing dashboards without replacing the entire data array or resetting the user's position.

- **Milestones:** Add local add/update/remove transactions keyed by stable row IDs; batch rapid updates and recalculate affected results; define interactions with pending edits; later integrate remote cache updates and a WebSocket or server-sent-events example.
- **Done when:** Focus, selection, and scroll position remain stable where records still exist; stale updates cannot overwrite newer values or pending drafts silently; removed rows are handled predictably. Include a reproducible update-rate benchmark with grouping/formulas enabled.
- **Start here:** [DataGrid.tsx](src/components/data-grid/DataGrid.tsx), [gridEditing.ts](src/lib/gridEditing.ts), [useGridDrafts.ts](src/hooks/useGridDrafts.ts), [serverRowModel.ts](src/lib/serverRowModel.ts).
- **AG Grid example:** [High Frequency Updates](https://www.ag-grid.com/react-data-grid/data-update-high-frequency/).

### B6. Screen-reader and complete keyboard workflows

Make sorting, grouping, filtering, editing, and navigating large datasets usable without a mouse.

- **Milestones:** Audit the current keyboard/semantic behavior; document a focus model and row/column index strategy; fix headers, menus, resize/reorder alternatives, and grouped/pivot navigation; add announcements for validation, loading, and selection.
- **Done when:** Documented workflows pass automated accessibility checks and manual keyboard/screen-reader checks, including virtual rows and the Streamlit iframe. Record browser/screen-reader versions and remaining limitations; automated scans alone do not establish accessibility.
- **Start here:** [DataGrid.tsx](src/components/data-grid/DataGrid.tsx), [DataGridHeaderCell.tsx](src/components/data-grid/DataGridHeaderCell.tsx), [DataGridEditPanel.tsx](src/components/data-grid/DataGridEditPanel.tsx), [browser tests](tests/).
- **Dependencies:** Coordinate with B2 so offscreen focus and index announcements share one model. Small audit findings can become easy or medium child issues.
- **AG Grid examples:** [Accessibility](https://www.ag-grid.com/react-data-grid/accessibility/) and [Keyboard Interaction](https://www.ag-grid.com/react-data-grid/keyboard-navigation/).

## Turn the roadmap into an active contribution queue

These are suggested maintainer practices and labels; this document does not create issues, assign contributors, or promise review times.

1. **Start with a small queue:** Prepare E1, E2, and E4 as first-contribution issues, M5 as an intermediate feature, and B1 as a design discussion. Add more as reviewers become available.
2. **Make each issue actionable:** Include its roadmap ID, user benefit, smallest useful scope, starting files, acceptance checks, and React/Streamlit expectations. Use `enhancement` plus a proposed `difficulty: easy`, `difficulty: medium`, or `difficulty: big` label. Add `help wanted`; reserve `good first issue` for bounded work with support available.
3. **Keep ownership visible:** A contributor comments on the issue with their intended scope; a maintainer records who is working on it. If someone steps away, keep their notes and make the task available again.
4. **Split large work:** Use a parent issue with linked milestones. Design, examples, translations, test fixtures, and documentation can be separate contributions. Mark dependencies so people can work without duplicating effort.
5. **Keep the public record current:** Link issues and PRs back here. When work ships, move it into the README/release notes and record the release beside its roadmap ID. Highlight contributors and their demos in release notes.

For every feature, agree on React support, Streamlit support or an explicit follow-up, local/server behavior, relevant verification, and API documentation. Small PRs with a working example are the easiest contributions to review.
