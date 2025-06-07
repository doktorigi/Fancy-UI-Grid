
"use client";
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataGrid } from '@/components/data-grid/DataGrid';
import type { ColumnDefinition } from '@/types/data-grid';
import { Search, Play } from 'lucide-react';
import type { Policy } from '@/app/page';


const initialSearchTableData: Policy[] = [
  { id: 1, company: 'ABC Insurance', program: 'Target Umbrella', state: 'CA', policyNo: '123456', policyEff: '2025-01-01', premium: 1250.00, selected: true },
  { id: 2, company: 'XYZ Insurance', program: 'CPL', state: 'CA', policyNo: '123457', policyEff: '2025-01-02', premium: 980.00, selected: true },
  { id: 3, company: 'ABC Insurance', program: 'Target Umbrella', state: 'FL', policyNo: '123458', policyEff: '2025-01-01', premium: 1450.00, selected: true },
  { id: 4, company: 'DEF Insurance', program: 'Umbrella', state: 'FL', policyNo: '123459', policyEff: '2025-01-01', premium: 1125.00, selected: true },
  { id: 5, company: 'XYZ Insurance', program: 'CPL', state: 'FL', policyNo: '123460', policyEff: '2025-01-01', premium: 1050.00, selected: false },
  { id: 6, company: 'ABC Insurance', program: 'Umbrella', state: 'NY', policyNo: '123461', policyEff: '2025-01-03', premium: 1800.00, selected: true },
  { id: 7, company: 'DEF Insurance', program: 'Target Umbrella', state: 'NY', policyNo: '123462', policyEff: '2025-01-04', premium: 2100.00, selected: true },
  { id: 8, company: 'XYZ Insurance', program: 'CPL', state: 'TX', policyNo: '123463', policyEff: '2025-01-05', premium: 1300.00, selected: true },
  { id: 9, company: 'ABC Insurance', program: 'Umbrella', state: 'TX', policyNo: '123464', policyEff: '2025-01-06', premium: 1550.00, selected: false },
  { id: 10, company: 'DEF Insurance', program: 'CPL', state: 'CA', policyNo: '123465', policyEff: '2025-01-07', premium: 900.00, selected: true },
];

interface SearchFormProps {
  onExecute: (raterVersion: string) => void;
}

export const SearchForm: React.FC<SearchFormProps> = ({ onExecute }) => {
  const [dateEffectiveFrom, setDateEffectiveFrom] = useState('2025-02-01');
  const [dateEffectiveTo, setDateEffectiveTo] = useState('2025-04-01');
  const [selectedState, setSelectedState] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [raterVersion, setRaterVersion] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  
  const [inForceOnly, setInForceOnly] = useState(true);
  const [asOfDate, setAsOfDate] = useState('2025-06-04');
  const [isGuidewire, setIsGuidewire] = useState(true);
  const [isLegacy, setIsLegacy] = useState(true);
  const [effectiveDateType, setEffectiveDateType] = useState('actual');
  const [onLevelDate, setOnLevelDate] = useState('2025-01-01');

  const [gridData, setGridData] = useState<Policy[]>(initialSearchTableData);

  const handleSearch = () => {
    alert('Search clicked - Mock search. Data displayed is static for this demo.');
  };

  const handleActualExecute = () => {
    if (!raterVersion) {
      alert('Please select a rater version');
      return;
    }
    if (!selectedProduct) {
      alert('Please select a product');
      return;
    }
    onExecute(raterVersion);
  };

  const productOptions = [
    { value: 'xpltxl', label: 'XPLTXL' },
    { value: 'cpltpl', label: 'CPLTPL' },
    { value: 'umb', label: 'UMB' },
    { value: 'tum', label: 'TUM' },
    { value: 'pumb', label: 'PUMB' },
    { value: 'cpl', label: 'CPL' }
  ];
  const programOptions = [
    { value: 'Umbrella', label: 'Umbrella' },
    { value: 'Target Umbrella', label: 'Target Umbrella' },
    { value: 'CPL', label: 'CPL' }
  ];
  const companyOptions = [
    { value: 'ABC Insurance', label: 'ABC Insurance' },
    { value: 'XYZ Insurance', label: 'XYZ Insurance' },
    { value: 'DEF Insurance', label: 'DEF Insurance' }
  ];
  const stateOptions = [
    { value: 'CA', label: 'California' },
    { value: 'FL', label: 'Florida' },
    { value: 'NY', label: 'New York' },
    { value: 'TX', label: 'Texas' }
  ];
  const raterVersionOptions = [
    { value: '1.0.0', label: '1.0.0 (Current)' },
    { value: '1.1.0', label: '1.1.0 (Proposed)' }
  ];
  const effectiveDateOptions = [
    { value: 'actual', label: 'Actual effective date' },
    { value: 'prior', label: 'Prior effective date' },
    { value: 'onlevel', label: 'On-level' }
  ];

  const searchGridColumnDefs = useMemo<ColumnDefinition<Policy>[]>(() => [
    { field: 'company', headerText: 'Company', sortable: true, filterable: true, filterType: 'text', defaultWidth: '180px' },
    { field: 'program', headerText: 'Program', sortable: true, filterable: true, filterType: 'text', defaultWidth: '150px' },
    { 
      field: 'state', 
      headerText: 'State', 
      sortable: true, 
      filterable: true, 
      filterType: 'select', 
      filterOptions: stateOptions.map(opt => ({label: opt.label, value: opt.value})),
      defaultWidth: '120px',
    },
    { field: 'policyNo', headerText: 'Policy No.', sortable: true, filterable: true, filterType: 'text', defaultWidth: '120px' },
    { field: 'policyEff', headerText: 'Policy Eff.', sortable: true, filterable: true, filterType: 'date', defaultWidth: '130px' },
    { 
      field: 'premium', 
      headerText: 'Current Premium', 
      sortable: true, 
      filterable: true, 
      filterType: 'number', 
      defaultWidth: '150px',
    },
  ], [stateOptions]);


  return (
    <>
      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl text-primary">Search Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="mb-4">
                <Label htmlFor="searchStateSelect" className="block text-sm font-medium text-foreground mb-1">State</Label>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger id="searchStateSelect" className="bg-input border-border">
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    {stateOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-4">
                <Label htmlFor="searchProgramSelect" className="block text-sm font-medium text-foreground mb-1">Program</Label>
                <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                  <SelectTrigger id="searchProgramSelect" className="bg-input border-border">
                    <SelectValue placeholder="All Programs" />
                  </SelectTrigger>
                  <SelectContent>
                    {programOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-4">
                <Label htmlFor="searchCompanySelect" className="block text-sm font-medium text-foreground mb-1">Company</Label>
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger id="searchCompanySelect" className="bg-input border-border">
                    <SelectValue placeholder="All Companies" />
                  </SelectTrigger>
                  <SelectContent>
                    {companyOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
               <div className="mb-4">
                <Label className="block text-sm font-medium text-foreground mb-1">Select effective date for rating</Label>
                <div className="flex items-center space-x-2">
                  <Select value={effectiveDateType} onValueChange={setEffectiveDateType}>
                    <SelectTrigger className="flex-1 bg-input border-border">
                      <SelectValue placeholder="Select date type"/>
                    </SelectTrigger>
                    <SelectContent>
                      {effectiveDateOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {effectiveDateType === 'onlevel' && (
                    <Input 
                      type="date" 
                      value={onLevelDate} 
                      onChange={(e) => setOnLevelDate(e.target.value)} 
                      className="bg-input border-border"
                    />
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-4">
                <Label className="block text-sm font-medium text-foreground mb-2">Policy Status</Label>
                <div className="bg-muted/50 p-3 rounded-md border">
                  <div className="flex items-center mb-2">
                    <Checkbox id="inForceOnly" checked={inForceOnly} onCheckedChange={(checked) => setInForceOnly(!!checked)} className="mr-2" />
                    <Label htmlFor="inForceOnly" className="text-sm">In-force policies only</Label>
                  </div>
                  <div className="flex items-center">
                    <Label htmlFor="asOfDateInput" className="text-sm mr-2 shrink-0">As of date:</Label>
                    <Input 
                      id="asOfDateInput"
                      type="date" 
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                      className="flex-1 bg-input h-9 border-border"
                    />
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <Label htmlFor="policyNumberInput" className="block text-sm font-medium text-foreground mb-1">Policy Number</Label>
                <Input 
                  id="policyNumberInput"
                  type="text" 
                  value={policyNumber} 
                  onChange={(e) => setPolicyNumber(e.target.value)} 
                  className="bg-input border-border"
                  placeholder="Optional: Enter specific policy number"
                />
              </div>
            </div>

            <div>
              <div className="mb-4">
                <Label className="block text-sm font-medium text-foreground mb-2">Source System</Label>
                 <div className="bg-muted/50 p-3 rounded-md border">
                  <div className="flex items-center mb-2">
                    <Checkbox id="isGuidewire" checked={isGuidewire} onCheckedChange={(checked) => setIsGuidewire(!!checked)} className="mr-2"/>
                    <Label htmlFor="isGuidewire" className="text-sm">Guidewire</Label>
                  </div>
                  <div className="flex items-center">
                    <Checkbox id="isLegacy" checked={isLegacy} onCheckedChange={(checked) => setIsLegacy(!!checked)} className="mr-2"/>
                    <Label htmlFor="isLegacy" className="text-sm">Legacy (PAS)</Label>
                  </div>
                </div>
              </div>
               <div className="mb-4">
                <Label className="block text-sm font-medium text-foreground mb-2">Policy Effective Date</Label>
                <div className="bg-muted/50 p-3 rounded-md border space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="dateEffectiveFrom" className="w-12 text-sm shrink-0">From</Label>
                    <Input 
                      id="dateEffectiveFrom"
                      type="date" 
                      value={dateEffectiveFrom} 
                      onChange={(e) => setDateEffectiveFrom(e.target.value)} 
                      className="flex-1 bg-input h-9 ml-2 border-border"
                    />
                  </div>
                  <div className="flex items-center">
                    <Label htmlFor="dateEffectiveTo" className="w-12 text-sm shrink-0">To</Label>
                    <Input 
                      id="dateEffectiveTo"
                      type="date" 
                      value={dateEffectiveTo} 
                      onChange={(e) => setDateEffectiveTo(e.target.value)} 
                      className="flex-1 bg-input h-9 ml-2 border-border"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <Button 
                  onClick={handleSearch}
                  variant="default"
                  size="default"
                  className="uppercase tracking-wide font-medium"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
            <DataGrid<Policy>
                data={gridData}
                columnDefs={searchGridColumnDefs}
                defaultPageSize={5}
                pageSizeOptions={[5, 10, 20]}
                enableRowSelection={true}
             />
        </div>
        
        <Card className="w-full md:w-80 shadow-lg bg-blue-50 dark:bg-primary/10 border-primary/30">
          <CardHeader>
             <CardTitle className="text-lg text-primary">Repricing Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
              <Label htmlFor="productSelect" className="block text-sm font-medium text-foreground mb-1">Products</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger id="productSelect" className="bg-input border-border">
                  <SelectValue placeholder="Select Product" />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="raterVersionSelect" className="block text-sm font-medium text-foreground mb-1">Rater Version</Label>
              <Select value={raterVersion} onValueChange={setRaterVersion}>
                <SelectTrigger id="raterVersionSelect" className="bg-input border-border">
                  <SelectValue placeholder="Select Version" />
                </SelectTrigger>
                <SelectContent>
                  {raterVersionOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleActualExecute}
              variant="default"
              size="lg"
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground uppercase tracking-wide font-medium"
            >
              <Play className="mr-2 h-5 w-5" /> 
              Execute Repricing
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
