import type { GridDataSource, GroupKey, ServerRow, ServerRowModelOptions, ServerRowsRequest, ServerRowsResult } from '@/types/data-grid';

export type ServerQuery<T> = Omit<ServerRowsRequest<T>, 'startRow' | 'endRow' | 'groupKeys'>;
type Route<T> = { path: GroupKey[]; count?: number; expanded: Map<number, { row: ServerRow<T>; child: Route<T> }> };
type Block<T> = {
  key: string; route: Route<T>; start: number; status: 'queued' | 'loading' | 'ready' | 'error';
  rows: ServerRow<T>[]; controller: AbortController; error?: string; touched: number;
};
export interface ServerSlot<T> {
  index: number; localIndex: number; path: GroupKey[]; row?: ServerRow<T>;
  status: 'loading' | 'ready' | 'error'; error?: string; expanded: boolean;
}

/** Sparse, route-aware cache: memory depends on cached blocks and expanded groups, not rowCount. */
export class ServerRowModel<T> {
  readonly blockSize: number;
  readonly maxCachedBlocks: number;
  private readonly concurrency: number;
  private root: Route<T> = { path: [], expanded: new Map() };
  private blocks = new Map<string, Block<T>>();
  private wanted = new Set<string>();
  private listeners = new Set<() => void>();
  private version = 0;
  private generation = 0;
  private clock = 0;
  private active = 0;
  metadata: Pick<ServerRowsResult<T>, 'aggregates' | 'pivotResultColumns' | 'grandTotalValues'> = {};

  constructor(private source: GridDataSource<T>, readonly query: ServerQuery<T>, options: ServerRowModelOptions = {}) {
    this.blockSize = Math.max(1, Math.floor(options.blockSize ?? 100));
    this.maxCachedBlocks = Math.max(1, Math.floor(options.maxCachedBlocks ?? 10));
    this.concurrency = Math.max(1, Math.floor(options.maxConcurrentRequests ?? 4));
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.version;
  private emit() { this.version++; this.listeners.forEach(listener => listener()); }
  get rootRowCount() { return this.root.count; }
  get cachedBlockCount() { return this.blocks.size; }
  get loading() { return Array.from(this.blocks.values()).some(b => b.status === 'queued' || b.status === 'loading'); }
  private count(route: Route<T>): number {
    return (route.count ?? this.blockSize) + Array.from(route.expanded.values()).reduce((n, item) => n + this.count(item.child), 0);
  }
  get displayRowCount() { return this.count(this.root); }
  private key(path: GroupKey[], start: number) { return JSON.stringify([path, start]); }
  private locate(index: number, route = this.root): { route: Route<T>; localIndex: number } {
    let shift = 0;
    for (const [position, entry] of Array.from(route.expanded).sort(([a], [b]) => a - b)) {
      const childStart = position + shift + 1;
      if (index < childStart) break;
      const children = this.count(entry.child);
      if (index < childStart + children) return this.locate(index - childStart, entry.child);
      shift += children;
    }
    return { route, localIndex: index - shift };
  }
  getWindow(start: number, end: number): ServerSlot<T>[] {
    const slots: ServerSlot<T>[] = [];
    for (let index = Math.max(0, start); index < Math.min(end, this.displayRowCount); index++) {
      const { route, localIndex } = this.locate(index);
      const block = this.blocks.get(this.key(route.path, Math.floor(localIndex / this.blockSize) * this.blockSize));
      const expanded = route.expanded.get(localIndex);
      const row = expanded?.row ?? block?.rows[localIndex % this.blockSize];
      slots.push({ index, localIndex, path: route.path, row, expanded: !!expanded,
        status: row ? 'ready' : block?.status === 'error' ? 'error' : 'loading', error: block?.error });
    }
    return slots;
  }
  ensureRange(start: number, end: number) {
    const wanted = new Set<string>();
    for (let index = Math.max(0, start); index < Math.min(end, this.displayRowCount); index++) {
      const { route, localIndex } = this.locate(index);
      const blockStart = Math.floor(localIndex / this.blockSize) * this.blockSize;
      const key = this.key(route.path, blockStart);
      wanted.add(key);
      let block = this.blocks.get(key);
      if (!block) {
        block = { key, route, start: blockStart, status: 'queued', rows: [], controller: new AbortController(), touched: ++this.clock };
        this.blocks.set(key, block);
      } else block.touched = ++this.clock;
    }
    this.wanted = wanted;
    // Abandon offscreen queued work. Active work is allowed to finish within the bounded cache.
    for (const [key, block] of this.blocks) if (!wanted.has(key) && block.status === 'queued') this.blocks.delete(key);
    this.evict();
    this.pump();
  }
  private evict() {
    const candidates = Array.from(this.blocks.values()).filter(b => !this.wanted.has(b.key)).sort((a, b) => a.touched - b.touched);
    while (this.blocks.size > Math.max(this.maxCachedBlocks, this.wanted.size) && candidates.length) {
      const block = candidates.shift()!;
      block.controller.abort();
      this.blocks.delete(block.key);
    }
  }
  private pump() {
    for (const block of this.blocks.values()) {
      if (this.active >= this.concurrency) break;
      if (block.status !== 'queued') continue;
      block.status = 'loading';
      this.active++;
      const generation = this.generation;
      Promise.resolve().then(() => this.source.getRows({ ...this.query, groupKeys: block.route.path,
        startRow: block.start, endRow: block.start + this.blockSize }, block.controller.signal))
        .then(result => {
          if (generation !== this.generation || block.controller.signal.aborted || this.blocks.get(block.key) !== block) return;
          if (!Number.isSafeInteger(result.rowCount) || result.rowCount < 0 || !Array.isArray(result.rows)) throw new Error('Invalid datasource response: rows and a non-negative integer rowCount are required.');
          const expected = Math.min(this.blockSize, Math.max(0, result.rowCount - block.start));
          if (result.rows.length !== expected) throw new Error(`Datasource returned ${result.rows.length} rows; expected ${expected}.`);
          block.rows = result.rows;
          block.status = 'ready';
          block.route.count = result.rowCount;
          if (!block.route.path.length) this.metadata = {
            aggregates: result.aggregates, pivotResultColumns: result.pivotResultColumns,
            grandTotalValues: result.grandTotalValues,
          };
        }).catch(error => {
          if (generation !== this.generation || block.controller.signal.aborted || this.blocks.get(block.key) !== block) return;
          block.status = 'error';
          block.error = error instanceof Error ? error.message : 'Unable to load rows.';
        }).finally(() => {
          if (generation !== this.generation) return;
          this.active--;
          this.evict();
          this.pump();
          this.emit();
        });
    }
  }
  toggle(slot: ServerSlot<T>) {
    if (!slot.row?.group) return;
    const { route, localIndex } = this.locate(slot.index);
    const previous = route.expanded.get(localIndex);
    if (previous) {
      route.expanded.delete(localIndex);
      const prefix = previous.child.path;
      for (const [key, block] of this.blocks) {
        if (prefix.every((value, i) => Object.is(value, block.route.path[i])) && block.route.path.length >= prefix.length) {
          block.controller.abort();
          this.blocks.delete(key);
        }
      }
    } else {
      route.expanded.set(localIndex, { row: slot.row, child: {
        path: [...route.path, slot.row.group.key], count: slot.row.group.childCount, expanded: new Map(),
      } });
    }
    this.emit();
  }
  retry(slot: ServerSlot<T>) {
    const key = this.key(slot.path, Math.floor(slot.localIndex / this.blockSize) * this.blockSize);
    const block = this.blocks.get(key);
    if (block?.status === 'error') { block.status = 'queued'; block.error = undefined; this.pump(); this.emit(); }
  }
  /** Also safe under React Strict Mode's setup / cleanup / setup cycle. */
  reset() {
    this.generation++;
    for (const block of this.blocks.values()) block.controller.abort();
    this.blocks.clear();
    this.wanted.clear();
    this.active = 0;
    this.root = { path: [], expanded: new Map() };
    this.metadata = {};
    this.emit();
  }
}

export function createHttpDataSource<T>(url: string, init?: Omit<RequestInit, 'body' | 'signal' | 'method'>): GridDataSource<T> {
  return { async getRows(request, signal) {
    const headers = new Headers(init?.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(url, { ...init, method: 'POST', headers, body: JSON.stringify(request), signal });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(typeof error?.message === 'string' ? error.message : `Loading rows failed (${response.status}).`);
    }
    return response.json();
  } };
}
