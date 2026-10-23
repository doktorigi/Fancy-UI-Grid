"""Run from this directory: streamlit run server_example.py"""
import sys
import tempfile
from pathlib import Path
import streamlit as st
from fancy_ui_grid import fancy_ui_grid
from fancy_ui_grid.server import SQLiteDataSource

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "examples"))
from sqlite_server import COLUMNS, seed, validate_order

st.set_page_config(page_title="Fancy UI Grid: Server data", layout="wide")
st.title("Fancy UI Grid: Server data and batch editing")


@st.cache_resource
def datasource():
    database = Path(tempfile.gettempdir()) / "fancy-grid-streamlit-demo.db"
    seed(database, 1000000)
    return SQLiteDataSource(database, "orders", COLUMNS)


source = datasource()
st.caption("One million SQLite rows, fetched on demand. Edit Amount or Limit, review the draft, then Save all. Amount cannot exceed Limit.")
result = fancy_ui_grid(
    [], [{**column, "filterable": True, "sortable": True} for column in COLUMNS],
    data_source=source.get_rows,
    on_batch_save=lambda edits: source.save_edits(edits, validate_order),
    edit_mode="batch", enable_grouping_panel=True, enable_pivot_toggle=True,
    enable_floating_filters=True, enable_formula_columns=False,
    server_row_model_options={"blockSize": 100, "maxCachedBlocks": 6, "maxConcurrentRequests": 2},
    height=900, key="sqlite-server-demo",
)
st.json(result.get("edits", []))
