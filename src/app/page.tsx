
"use client";
import * as React from 'react';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { Sparkline } from '@/components/data-grid/Sparkline';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Github } from 'lucide-react';
import type { ColumnDefinition } from '@/types/data-grid';

interface ShowcasePolicy {
  id: number;
  insured: string;
  status: string;
  program: string;
  state: string;
  effectiveDate: string;
  premium: number;
  fees: number;
  lossRatio: number;
  premiumHistory: number[];
  premiumDeltas: number[];
  [key: string]: any;
}

const MONTHS = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
const FIRST = ['Summit', 'Northwind', 'Blue Harbor', 'Cedar', 'Granite', 'Ironwood', 'Lakeshore', 'Pioneer', 'Redstone', 'Silverline', 'Standard', 'Union', 'Vanguard', 'Westfield', 'Atlas', 'Beacon'];
const SECOND = ['Builders', 'Construction', 'Contracting', 'Development', 'Energy', 'Engineering', 'Environmental', 'Holdings', 'Industries', 'Logistics', 'Manufacturing', 'Mechanical', 'Properties', 'Restoration', 'Services', 'Solutions'];
const SUFFIX = ['LLC', 'Inc.', 'Corp.', 'Group'];
const PROGRAMS = ['General Liability', 'Professional Liability', 'Umbrella', 'Environmental'];
const STATES = ['CA', 'TX', 'FL', 'NY', 'PA', 'OH', 'GA', 'NC'];
const STATUSES = ['Bound', 'Bound', 'Bound', 'Bound', 'Quoted', 'Quoted', 'Quoted', 'Submitted', 'Submitted', 'Declined'];

// Everything is derived from the row index so the demo is identical on every visit.
function makePolicy(i: number): ShowcasePolicy {
  const premium = 5000 + ((i * 7919) % 2450) * 100;
  const history: number[] = [];
  let v = premium;
  for (let m = 11; m >= 0; m--) {
    history.unshift(Math.round(v / 100) * 100);
    v = v / (1 + ((((i + 1) * 31 + m * 17) % 13) - 6) / 100);
  }
  history[history.length - 1] = premium;
  return {
    id: i + 1,
    insured: `${FIRST[i % 16]} ${SECOND[(i * 7) % 16]} ${SUFFIX[i % 4]}`,
    status: STATUSES[i % 10],
    program: PROGRAMS[(i * 3) % 4],
    state: STATES[(i * 5) % 8],
    effectiveDate: `${2024 + (i % 3)}-${String(((i * 5) % 12) + 1).padStart(2, '0')}-${String(((i * 11) % 28) + 1).padStart(2, '0')}`,
    premium,
    fees: 250 + ((i * 131) % 22) * 100,
    lossRatio: (i * 37) % 140,
    premiumHistory: history,
    premiumDeltas: history.slice(1).map((h, j) => h - history[j]),
  };
}

const money = (v: number | undefined) =>
  typeof v === 'number' ? v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '';

const TRY_IT: { title: string; body: string }[] = [
  { title: 'Excel-style editing', body: 'Double-click Premium or Fees to edit. Select cells and drag the corner fill handle, paste straight from Excel (Ctrl+V), undo with Ctrl+Z.' },
  { title: 'Range charts', body: 'Drag-select some cells (try State through Fees), right-click, and pick "Chart Selection…" for bars, lines, stacked area, or pie.' },
  { title: 'Sparklines', body: 'The 12-Mo Premium and Δ / Month columns are inline SVG mini charts — hover them for per-month values.' },
  { title: 'Find, filter, search', body: 'Ctrl+F finds across the grid with highlights. Every column has typed filters — try the year/month tree on Effective.' },
  { title: 'Group & aggregate', body: 'Drag the Program or State header into the panel above the grid — groups collapse and premium sums roll up. Column totals live in the footer.' },
  { title: 'Arrange everything', body: 'Drag the ⣿ handle to reorder rows. Drag headers to reorder columns, resize their edges, pin or hide from the header menu.' },
  { title: 'Master-detail', body: 'Click the chevron on any row for a full-width detail panel — any React content, here with a larger sparkline.' },
  { title: 'Select & export', body: 'Select a block of numbers and watch Sum / Avg / Min / Max in the status bar. Copy as TSV with Ctrl+C or export CSV/XLSX.' },
];

export default function ShowcasePage() {
  const [rows, setRows] = React.useState<ShowcasePolicy[]>(() => Array.from({ length: 160 }, (_, i) => makePolicy(i)));
  const [virtualized, setVirtualized] = React.useState(false);

  const gridData = React.useMemo(
    () => (virtualized ? Array.from({ length: 10000 }, (_, i) => makePolicy(i)) : rows),
    [virtualized, rows]
  );

  const handleCellEdit = (rowId: string | number, field: keyof ShowcasePolicy & string, value: any) => {
    if (virtualized) return;
    setRows(prev => prev.map(row => (row.id === rowId ? { ...row, [field]: value } : row)));
  };

  const columnDefs = React.useMemo<ColumnDefinition<ShowcasePolicy>[]>(() => [
    { field: 'insured', headerText: 'Insured', sortable: true, filterable: true, filterType: 'text', defaultWidth: '200px', pinned: 'left', hideable: false },
    { field: 'status', headerText: 'Status', sortable: true, filterable: true, filterType: 'select', defaultWidth: '110px' },
    { field: 'program', headerText: 'Program', sortable: true, filterable: true, filterType: 'select', defaultWidth: '165px' },
    { field: 'state', headerText: 'State', sortable: true, filterable: true, filterType: 'select', defaultWidth: '90px' },
    { field: 'effectiveDate', headerText: 'Effective', sortable: true, filterable: true, filterType: 'date-tree', defaultWidth: '115px' },
    {
      field: 'premium', headerText: 'Premium', sortable: true, filterable: true, filterType: 'number',
      defaultWidth: '125px', editable: true, aggregate: 'sum', group: 'Financials',
      cellRenderer: (v) => money(v),
    },
    {
      field: 'fees', headerText: 'Fees', sortable: true, filterable: true, filterType: 'number',
      defaultWidth: '105px', editable: true, aggregate: 'sum', group: 'Financials',
      cellRenderer: (v) => money(v),
    },
    {
      field: 'lossRatio', headerText: 'Loss Ratio', sortable: true, filterable: true, filterType: 'number',
      defaultWidth: '110px', aggregate: 'avg', group: 'Financials',
      cellRenderer: (v) => `${v}%`,
    },
    {
      field: 'premiumHistory', headerText: '12-Mo Premium', defaultWidth: '150px',
      sortable: false, groupable: false, group: 'Trend',
      sparkline: { type: 'line', width: 124, height: 26, labels: MONTHS, format: money },
    },
    {
      field: 'premiumDeltas', headerText: 'Δ / Month', defaultWidth: '120px',
      sortable: false, groupable: false, group: 'Trend',
      sparkline: { type: 'winloss', width: 96, height: 22, labels: MONTHS.slice(1), format: (v) => `${v >= 0 ? '+' : ''}${money(v)}` },
    },
  ], []);

  const getRowStyle = React.useCallback((row: ShowcasePolicy): React.CSSProperties | undefined => {
    if (row.status === 'Bound') return { backgroundColor: 'hsl(150 60% 45% / 0.07)' };
    if (row.status === 'Declined') return { backgroundColor: 'hsl(0 70% 50% / 0.06)' };
    return undefined;
  }, []);

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-[1400px] px-6 py-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">Fancy UI Grid</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              A feature-rich React data grid — typed filters, grouping, Excel-style editing,
              in-cell sparklines, and range charts. Built with Next.js, ShadCN UI, and Tailwind. MIT licensed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="https://github.com/doktorigi/Fancy-UI-Grid" target="_blank" rel="noreferrer">
                <Github className="mr-2 h-4 w-4" />
                GitHub
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              {/* Relative anchor, not next/link: static export + basePath makes the
                  root RSC prefetch 404 on GitHub Pages; a plain link avoids it. */}
              <a href="repricing/">App demo →</a>
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <section aria-label="Things to try" className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TRY_IT.map(item => (
            <Card key={item.title} className="bg-card">
              <CardContent className="p-4">
                <h2 className="mb-1 text-sm font-semibold text-foreground">{item.title}</h2>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={virtualized}
            onChange={(e) => setVirtualized(e.target.checked)}
            className="h-4 w-4"
          />
          Virtualize 10,000 rows (windowed scrolling replaces pagination; editing applies to the 160-row dataset)
        </label>

        <DataGrid<ShowcasePolicy>
          data={gridData}
          columnDefs={columnDefs}
          defaultPageSize={25}
          pageSizeOptions={[10, 25, 50, 100]}
          enableRowSelection={true}
          enableGroupingPanel={true}
          enableRowReorder={!virtualized}
          onRowsReordered={(data) => { if (!virtualized) setRows(data); }}
          onCellEdit={handleCellEdit}
          virtualized={virtualized}
          storageKey="fancyGridShowcase"
          getRowStyle={getRowStyle}
          globalFilterPlaceholder="Search all columns..."
          detailRenderer={(row) => (
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <h3 className="mb-1 font-semibold">{row.insured}</h3>
                <p className="text-sm text-muted-foreground">{row.program} · {row.state} · effective {row.effectiveDate}</p>
                <p className="text-sm text-muted-foreground">Status: {row.status}</p>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Financials</h3>
                <p className="text-sm">Premium: {money(row.premium)}</p>
                <p className="text-sm">Fees: {money(row.fees)}</p>
                <p className="text-sm">Loss ratio: {row.lossRatio}%</p>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Trailing 12 months</h3>
                <Sparkline values={row.premiumHistory} type="area" width={280} height={56} labels={MONTHS} format={money} />
              </div>
            </div>
          )}
        />

        <footer className="mt-8 text-center text-xs text-muted-foreground">
          <a className="underline-offset-4 hover:underline" href="https://github.com/doktorigi/Fancy-UI-Grid" target="_blank" rel="noreferrer">
            github.com/doktorigi/Fancy-UI-Grid
          </a>{' '}
          · MIT License · Grid state (columns, filters, sort) persists in your browser's localStorage.
        </footer>
      </div>
    </div>
  );
}
