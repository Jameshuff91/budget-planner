'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useDBContext, Asset as AssetItem } from '@context/DatabaseContext'; // Renamed Asset to AssetItem to avoid conflict
import { useToast } from '@components/ui/use-toast';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription, // Added for context
} from '@components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose, // Added for explicit close
} from '@components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@components/ui/table';
import { Label } from '@components/ui/label';
import { ScrollArea } from '@components/ui/scroll-area'; // For potentially long tables
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select'; // For Asset Type
import { Trash2, Edit, PlusCircle } from 'lucide-react';
import { formatCurrency } from '@utils/helpers';
import { logger } from '@services/logger';

const ASSET_TYPES = ['Cash', 'Savings Account', 'Checking Account', 'Investment (Stocks)', 'Investment (Bonds)', 'Real Estate', 'Vehicle', 'Other'] as const;
type AssetTypeTuple = typeof ASSET_TYPES;
type AssetType = AssetTypeTuple[number];

interface AssetFormData {
  name: string;
  type: AssetType;
  currentValue: string; // Store as string for input field
}

const DEFAULT_FORM_DATA: AssetFormData = {
  name: '',
  type: 'Other',
  currentValue: '',
};

export default function ManageAssetsPage() {
  const { assets, addAsset, updateAsset, deleteAsset, loading } = useDBContext();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetItem | null>(null);
  const [formData, setFormData] = useState<AssetFormData>(DEFAULT_FORM_DATA);
  const [assetToDelete, setAssetToDelete] = useState<AssetItem | null>(null); // For delete confirmation

  // Effect to populate form when editingAsset changes
  useEffect(() => {
    if (editingAsset) {
      setFormData({
        name: editingAsset.name,
        type: editingAsset.type as AssetType, // Assuming Asset.type aligns with AssetType
        currentValue: editingAsset.currentValue.toString(),
      });
    } else {
      setFormData(DEFAULT_FORM_DATA); // Reset for new asset
    }
  }, [editingAsset, isDialogOpen]); // Re-run if dialog opens for a new asset after editing

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (value: AssetType) => {
    setFormData(prev => ({ ...prev, type: value }));
  };
  
  const openAddDialog = () => {
    setEditingAsset(null);
    setFormData(DEFAULT_FORM_DATA);
    setIsDialogOpen(true);
  };

  const openEditDialog = (asset: AssetItem) => {
    setEditingAsset(asset);
    // useEffect will populate formData
    setIsDialogOpen(true);
  };
  
  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingAsset(null); // Important to reset editingAsset
    setFormData(DEFAULT_FORM_DATA);
  };

  const handleSaveAsset = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Validation Error", description: "Asset name cannot be empty.", variant: "destructive" });
      return;
    }
    const currentValueNum = parseFloat(formData.currentValue);
    if (isNaN(currentValueNum) || currentValueNum < 0) {
      toast({ title: "Validation Error", description: "Current value must be a valid positive number.", variant: "destructive" });
      return;
    }

    const assetPayload = {
      name: formData.name,
      type: formData.type,
      currentValue: currentValueNum,
      lastUpdated: new Date().toISOString(),
    };

    try {
      if (editingAsset) {
        await updateAsset({ ...editingAsset, ...assetPayload });
        toast({ title: "Asset Updated", description: `${assetPayload.name} has been updated successfully.` });
      } else {
        await addAsset(assetPayload);
        toast({ title: "Asset Added", description: `${assetPayload.name} has been added successfully.` });
      }
      closeDialog();
    } catch (error) {
      logger.error("Error saving asset:", error);
      toast({ title: "Save Error", description: "Failed to save asset. Please try again.", variant: "destructive" });
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!assetToDelete || assetToDelete.id !== assetId) return; // Should not happen

    try {
      await deleteAsset(assetId);
      toast({ title: "Asset Deleted", description: `${assetToDelete.name} has been deleted.` });
      setAssetToDelete(null); // Close confirmation
    } catch (error) {
      logger.error("Error deleting asset:", error);
      toast({ title: "Delete Error", description: "Failed to delete asset. Please try again.", variant: "destructive" });
      setAssetToDelete(null);
    }
  };

  const formatDate = (isoString: string) => new Date(isoString).toLocaleDateString();

  return (
    <div className="container mx-auto p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manage Assets</CardTitle>
            <CardDescription>Add, edit, or remove your financial assets.</CardDescription>
          </div>
          <Button onClick={openAddDialog}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Asset
          </Button>
        </CardHeader>
        <CardContent>
          {loading && <p>Loading assets...</p>}
          {!loading && assets.length === 0 && (
            <p className="text-center text-gray-500 py-8">No assets added yet. Click "Add New Asset" to get started.</p>
          )}
          {!loading && assets.length > 0 && (
            <ScrollArea className="max-h-[600px]"> {/* Adjust height as needed */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Current Value</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">{asset.name}</TableCell>
                      <TableCell>{asset.type}</TableCell>
                      <TableCell className="text-right">{formatCurrency(asset.currentValue)}</TableCell>
                      <TableCell>{formatDate(asset.lastUpdated)}</TableCell>
                      <TableCell className="text-center space-x-2">
                        <Button variant="outline" size="icon" onClick={() => openEditDialog(asset)}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit Asset</span>
                        </Button>
                        <DialogTrigger asChild>
                           <Button variant="outline" size="icon" className="text-red-600 hover:text-red-700" onClick={() => setAssetToDelete(asset)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete Asset</span>
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
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setIsDialogOpen(true); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
            <DialogDescription>
              {editingAsset ? 'Update the details of your asset.' : 'Fill in the details of your new asset.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleInputChange} className="col-span-3" placeholder="e.g., Savings Account" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">Type</Label>
              <Select name="type" value={formData.type} onValueChange={(value: AssetType) => handleTypeChange(value)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select asset type" />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="currentValue" className="text-right">Current Value</Label>
              <Input id="currentValue" name="currentValue" type="number" value={formData.currentValue} onChange={handleInputChange} className="col-span-3" placeholder="e.g., 5000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSaveAsset}>Save Asset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog (Simple version using Dialog for consistency) */}
      <Dialog open={!!assetToDelete} onOpenChange={(open) => { if (!open) setAssetToDelete(null); }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogDescription>
                    Are you sure you want to delete the asset "{assetToDelete?.name}"? This action cannot be undone.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setAssetToDelete(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => assetToDelete && handleDeleteAsset(assetToDelete.id)}>Delete</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
