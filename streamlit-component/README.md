# Fancy UI Grid — Streamlit component

Use the [Fancy UI Grid](https://github.com/doktorigi/Fancy-UI-Grid) React data grid inside a Streamlit app: sorting, per-column filters, grouping with aggregations, pinning, editing, CSV/XLSX export, and state persistence — with selection and cell edits reported back to Python.

## Install

The prebuilt frontend is committed, so no Node.js is needed:

```bash
pip install "git+https://github.com/doktorigi/Fancy-UI-Grid.git#subdirectory=streamlit-component"
```

Or from a local clone: `pip install ./streamlit-component`

## Usage

```python
import streamlit as st
from fancy_ui_grid import fancy_ui_grid

data = [
    {"id": 1, "name": "Alice", "department": "Engineering", "salary": 98000},
    {"id": 2, "name": "Bob", "department": "Sales", "salary": 72000},
]
# pandas DataFrames also work; an `id` column is added from the index if missing.

column_defs = [
    {"field": "name", "headerText": "Name", "sortable": True, "filterable": True, "filterType": "text", "editable": True},
    {"field": "department", "headerText": "Department", "sortable": True, "filterable": True, "filterType": "select"},
    {"field": "salary", "headerText": "Salary", "sortable": True, "filterable": True, "filterType": "number", "aggregate": "sum"},
]

result = fancy_ui_grid(data, column_defs, enable_grouping_panel=True, key="my_grid")
st.write("Selected:", result["selected_ids"])
st.write("Edits:", result["edits"])
```

Column definitions use the grid's camelCase keys — see [API_REFERENCE.md](../API_REFERENCE.md). Function-valued options (`cellRenderer`, `headerRenderer`) can't cross the Python/JS boundary and aren't supported from Streamlit.

`fancy_ui_grid()` returns `{"selected_ids": [...], "edits": [{"row_id", "field", "value"}, ...]}` and reruns your script on each selection change or committed cell edit, like any Streamlit widget.

Run the demo: `streamlit run example_app.py` (and `python smoke_test.py` for the headless check).

## Notes

* If the grid's filter popovers get clipped at the bottom of the component frame, pass a fixed `height=` (px).
* Set a unique `storage_key` per grid so persisted state (column widths, filters, ...) doesn't collide.

## Publishing to PyPI

```bash
pip install build twine
python -m build            # from streamlit-component/, after a fresh frontend build
twine upload dist/*
```

## Developing the frontend

```bash
cd frontend
npm install
npm run dev                      # serves on http://localhost:5173
FANCY_UI_GRID_DEV_URL=http://localhost:5173 streamlit run ../example_app.py
```

`npm run build` writes the production bundle to `fancy_ui_grid/frontend_build/` — commit it so pip installs keep working. The frontend imports the grid source from the repo's `src/` via the `@` alias, so grid changes are picked up on the next build; nothing is copied.
