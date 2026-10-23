"""Run: python examples/sqlite_server.py --rows 1000000 --database /path/to/demo.db"""
import argparse
import json
import sqlite3
import sys
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "streamlit-component"))
from fancy_ui_grid.server import SQLiteDataSource

REGIONS = ["CA", "NY", "TX", "FL"]
COLUMNS = [
    {"field": "id", "headerText": "ID", "sortable": True},
    {"field": "region", "headerText": "Region", "filterType": "select", "editable": True, "editor": "select", "editorOptions": [{"label": value, "value": value} for value in REGIONS]},
    {"field": "status", "headerText": "Status", "filterType": "select", "editable": True, "editor": "select", "editorOptions": [{"label": value, "value": value} for value in ["Draft", "Approved"]]},
    {"field": "amount", "headerText": "Amount", "filterType": "number", "editable": True, "aggregate": ["sum", "avg"], "validation": {"required": True, "min": 0, "max": 1000000}},
    {"field": "limit", "headerText": "Limit", "filterType": "number", "editable": True, "validation": {"required": True, "min": 0}},
    {"field": "active", "headerText": "Active", "filterType": "boolean", "editable": True, "editor": "boolean"},
    {"field": "date", "headerText": "Date", "filterType": "date", "editable": True, "editor": "date"},
]


def seed(database, count):
    with closing(sqlite3.connect(database)) as connection, connection:
        connection.execute('CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, region TEXT, status TEXT, amount REAL, "limit" REAL, active INTEGER, date TEXT)')
        if connection.execute("SELECT COUNT(*) FROM orders").fetchone()[0]:
            return
        connection.executemany('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?)',
            ((i + 1, REGIONS[i % 4], "Approved" if i % 3 else "Draft", 100 + i % 10000, 20000, i % 5 != 0, f"2026-10-{i % 28 + 1:02d}") for i in range(count)))
        connection.execute("CREATE INDEX IF NOT EXISTS orders_region ON orders(region)")


def validate_order(row):
    return {"amount": "Amount must not exceed Limit."} if row["amount"] is not None and row["limit"] is not None and row["amount"] > row["limit"] else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", default="grid-demo.db")
    parser.add_argument("--rows", type=int, default=1000000)
    parser.add_argument("--port", type=int, default=9010)
    parser.add_argument("--origin", default="http://localhost:9002")
    args = parser.parse_args()
    seed(args.database, args.rows)
    source = SQLiteDataSource(args.database, "orders", COLUMNS)

    class Handler(BaseHTTPRequestHandler):
        def respond(self, status, payload):
            body = json.dumps(payload, allow_nan=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", args.origin)
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.respond(200, {})

        def do_POST(self):
            if self.headers.get("Origin") not in (None, args.origin):
                self.respond(403, {"message": "Origin is not allowed"})
                return
            length = int(self.headers.get("Content-Length", "0"))
            if length > 2_000_000:
                self.respond(413, {"message": "Request too large"})
                return
            try:
                payload = json.loads(self.rfile.read(length))
                if self.path == "/rows":
                    result = source.get_rows(payload)
                elif self.path == "/edits":
                    result = source.save_edits(payload, validate_order)
                else:
                    self.respond(404, {"message": "Not found"})
                    return
                self.respond(200, result)
            except (ValueError, KeyError, TypeError) as error:
                self.respond(400, {"message": str(error)})

    print(f"SQLite example ready at http://127.0.0.1:{args.port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
