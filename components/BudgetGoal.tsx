'use client';

import { Target, TrendingUp, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Slider } from '@components/ui/slider';

const MIN_GOAL = 5000;
const MAX_GOAL = 2000000;
const STEP = 5000;
const ANNUAL_RETURN = 0.08;

export default function BudgetGoal() {
  const [goalAmount, setGoalAmount] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('budgetGoal');
      return saved ? Number(saved) : 10000;
    }
    return 10000;
  });
  const [timeToReach, setTimeToReach] = useState(0);
  const [monthlySavings, setMonthlySavings] = useState(500);
  const [understandMetric, setUnderstandMetric] = useState(0);
  const [projectedAmount, setProjectedAmount] = useState(0);

  useEffect(() => {
    // Calculate time with compound interest
    const annualSavings = monthlySavings * 12;
    let years = 0;
    let accumulated = 0;

    while (accumulated < goalAmount && years < 50) {
      accumulated = accumulated * (1 + ANNUAL_RETURN) + annualSavings;
      years++;
    }

    setTimeToReach(years * 12);
    setProjectedAmount(accumulated);
    setUnderstandMetric((monthlySavings / goalAmount) * 100);
    localStorage.setItem('budgetGoal', goalAmount.toString());
  }, [goalAmount, monthlySavings]);

  const handleSliderChange = (value: number[]) => {
    setGoalAmount(value[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (!isNaN(value) && value >= MIN_GOAL && value <= MAX_GOAL) {
      setGoalAmount(value);
    }
  };

  const handleSavingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (!isNaN(value) && value > 0) {
      setMonthlySavings(value);
    }
  };

  const setGoalToMonthlySavings = () => {
    setGoalAmount(monthlySavings);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card className='bg-white shadow-lg rounded-lg overflow-hidden'>
      <CardHeader className='bg-gradient-to-r from-yellow-400 to-yellow-500 text-white p-6'>
        <CardTitle className='text-2xl font-bold'>Budget Goal</CardTitle>
      </CardHeader>
      <CardContent className='p-6 space-y-6'>
        <div className='space-y-4'>
          <Label htmlFor='monthlySavings' className='text-lg font-semibold'>
            Monthly Savings
          </Label>
          <div className='flex items-center space-x-4'>
            <TrendingUp className='h-6 w-6 text-yellow-500' />
            <Input
              id='monthlySavings'
              type='number'
              value={monthlySavings}
              onChange={handleSavingsChange}
              min='1'
              className='flex-grow'
            />
          </div>
        </div>
        <div className='space-y-4'>
          <Label htmlFor='goalAmount' className='text-lg font-semibold'>
            Goal Amount: {formatCurrency(goalAmount)}
          </Label>
          <div className='flex items-center space-x-4'>
            <Target className='h-6 w-6 text-yellow-500' />
            <Slider
              id='goalAmount'
              min={MIN_GOAL}
              max={MAX_GOAL}
              step={STEP}
              value={[goalAmount]}
              onValueChange={handleSliderChange}
              className='flex-grow'
            />
          </div>
          <div className='flex items-center space-x-2'>
            <Input
              type='number'
              value={goalAmount}
              onChange={handleInputChange}
              min={MIN_GOAL}
              max={MAX_GOAL}
              step={STEP}
              className='flex-grow'
            />
            <Button onClick={setGoalToMonthlySavings} className='whitespace-nowrap'>
              Set to Monthly Savings
            </Button>
          </div>
        </div>
        <div className='bg-yellow-50 p-4 rounded-lg'>
          <p className='text-sm text-yellow-700 mb-2'>
            Based on your current savings rate, you will reach your goal in:
          </p>
          <div className='flex items-center space-x-2'>
            <Calendar className='h-6 w-6 text-yellow-500' />
            <div>
              <p className='text-2xl font-bold text-yellow-700'>
                {timeToReach} {timeToReach === 1 ? 'month' : 'months'}
                {timeToReach > 12 && ` (${(timeToReach / 12).toFixed(1)} years)`}
              </p>
              <p className='text-sm text-gray-600'>
                With 8% annual compound interest, projected final amount:{' '}
                {formatCurrency(projectedAmount)}
              </p>
            </div>
          </div>
        </div>
        <div className='bg-blue-50 p-4 rounded-lg'>
          <p className='text-sm text-blue-700 mb-2'>Understand This Metric:</p>
          <p className='text-lg font-semibold text-blue-700'>
            {understandMetric.toFixed(2)}% of your goal saved each month
          </p>
          <p className='text-xs text-blue-600 mt-1'>
            This percentage represents how much of your goal you&apos;re saving each month. A higher
            percentage means you&apos;re saving more relative to your goal.
          </p>
          <p className='text-sm text-blue-700'>
            At {formatCurrency(monthlySavings)} monthly savings with 8% annual compound growth,
            you&apos;ll reach your goal of {formatCurrency(goalAmount)} in{' '}
            {(timeToReach / 12).toFixed(1)} years
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
