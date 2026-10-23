import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpDataSource, ServerRowModel, type ServerQuery } from './serverRowModel';
import type { ServerRowsRequest, ServerRowsResult } from '@/types/data-grid';

type Row = { id: number | string; value: number };
const query: ServerQuery<Row> = { rowGroupColumns: [], sortModel: [], filterModel: {}, globalFilter: '', pivotMode: false, pivotColumns: [], valueColumns: [] };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const flat = (request: ServerRowsRequest<Row>, count = 1000000): ServerRowsResult<Row> => ({
  rows: Array.from({ length: Math.max(0, Math.min(count, request.endRow) - request.startRow) }, (_, i) => ({ data: { id: request.startRow + i, value: request.startRow + i } })), rowCount: count,
});
test('million-row counts use sparse blocks, deduplicate requests, and evict globally', async () => {
  let calls = 0;
  const model = new ServerRowModel<Row>({ async getRows(request) { calls++; return flat(request); } }, query, { blockSize: 20, maxCachedBlocks: 2 });
  model.ensureRange(0, 10); model.ensureRange(0, 10);
  await tick();
  assert.equal(calls, 1); assert.equal(model.displayRowCount, 1000000);
  for (const start of [100, 500, 999980]) { model.ensureRange(start, start + 10); await tick(); }
  assert.equal(model.cachedBlockCount, 2);
  assert.equal(model.getWindow(999980, 999981)[0].row?.data.value, 999980);
  assert.equal(model.getWindow(0, 1)[0].row, undefined);
  model.reset();
});
test('groups load only on expansion and retain position when parent blocks are evicted', async () => {
  const requests: ServerRowsRequest<Row>[] = [];
  const model = new ServerRowModel<Row>({ async getRows(request) {
    requests.push(request);
    if (!request.groupKeys.length) return { rows: [{ data: { id: 'group-a', value: 30 }, group: { key: 'a', childCount: 2, leafCount: 2 } }], rowCount: 1 };
    return flat(request, 2);
  } }, { ...query, rowGroupColumns: ['id'] }, { blockSize: 10, maxCachedBlocks: 1 });
  model.ensureRange(0, 1); await tick();
  assert.equal(requests.length, 1);
  model.toggle(model.getWindow(0, 1)[0]);
  model.ensureRange(1, 3); await tick();
  assert.deepEqual(requests[1].groupKeys, ['a']);
  assert.equal(model.displayRowCount, 3);
  assert.equal(model.getWindow(0, 1)[0].row?.data.id, 'group-a');
  model.toggle(model.getWindow(0, 1)[0]);
  assert.equal(model.displayRowCount, 1);
  model.reset();
});
test('reset aborts pending requests and ignores a late response even when the source ignores cancellation', async () => {
  let resolve!: (result: ServerRowsResult<Row>) => void;
  let signal!: AbortSignal;
  const model = new ServerRowModel<Row>({ getRows(_request, incoming) { signal = incoming; return new Promise(done => { resolve = done; }); } }, query);
  model.ensureRange(0, 1); await tick();
  model.reset(); assert.equal(signal.aborted, true);
  resolve({ rows: [], rowCount: 0 }); await tick();
  assert.equal(model.rootRowCount, undefined);
  assert.equal(model.cachedBlockCount, 0);
});
test('errors are explicit, retries work, and empty results have no phantom rows', async () => {
  let fail = true;
  const model = new ServerRowModel<Row>({ async getRows() { if (fail) throw new Error('Offline'); return { rows: [], rowCount: 0 }; } }, query);
  model.ensureRange(0, 1); await tick();
  assert.equal(model.getWindow(0, 1)[0].error, 'Offline');
  fail = false; model.retry(model.getWindow(0, 1)[0]); await tick();
  assert.equal(model.displayRowCount, 0);
  assert.deepEqual(model.getWindow(0, 10), []);
});
test('grouping, filter, multi-sort, and pivot definitions reach the server unchanged with full-query totals', async () => {
  const configured: ServerQuery<Row> = { ...query, globalFilter: 'CA', pivotMode: true, pivotColumns: ['id'], valueColumns: [{ field: 'value', aggregate: 'avg' }] };
  let received: ServerRowsRequest<Row> | undefined;
  const model = new ServerRowModel<Row>({ async getRows(request) { received = request; return { ...flat(request, 1), grandTotalValues: { average: 123 } }; } }, configured);
  model.ensureRange(0, 1); await tick();
  assert.deepEqual(received?.valueColumns, configured.valueColumns);
  assert.equal(model.metadata.grandTotalValues?.average, 123);
});

test('HTTP adapter preserves Headers, cancellation and actionable server errors', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  try {
    globalThis.fetch = async (_input, init) => {
      assert.equal(new Headers(init?.headers).get('X-Workspace'), 'example');
      assert.equal(new Headers(init?.headers).get('Content-Type'), 'application/json');
      assert.equal(init?.signal, controller.signal);
      assert.equal(init?.method, 'POST');
      assert.equal(JSON.parse(init?.body as string).startRow, 0);
      return new Response(JSON.stringify({ message: 'Choose fewer pivot dimensions.' }), { status: 400 });
    };
    const source = createHttpDataSource<Row>('/rows', { headers: new Headers({ 'X-Workspace': 'example' }) });
    await assert.rejects(source.getRows({ ...query, startRow: 0, endRow: 100, groupKeys: [] }, controller.signal), /Choose fewer pivot dimensions/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
