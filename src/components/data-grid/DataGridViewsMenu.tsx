import * as React from 'react';
import type { GridDensity, GridViewPreset } from '@/types/data-grid';
import { describeGridViewSummary } from '@/lib/savedViews';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bookmark,
  Check,
  Plus,
  RotateCcw,
  Rows3,
  Save,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataGridViewsMenuProps<TData> {
  views: GridViewPreset<TData>[];
  activeViewId: string | null;
  onApplyView: (view: GridViewPreset<TData>) => void;
  onSaveNewView: (name: string) => void;
  onUpdateView: (viewId: string) => void;
  onDeleteView: (viewId: string) => void;
  onResetDefaultLayout: () => void;
}

export function DataGridViewsMenu<TData>({
  views,
  activeViewId,
  onApplyView,
  onSaveNewView,
  onUpdateView,
  onDeleteView,
  onResetDefaultLayout,
}: DataGridViewsMenuProps<TData>) {
  const [open, setOpen] = React.useState(false);
  const [newViewName, setNewViewName] = React.useState('');

  const activeView = React.useMemo(
    () => views.find(v => v.id === activeViewId) || null,
    [views, activeViewId]
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newViewName.trim();
    if (!trimmed) return;
    onSaveNewView(trimmed);
    setNewViewName('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={activeView ? 'secondary' : 'outline'}
          size="sm"
          aria-label="Saved grid views"
        >
          <Bookmark className="mr-1.5 h-4 w-4" />
          <span className="max-w-[120px] truncate">
            {activeView ? activeView.name : 'Views'}
          </span>
          {views.length > 0 && (
            <Badge variant="outline" className="ml-1.5 h-4 px-1 text-[10px]">
              {views.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 space-y-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider">
            Saved Views &amp; Presets
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Snapshot filters, multi-sort, grouping, pivot, columns &amp; density
          </p>
        </div>

        <form onSubmit={handleSave} className="flex items-center gap-1.5">
          <Input
            value={newViewName}
            onChange={e => setNewViewName(e.target.value)}
            placeholder="Save current view as..."
            className="h-8 text-xs flex-1"
            aria-label="New view name"
          />
          <Button
            type="submit"
            size="sm"
            className="h-8 px-2.5 text-xs shrink-0"
            disabled={!newViewName.trim()}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Save
          </Button>
        </form>

        {views.length > 0 ? (
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {views.map(view => {
              const isActive = view.id === activeViewId;
              const summary = describeGridViewSummary(view.state);
              return (
                <div
                  key={view.id}
                  className={cn(
                    'group flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                    isActive
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-transparent bg-muted/40 hover:bg-muted'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onApplyView(view);
                      setOpen(false);
                    }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-1.5 font-medium truncate">
                      {isActive && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      <span className="truncate">{view.name}</span>
                      {view.builtIn && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                          Preset
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {summary}
                    </div>
                  </button>
                  {!view.builtIn && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onUpdateView(view.id);
                        }}
                        className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                        title="Overwrite with current grid state"
                        aria-label={`Overwrite view ${view.name}`}
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onDeleteView(view.id);
                        }}
                        className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                        title={`Delete view ${view.name}`}
                        aria-label={`Delete view ${view.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            No saved views yet. Configure filters, sorting, or pivot and save above.
          </p>
        )}

        <div className="pt-2 border-t flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs w-full justify-center text-muted-foreground hover:text-foreground"
            onClick={() => {
              onResetDefaultLayout();
              setOpen(false);
            }}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset to Default Layout
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DataGridDensitySelectorProps {
  density: GridDensity;
  onDensityChange: (density: GridDensity) => void;
}

const DENSITY_OPTIONS: { value: GridDensity; label: string; hint: string }[] = [
  { value: 'compact', label: 'Compact', hint: 'High density (32px)' },
  { value: 'normal', label: 'Normal', hint: 'Standard spacing (48px)' },
  { value: 'comfortable', label: 'Comfortable', hint: 'Relaxed spacing (58px)' },
];

export function DataGridDensitySelector({
  density,
  onDensityChange,
}: DataGridDensitySelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Row density">
          <Rows3 className="mr-1.5 h-4 w-4" />
          <span className="capitalize">{density}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">Row Density</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DENSITY_OPTIONS.map(opt => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onDensityChange(opt.value)}
            className="flex items-center justify-between text-xs cursor-pointer"
          >
            <div>
              <div className="font-medium">{opt.label}</div>
              <div className="text-[10px] text-muted-foreground">{opt.hint}</div>
            </div>
            {density === opt.value && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
