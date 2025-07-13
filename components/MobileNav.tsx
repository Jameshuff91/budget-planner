'use client';

import { Home, PieChart, TrendingUp, List, Settings, BarChart3 } from 'lucide-react';
import React from 'react';

import { cn } from '../lib/utils';

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const tabs = [
    { id: 'overview', label: 'Home', icon: Home },
    { id: 'categories', label: 'Categ', icon: PieChart },
    { id: 'trends', label: 'Trends', icon: TrendingUp },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'transactions', label: 'Trans', icon: List },
  ];

  return (
    <nav className='fixed bottom-0 left-0 right-0 bg-white border-t md:hidden z-50'>
      <div className='grid grid-cols-6 h-16'>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-xs transition-colors',
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className='h-5 w-5' />
              <span className='sr-only md:not-sr-only'>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
