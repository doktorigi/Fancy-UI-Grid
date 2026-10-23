# Contributing to Fancy UI Grid

Thanks for your interest! Issues and pull requests are welcome — including small ones.

## Where to start

The [contributor roadmap](ROADMAP.md) has **six easy, six medium, and six big feature ideas**, with starting files, acceptance criteria, and AG Grid examples. E1 (header help), E2 (column search), and E4 (export filenames) are good starting points. M5 (sharing saved views) is an intermediate project; big features are split into milestones.

Search existing issues for the roadmap ID before opening a new one. To volunteer, comment on the existing issue with your intended scope. For a new task, use the [Feature / roadmap contribution template](https://github.com/doktorigi/Fancy-UI-Grid/issues/new?template=feature.yml) and put its ID in the title. Design feedback, translations, examples, accessibility checks, and documentation are useful contributions too.

Check the [issues labeled `good first issue`](https://github.com/doktorigi/Fancy-UI-Grid/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22). If you want to work on something bigger, open an issue first so we can agree on the approach before you invest time.

## Project layout

| Path | What it is |
| --- | --- |
| `src/components/data-grid/` | The grid itself — this is the library |
| `src/types/data-grid.ts` | All public types (`DataGridProps`, `ColumnDefinition`, ...) |
| `src/lib/`, `src/hooks/` | Processing helpers, unit tests, editing state, and server row model |
| `tests/` | Playwright browser scenarios |
| `ROADMAP.md` | Proposed features and contributor starting points |
| `src/components/bulk-repricing/`, `src/app/` | The Next.js demo app |
| `streamlit-component/` | Streamlit wrapper: Python package + Vite frontend that imports the grid from `src/` |

## Development

```bash
npm ci
npm run dev        # demo app on http://localhost:9002
```

For the Streamlit component, see [streamlit-component/README.md](streamlit-component/README.md).

## Before you open a PR

1. For code changes, run `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:browser` (CI runs all four). Install the browser once with `npx playwright install chromium`. Add focused regression coverage for changed behavior; see [advanced workflow verification](docs/advanced-workflows.md#verification) for optional live backend tests.
2. If shared grid changes affect Streamlit, install its frontend dependencies with `npm --prefix streamlit-component/frontend ci`, rebuild with `npm --prefix streamlit-component/frontend run build`, and commit the updated `streamlit-component/fancy_ui_grid/frontend_build/`. If Python or transport behavior changes, also run `python -m unittest test_server test_transport -v` and `python smoke_test.py` from `streamlit-component/` with its dependencies installed.
3. Update `API_REFERENCE.md` for changed props or column options, and add a small demo for a user-visible feature. State which local/server modes and React/Streamlit interfaces are supported; link a follow-up issue for deferred support.
4. Keep changes focused: one feature or independently useful milestone per PR. Link the issue and roadmap ID, describe the resulting behavior, and report verification. Screenshots or a short recording help with visible changes.
5. For documentation-only changes, check links, examples, and `git diff --check`; no local application rebuild is needed. CI still runs its configured checks.

## Guidelines

* Prefer small, boring solutions over clever abstractions; match the style of the surrounding code.
* New grid behavior should be driven by props/column definitions, not hardcoded field names (we're actively removing the remaining hardcoded demo renderers — see issues).
* This project is MIT licensed; by contributing you agree your contributions are licensed the same way.
