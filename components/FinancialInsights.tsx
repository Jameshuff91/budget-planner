'use client';

import { Card } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { useDBContext } from '@context/DatabaseContext';
import {
  calculateFinancialHealthScore,
  identifySavingsOpportunities,
  detectSpendingPatterns,
} from '@utils/budgetAnalysis';
import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Activity,
} from 'lucide-react';

export default function FinancialInsights() {
  const { transactions, categories } = useDBContext();
  const [healthScore, setHealthScore] = useState<ReturnType<typeof calculateFinancialHealthScore> | null>(null);
  const [savingsOpportunities, setSavingsOpportunities] = useState<ReturnType<typeof identifySavingsOpportunities>>([]);
  const [spendingPatterns, setSpendingPatterns] = useState<ReturnType<typeof detectSpendingPatterns>>([]);

  useEffect(() => {
    if (transactions.length > 0) {
      const score = calculateFinancialHealthScore(transactions, categories, 1);
      setHealthScore(score);

      const opportunities = identifySavingsOpportunities(transactions, 3);
      setSavingsOpportunities(opportunities.slice(0, 5)); // Top 5

      const patterns = detectSpendingPatterns(transactions, 3);
      setSpendingPatterns(patterns.slice(0, 5)); // Top 5
    }
  }, [transactions, categories]);

  if (!healthScore) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Financial Insights</h3>
        <p className="text-muted-foreground">Loading insights...</p>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreGrade = (score: number) => {
    if (score >= 80) return 'A';
    if (score >= 60) return 'B';
    if (score >= 40) return 'C';
    if (score >= 20) return 'D';
    return 'F';
  };

  return (
    <div className="space-y-6">
      {/* Financial Health Score */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Financial Health Score</h3>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`text-6xl font-bold ${getScoreColor(healthScore.overall)}`}>
              {healthScore.overall}
            </div>
            <div>
              <div className={`text-3xl font-bold ${getScoreColor(healthScore.overall)}`}>
                {getScoreGrade(healthScore.overall)}
              </div>
              <div className="text-sm text-muted-foreground">out of 100</div>
            </div>
          </div>

          <Activity className={`w-16 h-16 ${getScoreColor(healthScore.overall)}`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Savings Rate</div>
            <div className="text-xl font-bold">{healthScore.savingsRate}%</div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Budget Adherence</div>
            <div className="text-xl font-bold">{healthScore.budgetAdherence}/30</div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Expense Stability</div>
            <div className="text-xl font-bold">{healthScore.expenseStability}/30</div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Insights & Recommendations</h4>
          {healthScore.insights.map((insight, index) => (
            <div key={index} className="flex items-start gap-2 p-3 bg-blue-50 rounded">
              <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900">{insight}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Savings Opportunities */}
      {savingsOpportunities.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Savings Opportunities
          </h3>

          <div className="space-y-3">
            {savingsOpportunities.map((opportunity, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  opportunity.priority === 'high'
                    ? 'bg-red-50 border-red-200'
                    : opportunity.priority === 'medium'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-green-50 border-green-200'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold text-sm">{opportunity.category}</div>
                  <div
                    className={`text-sm font-bold ${
                      opportunity.priority === 'high'
                        ? 'text-red-600'
                        : opportunity.priority === 'medium'
                          ? 'text-yellow-600'
                          : 'text-green-600'
                    }`}
                  >
                    Save ${opportunity.potentialSavings.toFixed(2)}/mo
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{opportunity.reason}</p>
                <div className="mt-2">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      opportunity.priority === 'high'
                        ? 'bg-red-100 text-red-700'
                        : opportunity.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {opportunity.priority.toUpperCase()} PRIORITY
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-green-100 rounded-lg">
            <div className="text-sm font-semibold text-green-800">
              Total Potential Savings
            </div>
            <div className="text-2xl font-bold text-green-600">
              ${savingsOpportunities.reduce((sum, o) => sum + o.potentialSavings, 0).toFixed(2)}/mo
            </div>
          </div>
        </Card>
      )}

      {/* Spending Patterns */}
      {spendingPatterns.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Spending Patterns</h3>

          <div className="space-y-4">
            {spendingPatterns.map((pattern, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold">{pattern.category}</div>
                  <div className="flex items-center gap-2">
                    {pattern.trend === 'increasing' ? (
                      <TrendingUp className="w-4 h-4 text-red-600" />
                    ) : pattern.trend === 'decreasing' ? (
                      <TrendingDown className="w-4 h-4 text-green-600" />
                    ) : (
                      <Activity className="w-4 h-4 text-blue-600" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        pattern.trend === 'increasing'
                          ? 'text-red-600'
                          : pattern.trend === 'decreasing'
                            ? 'text-green-600'
                            : 'text-blue-600'
                      }`}
                    >
                      {pattern.trend}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Average: </span>
                    <span className="font-medium">${pattern.averageAmount.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Frequency: </span>
                    <span className="font-medium">{pattern.frequency} transactions</span>
                  </div>
                </div>

                {pattern.anomalies.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-yellow-600">
                    <AlertTriangle className="w-3 h-3" />
                    {pattern.anomalies.length} unusual transaction(s) detected
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
