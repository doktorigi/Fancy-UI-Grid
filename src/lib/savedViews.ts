import type {
  ActiveFilters,
  DataGridState,
  GridDensity,
  GridViewPreset,
  GridViewStateSnapshot,
  HierarchicalData,
  PivotValueConfig,
} from '@/types/data-grid';

export interface DensityRowMetrics {
  density: GridDensity;
  label: string;
  cellPaddingClass: string;
  groupCellPaddingClass: string;
  headerHeightClass: string;
  defaultRowHeight: number;
}

export function getDensityRowMetrics(density: GridDensity = 'normal'): DensityRowMetrics {
  switch (density) {
    case 'compact':
      return {
        density: 'compact',
        label: 'Compact',
        cellPaddingClass: 'px-2 py-1 text-xs',
        groupCellPaddingClass: 'px-2 py-1 text-xs',
        headerHeightClass: 'h-8',
        defaultRowHeight: 32,
      };
    case 'comfortable':
      return {
        density: 'comfortable',
        label: 'Comfortable',
        cellPaddingClass: 'px-4 py-3 text-sm',
        groupCellPaddingClass: 'px-4 py-2.5 text-sm',
        headerHeightClass: 'h-12',
        defaultRowHeight: 58,
      };
    case 'normal':
    default:
      return {
        density: 'normal',
        label: 'Normal',
        cellPaddingClass: 'px-3 py-2 text-sm',
        groupCellPaddingClass: 'px-3 py-2 text-sm',
        headerHeightClass: 'h-10',
        defaultRowHeight: 48,
      };
  }
}

export function rehydrateViewColumnFilters<TData = any>(
  rawFilters?: ActiveFilters<TData>
): ActiveFilters<TData> {
  if (!rawFilters) return {};
  const result: ActiveFilters<TData> = {};
  for (const [field, filter] of Object.entries(rawFilters)) {
    if (!filter) continue;
    if (filter.type === 'date') {
      result[field] = {
        ...filter,
        value: filter.value ? new Date(filter.value) : undefined,
        value2: filter.value2 ? new Date(filter.value2) : undefined,
      };
    } else if (filter.type === 'date-tree') {
      result[field] = {
        ...filter,
        selected: Array.isArray(filter.selected) ? [...filter.selected] : [],
      };
    } else if (filter.type === 'select') {
      result[field] = {
        ...filter,
        value: Array.isArray(filter.value) ? [...filter.value] : filter.value,
      };
    } else {
      result[field] = { ...filter };
    }
  }
  return result;
}

export function createGridViewSnapshot<TData extends HierarchicalData<TData>>(
  state: DataGridState<TData>
): GridViewStateSnapshot<TData> {
  return {
    globalFilter: state.globalFilter || '',
    columnFilters: rehydrateViewColumnFilters(state.columnFilters),
    sortConfig: state.sortConfig ? { ...state.sortConfig } : null,
    multiSortConfig: (state.multiSortConfig || []).map(s => ({ ...s })),
    groupedBy: [...(state.groupedBy || [])],
    visibleColumns: [...(state.visibleColumns || [])],
    columnOrder: [...(state.columnOrder || [])],
    pinnedColumns: {
      left: [...(state.pinnedColumns?.left || [])],
      right: [...(state.pinnedColumns?.right || [])],
    },
    columnWidths: { ...(state.columnWidths || {}) },
    pivotMode: !!state.pivotMode,
    pivotColumns: [...(state.pivotColumns || [])],
    pivotValues: (state.pivotValues || []).map(v => ({ ...v })),
    floatingFiltersOpen: !!state.floatingFiltersOpen,
    density: state.density || 'normal',
    pageSize: state.pageSize,
    formulaColumns: (state.formulaColumns || []).map(fc => ({ ...fc })),
  };
}

export function applyGridViewSnapshot<TData extends HierarchicalData<TData>>(
  prevState: DataGridState<TData>,
  snapshot: GridViewStateSnapshot<TData>,
  baseFields: Iterable<string>,
  defaultPageSize: number
): DataGridState<TData> {
  const nextFormulaColumns = snapshot.formulaColumns
    ? snapshot.formulaColumns.map(fc => ({ ...fc }))
    : prevState.formulaColumns || [];

  const validSet = new Set<string>(baseFields);
  for (const fc of nextFormulaColumns) {
    validSet.add(fc.field);
  }

  const filterValid = (fields?: (keyof TData & string)[]): (keyof TData & string)[] =>
    (fields || []).filter(f => validSet.has(String(f)));

  const nextMultiSort = Array.isArray(snapshot.multiSortConfig)
    ? snapshot.multiSortConfig
        .filter(s => validSet.has(String(s.field)))
        .map(s => ({ ...s }))
    : snapshot.sortConfig && validSet.has(String(snapshot.sortConfig.field))
      ? [{ ...snapshot.sortConfig }]
      : [];

  const nextVisible =
    snapshot.visibleColumns && snapshot.visibleColumns.length > 0
      ? filterValid(snapshot.visibleColumns)
      : prevState.visibleColumns;

  const nextPinnedLeft = snapshot.pinnedColumns?.left
    ? filterValid(snapshot.pinnedColumns.left)
    : prevState.pinnedColumns.left;

  const nextPinnedRight = snapshot.pinnedColumns?.right
    ? filterValid(snapshot.pinnedColumns.right).filter(f => !nextPinnedLeft.includes(f))
    : prevState.pinnedColumns.right.filter(f => !nextPinnedLeft.includes(f));

  let nextColumnOrder = snapshot.columnOrder
    ? filterValid(snapshot.columnOrder).filter(
        f => !nextPinnedLeft.includes(f) && !nextPinnedRight.includes(f)
      )
    : prevState.columnOrder.filter(
        f => !nextPinnedLeft.includes(f) && !nextPinnedRight.includes(f)
      );

  for (const field of validSet) {
    const typedField = field as keyof TData & string;
    if (
      !nextPinnedLeft.includes(typedField) &&
      !nextPinnedRight.includes(typedField) &&
      !nextColumnOrder.includes(typedField)
    ) {
      nextColumnOrder.push(typedField);
    }
  }

  const nextPivotValues: PivotValueConfig<TData>[] = Array.isArray(snapshot.pivotValues)
    ? snapshot.pivotValues
        .filter(v => validSet.has(String(v.field)))
        .map(v => ({ ...v }))
    : prevState.pivotValues || [];

  return {
    ...prevState,
    globalFilter: snapshot.globalFilter ?? '',
    columnFilters: rehydrateViewColumnFilters(snapshot.columnFilters),
    multiSortConfig: nextMultiSort,
    sortConfig: nextMultiSort[0] || null,
    groupedBy: snapshot.groupedBy ? filterValid(snapshot.groupedBy) : [],
    visibleColumns: nextVisible.length > 0 ? nextVisible : Array.from(validSet) as (keyof TData & string)[],
    columnOrder: nextColumnOrder,
    pinnedColumns: {
      left: nextPinnedLeft,
      right: nextPinnedRight,
    },
    columnWidths: snapshot.columnWidths
      ? { ...prevState.columnWidths, ...snapshot.columnWidths }
      : prevState.columnWidths,
    pivotMode: snapshot.pivotMode ?? false,
    pivotColumns: snapshot.pivotColumns ? filterValid(snapshot.pivotColumns) : [],
    pivotValues: nextPivotValues,
    floatingFiltersOpen: snapshot.floatingFiltersOpen ?? prevState.floatingFiltersOpen,
    density: snapshot.density || prevState.density || 'normal',
    pageSize: snapshot.pageSize || prevState.pageSize || defaultPageSize,
    formulaColumns: nextFormulaColumns,
    currentPage: 1,
    focusedCell: null,
  };
}

export function mergeSavedViews<TData = any>(
  builtInViews: GridViewPreset<TData>[] = [],
  userViews: GridViewPreset<TData>[] = []
): GridViewPreset<TData>[] {
  const seen = new Set<string>();
  const merged: GridViewPreset<TData>[] = [];

  for (const preset of builtInViews) {
    if (!preset?.id || seen.has(preset.id)) continue;
    seen.add(preset.id);
    merged.push({ ...preset, builtIn: true });
  }

  for (const view of userViews) {
    if (!view?.id || seen.has(view.id)) continue;
    seen.add(view.id);
    merged.push({ ...view, builtIn: !!view.builtIn });
  }

  return merged;
}

export function describeGridViewSummary<TData = any>(
  snapshot: GridViewStateSnapshot<TData>
): string {
  const parts: string[] = [];

  if (snapshot.pivotMode) {
    parts.push('Pivot');
  } else if (snapshot.groupedBy && snapshot.groupedBy.length > 0) {
    parts.push(`${snapshot.groupedBy.length} group${snapshot.groupedBy.length > 1 ? 's' : ''}`);
  }

  const filterCount =
    Object.keys(snapshot.columnFilters || {}).length + (snapshot.globalFilter ? 1 : 0);
  if (filterCount > 0) {
    parts.push(`${filterCount} filter${filterCount > 1 ? 's' : ''}`);
  }

  const sortCount =
    snapshot.multiSortConfig && snapshot.multiSortConfig.length > 0
      ? snapshot.multiSortConfig.length
      : snapshot.sortConfig
        ? 1
        : 0;
  if (sortCount > 0) {
    parts.push(`${sortCount} sort${sortCount > 1 ? 's' : ''}`);
  }

  if (snapshot.formulaColumns && snapshot.formulaColumns.length > 0) {
    parts.push(`${snapshot.formulaColumns.length} fx`);
  }

  if (snapshot.density && snapshot.density !== 'normal') {
    parts.push(snapshot.density === 'compact' ? 'Compact' : 'Comfortable');
  }

  return parts.length > 0 ? parts.join(' · ') : 'Standard view';
}
