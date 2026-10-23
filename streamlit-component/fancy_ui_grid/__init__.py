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
    enable_floating_filters=False,
    pivot_mode=False,
    enable_pivot_toggle=None,
    pivot_columns=None,
    pivot_values=None,
    density="normal",
    enable_density_selector=True,
    enable_saved_views=True,
    saved_views=None,
    enable_formula_columns=True,
    formula_columns=None,
    is_tree_data=False,
    tree_column=None,
    storage_key=None,
    conditional_formats=None,
    server_side=False,
    total_row_count=None,
    edit_mode="cell",
    on_batch_save=None,
    data_source=None,
    data_source_version=None,
    server_row_model_options=None,
    virtualized=False,
    viewport_height=500,
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
        enable_floating_filters: Show an inline quick-filter row beneath headers.
        pivot_mode: Start in interactive Pivot Table Mode.
        enable_pivot_toggle: Show the Pivot Mode toggle button in the toolbar.
        pivot_columns: List of column field names to pivot into dynamic headers.
        pivot_values: List of ``{"field": ..., "aggregate": ...}`` dicts for pivot metrics.
        density: Initial row density (``'compact'``, ``'normal'``, or ``'comfortable'``).
        enable_density_selector: Show the row density switcher in the toolbar.
        enable_saved_views: Show the Saved Views preset manager in the toolbar.
        saved_views: Optional list of preset view dicts (``{"id", "name", "state"}``).
        enable_formula_columns: Show the ``Formulas`` calculated column builder in the toolbar.
        formula_columns: Optional list of calculated column dicts (``{"field", "headerText", "formula", "aggregate"}``).
        is_tree_data: Render hierarchical rows (dicts with ``children``).
        tree_column: Field that shows the tree expanders.
        storage_key: localStorage key for persisted grid state; set a
            unique key per grid.
        conditional_formats: List of conditional formatting rule dicts.
        server_side: Handle sorting/filtering/pagination on the server.
        total_row_count: Total count of rows across all pages in server_side mode.
        edit_mode: ``'cell'`` for immediate edits or ``'batch'`` for review/Save/Discard.
        on_batch_save: Optional callable receiving camelCase edits (rowId, field,
            oldValue, value). Return None/{} for success or {errors, message} to
            reject the entire batch. Requires key. Invoked once per request ID.
        data_source: Optional callable(request) -> {rows, rowCount, ...}; requires
            key. See fancy_ui_grid.server.SQLiteDataSource.get_rows.
        data_source_version: Change to invalidate cached server rows after external writes.
        server_row_model_options: Dict with blockSize, maxCachedBlocks, maxConcurrentRequests.
        virtualized: Window local rows instead of paginating.
        viewport_height: Scrolling viewport height, default 500 px.
        height: Fixed iframe height in px. Default: auto-sized to content.
        key: Streamlit widget key.

    Returns:
        dict with ``selected_ids``, ``edits``, and ``server_params`` (page, pageSize, sortConfig, multiSortConfig, columnFilters, globalFilter).
    """
    if hasattr(data, "to_json"):  # pandas DataFrame, without importing pandas
        records = json.loads(data.to_json(orient="records", date_format="iso"))
        for i, rec in enumerate(records):
            rec.setdefault("id", i)
        data = records

    if edit_mode not in ("cell", "batch"):
        raise ValueError("edit_mode must be 'cell' or 'batch'")
    managed = data_source is not None or on_batch_save is not None
    transport = {"responses": {}, "batches": {}}
    if managed:
        if key is None:
            raise ValueError("A unique key is required for data_source or on_batch_save")
        import streamlit as st
        transport = st.session_state.setdefault(f"_fancy_transport_{key}", transport)
    result = _component_func(
        data=data,
        column_defs=column_defs,
        default_page_size=default_page_size,
        page_size_options=page_size_options or [10, 25, 50, 100],
        enable_row_selection=enable_row_selection,
        enable_grouping_panel=enable_grouping_panel,
        enable_floating_filters=enable_floating_filters,
        pivot_mode=pivot_mode,
        enable_pivot_toggle=enable_pivot_toggle,
        pivot_columns=pivot_columns or [],
        pivot_values=pivot_values,
        density=density,
        enable_density_selector=enable_density_selector,
        enable_saved_views=enable_saved_views,
        saved_views=saved_views or [],
        enable_formula_columns=enable_formula_columns,
        formula_columns=formula_columns or [],
        is_tree_data=is_tree_data,
        tree_column=tree_column,
        storage_key=storage_key,
        conditional_formats=conditional_formats,
        server_side=server_side,
        total_row_count=total_row_count,
        edit_mode=edit_mode,
        batch_save_enabled=on_batch_save is not None,
        batch_response=next(reversed(transport["batches"].values()), None) if transport["batches"] else None,
        data_source_enabled=data_source is not None,
        data_source_version=data_source_version,
        server_row_model_options=server_row_model_options or {},
        server_responses=list(transport["responses"].values()),
        virtualized=virtualized,
        viewport_height=viewport_height,
        height=height,
        key=key,
        default={"selected_ids": [], "edits": [], "server_params": None},
    )
    if managed and result:
        updated = False
        if data_source is not None:
            for pending in result.get("server_requests", []):
                request_id = pending["id"]
                if request_id in transport["responses"]:
                    continue
                try:
                    response = {"id": request_id, "result": data_source(pending["request"])}
                except Exception as error:
                    response = {"id": request_id, "error": str(error)}
                transport["responses"][request_id] = response
                updated = True
        pending = result.get("batch_request")
        if on_batch_save is not None and pending and pending["id"] not in transport["batches"]:
            try:
                response = on_batch_save(pending["edits"]) or {}
            except Exception as error:
                response = {"message": str(error)}
            transport["batches"][pending["id"]] = {"id": pending["id"], "result": response}
            updated = True
        # Keep transport bounded without dropping any currently requested response.
        active_ids = {request["id"] for request in result.get("server_requests", [])}
        for request_id in list(transport["responses"])[:-32]:
            if request_id not in active_ids:
                del transport["responses"][request_id]
        for request_id in list(transport["batches"])[:-16]:
            del transport["batches"][request_id]
        if updated:
            st.rerun()
    return result
