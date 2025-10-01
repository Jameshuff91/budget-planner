import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';

test.describe('CSV Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);

    // Upload sample data first
    const csvContent = `date,description,amount,category,type
2024-01-15,Grocery Store,-50.25,Food,expense
2024-01-16,Gas Station,-35.00,Transportation,expense
2024-01-17,Salary,2500.00,Income,income
2024-01-18,Coffee Shop,-4.50,Food,expense
2024-01-19,Electric Bill,-120.00,Utilities,expense
2024-01-20,Freelance Work,500.00,Income,income`;

    const fileInput = page.locator('#file-upload');
    await fileInput.setInputFiles({
      name: 'test-transactions.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    // Wait for upload success
    await expect(
      page
        .locator('[data-radix-collection-item], [role="status"]')
        .filter({ hasText: /Success|processed/i })
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should open export dialog when export button is clicked', async ({ page }) => {
    // Click the export button
    await page.locator('button:has-text("Export Data")').click();

    // Verify export dialog is visible
    await expect(page.locator('h2:has-text("Export Financial Data")')).toBeVisible();
    await expect(
      page.locator('text=Choose your export options and download your financial data as CSV.'),
    ).toBeVisible();
  });

  test('should show export format options', async ({ page }) => {
    // Open export dialog
    await page.locator('button:has-text("Export Data")').click();

    // Check for export format radio buttons
    await expect(page.locator('text=Transactions')).toBeVisible();
    await expect(page.locator('text=Category Summary')).toBeVisible();
  });

  test('should download transactions CSV when export is clicked', async ({ page }) => {
    // Set up download promise before triggering download
    const downloadPromise = page.waitForEvent('download');

    // Open export dialog
    await page.locator('button:has-text("Export Data")').click();

    // Select transactions format (should be default)
    await expect(page.locator('input[value="transactions"]')).toBeChecked();

    // Click export button
    await page.locator('button:has-text("Export to CSV")').click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download filename contains 'transactions'
    expect(download.suggestedFilename()).toContain('transactions');
    expect(download.suggestedFilename().endsWith('.csv')).toBe(true);
  });

  test('should download category summary CSV', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');

    // Open export dialog
    await page.locator('button:has-text("Export Data")').click();

    // Select category summary format
    await page.locator('text=Category Summary').click();
    await expect(page.locator('input[value="summary"]')).toBeChecked();

    // Click export button
    await page.locator('button:has-text("Export to CSV")').click();

    // Wait for download
    const download = await downloadPromise;

    // Verify download filename
    expect(download.suggestedFilename()).toContain('category_summary');
    expect(download.suggestedFilename().endsWith('.csv')).toBe(true);
  });

  test('should filter by date range before export', async ({ page }) => {
    // Open export dialog
    await page.locator('button:has-text("Export Data")').click();

    // Enable date range filter
    await page.locator('input[type="checkbox"]').first().check();

    // Set date range (assuming date inputs are present)
    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').last();

    await startDateInput.fill('2024-01-16');
    await endDateInput.fill('2024-01-18');

    // Export with filters
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has-text("Export to CSV")').click();

    const download = await downloadPromise;

    // Verify download happens with date filter
    expect(download.suggestedFilename()).toContain('transactions');
    expect(download.suggestedFilename().endsWith('.csv')).toBe(true);
  });

  test('should show success toast after export', async ({ page }) => {
    // Open export dialog
    await page.locator('button:has-text("Export Data")').click();

    // Click export
    await page.locator('button:has-text("Export to CSV")').click();

    // Check for success toast
    await expect(
      page
        .locator('[data-radix-collection-item], [role="status"]')
        .filter({ hasText: /Exported.*transactions to CSV/i })
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('should close dialog after export', async ({ page }) => {
    // Open export dialog
    await page.locator('button:has-text("Export Data")').click();

    // Verify dialog is open
    await expect(page.locator('h2:has-text("Export Financial Data")')).toBeVisible();

    // Export data
    await page.locator('button:has-text("Export to CSV")').click();

    // Wait a bit for the export to complete
    await page.waitForTimeout(1000);

    // Verify dialog is closed
    await expect(page.locator('h2:has-text("Export Financial Data")')).not.toBeVisible();
  });

  test('should handle empty data gracefully', async ({ page }) => {
    // Clear existing data by reloading and logging in again without uploading
    await loginAsTestUser(page);

    // Try to export without data
    await page.locator('button:has-text("Export Data")').click();
    await page.locator('button:has-text("Export to CSV")').click();

    // Should show appropriate message
    await expect(
      page
        .locator('[data-radix-collection-item], [role="status"]')
        .filter({ hasText: /No data|0 transactions/i })
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('should allow canceling export dialog', async ({ page }) => {
    // Open export dialog
    await page.locator('button:has-text("Export Data")').click();

    // Verify dialog is open
    await expect(page.locator('h2:has-text("Export Financial Data")')).toBeVisible();

    // Click cancel button
    await page.locator('button:has-text("Cancel")').click();

    // Verify dialog is closed
    await expect(page.locator('h2:has-text("Export Financial Data")')).not.toBeVisible();
  });

  test('should maintain filter selections between exports', async ({ page }) => {
    // Open export dialog
    await page.locator('button:has-text("Export Data")').click();

    // Select category summary
    await page.locator('text=Category Summary').click();

    // Enable date filter
    await page.locator('input[type="checkbox"]').first().check();

    // Cancel dialog
    await page.locator('button:has-text("Cancel")').click();

    // Reopen dialog
    await page.locator('button:has-text("Export Data")').click();

    // Verify selections are maintained
    await expect(page.locator('input[value="summary"]')).toBeChecked();
    await expect(page.locator('input[type="checkbox"]').first()).toBeChecked();
  });
});
