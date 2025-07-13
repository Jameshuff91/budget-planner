'use client';

import { Bell, AlertTriangle, Settings, X } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { useDBContext } from '@context/DatabaseContext';
import { useAnalytics } from '@hooks/useAnalytics';
import { formatCurrency } from '@utils/helpers';

import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { toast } from './ui/use-toast';

interface AlertRule {
  id: string;
  type: 'budget_exceeded' | 'unusual_spending' | 'savings_goal' | 'recurring_charge';
  enabled: boolean;
  threshold?: number;
  categoryId?: string;
  description: string;
}

interface SpendingAlert {
  id: string;
  ruleId: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  dismissed: boolean;
  data?: any;
}

export default function SpendingAlerts() {
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<SpendingAlert[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const { transactions, categories } = useDBContext();
  const { categorySpending, monthlyTrends } = useAnalytics();

  useEffect(() => {
    // Load saved alert rules
    const savedRules = localStorage.getItem('budget.alertRules');
    if (savedRules) {
      setAlertRules(JSON.parse(savedRules));
    } else {
      // Default rules
      setAlertRules([
        {
          id: '1',
          type: 'budget_exceeded',
          enabled: true,
          threshold: 90,
          description: 'Alert when spending exceeds 90% of budget',
        },
        {
          id: '2',
          type: 'unusual_spending',
          enabled: true,
          threshold: 150,
          description: 'Alert on transactions 150% above average',
        },
        {
          id: '3',
          type: 'savings_goal',
          enabled: false,
          threshold: 500,
          description: 'Alert when monthly savings fall below $500',
        },
      ]);
    }

    // Load notification preference
    const notifPref = localStorage.getItem('budget.notificationsEnabled') === 'true';
    setNotificationsEnabled(notifPref);
  }, []);

  useEffect(() => {
    // Check for alerts based on rules
    checkAlerts();
  }, [transactions, alertRules, categorySpending]);

  const checkAlerts = () => {
    const newAlerts: SpendingAlert[] = [];

    alertRules.forEach((rule) => {
      if (!rule.enabled) return;

      switch (rule.type) {
        case 'budget_exceeded':
          categorySpending.forEach((category) => {
            if (category.target && category.target > 0) {
              const percentage = (category.value / category.target) * 100;
              if (percentage >= (rule.threshold || 90)) {
                newAlerts.push({
                  id: `${rule.id}-${category.name}`,
                  ruleId: rule.id,
                  message: `${category.name} spending at ${percentage.toFixed(0)}% of budget`,
                  severity: percentage >= 100 ? 'critical' : 'warning',
                  timestamp: new Date().toISOString(),
                  dismissed: false,
                  data: { category: category.name, percentage },
                });
              }
            }
          });
          break;

        case 'unusual_spending':
          const recentTransactions = transactions
            .filter((t) => {
              const date = new Date(t.date);
              const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
              return daysSince <= 7 && t.type === 'expense';
            })
            .sort((a, b) => b.amount - a.amount);

          const avgTransaction =
            transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0) /
            transactions.length;

          recentTransactions.forEach((tx) => {
            if (tx.amount > avgTransaction * ((rule.threshold || 150) / 100)) {
              newAlerts.push({
                id: `${rule.id}-${tx.id}`,
                ruleId: rule.id,
                message: `Unusual transaction: ${tx.description} - ${formatCurrency(tx.amount)}`,
                severity: 'warning',
                timestamp: new Date().toISOString(),
                dismissed: false,
                data: { transaction: tx },
              });
            }
          });
          break;

        case 'savings_goal':
          const currentSavings = monthlyTrends.netSavings.current;
          if (currentSavings < (rule.threshold || 500)) {
            newAlerts.push({
              id: `${rule.id}-savings`,
              ruleId: rule.id,
              message: `Monthly savings (${formatCurrency(currentSavings)}) below target`,
              severity: currentSavings < 0 ? 'critical' : 'warning',
              timestamp: new Date().toISOString(),
              dismissed: false,
              data: { savings: currentSavings },
            });
          }
          break;
      }
    });

    // Merge with existing alerts (avoid duplicates)
    const existingIds = activeAlerts.map((a) => a.id);
    const uniqueNewAlerts = newAlerts.filter((a) => !existingIds.includes(a.id));

    if (uniqueNewAlerts.length > 0) {
      setActiveAlerts([...activeAlerts, ...uniqueNewAlerts]);

      // Show notifications if enabled
      if (
        notificationsEnabled &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        uniqueNewAlerts.forEach((alert) => {
          new Notification('Budget Alert', {
            body: alert.message,
            icon: '/icon-192x192.png',
          });
        });
      }
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('budget.notificationsEnabled', 'true');
        toast({
          title: 'Notifications Enabled',
          description: 'You will receive budget alerts as notifications',
        });
      }
    }
  };

  const toggleRule = (ruleId: string) => {
    const updated = alertRules.map((rule) =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    );
    setAlertRules(updated);
    localStorage.setItem('budget.alertRules', JSON.stringify(updated));
  };

  const updateThreshold = (ruleId: string, threshold: number) => {
    const updated = alertRules.map((rule) => (rule.id === ruleId ? { ...rule, threshold } : rule));
    setAlertRules(updated);
    localStorage.setItem('budget.alertRules', JSON.stringify(updated));
  };

  const dismissAlert = (alertId: string) => {
    setActiveAlerts(activeAlerts.filter((a) => a.id !== alertId));
  };

  const undismissedAlerts = activeAlerts.filter((a) => !a.dismissed);

  return (
    <div className='space-y-4'>
      {/* Active Alerts */}
      {undismissedAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Bell className='h-5 w-5' />
              Active Alerts ({undismissedAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {undismissedAlerts.map((alert) => (
              <Alert
                key={alert.id}
                variant={alert.severity === 'critical' ? 'destructive' : 'default'}
              >
                <AlertTriangle className='h-4 w-4' />
                <AlertDescription className='flex items-center justify-between'>
                  <span>{alert.message}</span>
                  <Button variant='ghost' size='sm' onClick={() => dismissAlert(alert.id)}>
                    <X className='h-4 w-4' />
                  </Button>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Alert Rules Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Settings className='h-5 w-5' />
            Alert Rules
          </CardTitle>
          <CardDescription>Configure when you want to receive spending alerts</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Push Notifications */}
          <div className='flex items-center justify-between p-3 border rounded-lg'>
            <div>
              <Label>Push Notifications</Label>
              <p className='text-sm text-muted-foreground'>
                Receive alerts as browser notifications
              </p>
            </div>
            <Button
              variant={notificationsEnabled ? 'default' : 'outline'}
              size='sm'
              onClick={requestNotificationPermission}
              disabled={notificationsEnabled}
            >
              {notificationsEnabled ? 'Enabled' : 'Enable'}
            </Button>
          </div>

          {/* Alert Rules */}
          {alertRules.map((rule) => (
            <div key={rule.id} className='p-3 border rounded-lg space-y-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <Label>{rule.description}</Label>
                </div>
                <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
              </div>

              {rule.threshold !== undefined && rule.enabled && (
                <div className='flex items-center gap-2'>
                  <Label htmlFor={`threshold-${rule.id}`} className='text-sm'>
                    Threshold:
                  </Label>
                  <Input
                    id={`threshold-${rule.id}`}
                    type='number'
                    value={rule.threshold}
                    onChange={(e) => updateThreshold(rule.id, Number(e.target.value))}
                    className='w-24'
                  />
                  <span className='text-sm text-muted-foreground'>
                    {rule.type === 'budget_exceeded' || rule.type === 'unusual_spending'
                      ? '%'
                      : '$'}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Add Custom Rule Button */}
          <Button variant='outline' className='w-full' disabled>
            Add Custom Rule (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
