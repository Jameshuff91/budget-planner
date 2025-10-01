'use client';

import { Card } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Switch } from '@components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { useDBContext } from '@context/DatabaseContext';
import { dbService } from '@services/db';
import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Save, X, Bell, AlertTriangle } from 'lucide-react';
import { toast } from '@components/ui/use-toast';

interface BudgetAlert {
  id: string;
  categoryId: string;
  threshold: number;
  enabled: boolean;
  notificationsSent: number;
}

export default function BudgetAlerts() {
  const { categories } = useDBContext();
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<BudgetAlert>>({
    categoryId: '',
    threshold: 80,
    enabled: true,
  });

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const allAlerts = await dbService.getAllBudgetAlerts();
      setAlerts(allAlerts);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.categoryId || !formData.threshold) {
      toast({
        title: 'Error',
        description: 'Category and threshold are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingId) {
        // Update existing alert
        await dbService.updateBudgetAlert({
          id: editingId,
          categoryId: formData.categoryId!,
          threshold: formData.threshold!,
          enabled: formData.enabled ?? true,
          notificationsSent: 0,
        });

        toast({
          title: 'Success',
          description: 'Alert updated successfully',
        });
      } else {
        // Create new alert
        await dbService.addBudgetAlert(formData.categoryId!, formData.threshold!);

        toast({
          title: 'Success',
          description: 'Alert created successfully',
        });
      }

      // Reset form
      setFormData({
        categoryId: '',
        threshold: 80,
        enabled: true,
      });
      setIsAdding(false);
      setEditingId(null);

      // Reload alerts
      await loadAlerts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save alert',
        variant: 'destructive',
      });
      console.error('Error saving alert:', error);
    }
  };

  const handleEdit = (alert: BudgetAlert) => {
    setEditingId(alert.id);
    setFormData({
      categoryId: alert.categoryId,
      threshold: alert.threshold,
      enabled: alert.enabled,
    });
    setIsAdding(true);
  };

  const handleDelete = async (alertId: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) {
      return;
    }

    try {
      await dbService.deleteBudgetAlert(alertId);

      toast({
        title: 'Success',
        description: 'Alert deleted successfully',
      });

      await loadAlerts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete alert',
        variant: 'destructive',
      });
      console.error('Error deleting alert:', error);
    }
  };

  const handleToggle = async (alert: BudgetAlert) => {
    try {
      await dbService.updateBudgetAlert({
        ...alert,
        enabled: !alert.enabled,
      });

      toast({
        title: 'Success',
        description: `Alert ${!alert.enabled ? 'enabled' : 'disabled'}`,
      });

      await loadAlerts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update alert',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      categoryId: '',
      threshold: 80,
      enabled: true,
    });
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  // Get categories that don't have alerts yet (for new alert creation)
  const availableCategories = categories.filter((c) => {
    if (editingId) return true; // When editing, show all categories
    return c.type === 'expense' && !alerts.some((a) => a.categoryId === c.id);
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Budget Alerts
            </h3>
            <p className="text-sm text-muted-foreground">
              Get notified when spending reaches a threshold
            </p>
          </div>
          {!isAdding && availableCategories.length > 0 && (
            <Button onClick={() => setIsAdding(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Alert
            </Button>
          )}
        </div>

        {/* Add/Edit Form */}
        {isAdding && (
          <Card className="p-4 mb-6 bg-gray-50">
            <h4 className="font-semibold mb-4">
              {editingId ? 'Edit Alert' : 'New Alert'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                  disabled={!!editingId} // Disable when editing
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories
                      .filter((c) => c.type === 'expense')
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="threshold">Threshold (%) *</Label>
                <Input
                  id="threshold"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.threshold}
                  onChange={(e) =>
                    setFormData({ ...formData, threshold: parseInt(e.target.value) || 80 })
                  }
                  placeholder="80"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Alert when {formData.threshold}% of budget is reached
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
                <Label htmlFor="enabled">Enabled</Label>
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

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No budget alerts configured</p>
            <p className="text-sm">Add alerts to get notified when spending reaches a threshold</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const category = categories.find((c) => c.id === alert.categoryId);
              const isWarning = alert.threshold >= 90;
              const isModerate = alert.threshold >= 70 && alert.threshold < 90;

              return (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    alert.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`${alert.enabled ? '' : 'opacity-50'}`}>
                      <Bell
                        className={`w-5 h-5 ${
                          alert.enabled
                            ? isWarning
                              ? 'text-red-600'
                              : isModerate
                                ? 'text-yellow-600'
                                : 'text-blue-600'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>

                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {category?.icon} {getCategoryName(alert.categoryId)}
                        {!alert.enabled && (
                          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                            Disabled
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Alert at {alert.threshold}% of budget
                        {alert.notificationsSent > 0 && (
                          <span className="ml-2 text-xs">
                            • {alert.notificationsSent} notification(s) sent
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        isWarning
                          ? 'bg-red-100 text-red-700'
                          : isModerate
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {alert.threshold}%
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Switch checked={alert.enabled} onCheckedChange={() => handleToggle(alert)} />
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(alert)}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(alert.id)}>
                      <Trash2 className="w-3 h-3 text-red-600" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Info Card */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <h4 className="font-semibold text-sm mb-2 text-blue-900">How Budget Alerts Work</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Alerts trigger when spending reaches the threshold percentage of your budget</li>
          <li>• You'll see a notification in the app when an alert is triggered</li>
          <li>• Alerts automatically reset at the start of each month</li>
          <li>• You can disable alerts temporarily without deleting them</li>
        </ul>
      </Card>
    </div>
  );
}
