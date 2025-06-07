
"use client";
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchForm } from '@/components/bulk-repricing/SearchForm';
import { ResultsView } from '@/components/bulk-repricing/ResultsView';
import { ThemeToggle } from '@/components/theme-toggle';

export interface Policy {
  id: number;
  company: string;
  program: string;
  state: string;
  policyNo: string;
  policyEff: string; 
  premium: number; 
  selected?: boolean; 
}

export interface ResultPolicy extends Policy {
  currentPremium: number;
  newPremium: number;
  difference: number;
  raterVersion?: string; 
}


export default function BulkRepricingPage() {
  const [showResults, setShowResults] = useState(false);
  const [raterVersionForResults, setRaterVersionForResults] = useState('');
  const [selectedTool, setSelectedTool] = useState('pumb');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    // Ensure this only runs on the client
    if (typeof window !== 'undefined') {
        setCurrentDate(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    }
  }, []);


  const handleExecuteRepricing = (raterVersion: string) => {
    setRaterVersionForResults(raterVersion);
    setShowResults(true);
  };

  const handleBackToSearch = () => {
    setShowResults(false);
  };

  const toolOptions = [
    { value: 'pumb', label: 'PUMB' },
    { value: 'Wholesale', label: 'Wholesale Casualty' },
    { value: 'hca', label: 'HCA' }
  ];


  return (
    <div className="bg-background min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">Bulk Repricing Application</h1>
              <div className="flex items-center">
                <label htmlFor="lobSelect" className="text-sm font-medium text-muted-foreground mr-2">Line of Business:</label>
                <Select value={selectedTool} onValueChange={setSelectedTool}>
                  <SelectTrigger id="lobSelect" className="w-auto px-3 py-1 h-8 text-sm bg-card data-[state=open]:ring-ring data-[state=open]:ring-2">
                    <SelectValue placeholder="Select LOB" />
                  </SelectTrigger>
                  <SelectContent>
                    {toolOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground text-right">
                 {currentDate}
                </div>
                <ThemeToggle />
            </div>
          </div>
        </header>
        
        {showResults 
          ? <ResultsView raterVersion={raterVersionForResults} onBackToSearch={handleBackToSearch} /> 
          : <SearchForm onExecute={handleExecuteRepricing} />
        }
      </div>
    </div>
  );
}
