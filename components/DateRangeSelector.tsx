'use client';

import React, { useState, useCallback } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';

interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

interface Props {
  onDateRangeChange: (range: DateRange) => void;
  defaultRange?: 'month' | 'quarter' | 'year' | 'all';
}

export default function DateRangeSelector({ onDateRangeChange, defaultRange = 'month' }: Props) {
  const [selectedRange, setSelectedRange] = useState<DateRange>(getPresetRange(defaultRange));
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  function getPresetRange(preset: string): DateRange {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    switch (preset) {
      case 'month':
        return {
          startDate: new Date(currentYear, currentMonth, 1),
          endDate: new Date(currentYear, currentMonth + 1, 0),
          label: 'This Month',
        };
      case 'quarter':
        const currentQuarter = Math.floor(currentMonth / 3);
        return {
          startDate: new Date(currentYear, currentQuarter * 3, 1),
          endDate: new Date(currentYear, currentQuarter * 3 + 3, 0),
          label: 'This Quarter',
        };
      case 'year':
        return {
          startDate: new Date(currentYear, 0, 1),
          endDate: new Date(currentYear, 11, 31),
          label: 'This Year',
        };
      case 'all':
        return {
          startDate: new Date(2020, 0, 1), // Arbitrary old date
          endDate: new Date(),
          label: 'All Time',
        };
      default:
        return getPresetRange('month');
    }
  }

  const handlePresetSelect = useCallback(
    (preset: string) => {
      const range = getPresetRange(preset);
      setSelectedRange(range);
      onDateRangeChange(range);
      setIsCustomOpen(false);
    },
    [onDateRangeChange],
  );

  const handleCustomRange = useCallback(() => {
    if (customStart && customEnd) {
      const range: DateRange = {
        startDate: new Date(customStart),
        endDate: new Date(customEnd),
        label: 'Custom Range',
      };
      setSelectedRange(range);
      onDateRangeChange(range);
      setIsCustomOpen(false);
    }
  }, [customStart, customEnd, onDateRangeChange]);

  const getQuickRanges = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    return [
      {
        label: 'Last 7 Days',
        range: {
          startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
          endDate: today,
          label: 'Last 7 Days',
        },
      },
      {
        label: 'Last 30 Days',
        range: {
          startDate: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          endDate: today,
          label: 'Last 30 Days',
        },
      },
      {
        label: 'Last 90 Days',
        range: {
          startDate: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
          endDate: today,
          label: 'Last 90 Days',
        },
      },
      {
        label: 'Last Month',
        range: {
          startDate: new Date(currentYear, currentMonth - 1, 1),
          endDate: new Date(currentYear, currentMonth, 0),
          label: 'Last Month',
        },
      },
      {
        label: 'Last Quarter',
        range: (() => {
          const lastQuarter = Math.floor((currentMonth - 3) / 3);
          const year = lastQuarter < 0 ? currentYear - 1 : currentYear;
          const quarter = lastQuarter < 0 ? 3 : lastQuarter;
          return {
            startDate: new Date(year, quarter * 3, 1),
            endDate: new Date(year, quarter * 3 + 3, 0),
            label: 'Last Quarter',
          };
        })(),
      },
      {
        label: 'Last Year',
        range: {
          startDate: new Date(currentYear - 1, 0, 1),
          endDate: new Date(currentYear - 1, 11, 31),
          label: 'Last Year',
        },
      },
      {
        label: 'Year to Date',
        range: {
          startDate: new Date(currentYear, 0, 1),
          endDate: today,
          label: 'Year to Date',
        },
      },
    ];
  };

  const formatDateRange = (range: DateRange) => {
    const start = range.startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const end = range.endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${start} - ${end}`;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[280px] justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {selectedRange.label}: {formatDateRange(selectedRange)}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[280px]" align="start">
          <DropdownMenuItem onClick={() => handlePresetSelect('month')}>
            This Month
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetSelect('quarter')}>
            This Quarter
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetSelect('year')}>
            This Year
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetSelect('all')}>
            All Time
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {getQuickRanges().map((quickRange) => (
            <DropdownMenuItem
              key={quickRange.label}
              onClick={() => {
                setSelectedRange(quickRange.range);
                onDateRangeChange(quickRange.range);
              }}
            >
              {quickRange.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsCustomOpen(true)}>
            Custom Range...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isCustomOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Select Custom Date Range</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <input
                    id="start-date"
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    max={customEnd || new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <input
                    id="end-date"
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    min={customStart}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="flex gap-2 justify-end mt-6">
                  <Button variant="outline" onClick={() => setIsCustomOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCustomRange}
                    disabled={!customStart || !customEnd}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}