'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDBContext } from '@context/DatabaseContext';
import { useToast } from '@components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label'; // For better accessibility with inputs
import { formatCurrency } from '@utils/helpers'; // For toasts

export default function BudgetManagementPage() {
  const { categories, updateCategoryBudget, loading: categoriesLoading } = useDBContext();
  const { toast } = useToast();
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (categories && categories.length > 0) {
      const initialBudgets: Record<string, string> = {};
      categories.forEach(category => {
        // Use category.id as key for budgetInputs
        initialBudgets[category.id] = (category.budget || '').toString();
      });
      setBudgetInputs(initialBudgets);
    }
  }, [categories]);

  const handleBudgetInputChange = useCallback((categoryId: string, value: string) => {
    setBudgetInputs(prev => ({ ...prev, [categoryId]: value }));
  }, []);

  const handleSaveBudget = useCallback(async (categoryId: string) => {
    const budgetString = budgetInputs[categoryId];
    
    if (budgetString === undefined) {
      // This case should ideally not happen if inputs are correctly managed
      toast({ title: "Error", description: "Could not find budget value to save.", variant: "destructive" });
      return;
    }

    let numValue: number;
    if (budgetString.trim() === '') {
      numValue = 0; // Treat empty string as 0 budget
    } else {
      numValue = parseFloat(budgetString);
      if (isNaN(numValue)) {
        toast({ title: "Invalid Input", description: "Budget value must be a number.", variant: "destructive" });
        // Revert input to original value from categories context
        const originalCategory = categories.find(cat => cat.id === categoryId);
        setBudgetInputs(prev => ({ ...prev, [categoryId]: (originalCategory?.budget || '').toString() }));
        return;
      }
    }

    if (numValue < 0) {
      toast({ title: "Invalid Input", description: "Budget value cannot be negative.", variant: "destructive" });
      const originalCategory = categories.find(cat => cat.id === categoryId);
      setBudgetInputs(prev => ({ ...prev, [categoryId]: (originalCategory?.budget || '').toString() }));
      return;
    }

    try {
      await updateCategoryBudget(categoryId, numValue);
      toast({ title: "Budget Updated", description: `Budget for selected category set to ${formatCurrency(numValue)}.` });
      // The context refresh will trigger the useEffect to update budgetInputs if needed
    } catch (error: any) {
      toast({ title: "Error Updating Budget", description: error.message || "Could not update budget.", variant: "destructive" });
      // Revert input on error
      const originalCategory = categories.find(cat => cat.id === categoryId);
      setBudgetInputs(prev => ({ ...prev, [categoryId]: (originalCategory?.budget || '').toString() }));
    }
  }, [budgetInputs, categories, updateCategoryBudget, toast]);

  if (categoriesLoading) {
    return <div>Loading categories...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Manage Budgets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.filter(cat => cat.type === 'expense').map(category => ( // Filter for expense categories
              <div key={category.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3 border-b last:border-b-0">
                <Label htmlFor={`budget-${category.id}`} className="text-lg font-medium mb-2 sm:mb-0 sm:mr-4">
                  {category.name}
                </Label>
                <Input
                  id={`budget-${category.id}`}
                  type="number"
                  value={budgetInputs[category.id] !== undefined ? budgetInputs[category.id] : ''}
                  onChange={(e) => handleBudgetInputChange(category.id, e.target.value)}
                  onBlur={() => handleSaveBudget(category.id)}
                  className="w-full sm:w-40" // Responsive width
                  placeholder="Enter budget (e.g., 500)"
                />
              </div>
            ))}
            {categories.filter(cat => cat.type === 'expense').length === 0 && (
              <p>No expense categories found. Add some categories to manage budgets.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
