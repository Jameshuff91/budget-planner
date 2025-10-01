'use client';

import { Card } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Switch } from '@components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { useDBContext } from '@context/DatabaseContext';
import { dbService } from '@services/db';
import { useState } from 'react';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { Category } from '../src/types';
import { toast } from '@components/ui/use-toast';

export default function CategoryManagement() {
  const { categories } = useDBContext();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Category>>({
    name: '',
    type: 'expense',
    budget: 0,
    parentId: undefined,
    isTaxDeductible: false,
    color: '#3b82f6',
    icon: '💰',
  });

  const handleSubmit = async () => {
    if (!formData.name) {
      toast({
        title: 'Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingId) {
        // Update existing category
        await dbService.updateCategory({
          id: editingId,
          name: formData.name!,
          type: formData.type as 'income' | 'expense',
          budget: formData.budget,
          parentId: formData.parentId,
          isTaxDeductible: formData.isTaxDeductible,
          color: formData.color,
          icon: formData.icon,
        });

        toast({
          title: 'Success',
          description: 'Category updated successfully',
        });
      } else {
        // Add new category
        await dbService.addCategory({
          id: `category-${Date.now()}`,
          name: formData.name!,
          type: formData.type as 'income' | 'expense',
          budget: formData.budget,
          parentId: formData.parentId,
          isTaxDeductible: formData.isTaxDeductible,
          color: formData.color,
          icon: formData.icon,
        });

        toast({
          title: 'Success',
          description: 'Category created successfully',
        });
      }

      // Reset form
      setFormData({
        name: '',
        type: 'expense',
        budget: 0,
        parentId: undefined,
        isTaxDeductible: false,
        color: '#3b82f6',
        icon: '💰',
      });
      setIsAdding(false);
      setEditingId(null);

      // Refresh will happen automatically through context
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save category',
        variant: 'destructive',
      });
      console.error('Error saving category:', error);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      type: category.type,
      budget: category.budget || 0,
      parentId: category.parentId,
      isTaxDeductible: category.isTaxDeductible || false,
      color: category.color || '#3b82f6',
      icon: category.icon || '💰',
    });
    setIsAdding(true);
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      await dbService.deleteCategory(categoryId);

      toast({
        title: 'Success',
        description: 'Category deleted successfully',
      });

      // Refresh will happen automatically through context
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete category',
        variant: 'destructive',
      });
      console.error('Error deleting category:', error);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: '',
      type: 'expense',
      budget: 0,
      parentId: undefined,
      isTaxDeductible: false,
      color: '#3b82f6',
      icon: '💰',
    });
  };

  // Get parent categories (categories without a parent)
  const parentCategories = categories.filter((c) => !c.parentId && c.type === formData.type);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Category Management</h3>
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          )}
        </div>

        {/* Add/Edit Form */}
        {isAdding && (
          <Card className="p-4 mb-6 bg-gray-50">
            <h4 className="font-semibold mb-4">
              {editingId ? 'Edit Category' : 'New Category'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Category Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Groceries"
                />
              </div>

              <div>
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value as 'income' | 'expense' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="budget">Monthly Budget</Label>
                <Input
                  id="budget"
                  type="number"
                  value={formData.budget}
                  onChange={(e) =>
                    setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="parent">Parent Category (Optional)</Label>
                <Select
                  value={formData.parentId || 'none'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, parentId: value === 'none' ? undefined : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Parent Category)</SelectItem>
                    {parentCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="icon">Icon</Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="💰"
                  maxLength={2}
                />
              </div>

              <div>
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="taxDeductible"
                  checked={formData.isTaxDeductible}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isTaxDeductible: checked })
                  }
                />
                <Label htmlFor="taxDeductible">Tax Deductible</Label>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={handleSubmit} size="sm">
                <Save className="w-4 h-4 mr-2" />
                {editingId ? 'Update' : 'Save'}
              </Button>
              <Button onClick={handleCancel} variant="outline" size="sm">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {/* Category List */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm mb-3">Expense Categories</h4>
          {categories
            .filter((c) => c.type === 'expense')
            .map((category) => {
              const isParent = !category.parentId;
              const children = categories.filter((c) => c.parentId === category.id);

              return (
                <div key={category.id}>
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 ${
                      isParent ? 'bg-white border' : 'bg-gray-50 ml-8'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{category.icon}</span>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {category.name}
                          {category.isTaxDeductible && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                              Tax Deductible
                            </span>
                          )}
                        </div>
                        {category.budget && category.budget > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Budget: ${category.budget.toFixed(2)}/month
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {category.color && (
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(category)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(category.id)}
                      >
                        <Trash2 className="w-3 h-3 text-red-600" />
                      </Button>
                    </div>
                  </div>

                  {/* Show children */}
                  {isParent && children.length > 0 && (
                    <div className="mt-1">
                      {children.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 bg-gray-50 ml-8"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{child.icon}</span>
                            <div>
                              <div className="font-medium">{child.name}</div>
                              {child.budget && child.budget > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  Budget: ${child.budget.toFixed(2)}/month
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {child.color && (
                              <div
                                className="w-4 h-4 rounded-full border"
                                style={{ backgroundColor: child.color }}
                              />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(child)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(child.id)}
                            >
                              <Trash2 className="w-3 h-3 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          <h4 className="font-semibold text-sm mb-3 mt-6">Income Categories</h4>
          {categories
            .filter((c) => c.type === 'income')
            .map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 bg-white border"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{category.icon}</span>
                  <div>
                    <div className="font-medium">{category.name}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {category.color && (
                    <div
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: category.color }}
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(category)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(category.id)}
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
