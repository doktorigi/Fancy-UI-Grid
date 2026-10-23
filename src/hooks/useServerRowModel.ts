import * as React from 'react';
import type { GridDataSource, ServerRowModelOptions } from '@/types/data-grid';
import { ServerRowModel, type ServerQuery } from '@/lib/serverRowModel';

const emptySubscribe = () => () => {};
const emptySnapshot = () => 0;
export function useServerRowModel<T>({ source, query, options, scrollTop, rowHeight, height, version }: {
  source?: GridDataSource<T>; query: ServerQuery<T>; options?: ServerRowModelOptions;
  scrollTop: number; rowHeight: number; height: number; version?: string | number;
}) {
  const queryKey = JSON.stringify(query);
  const optionsKey = JSON.stringify(options ?? {});
  const [refreshVersion, refresh] = React.useReducer(n => n + 1, 0);
  // Query values are JSON, so equal inline objects must not reset the cache.
  const model = React.useMemo(() => source ? new ServerRowModel(source, JSON.parse(queryKey), JSON.parse(optionsKey)) : null,
    [source, queryKey, optionsKey, version, refreshVersion]);
  const revision = React.useSyncExternalStore(model?.subscribe ?? emptySubscribe, model?.getSnapshot ?? emptySnapshot, emptySnapshot);
  const total = model?.displayRowCount ?? 0;
  // Browsers cap element heights. Stretch the scrollbar, not the row DOM, for massive datasets.
  const physicalHeight = Math.min(8_000_000, total * rowHeight);
  const scrollScale = Math.max(1, (total * rowHeight - height) / Math.max(1, physicalHeight - height));
  const start = Math.min(Math.max(0, Math.floor(scrollTop * scrollScale / rowHeight) - 5), Math.max(0, total - 1));
  const end = Math.min(total, start + Math.ceil(height / rowHeight) + 12);
  React.useEffect(() => { model?.ensureRange(start, end); }, [model, start, end, revision]);
  React.useEffect(() => () => { model?.reset(); }, [model]);
  const slots = React.useMemo(() => model?.getWindow(start, end) ?? [], [model, start, end, revision]);
  const topSpacer = scrollScale > 1 ? Math.max(0, scrollTop - (scrollTop * scrollScale - start * rowHeight)) : start * rowHeight;
  const bottomSpacer = Math.max(0, physicalHeight - topSpacer - slots.length * rowHeight);
  return { model, slots, start, total, topSpacer, bottomSpacer, refresh, queryKey };
}
