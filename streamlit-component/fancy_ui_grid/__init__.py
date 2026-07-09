"""Streamlit component wrapping the Fancy UI Grid React data grid."""
import json
import os
from pathlib import Path

import streamlit.components.v1 as components

_DEV_URL = os.environ.get("FANCY_UI_GRID_DEV_URL")
if _DEV_URL:
    # Point at `npm run dev` (default http://localhost:5173) while developing.
    _component_func = components.declare_component("fancy_ui_grid", url=_DEV_URL)
else:
    _component_func = components.declare_component(
        "fancy_ui_grid", path=str(Path(__file__).parent / "frontend_build")
    )


def fancy_ui_grid(
    data,
    column_defs,
    *,
    default_page_size=10,
    page_size_options=None,
    enable_row_selection=True,
    enable_grouping_panel=False,
    is_tree_data=False,
    tree_column=None,
    storage_key=None,
    height=None,
    key=None,
):
    """Render the Fancy UI Grid and return its interaction state.

    Args:
        data: A list of dicts (each needs a unique ``id``) or a pandas
            DataFrame (an ``id`` column is added from the index if missing).
        column_defs: List of column definition dicts using the grid's
            camelCase keys, e.g. ``{"field": "name", "headerText": "Name",
            "sortable": True, "filterable": True, "filterType": "text",
            "aggregate": "sum"}``. See API_REFERENCE.md. Function-valued
            options (cellRenderer, headerRenderer) can't cross the
            Python/JS boundary and are not supported here.
        default_page_size: Initial rows per page.
        page_size_options: Page size choices, default [10, 25, 50, 100].
        enable_row_selection: Show selection checkboxes.
        enable_grouping_panel: Show the drag-to-group panel.
        is_tree_data: Render hierarchical rows (dicts with ``children``).
        tree_column: Field that shows the tree expanders.
        storage_key: localStorage key for persisted grid state; set a
            unique key per grid.
        height: Fixed iframe height in px. Default: auto-sized to content.
        key: Streamlit widget key.

    Returns:
        dict with ``selected_ids`` (list of row ids) and ``edits`` (list of
        ``{"row_id", "field", "value"}`` dicts, in the order they were made).
    """
    if hasattr(data, "to_json"):  # pandas DataFrame, without importing pandas
        records = json.loads(data.to_json(orient="records", date_format="iso"))
        for i, rec in enumerate(records):
            rec.setdefault("id", i)
        data = records

    return _component_func(
        data=data,
        column_defs=column_defs,
        default_page_size=default_page_size,
        page_size_options=page_size_options or [10, 25, 50, 100],
        enable_row_selection=enable_row_selection,
        enable_grouping_panel=enable_grouping_panel,
        is_tree_data=is_tree_data,
        tree_column=tree_column,
        storage_key=storage_key,
        height=height,
        key=key,
        default={"selected_ids": [], "edits": []},
    )
