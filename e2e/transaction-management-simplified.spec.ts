import { test, expect } from '@playwright/test';

test.describe('Transaction Management Simplified', () => {
  test('should display transactions after upload and clicking tab', async ({ page }) => {
    // Go to the app
    await page.goto('/');

    // Upload simple CSV data
    const csvContent = `date,description,amount,category,type
2024-01-15,Grocery Store,-50.25,Food,expense
2024-01-16,Gas Station,-35.00,Transportation,expense
2024-01-17,Salary,2500.00,Income,income`;

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

    // Wait for page to stabilize
    await page.waitForTimeout(2000);

    // Look for the Transactions tab and click it
    const transactionsTab = page.locator('button[role="tab"]:has-text("Transactions")');
    await expect(transactionsTab).toBeVisible({ timeout: 10000 });
    await transactionsTab.click();

    // Wait for tab content to load
    await page.waitForTimeout(1000);

    // Now check for Transaction History
    await expect(page.locator('text=Transaction History')).toBeVisible({ timeout: 10000 });

    // Check for the table
    const table = page.locator('table').first();
    await expect(table).toBeVisible();

    // Check for specific transactions
    await expect(page.locator('td:has-text("Grocery Store")')).toBeVisible();
    await expect(page.locator('td:has-text("Salary")')).toBeVisible();

    // Check search input is visible
    const searchInput = page.locator('input[placeholder="Search transactions..."]');
    await expect(searchInput).toBeVisible();

    // Test search functionality
    await searchInput.fill('grocery');
    await page.waitForTimeout(500);

    // Should only show grocery transaction
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(page.locator('td:has-text("Grocery Store")')).toBeVisible();
  });

  test('should edit a transaction', async ({ page }) => {
    // Setup: upload data and navigate to transactions
    await page.goto('/');

    const csvContent = `date,description,amount,category,type
2024-01-15,Test Transaction,-50.00,Food,expense`;

    const fileInput = page.locator('#file-upload');
    await fileInput.setInputFiles({
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    await expect(
      page
        .locator('[role="status"]')
        .filter({ hasText: /Success/i })
        .first(),
    ).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);
    await page.locator('button[role="tab"]:has-text("Transactions")').click();
    await page.waitForTimeout(1000);

    // Click edit button
    const editButton = page.locator('table tbody tr').first().locator('button').first();
    await editButton.click();

    // Check modal is open
    await expect(page.locator('h2:has-text("Edit Transaction")')).toBeVisible();

    // Edit description
    const descInput = page.locator('input#description');
    await descInput.clear();
    await descInput.fill('Updated Transaction');

    // Save
    await page.locator('button:has-text("Save changes")').click();

    // Check success message
    await expect(page.locator('text=Transaction updated successfully')).toBeVisible();

    // Verify update in list
    await expect(page.locator('td:has-text("Updated Transaction")')).toBeVisible();
  });

  test('should delete a transaction', async ({ page }) => {
    // Setup: upload data and navigate to transactions
    await page.goto('/');

    const csvContent = `date,description,amount,category,type
2024-01-15,To Delete,-50.00,Food,expense
2024-01-16,To Keep,-35.00,Transportation,expense`;

    const fileInput = page.locator('#file-upload');
    await fileInput.setInputFiles({
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    await expect(
      page
        .locator('[role="status"]')
        .filter({ hasText: /Success/i })
        .first(),
    ).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);
    await page.locator('button[role="tab"]:has-text("Transactions")').click();
    await page.waitForTimeout(1000);

    // Set up dialog handler to accept
    page.on('dialog', (dialog) => dialog.accept());

    // Find and click delete button for "To Delete" transaction
    const deleteRow = page.locator('tr', { has: page.locator('text=To Delete') });
    const deleteButton = deleteRow.locator('button.text-red-600');
    await deleteButton.click();

    // Check success message
    await expect(page.locator('text=Transaction deleted successfully')).toBeVisible();

    // Verify transaction is gone
    await expect(page.locator('td:has-text("To Delete")')).not.toBeVisible();
    await expect(page.locator('td:has-text("To Keep")')).toBeVisible();
  });
});
