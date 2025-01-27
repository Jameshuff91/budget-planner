import { Loader2 } from 'lucide-react';
import React from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';

import { Transaction } from '../src/hooks/useDatabase';

interface ExpenseDetailsModalProps {
  isOpen?: boolean;
  onClose: () => void;
  month: string;
  year?: number;
  spending: number;
  savings: number;
  isLoading?: boolean;
}

export function ExpenseDetailsModal({
  isOpen = false,
  onClose,
  month,
  year,
  spending,
  savings,
  isLoading = false,
}: ExpenseDetailsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>
            Overview for {month} {year}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className='flex justify-center items-center p-4'>
            <Loader2 className='h-6 w-6 animate-spin' />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className='text-right'>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Spending</TableCell>
                <TableCell className='text-right'>${spending.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Savings</TableCell>
                <TableCell className='text-right'>${savings.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className='font-bold'>Total</TableCell>
                <TableCell className='text-right font-bold'>
                  ${(spending + savings).toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
