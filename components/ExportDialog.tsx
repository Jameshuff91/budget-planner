'use client';

import { Download } from 'lucide-react';
import React, { useState } from 'react';

import { useDBContext } from '@context/DatabaseContext';

import { Transaction } from '../src/types';
import { exportTransactionsToCSV, exportCategorySummaryToCSV } from '../src/utils/csvExport';

import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { toast } from './ui/use-toast';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const { transactions } = useDBContext();
  const [exportType, setExportType] = useState<'all' | 'range' | 'month' | 'year'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [includeCategories, setIncludeCategories] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<'detailed' | 'summary'>('detailed');

  // Get unique categories
  const categories = Array.from(new Set(transactions.map((t) => t.category))).sort();

  // Get available years
  const years = Array.from(new Set(transactions.map((t) => new Date(t.date).getFullYear()))).sort(
    (a, b) => b - a,
  );

  const filterTransactions = (): Transaction[] => {
    let filtered = [...transactions];

    // Apply date filters
    switch (exportType) {
      case 'range':
        if (startDate && endDate) {
          filtered = filtered.filter((t) => {
            const date = new Date(t.date);
            return date >= new Date(startDate) && date <= new Date(endDate);
          });
        }
        break;
      case 'month':
        filtered = filtered.filter((t) => t.date.startsWith(selectedMonth));
        break;
      case 'year':
        filtered = filtered.filter(
          (t) => new Date(t.date).getFullYear() === parseInt(selectedYear),
        );
        break;
    }

    // Apply category filter if any categories are selected
    if (includeCategories.length > 0) {
      filtered = filtered.filter((t) => includeCategories.includes(t.category));
    }

    return filtered;
  };

  const handleExport = () => {
    try {
      const filteredTransactions = filterTransactions();

      if (filteredTransactions.length === 0) {
        toast({
          title: 'No data to export',
          description: 'No transactions match the selected criteria',
          variant: 'destructive',
        });
        return;
      }

      if (exportFormat === 'detailed') {
        exportTransactionsToCSV(filteredTransactions);
        toast({
          title: 'Success',
          description: `Exported ${filteredTransactions.length} transactions to CSV`,
        });
      } else {
        exportCategorySummaryToCSV(filteredTransactions);
        toast({
          title: 'Success',
          description: 'Exported category summary to CSV',
        });
      }

      onClose();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to export data',
        variant: 'destructive',
      });
    }
  };

  const handleCategoryToggle = (category: string) => {
    setIncludeCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>Export Transactions</DialogTitle>
          <DialogDescription>
            Choose your export options and download your financial data as CSV.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          {/* Date Range Selection */}
          <div className='space-y-3'>
            <Label>Date Range</Label>
            <RadioGroup
              value={exportType}
              onValueChange={(value: 'all' | 'range' | 'month' | 'year') => setExportType(value)}
            >
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='all' id='all' />
                <Label htmlFor='all' className='font-normal'>
                  All transactions
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='range' id='range' />
                <Label htmlFor='range' className='font-normal'>
                  Custom date range
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='month' id='month' />
                <Label htmlFor='month' className='font-normal'>
                  Specific month
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='year' id='year' />
                <Label htmlFor='year' className='font-normal'>
                  Specific year
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Date inputs based on selection */}
          {exportType === 'range' && (
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='start-date'>Start Date</Label>
                <Input
                  id='start-date'
                  type='date'
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='end-date'>End Date</Label>
                <Input
                  id='end-date'
                  type='date'
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            </div>
          )}

          {exportType === 'month' && (
            <div className='space-y-2'>
              <Label htmlFor='month'>Select Month</Label>
              <Input
                id='month'
                type='month'
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          )}

          {exportType === 'year' && (
            <div className='space-y-2'>
              <Label htmlFor='year'>Select Year</Label>
              <select
                id='year'
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md'
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category Filter */}
          <div className='space-y-3'>
            <Label>Categories (select all that apply)</Label>
            <div className='grid grid-cols-3 gap-2 max-h-32 overflow-y-auto'>
              {categories.map((category) => (
                <label key={category} className='flex items-center space-x-2'>
                  <input
                    type='checkbox'
                    checked={includeCategories.includes(category)}
                    onChange={() => handleCategoryToggle(category)}
                    className='rounded border-gray-300'
                  />
                  <span className='text-sm'>{category}</span>
                </label>
              ))}
            </div>
            {includeCategories.length === 0 && (
              <p className='text-sm text-gray-500'>All categories will be included</p>
            )}
          </div>

          {/* Export Format */}
          <div className='space-y-3'>
            <Label>Export Format</Label>
            <RadioGroup
              value={exportFormat}
              onValueChange={(value: 'detailed' | 'summary') => setExportFormat(value)}
            >
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='detailed' id='detailed' />
                <Label htmlFor='detailed' className='font-normal'>
                  Detailed transactions (all individual transactions)
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='summary' id='summary' />
                <Label htmlFor='summary' className='font-normal'>
                  Category summary (totals by category)
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport}>
            <Download className='h-4 w-4 mr-2' />
            Export to CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
