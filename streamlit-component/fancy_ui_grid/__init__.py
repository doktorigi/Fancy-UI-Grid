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
    conditional_formats=None,
    server_side=False,
    total_row_count=None,
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
            "aggregate": ["sum", "avg"]}``. See API_REFERENCE.md.
        default_page_size: Initial rows per page.
        page_size_options: Page size choices, default [10, 25, 50, 100].
        enable_row_selection: Show selection checkboxes.
        enable_grouping_panel: Show the drag-to-group panel.
        is_tree_data: Render hierarchical rows (dicts with ``children``).
        tree_column: Field that shows the tree expanders.
        storage_key: localStorage key for persisted grid state; set a
            unique key per grid.
        conditional_formats: List of conditional formatting rule dicts.
        server_side: Handle sorting/filtering/pagination on the server.
        total_row_count: Total count of rows across all pages in server_side mode.
        height: Fixed iframe height in px. Default: auto-sized to content.
        key: Streamlit widget key.

    Returns:
        dict with ``selected_ids``, ``edits``, and ``server_params`` (page, pageSize, sortConfig, columnFilters, globalFilter).
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
        conditional_formats=conditional_formats,
        server_side=server_side,
        total_row_count=total_row_count,
        height=height,
        key=key,
        default={"selected_ids": [], "edits": [], "server_params": None},
    )
