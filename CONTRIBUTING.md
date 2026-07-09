# Contributing to Fancy UI Grid

Thanks for your interest! Issues and pull requests are welcome — including small ones.

## Where to start

Check the [issues labeled `good first issue`](https://github.com/doktorigi/Fancy-UI-Grid/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22). If you want to work on something bigger, open an issue first so we can agree on the approach before you invest time.

## Project layout

| Path | What it is |
| --- | --- |
| `src/components/data-grid/` | The grid itself — this is the library |
| `src/types/data-grid.ts` | All public types (`DataGridProps`, `ColumnDefinition`, ...) |
| `src/components/bulk-repricing/`, `src/app/` | The Next.js demo app |
| `streamlit-component/` | Streamlit wrapper: Python package + Vite frontend that imports the grid from `src/` |

## Development

```bash
npm install
npm run dev        # demo app on http://localhost:9002
```

For the Streamlit component, see [streamlit-component/README.md](streamlit-component/README.md).

## Before you open a PR

1. `npm run typecheck` and `npm run build` must pass (CI enforces both).
2. If you touched the grid and the Streamlit wrapper is affected, rebuild it (`cd streamlit-component/frontend && npm run build`) and commit the updated `frontend_build/`.
3. Update `API_REFERENCE.md` if you added or changed a prop or column option.
4. Keep changes focused — one feature or fix per PR.

## Guidelines

* Prefer small, boring solutions over clever abstractions; match the style of the surrounding code.
* New grid behavior should be driven by props/column definitions, not hardcoded field names (we're actively removing the remaining hardcoded demo renderers — see issues).
* This project is MIT licensed; by contributing you agree your contributions are licensed the same way.
