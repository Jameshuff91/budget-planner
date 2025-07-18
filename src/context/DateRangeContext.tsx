'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

interface DateRangeContextType {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  isWithinRange: (date: Date | string) => boolean;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    return {
      startDate: new Date(currentYear, currentMonth, 1),
      endDate: new Date(currentYear, currentMonth + 1, 0),
      label: 'This Month',
    };
  });

  const isWithinRange = useCallback(
    (date: Date | string) => {
      const checkDate = typeof date === 'string' ? new Date(date) : date;
      return checkDate >= dateRange.startDate && checkDate <= dateRange.endDate;
    },
    [dateRange],
  );

  return (
    <DateRangeContext.Provider value={{ dateRange, setDateRange, isWithinRange }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error('useDateRange must be used within a DateRangeProvider');
  }
  return context;
}
