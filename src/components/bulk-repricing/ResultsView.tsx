
"use client";
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataGrid } from '@/components/data-grid/DataGrid';
import type { ColumnDefinition } from '@/types/data-grid';
import { ArrowLeft, Table as TableIcon } from 'lucide-react';
import type { ResultPolicy } from '@/app/page';
import { Badge } from '@/components/ui/badge';


const initialResultsData: Omit<ResultPolicy, 'premium'>[] = [
  { id: 1, company: 'ABC Insurance', program: 'Target Umbrella', policyNo: '123456', state: 'CA', currentPremium: 1250.00, newPremium: 1312.50, difference: 62.50, policyEff: '2025-01-15', raterVersion: '1.1.0' },
  { id: 2, company: 'XYZ Insurance', program: 'CPL', policyNo: '123457', state: 'CA', currentPremium: 980.00, newPremium: 970.20, difference: -9.80, policyEff: '2025-02-10', raterVersion: '1.1.0' },
  { id: 3, company: 'ABC Insurance', program: 'Target Umbrella', policyNo: '123458', state: 'FL', currentPremium: 1450.00, newPremium: 1595.00, difference: 145.00, policyEff: '2025-03-01', raterVersion: '1.1.0' },
  { id: 4, company: 'DEF Insurance', program: 'Umbrella', policyNo: '123459', state: 'FL', currentPremium: 1125.00, newPremium: 1147.50, difference: 22.50, policyEff: '2025-01-20', raterVersion: '1.1.0' },
  { id: 5, company: 'XYZ Insurance', program: 'CPL', policyNo: '123460', state: 'FL', currentPremium: 1050.00, newPremium: 1050.00, difference: 0.00, policyEff: '2025-04-05', raterVersion: '1.1.0' },
  { id: 6, company: 'ABC Insurance', program: 'Umbrella', policyNo: '123461', state: 'NY', currentPremium: 1800.00, newPremium: 1908.00, difference: 108.00, policyEff: '2025-02-22', raterVersion: '1.1.0' },
  { id: 7, company: 'DEF Insurance', program: 'Target Umbrella', policyNo: '123462', state: 'NY', currentPremium: 2100.00, newPremium: 2268.00, difference: 168.00, policyEff: '2025-03-15', raterVersion: '1.1.0' },
  { id: 8, company: 'XYZ Insurance', program: 'CPL', policyNo: '123463', state: 'TX', currentPremium: 1300.00, newPremium: 1274.00, difference: -26.00, policyEff: '2025-01-28', raterVersion: '1.1.0' },
  { id: 9, company: 'ABC Insurance', program: 'Umbrella', policyNo: '123464', state: 'TX', currentPremium: 1550.00, newPremium: 1565.50, difference: 15.50, policyEff: '2025-02-18', raterVersion: '1.1.0' },
  { id: 10, company: 'DEF Insurance', program: 'CPL', policyNo: '123465', state: 'CA', currentPremium: 900.00, newPremium: 981.00, difference: 81.00, policyEff: '2025-03-25', raterVersion: '1.1.0' },
];

interface ResultsViewProps {
  raterVersion: string;
  onBackToSearch: () => void;
}

const formatCurrency = (value: number | undefined) => {
  if (typeof value === 'undefined') return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const TRAILING_MONTHS = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

// Deterministic 12-month premium history ending at the current premium, so the
// sparkline demo is stable across reloads.
const premiumHistoryFor = (id: number, currentPremium: number): number[] => {
  const series: number[] = [];
  let value = currentPremium;
  for (let m = 11; m >= 0; m--) {
    series.unshift(Math.round(value));
    const wobble = (((id * 31 + m * 17) % 13) - 6) / 100; // -6%..+6%
    value = value / (1 + wobble);
  }
  series[series.length - 1] = currentPremium;
  return series;
};

const deltasOf = (history: number[]): number[] =>
  history.slice(1).map((v, i) => v - history[i]);

export const ResultsView: React.FC<ResultsViewProps> = ({ raterVersion, onBackToSearch }) => {
  const [resultsData, setResultsData] = useState<ResultPolicy[]>(initialResultsData.map(d => {
    const premiumHistory = premiumHistoryFor(d.id, d.currentPremium);
    return {...d, premium: d.currentPremium, raterVersion, premiumHistory, premiumDeltas: deltasOf(premiumHistory)};
  }));
  const [virtualizedDemo, setVirtualizedDemo] = useState(false);

  // Deterministic synthetic dataset to demo virtualized scrolling over many rows.
  const gridData = useMemo<ResultPolicy[]>(() => {
    if (!virtualizedDemo) return resultsData;
    const companies = ['ABC Insurance', 'XYZ Insurance', 'DEF Insurance', 'GHI Insurance'];
    const programs = ['Target Umbrella', 'CPL', 'Umbrella'];
    const states = ['CA', 'FL', 'NY', 'TX', 'PA', 'OH'];
    return Array.from({ length: 5000 }, (_, i) => {
      const currentPremium = 800 + ((i * 137) % 2200);
      const difference = Math.round(currentPremium * (((i * 61) % 21) - 10)) / 100;
      const premiumHistory = premiumHistoryFor(i + 1, currentPremium);
      return {
        id: i + 1,
        company: companies[i % companies.length],
        program: programs[i % programs.length],
        policyNo: String(100000 + i),
        state: states[i % states.length],
        currentPremium,
        newPremium: currentPremium + difference,
        difference,
        premium: currentPremium,
        policyEff: `2025-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
        raterVersion,
        premiumHistory,
        premiumDeltas: deltasOf(premiumHistory),
      };
    });
  }, [virtualizedDemo, resultsData, raterVersion]);

  const summaryTotalPolicies = gridData.length;
  const summarySourcePremium = gridData.reduce((sum, row) => sum + row.currentPremium, 0);
  const summaryNewPremium = gridData.reduce((sum, row) => sum + row.newPremium, 0);
  const batchId = "2593421";

  const handleExcelRaterClick = (row: ResultPolicy) => {
    alert(`Excel Rater for Policy ${row.policyNo}. This would call the excel download from coherent with the rater inputs and outputs.`);
  };

  // Cell edits (inline, paste, fill handle) land here; editing New Premium keeps the
  // Difference column consistent. The virtualized demo dataset is synthetic, so edits
  // and reordering only apply to the real 10-row dataset.
  const handleCellEdit = (rowId: string | number, field: keyof ResultPolicy & string, value: any) => {
    if (virtualizedDemo) return;
    setResultsData(prev =>
      prev.map(row => {
        if (row.id !== rowId) return row;
        const updated = { ...row, [field]: value };
        if (field === 'newPremium' && typeof value === 'number') {
          updated.difference = Math.round((value - row.currentPremium) * 100) / 100;
        }
        return updated;
      })
    );
  };

  const handleRowsReordered = (data: ResultPolicy[]) => {
    if (virtualizedDemo) return;
    setResultsData(data);
  };


  const resultsGridColumnDefs = useMemo<ColumnDefinition<ResultPolicy>[]>(() => [
    { field: 'company', headerText: 'Company', sortable: true, filterable: true, filterType: 'text', defaultWidth: '180px' },
    { field: 'program', headerText: 'Program', sortable: true, filterable: true, filterType: 'text', defaultWidth: '150px' },
    { field: 'policyNo', headerText: 'Policy No.', sortable: true, filterable: true, filterType: 'text', defaultWidth: '120px' },
    { 
      field: 'state', 
      headerText: 'State', 
      sortable: true, 
      filterable: true, 
      filterType: 'select',
      filterOptions: [...new Set(gridData.map(r => r.state))].map(s => ({label: s, value: s})),
      defaultWidth: '100px',
    },
    {
      field: 'currentPremium',
      headerText: 'Current Premium',
      sortable: true,
      filterable: true,
      filterType: 'number',
      defaultWidth: '150px',
      aggregate: 'sum',
      group: 'Premium',
      cellRenderer: (value) => formatCurrency(value),
    },
    {
      field: 'newPremium',
      headerText: 'New Premium',
      sortable: true,
      filterable: true,
      filterType: 'number',
      defaultWidth: '150px',
      aggregate: 'sum',
      group: 'Premium',
      editable: true,
      cellRenderer: (value) => formatCurrency(value),
    },
    {
      field: 'difference',
      headerText: 'Difference',
      sortable: true,
      filterable: true,
      filterType: 'number',
      defaultWidth: '120px',
      aggregate: 'sum',
      group: 'Premium',
      cellRenderer: (value) => (
        <span className={value > 0 ? 'text-red-600 dark:text-red-400' : value < 0 ? 'text-green-600 dark:text-green-400' : ''}>
          {formatCurrency(value)}
        </span>
      ),
    },
    {
      field: 'premiumHistory',
      headerText: 'Premium Trend',
      defaultWidth: '140px',
      sortable: false,
      groupable: false,
      group: 'Premium',
      sparkline: {
        type: 'line',
        width: 116,
        height: 26,
        labels: TRAILING_MONTHS,
        format: (v) => formatCurrency(v),
      },
    },
    {
      field: 'premiumDeltas',
      headerText: 'Δ / Month',
      defaultWidth: '120px',
      sortable: false,
      groupable: false,
      group: 'Premium',
      sparkline: {
        type: 'winloss',
        width: 96,
        height: 22,
        labels: TRAILING_MONTHS.slice(1),
        format: (v) => `${v >= 0 ? '+' : ''}${formatCurrency(v)}`,
      },
    },
    {
      field: 'raterVersion',
      headerText: 'Rater',
      sortable: true,
      filterable: true,
      filterType: 'text',
      defaultWidth: '100px',
    },
    {
      field: 'id',
      headerText: 'Actions',
      defaultWidth: '150px',
      sortable: false,
      groupable: false,
      cellRenderer: (_value, row) => (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleExcelRaterClick(row); }}>
          <TableIcon className="mr-1 h-3 w-3" /> Excel Rater
        </Button>
      ),
    },
  ], [gridData]); // State filter options derive from the active dataset


  return (
    <Card className="shadow-lg">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl text-primary">Repricing Results</CardTitle>
          <Button 
            variant="outline"
            onClick={onBackToSearch}
            className="uppercase tracking-wide font-medium"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Search
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-primary/10 dark:to-primary/20 p-6 mb-6 rounded-lg border border-blue-200 dark:border-primary/30">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="text-center bg-card">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Total Policies</p>
                <p className="text-2xl font-bold text-foreground">{summaryTotalPolicies}</p>
              </CardContent>
            </Card>
             <Card className="text-center bg-card">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Source Premium</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(summarySourcePremium)}</p>
              </CardContent>
            </Card>
             <Card className="text-center bg-card">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">New Premium</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(summaryNewPremium)}</p>
              </CardContent>
            </Card>
             <Card className="text-center bg-card">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Batch ID</p>
                <p className="text-2xl font-bold text-foreground">{batchId}</p>
              </CardContent>
            </Card>
          </div>
        </div>
        
        <label className="mb-3 flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={virtualizedDemo}
            onChange={(e) => setVirtualizedDemo(e.target.checked)}
            className="h-4 w-4"
          />
          Virtualized demo — replace the 10 sample rows with 5,000 generated rows and windowed scrolling
        </label>
        <DataGrid<ResultPolicy>
          data={gridData}
          columnDefs={resultsGridColumnDefs}
          defaultPageSize={5}
          pageSizeOptions={[5, 10, 20, 50]}
          enableRowSelection={true}
          enableGroupingPanel={true}
          virtualized={virtualizedDemo}
          storageKey="repricingResultsGrid"
          onCellEdit={handleCellEdit}
          enableRowReorder={!virtualizedDemo}
          onRowsReordered={handleRowsReordered}
          detailRenderer={(row) => (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <h4 className="mb-2 font-semibold">Policy {row.policyNo}</h4>
                <p className="text-sm text-muted-foreground">{row.company} — {row.program} ({row.state})</p>
                <p className="text-sm text-muted-foreground">Effective {row.policyEff} · Rater v{row.raterVersion}</p>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">Repricing</h4>
                <p className="text-sm">Current premium: {formatCurrency(row.currentPremium)}</p>
                <p className="text-sm">New premium: {formatCurrency(row.newPremium)}</p>
                <p className="text-sm">Difference: {formatCurrency(row.difference)}</p>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">Master-Detail</h4>
                <p className="text-sm text-muted-foreground">
                  This panel comes from the grid&apos;s <code>detailRenderer</code> prop — render
                  anything here: charts, forms, even a nested grid.
                </p>
              </div>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
};
