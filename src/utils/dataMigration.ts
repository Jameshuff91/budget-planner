import { logger } from '../services/logger';
import { Asset, Liability } from '../services/db';
import { Transaction, Category } from '../types';
import { generateUUID } from './helpers';

export interface BackupData {
  version: number;
  timestamp: string;
  metadata: {
    exportedBy: string;
    totalTransactions: number;
    totalCategories: number;
    totalAssets: number;
    totalLiabilities: number;
    totalRecurringPreferences: number;
    dataHash: string;
  };
  data: {
    transactions: Transaction[];
    categories: Category[];
    assets: Asset[];
    liabilities: Liability[];
    recurringPreferences: Record<string, 'confirmed' | 'dismissed'>;
  };
}

export interface MigrationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  migratedData: BackupData | null;
}

/**
 * Data migration utilities for handling schema changes and version compatibility
 */
export class DataMigration {
  private static readonly CURRENT_VERSION = 5; // Match database version
  private static readonly SUPPORTED_VERSIONS = [1, 2, 3, 4, 5];

  /**
   * Validates backup data structure and version compatibility
   */
  static validateBackupData(data: any): MigrationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if data exists
      if (!data) {
        errors.push('Backup data is empty or null');
        return { success: false, errors, warnings, migratedData: null };
      }

      // Check version
      if (typeof data.version !== 'number') {
        errors.push('Backup version is missing or invalid');
        return { success: false, errors, warnings, migratedData: null };
      }

      if (!this.SUPPORTED_VERSIONS.includes(data.version)) {
        errors.push(
          `Unsupported backup version: ${data.version}. Supported versions: ${this.SUPPORTED_VERSIONS.join(', ')}`,
        );
        return { success: false, errors, warnings, migratedData: null };
      }

      // Check required structure
      if (!data.data || typeof data.data !== 'object') {
        errors.push('Backup data structure is invalid - missing data object');
        return { success: false, errors, warnings, migratedData: null };
      }

      // Validate required arrays
      const requiredArrays = ['transactions', 'categories', 'assets', 'liabilities'];
      for (const arrayName of requiredArrays) {
        if (!Array.isArray(data.data[arrayName])) {
          errors.push(`Invalid or missing ${arrayName} array in backup data`);
        }
      }

      // Validate recurring preferences (can be missing in older versions)
      if (data.data.recurringPreferences && typeof data.data.recurringPreferences !== 'object') {
        errors.push('Invalid recurringPreferences object in backup data');
      }

      // Check metadata
      if (!data.metadata || typeof data.metadata !== 'object') {
        warnings.push('Backup metadata is missing or invalid');
      }

      if (errors.length > 0) {
        return { success: false, errors, warnings, migratedData: null };
      }

      return { success: true, errors, warnings, migratedData: data as BackupData };
    } catch (error) {
      logger.error('Error validating backup data:', error);
      errors.push('Failed to validate backup data structure');
      return { success: false, errors, warnings, migratedData: null };
    }
  }

  /**
   * Migrates backup data to the current version
   */
  static async migrateToCurrentVersion(data: BackupData): Promise<MigrationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let migratedData = { ...data };

    try {
      logger.info(`Migrating backup from version ${data.version} to ${this.CURRENT_VERSION}`);

      // Apply version-specific migrations
      if (data.version < 2) {
        migratedData = this.migrateV1ToV2(migratedData, warnings);
      }
      if (data.version < 3) {
        migratedData = this.migrateV2ToV3(migratedData, warnings);
      }
      if (data.version < 4) {
        migratedData = this.migrateV3ToV4(migratedData, warnings);
      }
      if (data.version < 5) {
        migratedData = this.migrateV4ToV5(migratedData, warnings);
      }

      // Update version and timestamp
      migratedData.version = this.CURRENT_VERSION;
      migratedData.timestamp = new Date().toISOString();

      // Validate migrated data
      const validation = this.validateMigratedData(migratedData);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);

      logger.info(`Migration completed. ${warnings.length} warnings, ${errors.length} errors`);

      return {
        success: errors.length === 0,
        errors,
        warnings,
        migratedData: errors.length === 0 ? migratedData : null,
      };
    } catch (error) {
      logger.error('Error during migration:', error);
      errors.push('Migration failed due to unexpected error');
      return { success: false, errors, warnings, migratedData: null };
    }
  }

  /**
   * Migration from version 1 to 2
   * - Added categories with budget field
   */
  private static migrateV1ToV2(data: BackupData, warnings: string[]): BackupData {
    warnings.push('Migrating from v1 to v2: Adding budget field to categories');

    const migratedData = { ...data };
    migratedData.data.categories = migratedData.data.categories.map((category) => ({
      ...category,
      budget: category.budget || undefined, // Keep existing budget or make undefined
    }));

    return migratedData;
  }

  /**
   * Migration from version 2 to 3
   * - Added PDF processing capabilities
   * - Added accountNumber field to transactions
   */
  private static migrateV2ToV3(data: BackupData, warnings: string[]): BackupData {
    warnings.push('Migrating from v2 to v3: Adding accountNumber field to transactions');

    const migratedData = { ...data };
    migratedData.data.transactions = migratedData.data.transactions.map((transaction) => ({
      ...transaction,
      accountNumber: transaction.accountNumber || undefined,
    }));

    return migratedData;
  }

  /**
   * Migration from version 3 to 4
   * - Added recurring preferences
   */
  private static migrateV3ToV4(data: BackupData, warnings: string[]): BackupData {
    warnings.push('Migrating from v3 to v4: Adding recurring preferences');

    const migratedData = { ...data };
    if (!migratedData.data.recurringPreferences) {
      migratedData.data.recurringPreferences = {};
    }

    return migratedData;
  }

  /**
   * Migration from version 4 to 5
   * - Added assets and liabilities for net worth tracking
   */
  private static migrateV4ToV5(data: BackupData, warnings: string[]): BackupData {
    warnings.push('Migrating from v4 to v5: Adding assets and liabilities');

    const migratedData = { ...data };
    if (!migratedData.data.assets) {
      migratedData.data.assets = [];
    }
    if (!migratedData.data.liabilities) {
      migratedData.data.liabilities = [];
    }

    return migratedData;
  }

  /**
   * Validates migrated data for consistency and completeness
   */
  private static validateMigratedData(data: BackupData): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate transactions
      data.data.transactions.forEach((transaction, index) => {
        if (!transaction.id) {
          errors.push(`Transaction at index ${index} is missing ID`);
        }
        if (!transaction.date) {
          errors.push(`Transaction at index ${index} is missing date`);
        }
        if (typeof transaction.amount !== 'number' || transaction.amount <= 0) {
          errors.push(`Transaction at index ${index} has invalid amount`);
        }
        if (!transaction.category || !transaction.description) {
          errors.push(`Transaction at index ${index} is missing category or description`);
        }
        if (!['income', 'expense'].includes(transaction.type)) {
          errors.push(`Transaction at index ${index} has invalid type`);
        }
      });

      // Validate categories
      data.data.categories.forEach((category, index) => {
        if (!category.id) {
          errors.push(`Category at index ${index} is missing ID`);
        }
        if (!category.name) {
          errors.push(`Category at index ${index} is missing name`);
        }
        if (!['income', 'expense'].includes(category.type)) {
          errors.push(`Category at index ${index} has invalid type`);
        }
      });

      // Validate assets
      data.data.assets.forEach((asset, index) => {
        if (!asset.id) {
          errors.push(`Asset at index ${index} is missing ID`);
        }
        if (!asset.name || !asset.type) {
          errors.push(`Asset at index ${index} is missing name or type`);
        }
        if (typeof asset.currentValue !== 'number') {
          errors.push(`Asset at index ${index} has invalid currentValue`);
        }
        if (!asset.lastUpdated) {
          errors.push(`Asset at index ${index} is missing lastUpdated`);
        }
      });

      // Validate liabilities
      data.data.liabilities.forEach((liability, index) => {
        if (!liability.id) {
          errors.push(`Liability at index ${index} is missing ID`);
        }
        if (!liability.name || !liability.type) {
          errors.push(`Liability at index ${index} is missing name or type`);
        }
        if (typeof liability.currentBalance !== 'number') {
          errors.push(`Liability at index ${index} has invalid currentBalance`);
        }
        if (!liability.lastUpdated) {
          errors.push(`Liability at index ${index} is missing lastUpdated`);
        }
      });

      // Check for duplicate IDs
      const transactionIds = data.data.transactions.map((t) => t.id);
      const categoryIds = data.data.categories.map((c) => c.id);
      const assetIds = data.data.assets.map((a) => a.id);
      const liabilityIds = data.data.liabilities.map((l) => l.id);

      if (new Set(transactionIds).size !== transactionIds.length) {
        errors.push('Duplicate transaction IDs found');
      }
      if (new Set(categoryIds).size !== categoryIds.length) {
        errors.push('Duplicate category IDs found');
      }
      if (new Set(assetIds).size !== assetIds.length) {
        errors.push('Duplicate asset IDs found');
      }
      if (new Set(liabilityIds).size !== liabilityIds.length) {
        errors.push('Duplicate liability IDs found');
      }

      // Check for orphaned transactions (categories that don't exist)
      const categoryNames = new Set(data.data.categories.map((c) => c.name));
      data.data.transactions.forEach((transaction, index) => {
        if (!categoryNames.has(transaction.category)) {
          warnings.push(
            `Transaction at index ${index} references non-existent category: ${transaction.category}`,
          );
        }
      });
    } catch (error) {
      logger.error('Error validating migrated data:', error);
      errors.push('Failed to validate migrated data');
    }

    return { errors, warnings };
  }

  /**
   * Sanitizes and repairs common data issues
   */
  static sanitizeBackupData(data: BackupData): BackupData {
    const sanitized = { ...data };

    try {
      // Ensure all transactions have valid IDs
      sanitized.data.transactions = sanitized.data.transactions.map((transaction) => ({
        ...transaction,
        id: transaction.id || generateUUID(),
        date:
          typeof transaction.date === 'string'
            ? transaction.date
            : new Date(transaction.date).toISOString(),
        amount: Math.abs(Number(transaction.amount)) || 0,
        category: transaction.category?.trim() || 'Uncategorized',
        description: transaction.description?.trim() || 'Unknown Transaction',
        type: ['income', 'expense'].includes(transaction.type) ? transaction.type : 'expense',
      }));

      // Ensure all categories have valid IDs
      sanitized.data.categories = sanitized.data.categories.map((category) => ({
        ...category,
        id: category.id || generateUUID(),
        name: category.name?.trim() || 'Unknown Category',
        type: ['income', 'expense'].includes(category.type) ? category.type : 'expense',
      }));

      // Ensure all assets have valid IDs
      sanitized.data.assets = sanitized.data.assets.map((asset) => ({
        ...asset,
        id: asset.id || generateUUID(),
        name: asset.name?.trim() || 'Unknown Asset',
        type: asset.type?.trim() || 'Other',
        currentValue: Number(asset.currentValue) || 0,
        lastUpdated: asset.lastUpdated || new Date().toISOString(),
      }));

      // Ensure all liabilities have valid IDs
      sanitized.data.liabilities = sanitized.data.liabilities.map((liability) => ({
        ...liability,
        id: liability.id || generateUUID(),
        name: liability.name?.trim() || 'Unknown Liability',
        type: liability.type?.trim() || 'Other',
        currentBalance: Number(liability.currentBalance) || 0,
        lastUpdated: liability.lastUpdated || new Date().toISOString(),
      }));

      // Ensure recurring preferences is an object
      if (
        !sanitized.data.recurringPreferences ||
        typeof sanitized.data.recurringPreferences !== 'object'
      ) {
        sanitized.data.recurringPreferences = {};
      }

      logger.info('Backup data sanitized successfully');
    } catch (error) {
      logger.error('Error sanitizing backup data:', error);
    }

    return sanitized;
  }

  /**
   * Creates a summary of backup data for user review
   */
  static createBackupSummary(data: BackupData): {
    version: number;
    timestamp: string;
    counts: {
      transactions: number;
      categories: number;
      assets: number;
      liabilities: number;
      recurringPreferences: number;
    };
    dateRange: {
      earliest: string | null;
      latest: string | null;
    };
    totalValue: {
      assets: number;
      liabilities: number;
      netWorth: number;
    };
  } {
    const transactions = data.data.transactions || [];
    const categories = data.data.categories || [];
    const assets = data.data.assets || [];
    const liabilities = data.data.liabilities || [];
    const recurringPreferences = data.data.recurringPreferences || {};

    // Calculate date range
    const dates = transactions.map((t) => new Date(t.date)).filter((d) => !isNaN(d.getTime()));
    const earliest =
      dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString() : null;
    const latest =
      dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString() : null;

    // Calculate total values
    const totalAssets = assets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);
    const totalLiabilities = liabilities.reduce(
      (sum, liability) => sum + (liability.currentBalance || 0),
      0,
    );
    const netWorth = totalAssets - totalLiabilities;

    return {
      version: data.version,
      timestamp: data.timestamp,
      counts: {
        transactions: transactions.length,
        categories: categories.length,
        assets: assets.length,
        liabilities: liabilities.length,
        recurringPreferences: Object.keys(recurringPreferences).length,
      },
      dateRange: {
        earliest,
        latest,
      },
      totalValue: {
        assets: totalAssets,
        liabilities: totalLiabilities,
        netWorth,
      },
    };
  }
}

/**
 * Convenience functions for common migration operations
 */
export const validateBackupData = DataMigration.validateBackupData;
export const migrateToCurrentVersion = DataMigration.migrateToCurrentVersion;
export const sanitizeBackupData = DataMigration.sanitizeBackupData;
export const createBackupSummary = DataMigration.createBackupSummary;
