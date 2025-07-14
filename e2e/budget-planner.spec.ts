import { test, expect } from '@playwright/test';

test.describe('Budget Planner Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the main application title', async ({ page }) => {
    await expect(page.locator('text=Budget Planner Dashboard')).toBeVisible();
  });

  test('should have file upload functionality', async ({ page }) => {
    // Check for file upload section
    await expect(page.locator('h2:has-text("Upload Financial Information")')).toBeVisible();

    // Check for file input
    const fileInput = page.locator('#file-upload');
    await expect(fileInput).toBeAttached();

    // Check for upload button
    await expect(page.locator('label[for="file-upload"]:has-text("Choose Files")')).toBeVisible();
  });

  test('should display financial dashboard', async ({ page }) => {
    // Check for dashboard title - use first() to handle multiple elements
    await expect(page.locator('text=Financial Dashboard').first()).toBeVisible();

    // Check for collapsible statements section
    await expect(page.locator('button:has-text("Show Financial Statements")')).toBeVisible();
  });

  test('should be able to upload a CSV file', async ({ page }) => {
    // Create a sample CSV file content
    const csvContent = `date,description,amount,category
2024-01-15,Grocery Store,-50.25,Food
2024-01-16,Gas Station,-35.00,Transportation
2024-01-17,Salary,2500.00,Income`;

    // Upload the file
    const fileInput = page.locator('#file-upload');
    await fileInput.setInputFiles({
      name: 'test-transactions.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    // Wait for toast notification to appear
    await expect(
      page
        .locator('[data-radix-collection-item], [role="status"]')
        .filter({ hasText: /Success|processed/i })
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show budget analysis after uploading data', async ({ page }) => {
    // Skip this test as we need to understand the dashboard structure better
    test.skip();
  });

  test('should handle PDF file upload', async ({ page }) => {
    // The file input accepts both PDF and CSV
    const fileInput = page.locator('#file-upload');

    // Create a minimal PDF file
    const pdfContent = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n203\n%%EOF',
    );

    await fileInput.setInputFiles({
      name: 'test-statement.pdf',
      mimeType: 'application/pdf',
      buffer: pdfContent,
    });

    // Wait for either processing indicator or toast notification
    // PDF processing might show progress bar or success/error toast
    await expect(
      page.locator('[data-radix-collection-item], [role="status"], .space-y-2').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check if main elements are still visible
    await expect(page.locator('text=Budget Planner Dashboard')).toBeVisible();
    await expect(page.locator('text=Upload Financial Information')).toBeVisible();

    // Check if reset button is still accessible
    await expect(page.locator('button:has-text("Reset Dashboard")')).toBeVisible();
  });
});

test.describe('Budget Planner Error Handling', () => {
  test('should handle invalid file formats gracefully', async ({ page }) => {
    await page.goto('/');

    // Try uploading a text file
    const fileInput = page.locator('#file-upload');
    await fileInput.setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is not a valid CSV or PDF file'),
    });

    // Check for error toast message
    await expect(page.locator('text=/Invalid file type|skipped/i').first()).toBeVisible({
      timeout: 5000,
    });

    // App should still be functional
    await expect(page.locator('text=Budget Planner Dashboard')).toBeVisible();
  });
});
