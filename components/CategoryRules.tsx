'use client';

import { Tags, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { useDBContext } from '@context/DatabaseContext';

import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from './ui/use-toast';

export interface CategoryRule {
  id: string;
  pattern: string;
  matchType: 'contains' | 'startsWith' | 'endsWith' | 'regex';
  category: string;
  priority: number;
  enabled: boolean;
}

export default function CategoryRules() {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<Partial<CategoryRule>>({
    pattern: '',
    matchType: 'contains',
    category: '',
    priority: 0,
    enabled: true,
  });
  const { categories } = useDBContext();

  useEffect(() => {
    // Load saved rules
    const savedRules = localStorage.getItem('budget.categoryRules');
    if (savedRules) {
      setRules(JSON.parse(savedRules));
    }
  }, []);

  const saveRules = (updatedRules: CategoryRule[]) => {
    // Sort by priority (higher priority first)
    const sorted = [...updatedRules].sort((a, b) => b.priority - a.priority);
    setRules(sorted);
    localStorage.setItem('budget.categoryRules', JSON.stringify(sorted));
  };

  const addRule = () => {
    if (!newRule.pattern || !newRule.category) {
      toast({
        title: 'Validation Error',
        description: 'Pattern and category are required',
        variant: 'destructive',
      });
      return;
    }

    const rule: CategoryRule = {
      id: Date.now().toString(),
      pattern: newRule.pattern!,
      matchType: newRule.matchType || 'contains',
      category: newRule.category!,
      priority: newRule.priority || 0,
      enabled: true,
    };

    saveRules([...rules, rule]);
    setNewRule({
      pattern: '',
      matchType: 'contains',
      category: '',
      priority: 0,
      enabled: true,
    });
    setIsAddingRule(false);

    toast({
      title: 'Rule Added',
      description: `New categorization rule created`,
    });
  };

  const updateRule = (ruleId: string, updates: Partial<CategoryRule>) => {
    const updated = rules.map((rule) => (rule.id === ruleId ? { ...rule, ...updates } : rule));
    saveRules(updated);
  };

  const deleteRule = (ruleId: string) => {
    if (confirm('Delete this rule?')) {
      saveRules(rules.filter((rule) => rule.id !== ruleId));
      toast({
        title: 'Rule Deleted',
        description: 'Categorization rule removed',
      });
    }
  };

  const testRule = (rule: CategoryRule, testString: string): boolean => {
    const pattern = rule.pattern.toLowerCase();
    const text = testString.toLowerCase();

    switch (rule.matchType) {
      case 'contains':
        return text.includes(pattern);
      case 'startsWith':
        return text.startsWith(pattern);
      case 'endsWith':
        return text.endsWith(pattern);
      case 'regex':
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(text);
        } catch {
          return false;
        }
      default:
        return false;
    }
  };

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Tags className='h-5 w-5' />
          Custom Category Rules
        </CardTitle>
        <CardDescription>
          Create rules to automatically categorize transactions based on their description
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Rules List */}
        <div className='space-y-2'>
          {rules.length === 0 && !isAddingRule && (
            <p className='text-sm text-muted-foreground text-center py-4'>
              No custom rules yet. Create one to start automating categorization.
            </p>
          )}

          {rules.map((rule) => (
            <div key={rule.id} className='flex items-center gap-2 p-3 border rounded-lg'>
              {editingRuleId === rule.id ? (
                <>
                  <Input
                    value={rule.pattern}
                    onChange={(e) => updateRule(rule.id, { pattern: e.target.value })}
                    className='flex-1'
                    placeholder='Pattern'
                  />
                  <Select
                    value={rule.matchType}
                    onValueChange={(value) => updateRule(rule.id, { matchType: value as any })}
                  >
                    <SelectTrigger className='w-32'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='contains'>Contains</SelectItem>
                      <SelectItem value='startsWith'>Starts with</SelectItem>
                      <SelectItem value='endsWith'>Ends with</SelectItem>
                      <SelectItem value='regex'>Regex</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={rule.category}
                    onValueChange={(value) => updateRule(rule.id, { category: value })}
                  >
                    <SelectTrigger className='w-40'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type='number'
                    value={rule.priority}
                    onChange={(e) => updateRule(rule.id, { priority: Number(e.target.value) })}
                    className='w-20'
                    placeholder='Priority'
                  />
                  <Button size='sm' variant='ghost' onClick={() => setEditingRuleId(null)}>
                    <Save className='h-4 w-4' />
                  </Button>
                </>
              ) : (
                <>
                  <div className='flex-1'>
                    <p className='text-sm font-medium'>
                      {rule.pattern} ({rule.matchType}) → {rule.category}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Priority: {rule.priority} • {rule.enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <Button size='sm' variant='ghost' onClick={() => setEditingRuleId(rule.id)}>
                    <Edit2 className='h-4 w-4' />
                  </Button>
                  <Button size='sm' variant='ghost' onClick={() => deleteRule(rule.id)}>
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add New Rule */}
        {isAddingRule && (
          <div className='space-y-3 p-4 border rounded-lg bg-muted/50'>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <Label htmlFor='pattern'>Pattern</Label>
                <Input
                  id='pattern'
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                  placeholder='e.g., Starbucks'
                />
              </div>
              <div>
                <Label htmlFor='matchType'>Match Type</Label>
                <Select
                  value={newRule.matchType}
                  onValueChange={(value) => setNewRule({ ...newRule, matchType: value as any })}
                >
                  <SelectTrigger id='matchType'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='contains'>Contains</SelectItem>
                    <SelectItem value='startsWith'>Starts with</SelectItem>
                    <SelectItem value='endsWith'>Ends with</SelectItem>
                    <SelectItem value='regex'>Regex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor='category'>Category</Label>
                <Select
                  value={newRule.category}
                  onValueChange={(value) => setNewRule({ ...newRule, category: value })}
                >
                  <SelectTrigger id='category'>
                    <SelectValue placeholder='Select category' />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor='priority'>Priority</Label>
                <Input
                  id='priority'
                  type='number'
                  value={newRule.priority}
                  onChange={(e) => setNewRule({ ...newRule, priority: Number(e.target.value) })}
                  placeholder='0'
                />
              </div>
            </div>
            <div className='flex justify-end gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setIsAddingRule(false);
                  setNewRule({
                    pattern: '',
                    matchType: 'contains',
                    category: '',
                    priority: 0,
                    enabled: true,
                  });
                }}
              >
                Cancel
              </Button>
              <Button size='sm' onClick={addRule}>
                Add Rule
              </Button>
            </div>
          </div>
        )}

        {/* Add Rule Button */}
        {!isAddingRule && (
          <Button variant='outline' className='w-full' onClick={() => setIsAddingRule(true)}>
            <Plus className='h-4 w-4 mr-2' />
            Add New Rule
          </Button>
        )}

        {/* Help Text */}
        <div className='pt-4 border-t'>
          <h4 className='text-sm font-medium mb-2'>How rules work:</h4>
          <ul className='text-sm text-muted-foreground space-y-1'>
            <li>• Rules are applied in priority order (highest first)</li>
            <li>• First matching rule determines the category</li>
            <li>• Use regex for complex patterns (e.g., ^UBER.*EATS$)</li>
            <li>• Rules apply to new transactions and manual categorization</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
