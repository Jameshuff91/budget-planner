'use client';

import { Card } from '@components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Button } from '@components/ui/button';
import Dashboard from './Dashboard';
import BudgetVsActualAnalysis from './BudgetVsActualAnalysis';
import FinancialInsights from './FinancialInsights';
import AdvancedReports from './AdvancedReports';
import YearOverYearComparison from './YearOverYearComparison';
import { useDBContext } from '@context/DatabaseContext';
import { checkBudgetAlerts, checkBudgetStatus } from '@services/budgetAlertService';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Lightbulb,
  FileText,
  Calendar,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function EnhancedDashboard() {
  const { transactions, categories } = useDBContext();
  const router = useRouter();
  const [budgetStatus, setBudgetStatus] = useState<{
    overBudget: number;
    nearLimit: number;
  }>({ overBudget: 0, nearLimit: 0 });

  // Get current month date range
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  useEffect(() => {
    // Check budget alerts when transactions or categories change
    if (transactions.length > 0 && categories.length > 0) {
      checkBudgetAlerts(transactions, categories);

      // Update budget status
      const status = checkBudgetStatus(transactions, categories);
      setBudgetStatus({
        overBudget: status.overBudget,
        nearLimit: status.nearLimit,
      });
    }
  }, [transactions, categories]);

  return (
    <div className="space-y-6">
      {/* Budget Status Banner */}
      {(budgetStatus.overBudget > 0 || budgetStatus.nearLimit > 0) && (
        <Card
          className={`p-4 ${
            budgetStatus.overBudget > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle
                className={`w-5 h-5 ${
                  budgetStatus.overBudget > 0 ? 'text-red-600' : 'text-yellow-600'
                }`}
              />
              <div>
                <p
                  className={`font-semibold ${
                    budgetStatus.overBudget > 0 ? 'text-red-900' : 'text-yellow-900'
                  }`}
                >
                  {budgetStatus.overBudget > 0
                    ? `Over budget in ${budgetStatus.overBudget} ${budgetStatus.overBudget === 1 ? 'category' : 'categories'}`
                    : `Approaching limit in ${budgetStatus.nearLimit} ${budgetStatus.nearLimit === 1 ? 'category' : 'categories'}`}
                </p>
                <p
                  className={`text-sm ${
                    budgetStatus.overBudget > 0 ? 'text-red-700' : 'text-yellow-700'
                  }`}
                >
                  Review your spending in the Budget Analysis tab
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              Manage Alerts
            </Button>
          </div>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="budget" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Budget</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            <span className="hidden sm:inline">Insights</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Reports</span>
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Year/Year</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Dashboard />
        </TabsContent>

        <TabsContent value="budget" className="space-y-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Budget Analysis</h2>
            <p className="text-muted-foreground">
              Track your budget vs actual spending for the current month
            </p>
          </div>
          <BudgetVsActualAnalysis startDate={startOfMonth} endDate={endOfMonth} />
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Financial Insights</h2>
            <p className="text-muted-foreground">
              Personalized recommendations and spending analysis
            </p>
          </div>
          <FinancialInsights />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Advanced Reports</h2>
            <p className="text-muted-foreground">
              Detailed financial reports and tax documentation
            </p>
          </div>
          <AdvancedReports />
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">Year-over-Year Comparison</h2>
            <p className="text-muted-foreground">
              Compare your spending patterns across years
            </p>
          </div>
          <YearOverYearComparison selectedYear={now.getFullYear()} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
