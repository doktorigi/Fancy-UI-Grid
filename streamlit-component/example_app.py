"""Demo Streamlit app for the fancy_ui_grid component.

Run from this directory:  streamlit run example_app.py
"""
import streamlit as st
from fancy_ui_grid import fancy_ui_grid

st.set_page_config(page_title="Fancy UI Grid demo", layout="wide")
st.title("Fancy UI Grid — Streamlit demo")

data = [
    {"id": 1, "name": "Alice Johnson", "department": "Engineering", "age": 34, "salary": 98000, "active": True},
    {"id": 2, "name": "Bob Smith", "department": "Engineering", "age": 41, "salary": 105000, "active": True},
    {"id": 3, "name": "Carol White", "department": "Sales", "age": 29, "salary": 72000, "active": False},
    {"id": 4, "name": "Dan Brown", "department": "Sales", "age": 37, "salary": 81000, "active": True},
    {"id": 5, "name": "Eve Davis", "department": "Marketing", "age": 26, "salary": 64000, "active": True},
    {"id": 6, "name": "Frank Miller", "department": "Marketing", "age": 45, "salary": 88000, "active": False},
    {"id": 7, "name": "Grace Lee", "department": "Engineering", "age": 31, "salary": 95000, "active": True},
]

column_defs = [
    {"field": "name", "headerText": "Name", "sortable": True, "filterable": True, "filterType": "text", "editable": True, "defaultWidth": "200px"},
    {"field": "department", "headerText": "Department", "sortable": True, "filterable": True, "filterType": "select"},
    {"field": "age", "headerText": "Age", "sortable": True, "filterable": True, "filterType": "number", "aggregate": ["avg", "min", "max"], "defaultWidth": "120px"},
    {"field": "salary", "headerText": "Salary", "sortable": True, "filterable": True, "filterType": "number", "aggregate": ["sum", "avg"], "editable": True},
    {"field": "active", "headerText": "Active", "filterable": True, "filterType": "boolean", "defaultWidth": "100px"},
]

conditional_formats = [
    {
        "field": "salary",
        "dataBar": {"min": 50000, "max": 120000, "color": "rgba(59, 130, 246, 0.25)"},
    },
    {
        "field": "active",
        "operator": "=",
        "value": False,
        "style": {"color": "#ef4444", "fontWeight": "bold"},
    },
]

result = fancy_ui_grid(
    data,
    column_defs,
    enable_grouping_panel=True,
    conditional_formats=conditional_formats,
    storage_key="exampleAppGrid",
    key="demo_grid",
)

col1, col2, col3 = st.columns(3)
col1.subheader("Selected row ids")
col1.json(result["selected_ids"])
col2.subheader("Cell edits")
col2.json(result["edits"])
col3.subheader("Server params")
col3.json(result.get("server_params"))
