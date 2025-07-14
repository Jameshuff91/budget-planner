'use client';

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { FileText, TrendingUp, PieChart, BarChart3, Calendar, Download } from 'lucide-react';

import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Switch } from '@components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { useToast } from '@components/ui/use-toast';
import { useDBContext } from '@context/DatabaseContext';
import { useAnalytics } from '@hooks/useAnalytics';
import { reportService, ReportOptions, ReportData } from '../src/services/reportService';
import { PDFGenerator, createFinancialReport } from '../src/utils/pdfGenerator';
import { formatCurrency } from '@utils/helpers';
import { logger } from '@services/logger';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'financial' | 'tax' | 'analysis' | 'export';
  defaultOptions: Partial<ReportOptions>;
  features: string[];
  recommended: boolean;
  dateRangeType: 'monthly' | 'yearly' | 'quarterly' | 'custom';
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'monthly-budget-review',
    name: 'Monthly Budget Review',
    description: 'Comprehensive monthly financial analysis with category breakdowns, budget vs. actual comparisons, and spending trends.',
    icon: PieChart,
    category: 'financial',
    defaultOptions: {
      reportType: 'monthly',
      includeCharts: true,
      includeCategorySummary: true,
      includeTransactionDetails: true,
      includeRecurringAnalysis: true,
      includeTaxReport: false,
      includeNetWorth: false,
    },
    features: ['Category Breakdown', 'Budget Analysis', 'Spending Charts', 'Transaction Details'],
    recommended: true,
    dateRangeType: 'monthly'
  },
  {
    id: 'annual-financial-summary',
    name: 'Annual Financial Summary',
    description: 'Year-end comprehensive report with full financial overview, trends, and performance metrics.',
    icon: TrendingUp,
    category: 'financial',
    defaultOptions: {
      reportType: 'yearly',
      includeCharts: true,
      includeCategorySummary: true,
      includeTransactionDetails: false,
      includeRecurringAnalysis: true,
      includeTaxReport: false,
      includeNetWorth: true,
    },
    features: ['Annual Overview', 'Trend Analysis', 'Net Worth', 'Performance Metrics'],
    recommended: true,
    dateRangeType: 'yearly'
  },
  {
    id: 'tax-preparation',
    name: 'Tax Preparation Report',
    description: 'Detailed report for tax season with deductible categories, business expenses, and supporting documentation.',
    icon: FileText,
    category: 'tax',
    defaultOptions: {
      reportType: 'yearly',
      includeCharts: false,
      includeCategorySummary: true,
      includeTransactionDetails: true,
      includeRecurringAnalysis: false,
      includeTaxReport: true,
      includeNetWorth: false,
    },
    features: ['Tax Deductions', 'Business Expenses', 'Detailed Transactions', 'Category Summary'],
    recommended: false,
    dateRangeType: 'yearly'
  },
  {
    id: 'quarterly-business-review',
    name: 'Quarterly Business Review',
    description: 'Professional quarterly report with key metrics, trend analysis, and actionable insights.',
    icon: BarChart3,
    category: 'analysis',
    defaultOptions: {
      reportType: 'custom',
      includeCharts: true,
      includeCategorySummary: true,
      includeTransactionDetails: false,
      includeRecurringAnalysis: true,
      includeTaxReport: false,
      includeNetWorth: true,
    },
    features: ['Quarterly Metrics', 'Trend Analysis', 'Executive Summary', 'Key Insights'],
    recommended: false,
    dateRangeType: 'quarterly'
  },
  {
    id: 'expense-audit',
    name: 'Expense Audit Report',
    description: 'Detailed expense analysis with transaction-level breakdown for auditing and compliance.',
    icon: FileText,
    category: 'analysis',
    defaultOptions: {
      reportType: 'custom',
      includeCharts: false,
      includeCategorySummary: true,
      includeTransactionDetails: true,
      includeRecurringAnalysis: false,
      includeTaxReport: false,
      includeNetWorth: false,
    },
    features: ['Detailed Transactions', 'Expense Categories', 'Merchant Analysis', 'Audit Trail'],
    recommended: false,
    dateRangeType: 'custom'
  },
  {
    id: 'investment-portfolio',
    name: 'Investment Portfolio Summary',
    description: 'Investment-focused report with savings rate analysis, portfolio performance, and wealth tracking.',
    icon: TrendingUp,
    category: 'analysis',
    defaultOptions: {
      reportType: 'yearly',
      includeCharts: true,
      includeCategorySummary: false,
      includeTransactionDetails: false,
      includeRecurringAnalysis: true,
      includeTaxReport: false,
      includeNetWorth: true,
    },
    features: ['Investment Tracking', 'Savings Rate', 'Portfolio Analysis', 'Wealth Growth'],
    recommended: false,
    dateRangeType: 'yearly'
  },
  {
    id: 'simple-export',
    name: 'Simple Data Export',
    description: 'Basic CSV export with transaction data for external analysis or spreadsheet import.',
    icon: Download,
    category: 'export',
    defaultOptions: {
      reportType: 'custom',
      includeCharts: false,
      includeCategorySummary: false,
      includeTransactionDetails: true,
      includeRecurringAnalysis: false,
      includeTaxReport: false,
      includeNetWorth: false,
    },
    features: ['CSV Format', 'Transaction Data', 'Spreadsheet Compatible', 'Quick Export'],
    recommended: false,
    dateRangeType: 'custom'
  }
];

interface ReportTemplatesProps {
  onTemplateSelect?: (template: ReportTemplate, options: ReportOptions) => void;
  className?: string;
}

export default function ReportTemplates({ onTemplateSelect, className }: ReportTemplatesProps) {
  const { transactions, loading } = useDBContext();
  const { toast } = useToast();
  
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [customOptions, setCustomOptions] = useState<Partial<ReportOptions>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Calculate date ranges based on template type
  const getDateRange = (template: ReportTemplate) => {
    const now = new Date();
    
    switch (template.dateRangeType) {
      case 'monthly':
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now)
        };
      case 'yearly':
        return {
          startDate: startOfYear(now),
          endDate: endOfYear(now)
        };
      case 'quarterly':
        return {
          startDate: startOfMonth(subMonths(now, 2)),
          endDate: endOfMonth(now)
        };
      default: // custom
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now)
        };
    }
  };

  // Prepare report data for selected date range
  const prepareReportData = (startDate: Date, endDate: Date): ReportData => {
    const filteredTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    // Get analytics for the date range
    const analytics = useAnalytics({ startDate, endDate });

    const totalIncome = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = filteredTransactions
      .filter(t => t.type === 'expense')
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
      periodLabel: `${format(startDate, 'MMM dd, yyyy')} - ${format(endDate, 'MMM dd, yyyy')}`
    };
  };

  // Generate report from template
  const generateFromTemplate = async (template: ReportTemplate) => {
    try {
      setIsGenerating(true);
      
      const dateRange = getDateRange(template);
      const reportData = prepareReportData(dateRange.startDate, dateRange.endDate);
      
      const options: ReportOptions = {
        ...template.defaultOptions,
        ...customOptions,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        reportTitle: template.name,
        reportType: template.defaultOptions.reportType || 'custom'
      } as ReportOptions;

      // Generate PDF or CSV based on template
      if (template.id === 'simple-export') {
        const blob = reportService.generateCSVReport(reportData, options);
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${template.id}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const blob = await reportService.generatePDFReport(reportData, options);
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${template.id}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      toast({
        title: 'Report Generated',
        description: `${template.name} has been generated successfully.`,
      });

      setIsDialogOpen(false);
    } catch (error) {
      logger.error('Error generating template report:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate report. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setCustomOptions(template.defaultOptions);
    
    if (onTemplateSelect) {
      const dateRange = getDateRange(template);
      const options: ReportOptions = {
        ...template.defaultOptions,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        reportTitle: template.name,
        reportType: template.defaultOptions.reportType || 'custom'
      } as ReportOptions;
      
      onTemplateSelect(template, options);
    } else {
      setIsDialogOpen(true);
    }
  };

  // Filter templates by category
  const getTemplatesByCategory = (category: string) => {
    return REPORT_TEMPLATES.filter(template => template.category === category);
  };

  return (
    <div className={className}>
      <Tabs defaultValue="recommended" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recommended">Recommended</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="tax">Tax</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="recommended" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {REPORT_TEMPLATES.filter(t => t.recommended).map(template => (
              <TemplateCard 
                key={template.id} 
                template={template} 
                onSelect={handleTemplateSelect}
                disabled={loading}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getTemplatesByCategory('financial').map(template => (
              <TemplateCard 
                key={template.id} 
                template={template} 
                onSelect={handleTemplateSelect}
                disabled={loading}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getTemplatesByCategory('tax').map(template => (
              <TemplateCard 
                key={template.id} 
                template={template} 
                onSelect={handleTemplateSelect}
                disabled={loading}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...getTemplatesByCategory('analysis'), ...getTemplatesByCategory('export')].map(template => (
              <TemplateCard 
                key={template.id} 
                template={template} 
                onSelect={handleTemplateSelect}
                disabled={loading}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Template Configuration Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4">
              <div>
                <Label>Date Range</Label>
                <div className="text-sm text-gray-600">
                  {(() => {
                    const range = getDateRange(selectedTemplate);
                    return `${format(range.startDate, 'MMM dd, yyyy')} - ${format(range.endDate, 'MMM dd, yyyy')}`;
                  })()}
                </div>
              </div>

              <div>
                <Label>Included Features</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedTemplate.features.map(feature => (
                    <Badge key={feature} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Show preview data */}
              {(() => {
                const range = getDateRange(selectedTemplate);
                const previewData = prepareReportData(range.startDate, range.endDate);
                return (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Transactions:</span>
                        <span className="font-medium">{previewData.transactions.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Income:</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(previewData.totalIncome)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Expenses:</span>
                        <span className="font-medium text-red-600">
                          {formatCurrency(previewData.totalExpenses)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedTemplate && generateFromTemplate(selectedTemplate)}
              disabled={isGenerating || !selectedTemplate}
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Template Card Component
interface TemplateCardProps {
  template: ReportTemplate;
  onSelect: (template: ReportTemplate) => void;
  disabled?: boolean;
}

function TemplateCard({ template, onSelect, disabled }: TemplateCardProps) {
  const IconComponent = template.icon;
  
  return (
    <Card className="cursor-pointer hover:shadow-md transition-all duration-200 group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
              <IconComponent className="h-5 w-5 text-blue-600" />
            </div>
            {template.recommended && (
              <Badge variant="secondary" className="text-xs">Recommended</Badge>
            )}
          </div>
          <Badge variant="outline" className="text-xs capitalize">
            {template.category}
          </Badge>
        </div>
        <CardTitle className="text-lg">{template.name}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-gray-600 mb-4 line-clamp-3">
          {template.description}
        </p>
        
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium text-gray-500">Features</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {template.features.slice(0, 3).map(feature => (
                <Badge key={feature} variant="secondary" className="text-xs">
                  {feature}
                </Badge>
              ))}
              {template.features.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{template.features.length - 3} more
                </Badge>
              )}
            </div>
          </div>
          
          <Button
            onClick={() => onSelect(template)}
            disabled={disabled}
            className="w-full"
            size="sm"
          >
            {template.id === 'simple-export' ? 'Export CSV' : 'Generate PDF'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}