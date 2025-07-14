'use client';

import { 
  Upload, 
  Download, 
  Shield, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  FileText,
  Settings,
  History,
  Eye,
  EyeOff,
  Trash2,
  Calendar
} from 'lucide-react';
import React, { useState, useRef, useCallback } from 'react';

import { useDBContext } from '@context/DatabaseContext';
import { 
  BackupService, 
  BackupOptions, 
  RestoreOptions, 
  BackupProgress, 
  RestoreProgress,
  BackupSchedule
} from '../src/services/backupService';
import { estimatePasswordStrength, generateSecurePassword } from '../src/utils/dataEncryption';

import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
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
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from './ui/use-toast';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';

interface BackupRestoreProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BackupRestore({ isOpen, onClose }: BackupRestoreProps) {
  // State management
  const { refreshData } = useDBContext();
  const [activeTab, setActiveTab] = useState('backup');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Backup state
  const [backupOptions, setBackupOptions] = useState<BackupOptions>({
    includeTransactions: true,
    includeCategories: true,
    includeAssets: true,
    includeLiabilities: true,
    includeRecurringPreferences: true,
    encrypt: false,
    password: '',
    filename: '',
  });
  const [backupProgress, setBackupProgress] = useState<BackupProgress | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<any>(null);

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreOptions, setRestoreOptions] = useState({
    mergeData: false,
    validateOnly: false,
  });
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgress | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

  // Schedule state
  const [schedule, setSchedule] = useState<BackupSchedule>(() => 
    BackupService.getBackupSchedule() || {
      enabled: false,
      frequency: 'weekly' as const,
      time: '02:00',
      autoCleanup: true,
      keepCount: 10,
    }
  );

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password handling
  const handlePasswordChange = useCallback((password: string) => {
    setBackupOptions(prev => ({ ...prev, password }));
    if (password) {
      setPasswordStrength(estimatePasswordStrength(password));
    } else {
      setPasswordStrength(null);
    }
  }, []);

  const generatePassword = useCallback(() => {
    const newPassword = generateSecurePassword(16);
    handlePasswordChange(newPassword);
    toast({
      title: 'Password Generated',
      description: 'A secure password has been generated. Make sure to save it!',
    });
  }, [handlePasswordChange]);

  // Backup functions
  const handleCreateBackup = async () => {
    try {
      setIsProcessing(true);
      setBackupProgress(null);

      if (backupOptions.encrypt && !backupOptions.password) {
        toast({
          title: 'Password Required',
          description: 'Please provide a password for encryption.',
          variant: 'destructive',
        });
        return;
      }

      const filename = await BackupService.createBackup(
        {
          ...backupOptions,
          filename: backupOptions.filename || `budget-backup-${new Date().toISOString().split('T')[0]}.json`,
        },
        setBackupProgress
      );

      toast({
        title: 'Backup Created',
        description: `Backup saved as ${filename}`,
      });

    } catch (error) {
      toast({
        title: 'Backup Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Restore functions
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setValidationResult(null);
    }
  };

  const handleValidateFile = async () => {
    if (!restoreFile) return;

    try {
      setIsProcessing(true);
      const result = await BackupService.validateBackupFile(restoreFile, restorePassword);
      setValidationResult(result);

      if (result.valid) {
        toast({
          title: 'Valid Backup File',
          description: 'The backup file is valid and ready to restore.',
        });
      } else {
        toast({
          title: 'Invalid Backup File',
          description: result.errors.join(', '),
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Validation Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile) return;

    try {
      setIsProcessing(true);
      setRestoreProgress(null);

      const result = await BackupService.restoreBackup(
        {
          data: restoreFile,
          password: restorePassword,
          mergeData: restoreOptions.mergeData,
          validateOnly: false,
        },
        setRestoreProgress
      );

      if (result.success) {
        await refreshData();
        toast({
          title: 'Restore Completed',
          description: `Successfully restored ${result.summary.counts.transactions} transactions and other data.`,
        });
        
        if (result.warnings.length > 0) {
          toast({
            title: 'Restore Warnings',
            description: `${result.warnings.length} warnings occurred. Check console for details.`,
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Restore Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Schedule functions
  const handleSaveSchedule = async () => {
    try {
      await BackupService.setBackupSchedule(schedule);
      toast({
        title: 'Schedule Updated',
        description: schedule.enabled ? 'Automatic backups are now enabled.' : 'Automatic backups are disabled.',
      });
    } catch (error) {
      toast({
        title: 'Schedule Failed',
        description: error instanceof Error ? error.message : 'Failed to update schedule',
        variant: 'destructive',
      });
    }
  };

  // Get password strength color
  const getPasswordStrengthColor = (level: string) => {
    switch (level) {
      case 'very-strong': return 'text-green-600';
      case 'strong': return 'text-blue-600';
      case 'good': return 'text-yellow-600';
      case 'fair': return 'text-orange-600';
      case 'weak': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Backup & Restore</DialogTitle>
          <DialogDescription>
            Securely backup your financial data or restore from a previous backup.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="backup">
              <Download className="h-4 w-4 mr-2" />
              Backup
            </TabsTrigger>
            <TabsTrigger value="restore">
              <Upload className="h-4 w-4 mr-2" />
              Restore
            </TabsTrigger>
            <TabsTrigger value="schedule">
              <Clock className="h-4 w-4 mr-2" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Backup Tab */}
          <TabsContent value="backup" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Backup</CardTitle>
                <CardDescription>
                  Export your financial data to a secure backup file.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Data Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Data to Include</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center space-x-2">
                      <Switch
                        checked={backupOptions.includeTransactions}
                        onCheckedChange={(checked) => 
                          setBackupOptions(prev => ({ ...prev, includeTransactions: checked }))
                        }
                      />
                      <span>Transactions</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <Switch
                        checked={backupOptions.includeCategories}
                        onCheckedChange={(checked) => 
                          setBackupOptions(prev => ({ ...prev, includeCategories: checked }))
                        }
                      />
                      <span>Categories</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <Switch
                        checked={backupOptions.includeAssets}
                        onCheckedChange={(checked) => 
                          setBackupOptions(prev => ({ ...prev, includeAssets: checked }))
                        }
                      />
                      <span>Assets</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <Switch
                        checked={backupOptions.includeLiabilities}
                        onCheckedChange={(checked) => 
                          setBackupOptions(prev => ({ ...prev, includeLiabilities: checked }))
                        }
                      />
                      <span>Liabilities</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <Switch
                        checked={backupOptions.includeRecurringPreferences}
                        onCheckedChange={(checked) => 
                          setBackupOptions(prev => ({ ...prev, includeRecurringPreferences: checked }))
                        }
                      />
                      <span>Recurring Preferences</span>
                    </label>
                  </div>
                </div>

                {/* Encryption */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={backupOptions.encrypt}
                      onCheckedChange={(checked) => 
                        setBackupOptions(prev => ({ ...prev, encrypt: checked }))
                      }
                    />
                    <Label className="text-base font-medium">
                      <Shield className="h-4 w-4 inline mr-1" />
                      Encrypt Backup
                    </Label>
                  </div>
                  
                  {backupOptions.encrypt && (
                    <div className="space-y-3 ml-6">
                      <div className="space-y-2">
                        <Label htmlFor="backup-password">Encryption Password</Label>
                        <div className="flex space-x-2">
                          <div className="relative flex-1">
                            <Input
                              id="backup-password"
                              type={showPassword ? 'text' : 'password'}
                              value={backupOptions.password}
                              onChange={(e) => handlePasswordChange(e.target.value)}
                              placeholder="Enter a strong password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 transform -translate-y-1/2"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={generatePassword}
                          >
                            Generate
                          </Button>
                        </div>
                        
                        {passwordStrength && (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm">Strength:</span>
                              <Badge variant={passwordStrength.level === 'very-strong' || passwordStrength.level === 'strong' ? 'default' : 'destructive'}>
                                {passwordStrength.level}
                              </Badge>
                              <span className={`text-sm ${getPasswordStrengthColor(passwordStrength.level)}`}>
                                {passwordStrength.score}/100
                              </span>
                            </div>
                            {passwordStrength.suggestions.length > 0 && (
                              <div className="text-sm text-gray-600">
                                Suggestions: {passwordStrength.suggestions.join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filename */}
                <div className="space-y-2">
                  <Label htmlFor="backup-filename">Filename (optional)</Label>
                  <Input
                    id="backup-filename"
                    value={backupOptions.filename}
                    onChange={(e) => setBackupOptions(prev => ({ ...prev, filename: e.target.value }))}
                    placeholder={`budget-backup-${new Date().toISOString().split('T')[0]}.json`}
                  />
                </div>

                {/* Progress */}
                {backupProgress && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>{backupProgress.message}</span>
                          <span>{backupProgress.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${backupProgress.progress}%` }}
                          />
                        </div>
                        {backupProgress.error && (
                          <div className="text-red-600 text-sm">{backupProgress.error}</div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  onClick={handleCreateBackup} 
                  disabled={isProcessing}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isProcessing ? 'Creating Backup...' : 'Create Backup'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Restore Tab */}
          <TabsContent value="restore" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Restore from Backup</CardTitle>
                <CardDescription>
                  Import data from a previous backup file.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File Selection */}
                <div className="space-y-2">
                  <Label>Backup File</Label>
                  <div className="flex space-x-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileSelect}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleValidateFile}
                      disabled={!restoreFile || isProcessing}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Validate
                    </Button>
                  </div>
                </div>

                {/* Password for encrypted backups */}
                <div className="space-y-2">
                  <Label htmlFor="restore-password">Password (if encrypted)</Label>
                  <Input
                    id="restore-password"
                    type="password"
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    placeholder="Enter backup password"
                  />
                </div>

                {/* Restore Options */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Restore Options</Label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <Switch
                        checked={restoreOptions.mergeData}
                        onCheckedChange={(checked) => 
                          setRestoreOptions(prev => ({ ...prev, mergeData: checked }))
                        }
                      />
                      <span>Merge with existing data (instead of replacing)</span>
                    </label>
                  </div>
                </div>

                {/* Validation Result */}
                {validationResult && (
                  <Alert variant={validationResult.valid ? "default" : "destructive"}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {validationResult.valid ? (
                        <div className="space-y-2">
                          <div className="text-green-600 font-medium">✓ Valid backup file</div>
                          {validationResult.summary && (
                            <div className="space-y-1 text-sm">
                              <div>Version: {validationResult.summary.version}</div>
                              <div>Transactions: {validationResult.summary.counts.transactions}</div>
                              <div>Categories: {validationResult.summary.counts.categories}</div>
                              <div>Assets: {validationResult.summary.counts.assets}</div>
                              <div>Liabilities: {validationResult.summary.counts.liabilities}</div>
                              <div>Date Range: {validationResult.summary.dateRange.earliest} to {validationResult.summary.dateRange.latest}</div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-red-600 font-medium">✗ Invalid backup file</div>
                          <div className="text-sm">{validationResult.errors.join(', ')}</div>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Progress */}
                {restoreProgress && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>{restoreProgress.message}</span>
                          <span>{restoreProgress.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${restoreProgress.progress}%` }}
                          />
                        </div>
                        {restoreProgress.error && (
                          <div className="text-red-600 text-sm">{restoreProgress.error}</div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  onClick={handleRestoreBackup} 
                  disabled={!restoreFile || !validationResult?.valid || isProcessing}
                  className="w-full"
                  variant={restoreOptions.mergeData ? "default" : "destructive"}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isProcessing ? 'Restoring...' : restoreOptions.mergeData ? 'Merge Data' : 'Replace All Data'}
                </Button>
                
                {!restoreOptions.mergeData && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Warning: This will replace ALL existing data with the backup data. This action cannot be undone.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Automatic Backup Schedule</CardTitle>
                <CardDescription>
                  Configure automatic backups to run on a schedule.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={schedule.enabled}
                    onCheckedChange={(checked) => 
                      setSchedule(prev => ({ ...prev, enabled: checked }))
                    }
                  />
                  <Label className="text-base font-medium">Enable Automatic Backups</Label>
                </div>

                {schedule.enabled && (
                  <div className="space-y-4 ml-6">
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <RadioGroup 
                        value={schedule.frequency} 
                        onValueChange={(value: any) => setSchedule(prev => ({ ...prev, frequency: value }))}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="daily" id="daily" />
                          <Label htmlFor="daily">Daily</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="weekly" id="weekly" />
                          <Label htmlFor="weekly">Weekly</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="monthly" id="monthly" />
                          <Label htmlFor="monthly">Monthly</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="backup-time">Time</Label>
                      <Input
                        id="backup-time"
                        type="time"
                        value={schedule.time}
                        onChange={(e) => setSchedule(prev => ({ ...prev, time: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={schedule.autoCleanup}
                          onCheckedChange={(checked) => 
                            setSchedule(prev => ({ ...prev, autoCleanup: checked }))
                          }
                        />
                        <Label>Automatic cleanup of old backups</Label>
                      </div>
                      
                      {schedule.autoCleanup && (
                        <div className="ml-6 space-y-2">
                          <Label htmlFor="keep-count">Number of backups to keep</Label>
                          <Input
                            id="keep-count"
                            type="number"
                            min="1"
                            max="100"
                            value={schedule.keepCount}
                            onChange={(e) => setSchedule(prev => ({ ...prev, keepCount: parseInt(e.target.value) || 10 }))}
                          />
                        </div>
                      )}
                    </div>

                    {schedule.lastBackup && (
                      <div className="text-sm text-gray-600">
                        Last backup: {new Date(schedule.lastBackup).toLocaleString()}
                      </div>
                    )}

                    {schedule.nextBackup && (
                      <div className="text-sm text-gray-600">
                        Next backup: {new Date(schedule.nextBackup).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                <Button onClick={handleSaveSchedule} className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Save Schedule
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Backup History</CardTitle>
                <CardDescription>
                  View your backup history and download previous backups.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BackupHistoryList />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Backup History List Component
function BackupHistoryList() {
  const [history, setHistory] = useState(() => BackupService.getBackupHistory());

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No backup history found</p>
        <p className="text-sm">Create your first backup to see it here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((backup) => (
        <Card key={backup.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span className="font-medium">{backup.filename}</span>
                {backup.encrypted && (
                  <Badge variant="secondary">
                    <Shield className="h-3 w-3 mr-1" />
                    Encrypted
                  </Badge>
                )}
              </div>
              <div className="text-sm text-gray-600 space-x-4">
                <span>
                  <Calendar className="h-3 w-3 inline mr-1" />
                  {new Date(backup.timestamp).toLocaleString()}
                </span>
                <span>Size: {formatFileSize(backup.size)}</span>
                {backup.summary && (
                  <span>
                    {backup.summary.counts.transactions} transactions
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}