'use client';

import { Trash2, Edit, PlusCircle } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@components/ui/dialog';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { ScrollArea } from '@components/ui/scroll-area';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@components/ui/table';
import { useToast } from '@components/ui/use-toast';
import { useDBContext } from '@context/DatabaseContext';
import { Liability as LiabilityItem } from '@services/db'; // Import Liability type from db service
// Note: Select component not available, using native select for liability type
import { logger } from '@services/logger';
import { formatCurrency } from '@utils/helpers';

const LIABILITY_TYPES = [
  'Credit Card',
  'Mortgage',
  'Student Loan',
  'Personal Loan',
  'Auto Loan',
  'Medical Debt',
  'Other',
] as const;
type LiabilityTypeTuple = typeof LIABILITY_TYPES;
type LiabilityType = LiabilityTypeTuple[number];

interface LiabilityFormData {
  name: string;
  type: LiabilityType;
  currentBalance: string; // Store as string for input field
}

const DEFAULT_FORM_DATA: LiabilityFormData = {
  name: '',
  type: 'Other',
  currentBalance: '',
};

export default function ManageLiabilitiesPage() {
  const { liabilities, addLiability, updateLiability, deleteLiability, loading } = useDBContext();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState<LiabilityItem | null>(null);
  const [formData, setFormData] = useState<LiabilityFormData>(DEFAULT_FORM_DATA);
  const [liabilityToDelete, setLiabilityToDelete] = useState<LiabilityItem | null>(null);

  useEffect(() => {
    if (editingLiability) {
      setFormData({
        name: editingLiability.name,
        type: editingLiability.type as LiabilityType,
        currentBalance: editingLiability.currentBalance.toString(),
      });
    } else {
      setFormData(DEFAULT_FORM_DATA);
    }
  }, [editingLiability, isDialogOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (value: LiabilityType) => {
    setFormData((prev) => ({ ...prev, type: value }));
  };

  const openAddDialog = () => {
    setEditingLiability(null);
    setFormData(DEFAULT_FORM_DATA);
    setIsDialogOpen(true);
  };

  const openEditDialog = (liability: LiabilityItem) => {
    setEditingLiability(liability);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingLiability(null);
    setFormData(DEFAULT_FORM_DATA);
  };

  const handleSaveLiability = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Liability name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }
    const currentBalanceNum = parseFloat(formData.currentBalance);
    if (isNaN(currentBalanceNum) || currentBalanceNum < 0) {
      toast({
        title: 'Validation Error',
        description: 'Current balance must be a valid positive number.',
        variant: 'destructive',
      });
      return;
    }

    const liabilityPayload = {
      name: formData.name,
      type: formData.type,
      currentBalance: currentBalanceNum,
      lastUpdated: new Date().toISOString(),
    };

    try {
      if (editingLiability) {
        await updateLiability({ ...editingLiability, ...liabilityPayload });
        toast({
          title: 'Liability Updated',
          description: `${liabilityPayload.name} has been updated successfully.`,
        });
      } else {
        await addLiability(liabilityPayload);
        toast({
          title: 'Liability Added',
          description: `${liabilityPayload.name} has been added successfully.`,
        });
      }
      closeDialog();
    } catch (error) {
      logger.error('Error saving liability:', error);
      toast({
        title: 'Save Error',
        description: 'Failed to save liability. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteLiability = async (liabilityId: string) => {
    if (!liabilityToDelete || liabilityToDelete.id !== liabilityId) return;

    try {
      await deleteLiability(liabilityId);
      toast({
        title: 'Liability Deleted',
        description: `${liabilityToDelete.name} has been deleted.`,
      });
      setLiabilityToDelete(null);
    } catch (error) {
      logger.error('Error deleting liability:', error);
      toast({
        title: 'Delete Error',
        description: 'Failed to delete liability. Please try again.',
        variant: 'destructive',
      });
      setLiabilityToDelete(null);
    }
  };

  const formatDate = (isoString: string) => new Date(isoString).toLocaleDateString();

  return (
    <div className='container mx-auto p-4 md:p-6'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <div>
            <CardTitle>Manage Liabilities</CardTitle>
            <CardDescription>Add, edit, or remove your financial liabilities.</CardDescription>
          </div>
          <Button onClick={openAddDialog}>
            <PlusCircle className='mr-2 h-4 w-4' /> Add New Liability
          </Button>
        </CardHeader>
        <CardContent>
          {loading && <p>Loading liabilities...</p>}
          {!loading && liabilities.length === 0 && (
            <p className='text-center text-gray-500 py-8'>
              No liabilities added yet. Click &quot;Add New Liability&quot; to get started.
            </p>
          )}
          {!loading && liabilities.length > 0 && (
            <ScrollArea className='max-h-[600px]'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className='text-right'>Current Balance</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className='text-center'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liabilities.map((liability) => (
                    <TableRow key={liability.id}>
                      <TableCell className='font-medium'>{liability.name}</TableCell>
                      <TableCell>{liability.type}</TableCell>
                      <TableCell className='text-right'>
                        {formatCurrency(liability.currentBalance)}
                      </TableCell>
                      <TableCell>{formatDate(liability.lastUpdated)}</TableCell>
                      <TableCell className='text-center space-x-2'>
                        <Button
                          variant='outline'
                          size='icon'
                          onClick={() => openEditDialog(liability)}
                        >
                          <Edit className='h-4 w-4' />
                          <span className='sr-only'>Edit Liability</span>
                        </Button>
                        <DialogTrigger asChild>
                          <Button
                            variant='outline'
                            size='icon'
                            className='text-red-600 hover:text-red-700'
                            onClick={() => setLiabilityToDelete(liability)}
                          >
                            <Trash2 className='h-4 w-4' />
                            <span className='sr-only'>Delete Liability</span>
                          </Button>
                        </DialogTrigger>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setIsDialogOpen(true);
        }}
      >
        <DialogContent className='sm:max-w-[425px]'>
          <DialogHeader>
            <DialogTitle>{editingLiability ? 'Edit Liability' : 'Add New Liability'}</DialogTitle>
            <DialogDescription>
              {editingLiability
                ? 'Update the details of your liability.'
                : 'Fill in the details of your new liability.'}
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='name' className='text-right'>
                Name
              </Label>
              <Input
                id='name'
                name='name'
                value={formData.name}
                onChange={handleInputChange}
                className='col-span-3'
                placeholder='e.g., Credit Card Debt'
              />
            </div>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='type' className='text-right'>
                Type
              </Label>
              <select
                id='type'
                name='type'
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value as LiabilityType)}
                className='col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
              >
                {LIABILITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='currentBalance' className='text-right'>
                Current Balance
              </Label>
              <Input
                id='currentBalance'
                name='currentBalance'
                type='number'
                value={formData.currentBalance}
                onChange={handleInputChange}
                className='col-span-3'
                placeholder='e.g., 1500'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveLiability}>Save Liability</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!liabilityToDelete}
        onOpenChange={(open) => {
          if (!open) setLiabilityToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the liability &quot;{liabilityToDelete?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setLiabilityToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => liabilityToDelete && handleDeleteLiability(liabilityToDelete.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
