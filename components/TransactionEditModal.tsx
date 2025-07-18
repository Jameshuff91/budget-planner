'use client';

import React, { useState, useEffect } from 'react';

import { useDBContext } from '@context/DatabaseContext';

import { Transaction } from '../src/types';

import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from './ui/use-toast';

interface TransactionEditModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Transaction) => Promise<void>;
}

export function TransactionEditModal({
  transaction,
  isOpen,
  onClose,
  onSave,
}: TransactionEditModalProps) {
  const { categories } = useDBContext();
  const [editedTransaction, setEditedTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (transaction) {
      setEditedTransaction({ ...transaction });
    }
  }, [transaction]);

  const handleSave = async () => {
    if (!editedTransaction) return;

    // Validate required fields
    if (
      !editedTransaction.date ||
      !editedTransaction.description ||
      editedTransaction.amount === undefined
    ) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await onSave(editedTransaction);
      toast({
        title: 'Success',
        description: 'Transaction updated successfully',
      });
      onClose();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update transaction',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!editedTransaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-[525px]'>
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>Make changes to the transaction details below.</DialogDescription>
        </DialogHeader>
        <div className='grid gap-4 py-4'>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='date' className='text-right'>
              Date
            </Label>
            <Input
              id='date'
              type='date'
              value={editedTransaction.date}
              onChange={(e) => setEditedTransaction({ ...editedTransaction, date: e.target.value })}
              className='col-span-3'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='description' className='text-right'>
              Description
            </Label>
            <Input
              id='description'
              value={editedTransaction.description}
              onChange={(e) =>
                setEditedTransaction({ ...editedTransaction, description: e.target.value })
              }
              className='col-span-3'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='amount' className='text-right'>
              Amount
            </Label>
            <Input
              id='amount'
              type='number'
              step='0.01'
              value={Math.abs(editedTransaction.amount)}
              onChange={(e) =>
                setEditedTransaction({
                  ...editedTransaction,
                  amount:
                    editedTransaction.type === 'expense'
                      ? -Math.abs(parseFloat(e.target.value) || 0)
                      : Math.abs(parseFloat(e.target.value) || 0),
                })
              }
              className='col-span-3'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='type' className='text-right'>
              Type
            </Label>
            <Select
              value={editedTransaction.type}
              onValueChange={(value: 'income' | 'expense') => {
                const absAmount = Math.abs(editedTransaction.amount);
                setEditedTransaction({
                  ...editedTransaction,
                  type: value,
                  amount: value === 'expense' ? -absAmount : absAmount,
                });
              }}
            >
              <SelectTrigger className='col-span-3'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='income'>Income</SelectItem>
                <SelectItem value='expense'>Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='category' className='text-right'>
              Category
            </Label>
            <Select
              value={editedTransaction.categoryId || 'uncategorized'}
              onValueChange={(value) => {
                setEditedTransaction({
                  ...editedTransaction,
                  categoryId: value === 'uncategorized' ? undefined : value,
                  category: categories.find((c) => c.id === value)?.name || 'Uncategorized',
                });
              }}
            >
              <SelectTrigger className='col-span-3'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='uncategorized'>Uncategorized</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {editedTransaction.accountNumber && (
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label className='text-right'>Account</Label>
              <div className='col-span-3 text-sm text-gray-600'>
                {editedTransaction.accountNumber}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
