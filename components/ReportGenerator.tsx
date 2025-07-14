'use client';

import { useState, useRef } from 'react';
import { format, subMonths, startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';
import { Download, FileText, Calendar, Settings, ChartBar } from 'lucide-react';

import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { Switch } from '@components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { useToast } from '@components/ui/use-toast';
import { useDBContext } from '@context/DatabaseContext';
import { useAnalytics } from '@hooks/useAnalytics';
import { reportService, ReportOptions, ReportData, ChartData } from '../src/services/reportService';
import { PDFGenerator, createFinancialReport, captureCharts } from '../src/utils/pdfGenerator';
import { formatCurrency } from '@utils/helpers';
import { logger } from '@services/logger';

interface ReportGeneratorProps {
  className?: string;
}

export default function ReportGenerator({ className }: ReportGeneratorProps) {
  const { transactions, loading } = useDBContext();
  const { toast } = useToast();

  // Report configuration state
  const [reportType, setReportType] = useState<'monthly' | 'yearly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportTitle, setReportTitle] = useState('');

  // Report options state
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeTransactionDetails, setIncludeTransactionDetails] = useState(true);
  const [includeCategorySummary, setIncludeCategorySummary] = useState(true);
  const [includeTaxReport, setIncludeTaxReport] = useState(false);
  const [includeRecurringAnalysis, setIncludeRecurringAnalysis] = useState(true);
  const [includeNetWorth, setIncludeNetWorth] = useState(false);

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');

  // Get analytics data for the selected date range
  const dateRange = {
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  };

  const analytics = useAnalytics(dateRange);

  // Quick date range presets
  const setDateRange = (
    type: 'current-month' | 'last-month' | 'current-year' | 'last-3-months' | 'last-6-months',
  ) => {
    const now = new Date();
    let start: Date, end: Date;

    switch (type) {
      case 'current-month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        setReportType('monthly');
        break;
      case 'last-month':
        const lastMonth = subMonths(now, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        setReportType('monthly');
        break;
      case 'current-year':
        start = startOfYear(now);
        end = endOfYear(now);
        setReportType('yearly');
        break;
      case 'last-3-months':
        start = startOfMonth(subMonths(now, 2));
        end = endOfMonth(now);
        setReportType('custom');
        break;
      case 'last-6-months':
        start = startOfMonth(subMonths(now, 5));
        end = endOfMonth(now);
        setReportType('custom');
        break;
      default:
        return;
    }

    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  // Prepare report data
  const prepareReportData = (): ReportData => {
    const filteredTransactions = transactions.filter((t) => {
      const transactionDate = new Date(t.date);
      return transactionDate >= dateRange.startDate && transactionDate <= dateRange.endDate;
    });

    const totalIncome = filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = filteredTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netSavings = totalIncome - totalExpenses;

    return {
      transactions: filteredTransactions,
      categorySpending: analytics.categorySpending,
      spendingTrend: analytics.spendingTrend,
      monthlyTrends: analytics.monthlyTrends,
      merchantSpending: analytics.merchantSpending,
      potentialRecurringTransactions: analytics.potentialRecurringTransactions,
      totalIncome,
      totalExpenses,
      netSavings,
      periodLabel: `${format(dateRange.startDate, 'MMM dd, yyyy')} - ${format(dateRange.endDate, 'MMM dd, yyyy')}`,
    };
  };

  // Capture chart elements
  const captureChartsFromDOM = async (): Promise<ChartData[]> => {
    const charts: ChartData[] = [];

    if (!includeCharts) return charts;

    try {
      // Look for chart containers with specific data attributes or classes
      const chartSelectors = [
        '[data-chart="spending-by-category"]',
        '[data-chart="spending-trend"]',
        '.recharts-wrapper',
        '.chart-container',
      ];

      for (const selector of chartSelectors) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element, index) => {
          if (element instanceof HTMLElement) {
            const title =
              element.getAttribute('data-chart-title') ||
              element.querySelector('h3, h4, .chart-title')?.textContent ||
              `Chart ${index + 1}`;

            charts.push({
              element,
              title: title.trim(),
              description: element.getAttribute('data-chart-description') || undefined,
            });
          }
        });
      }

      logger.info(`Captured ${charts.length} charts for report`);
    } catch (error) {
      logger.error('Error capturing charts:', error);
      toast({
        title: 'Chart Capture Warning',
        description: 'Some charts may not be included in the report.',
        variant: 'destructive',
      });
    }

    return charts;
  };

  // Generate PDF report
  const generatePDFReport = async () => {
    try {
      setIsGenerating(true);

      const reportData = prepareReportData();
      const charts = await captureChartsFromDOM();

      const options: ReportOptions = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        includeCharts,
        includeTransactionDetails,
        includeCategorySummary,
        includeTaxReport,
        includeRecurringAnalysis,
        includeNetWorth,
        reportTitle: reportTitle || undefined,
        reportType,
      };

      const blob = await reportService.generatePDFReport(reportData, options, charts);

      // Download the PDF
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `financial-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Report Generated',
        description: 'Your financial report has been downloaded successfully.',
      });
    } catch (error) {
      logger.error('Error generating PDF report:', error);
      toast({
        title: 'Report Generation Failed',
        description:
          error instanceof Error ? error.message : 'Failed to generate report. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate CSV export
  const generateCSVReport = async () => {
    try {
      setIsGenerating(true);

      const reportData = prepareReportData();
      const options: ReportOptions = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        includeCharts: false,
        includeTransactionDetails: true,
        includeCategorySummary: false,
        includeTaxReport: false,
        includeRecurringAnalysis: false,
        includeNetWorth: false,
        reportType,
      };

      const blob = reportService.generateCSVReport(reportData, options);

      // Download the CSV
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `financial-data-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'CSV Export Complete',
        description: 'Your transaction data has been exported successfully.',
      });
    } catch (error) {
      logger.error('Error generating CSV export:', error);
      toast({
        title: 'Export Failed',
        description:
          error instanceof Error ? error.message : 'Failed to export data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle report generation
  const handleGenerateReport = () => {
    if (exportFormat === 'pdf') {
      generatePDFReport();
    } else {
      generateCSVReport();
    }
  };

  const reportData = prepareReportData();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <FileText className='h-5 w-5' />
          Report Generator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue='settings' className='w-full'>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='settings'>Settings</TabsTrigger>
            <TabsTrigger value='preview'>Preview</TabsTrigger>
            <TabsTrigger value='templates'>Templates</TabsTrigger>
          </TabsList>

          <TabsContent value='settings' className='space-y-6'>
            {/* Report Type and Date Range */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div className='space-y-4'>
                <Label htmlFor='report-type'>Report Type</Label>
                <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='monthly'>Monthly Report</SelectItem>
                    <SelectItem value='yearly'>Yearly Report</SelectItem>
                    <SelectItem value='custom'>Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                <div className='space-y-2'>
                  <Label>Quick Date Ranges</Label>
                  <div className='grid grid-cols-2 gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setDateRange('current-month')}
                    >
                      Current Month
                    </Button>
                    <Button variant='outline' size='sm' onClick={() => setDateRange('last-month')}>
                      Last Month
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setDateRange('current-year')}
                    >
                      Current Year
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setDateRange('last-3-months')}
                    >
                      Last 3 Months
                    </Button>
                  </div>
                </div>
              </div>

              <div className='space-y-4'>
                <div>
                  <Label htmlFor='start-date'>Start Date</Label>
                  <Input
                    id='start-date'
                    type='date'
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor='end-date'>End Date</Label>
                  <Input
                    id='end-date'
                    type='date'
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor='report-title'>Report Title (Optional)</Label>
                  <Input
                    id='report-title'
                    placeholder='Custom report title'
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Export Format */}
            <div className='space-y-2'>
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                <SelectTrigger className='w-[180px]'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='pdf'>PDF Report</SelectItem>
                  <SelectItem value='csv'>CSV Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Report Options (only for PDF) */}
            {exportFormat === 'pdf' && (
              <div className='space-y-4'>
                <Label>Report Sections</Label>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='include-charts'>Include Charts</Label>
                    <Switch
                      id='include-charts'
                      checked={includeCharts}
                      onCheckedChange={setIncludeCharts}
                    />
                  </div>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='include-categories'>Category Summary</Label>
                    <Switch
                      id='include-categories'
                      checked={includeCategorySummary}
                      onCheckedChange={setIncludeCategorySummary}
                    />
                  </div>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='include-transactions'>Transaction Details</Label>
                    <Switch
                      id='include-transactions'
                      checked={includeTransactionDetails}
                      onCheckedChange={setIncludeTransactionDetails}
                    />
                  </div>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='include-recurring'>Recurring Analysis</Label>
                    <Switch
                      id='include-recurring'
                      checked={includeRecurringAnalysis}
                      onCheckedChange={setIncludeRecurringAnalysis}
                    />
                  </div>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='include-tax'>Tax Report</Label>
                    <Switch
                      id='include-tax'
                      checked={includeTaxReport}
                      onCheckedChange={setIncludeTaxReport}
                    />
                  </div>
                  <div className='flex items-center justify-between'>
                    <Label htmlFor='include-networth'>Net Worth</Label>
                    <Switch
                      id='include-networth'
                      checked={includeNetWorth}
                      onCheckedChange={setIncludeNetWorth}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <div className='flex justify-end'>
              <Button
                onClick={handleGenerateReport}
                disabled={isGenerating || loading}
                className='min-w-[150px]'
              >
                {isGenerating ? (
                  <>
                    <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2' />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className='h-4 w-4 mr-2' />
                    Generate {exportFormat.toUpperCase()}
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value='preview' className='space-y-4'>
            <div className='border rounded-lg p-4 bg-gray-50'>
              <h3 className='text-lg font-semibold mb-4'>Report Preview</h3>

              <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
                <div className='text-center p-4 bg-white rounded border'>
                  <div className='text-2xl font-bold text-green-600'>
                    {formatCurrency(reportData.totalIncome)}
                  </div>
                  <div className='text-sm text-gray-600'>Total Income</div>
                </div>
                <div className='text-center p-4 bg-white rounded border'>
                  <div className='text-2xl font-bold text-red-600'>
                    {formatCurrency(reportData.totalExpenses)}
                  </div>
                  <div className='text-sm text-gray-600'>Total Expenses</div>
                </div>
                <div className='text-center p-4 bg-white rounded border'>
                  <div className='text-2xl font-bold text-blue-600'>
                    {formatCurrency(reportData.netSavings)}
                  </div>
                  <div className='text-sm text-gray-600'>Net Savings</div>
                </div>
              </div>

              <div className='space-y-2'>
                <div className='flex justify-between'>
                  <span>Report Period:</span>
                  <span className='font-medium'>{reportData.periodLabel}</span>
                </div>
                <div className='flex justify-between'>
                  <span>Transaction Count:</span>
                  <span className='font-medium'>{reportData.transactions.length}</span>
                </div>
                <div className='flex justify-between'>
                  <span>Categories:</span>
                  <span className='font-medium'>{reportData.categorySpending.length}</span>
                </div>
                <div className='flex justify-between'>
                  <span>Recurring Transactions:</span>
                  <span className='font-medium'>
                    {reportData.potentialRecurringTransactions.length}
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value='templates'>
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold'>Report Templates</h3>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <Card className='cursor-pointer hover:shadow-md transition-shadow'>
                  <CardContent className='p-4'>
                    <h4 className='font-semibold mb-2'>Monthly Budget Review</h4>
                    <p className='text-sm text-gray-600 mb-3'>
                      Comprehensive monthly financial analysis with category breakdowns and budget
                      vs. actual comparisons.
                    </p>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => {
                        setReportType('monthly');
                        setIncludeCharts(true);
                        setIncludeCategorySummary(true);
                        setIncludeTransactionDetails(true);
                        setIncludeRecurringAnalysis(true);
                        setIncludeTaxReport(false);
                        setIncludeNetWorth(false);
                      }}
                    >
                      Use Template
                    </Button>
                  </CardContent>
                </Card>

                <Card className='cursor-pointer hover:shadow-md transition-shadow'>
                  <CardContent className='p-4'>
                    <h4 className='font-semibold mb-2'>Tax Preparation</h4>
                    <p className='text-sm text-gray-600 mb-3'>
                      Focused report for tax season with deductible categories and detailed
                      transaction records.
                    </p>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => {
                        setReportType('yearly');
                        setIncludeCharts(false);
                        setIncludeCategorySummary(true);
                        setIncludeTransactionDetails(true);
                        setIncludeRecurringAnalysis(false);
                        setIncludeTaxReport(true);
                        setIncludeNetWorth(false);
                      }}
                    >
                      Use Template
                    </Button>
                  </CardContent>
                </Card>

                <Card className='cursor-pointer hover:shadow-md transition-shadow'>
                  <CardContent className='p-4'>
                    <h4 className='font-semibold mb-2'>Investment Summary</h4>
                    <p className='text-sm text-gray-600 mb-3'>
                      Annual overview focusing on savings rate, investment tracking, and net worth
                      analysis.
                    </p>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => {
                        setReportType('yearly');
                        setIncludeCharts(true);
                        setIncludeCategorySummary(false);
                        setIncludeTransactionDetails(false);
                        setIncludeRecurringAnalysis(true);
                        setIncludeTaxReport(false);
                        setIncludeNetWorth(true);
                      }}
                    >
                      Use Template
                    </Button>
                  </CardContent>
                </Card>

                <Card className='cursor-pointer hover:shadow-md transition-shadow'>
                  <CardContent className='p-4'>
                    <h4 className='font-semibold mb-2'>Simple Export</h4>
                    <p className='text-sm text-gray-600 mb-3'>
                      Basic report with essential information and minimal formatting for external
                      use.
                    </p>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => {
                        setExportFormat('csv');
                        setIncludeCharts(false);
                        setIncludeCategorySummary(false);
                        setIncludeTransactionDetails(true);
                        setIncludeRecurringAnalysis(false);
                        setIncludeTaxReport(false);
                        setIncludeNetWorth(false);
                      }}
                    >
                      Use Template
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
