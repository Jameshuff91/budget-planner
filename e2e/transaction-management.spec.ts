import { test, expect, Page } from '@playwright/test';

test.describe('Transaction Management', () => {
  // Helper function to upload sample transaction data
  async function uploadSampleData(page: Page) {
    const csvContent = `date,description,amount,category,type
2024-01-15,Grocery Store,-50.25,Food,expense
2024-01-16,Gas Station,-35.00,Transportation,expense
2024-01-17,Salary,2500.00,Income,income
2024-01-18,Coffee Shop,-4.50,Food,expense
2024-01-19,Electric Bill,-120.00,Utilities,expense
2024-01-20,Freelance Work,500.00,Income,income
2024-01-21,Restaurant,-75.50,Food,expense
2024-01-22,Internet Bill,-80.00,Utilities,expense
2024-01-23,Car Insurance,-150.00,Transportation,expense
2024-01-24,Gym Membership,-30.00,Health,expense`;

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
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await uploadSampleData(page);

    // Click on the Transactions tab to show the transaction list
    await page.waitForLoadState('networkidle');
    await page.locator('button[role="tab"]:has-text("Transactions")').click();
    await page.waitForTimeout(500); // Wait for tab content to render
  });

  test.describe('Viewing Transactions', () => {
    test('should display transaction list after upload', async ({ page }) => {
      // Check for Transaction History card - using CardTitle component
      await expect(page.locator('text=Transaction History').first()).toBeVisible({
        timeout: 10000,
      });

      // Check for transaction table
      await expect(page.locator('table').first()).toBeVisible();

      // Verify table headers
      await expect(page.locator('th:has-text("Date")').first()).toBeVisible();
      await expect(page.locator('th:has-text("Description")').first()).toBeVisible();
      await expect(page.locator('th:has-text("Category")').first()).toBeVisible();
      await expect(page.locator('th:has-text("Amount")').first()).toBeVisible();
      await expect(page.locator('th:has-text("Actions")').first()).toBeVisible();
    });

    test('should display all uploaded transactions', async ({ page }) => {
      // Wait for the Transaction History section to be visible
      await expect(page.locator('text=Transaction History').first()).toBeVisible({
        timeout: 10000,
      });

      // Wait for transactions to load
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Count transactions (should be 10 from our sample data)
      const transactionRows = page.locator('table').first().locator('tbody tr');
      await expect(transactionRows).toHaveCount(10);

      // Verify specific transaction is displayed
      await expect(page.locator('td:has-text("Grocery Store")').first()).toBeVisible();
      await expect(page.locator('td:has-text("Salary")').first()).toBeVisible();
    });

    test('should display transaction details correctly', async ({ page }) => {
      // Find the Grocery Store transaction row
      const groceryRow = page.locator('tr', { has: page.locator('text=Grocery Store') });

      // Verify date format
      await expect(groceryRow.locator('td').first()).toContainText('Jan 15, 2024');

      // Verify category badge
      await expect(groceryRow.locator('span:has-text("Food")')).toBeVisible();

      // Verify amount formatting (expense should be negative/red)
      const amountCell = groceryRow.locator('td').nth(3);
      await expect(amountCell).toHaveClass(/text-red-600/);
      await expect(amountCell).toContainText('$50.25');

      // Verify income formatting (should be positive/green)
      const salaryRow = page.locator('tr', { has: page.locator('text=Salary') });
      const salaryAmount = salaryRow.locator('td').nth(3);
      await expect(salaryAmount).toHaveClass(/text-green-600/);
      await expect(salaryAmount).toContainText('+$2,500.00');
    });

    test('should show transaction summary at bottom', async ({ page }) => {
      // Check for summary stats
      await expect(page.locator('text=/Total Transactions: \\d+/')).toBeVisible();
      await expect(page.locator('text=/Total: \\$[\\d,.-]+/')).toBeVisible();

      // Verify transaction count
      await expect(page.locator('text=Total Transactions: 10')).toBeVisible();
    });
  });

  test.describe('Searching Transactions', () => {
    test('should filter transactions by search term', async ({ page }) => {
      // Wait for the Transaction History section
      await expect(page.locator('text=Transaction History').first()).toBeVisible({
        timeout: 10000,
      });

      // Find search input
      const searchInput = page.locator('input[placeholder="Search transactions..."]').first();
      await expect(searchInput).toBeVisible();

      // Search for "bill"
      await searchInput.fill('bill');

      // Wait for filtering to apply
      await page.waitForTimeout(500);

      // Should only show transactions with "bill" in description
      const visibleRows = page.locator('table').first().locator('tbody tr');
      await expect(visibleRows).toHaveCount(2); // Electric Bill and Internet Bill

      // Verify the correct transactions are shown
      await expect(page.locator('td:has-text("Electric Bill")').first()).toBeVisible();
      await expect(page.locator('td:has-text("Internet Bill")').first()).toBeVisible();

      // Verify other transactions are hidden
      await expect(page.locator('td:has-text("Grocery Store")')).not.toBeVisible();
    });

    test('should show no results message for empty search', async ({ page }) => {
      const searchInput = page.locator('input[placeholder="Search transactions..."]');

      // Search for something that doesn't exist
      await searchInput.fill('xyz123nonsense');
      await page.waitForTimeout(500);

      // Should show no results message
      await expect(page.locator('text=No transactions match your search criteria.')).toBeVisible();
    });

    test('should clear search and show all transactions', async ({ page }) => {
      const searchInput = page.locator('input[placeholder="Search transactions..."]');

      // Search and then clear
      await searchInput.fill('bill');
      await page.waitForTimeout(500);
      await expect(page.locator('table tbody tr')).toHaveCount(2);

      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(500);

      // Should show all transactions again
      await expect(page.locator('table tbody tr')).toHaveCount(10);
    });

    test('should be case-insensitive search', async ({ page }) => {
      const searchInput = page.locator('input[placeholder="Search transactions..."]');

      // Search with different cases
      await searchInput.fill('GROCERY');
      await page.waitForTimeout(500);
      await expect(page.locator('td:has-text("Grocery Store")')).toBeVisible();

      await searchInput.fill('grocery');
      await page.waitForTimeout(500);
      await expect(page.locator('td:has-text("Grocery Store")')).toBeVisible();
    });
  });

  test.describe('Filtering by Category', () => {
    test('should display category filter dropdown', async ({ page }) => {
      // Wait for the Transaction History section
      await expect(page.locator('text=Transaction History').first()).toBeVisible({
        timeout: 10000,
      });

      // Find category filter - it's the second select element (first is year selector)
      const selects = page.locator('select');
      const categoryFilter = selects.nth(1);
      await expect(categoryFilter).toBeVisible();

      // Click to open options
      await categoryFilter.click();

      // Verify categories are listed
      await expect(page.locator('option:has-text("Food")')).toBeVisible();
      await expect(page.locator('option:has-text("Transportation")')).toBeVisible();
      await expect(page.locator('option:has-text("Utilities")')).toBeVisible();
      await expect(page.locator('option:has-text("Income")')).toBeVisible();
    });

    test('should filter transactions by category', async ({ page }) => {
      // Wait for the Transaction History section
      await expect(page.locator('text=Transaction History').first()).toBeVisible({
        timeout: 10000,
      });

      // Find category filter - it's the second select element
      const selects = page.locator('select');
      const categoryFilter = selects.nth(1);

      // Filter by Food category
      await categoryFilter.selectOption('Food');
      await page.waitForTimeout(500);

      // Should only show Food transactions
      const visibleRows = page.locator('table').first().locator('tbody tr');
      await expect(visibleRows).toHaveCount(3); // Grocery Store, Coffee Shop, Restaurant

      // Verify all visible transactions are Food category
      const categoryBadges = page.locator('table').first().locator('tbody span:has-text("Food")');
      await expect(categoryBadges).toHaveCount(3);
    });

    test('should combine search and category filters', async ({ page }) => {
      // Wait for the Transaction History section
      await expect(page.locator('text=Transaction History').first()).toBeVisible({
        timeout: 10000,
      });

      const searchInput = page.locator('input[placeholder="Search transactions..."]').first();
      const selects = page.locator('select');
      const categoryFilter = selects.nth(1);

      // Filter by Transportation category
      await categoryFilter.selectOption('Transportation');
      await page.waitForTimeout(500);

      // Then search for "insurance"
      await searchInput.fill('insurance');
      await page.waitForTimeout(500);

      // Should only show Car Insurance
      await expect(page.locator('table').first().locator('tbody tr')).toHaveCount(1);
      await expect(page.locator('td:has-text("Car Insurance")').first()).toBeVisible();
    });

    test('should reset to all categories', async ({ page }) => {
      // Wait for the Transaction History section
      await expect(page.locator('text=Transaction History').first()).toBeVisible({
        timeout: 10000,
      });

      const selects = page.locator('select');
      const categoryFilter = selects.nth(1);

      // Filter by category first
      await categoryFilter.selectOption('Food');
      await expect(page.locator('table').first().locator('tbody tr')).toHaveCount(3);

      // Reset to all categories
      await categoryFilter.selectOption('all');
      await page.waitForTimeout(500);

      // Should show all transactions
      await expect(page.locator('table').first().locator('tbody tr')).toHaveCount(10);
    });
  });

  test.describe('Editing Transactions', () => {
    test('should open edit modal when edit button is clicked', async ({ page }) => {
      // Wait for the Transaction History section
      await expect(page.locator('text=Transaction History').first()).toBeVisible({
        timeout: 10000,
      });

      // Wait for transactions to load
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Click edit button on first transaction - find by the Edit2 icon
      const firstEditButton = page
        .locator('table')
        .first()
        .locator('tbody tr')
        .first()
        .locator('button')
        .first();
      await firstEditButton.click();

      // Verify modal is open
      await expect(page.locator('h2:has-text("Edit Transaction")')).toBeVisible();
      await expect(
        page.locator('text=Make changes to the transaction details below.'),
      ).toBeVisible();
    });

    test('should populate edit form with transaction data', async ({ page }) => {
      // Find and click edit on Grocery Store transaction
      const groceryRow = page.locator('tr', { has: page.locator('text=Grocery Store') });
      await groceryRow.locator('button').first().click();

      // Verify form fields are populated
      await expect(page.locator('input#date')).toHaveValue('2024-01-15');
      await expect(page.locator('input#description')).toHaveValue('Grocery Store');
      await expect(page.locator('input#amount')).toHaveValue('50.25');

      // Verify type is set to expense
      await expect(page.locator('[role="combobox"]').first()).toContainText('Expense');
    });

    test('should update transaction description', async ({ page }) => {
      // Edit first transaction
      const firstRow = page.locator('table tbody tr').first();
      await firstRow.locator('button').first().click();

      // Change description
      const descriptionInput = page.locator('input#description');
      await descriptionInput.clear();
      await descriptionInput.fill('Supermarket Shopping');

      // Save changes
      await page.locator('button:has-text("Save changes")').click();

      // Wait for modal to close and toast to appear
      await expect(page.locator('h2:has-text("Edit Transaction")')).not.toBeVisible();
      await expect(page.locator('text=Transaction updated successfully')).toBeVisible();

      // Verify transaction is updated in the list
      await expect(page.locator('td:has-text("Supermarket Shopping")')).toBeVisible();
    });

    test('should update transaction amount', async ({ page }) => {
      // Find and edit Grocery Store transaction
      const groceryRow = page.locator('tr', { has: page.locator('text=Grocery Store') });
      await groceryRow.locator('button').first().click();

      // Change amount
      const amountInput = page.locator('input#amount');
      await amountInput.clear();
      await amountInput.fill('75.50');

      // Save changes
      await page.locator('button:has-text("Save changes")').click();

      // Wait for update
      await expect(page.locator('text=Transaction updated successfully')).toBeVisible();

      // Verify amount is updated
      await expect(groceryRow.locator('td').nth(3)).toContainText('$75.50');
    });

    test('should update transaction category', async ({ page }) => {
      // Edit Coffee Shop transaction
      const coffeeRow = page.locator('tr', { has: page.locator('text=Coffee Shop') });
      await coffeeRow.locator('button').first().click();

      // Change category
      await page.locator('[role="combobox"]').last().click();
      await page.locator('[role="option"]:has-text("Utilities")').click();

      // Save changes
      await page.locator('button:has-text("Save changes")').click();

      // Verify category is updated
      await expect(page.locator('text=Transaction updated successfully')).toBeVisible();
      await expect(coffeeRow.locator('span:has-text("Utilities")')).toBeVisible();
    });

    test('should change transaction type from expense to income', async ({ page }) => {
      // Edit Electric Bill transaction
      const billRow = page.locator('tr', { has: page.locator('text=Electric Bill') });
      await billRow.locator('button').first().click();

      // Change type to income
      await page.locator('[role="combobox"]').first().click();
      await page.locator('[role="option"]:has-text("Income")').click();

      // Save changes
      await page.locator('button:has-text("Save changes")').click();

      // Verify type change - amount should now be green and positive
      await expect(page.locator('text=Transaction updated successfully')).toBeVisible();
      const amountCell = billRow.locator('td').nth(3);
      await expect(amountCell).toHaveClass(/text-green-600/);
      await expect(amountCell).toContainText('+$120.00');
    });

    test('should validate required fields', async ({ page }) => {
      // Open edit modal
      await page.locator('button[aria-label*="Edit"], button:has(svg)').first().click();

      // Clear description (required field)
      const descriptionInput = page.locator('input#description');
      await descriptionInput.clear();

      // Try to save
      await page.locator('button:has-text("Save changes")').click();

      // Should show validation error
      await expect(page.locator('text=Please fill in all required fields')).toBeVisible();

      // Modal should stay open
      await expect(page.locator('h2:has-text("Edit Transaction")')).toBeVisible();
    });

    test('should cancel edit without saving', async ({ page }) => {
      // Get original description
      const firstRow = page.locator('table tbody tr').first();
      const originalDescription = await firstRow.locator('td').nth(1).textContent();

      // Open edit modal
      await firstRow.locator('button').first().click();

      // Change description
      const descriptionInput = page.locator('input#description');
      await descriptionInput.clear();
      await descriptionInput.fill('Changed Description');

      // Cancel
      await page.locator('button:has-text("Cancel")').click();

      // Modal should close
      await expect(page.locator('h2:has-text("Edit Transaction")')).not.toBeVisible();

      // Description should not be changed
      await expect(firstRow.locator('td').nth(1)).toHaveText(originalDescription!);
    });
  });

  test.describe('Deleting Transactions', () => {
    test('should show confirmation dialog when delete is clicked', async ({ page }) => {
      // Wait for the Transaction History section
      await expect(page.locator('text=Transaction History').first()).toBeVisible({
        timeout: 10000,
      });

      // Wait for transactions to load
      await page.waitForSelector('table tbody tr', { timeout: 10000 });

      // Set up dialog handler
      page.on('dialog', (dialog) => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('Are you sure you want to delete this transaction?');
        dialog.accept();
      });

      // Click delete button - it's the second button in the first row
      const firstDeleteButton = page
        .locator('table')
        .first()
        .locator('tbody tr')
        .first()
        .locator('button.text-red-600')
        .first();
      await firstDeleteButton.click();

      // Wait for deletion
      await expect(page.locator('text=Transaction deleted successfully')).toBeVisible();
    });

    test('should delete transaction when confirmed', async ({ page }) => {
      // Get initial count
      const initialCount = await page.locator('table tbody tr').count();

      // Set up dialog handler to accept
      page.on('dialog', (dialog) => dialog.accept());

      // Delete first transaction
      const firstDescription = await page
        .locator('table tbody tr')
        .first()
        .locator('td')
        .nth(1)
        .textContent();
      await page.locator('button[aria-label*="Delete"], button.text-red-600').first().click();

      // Wait for deletion
      await expect(page.locator('text=Transaction deleted successfully')).toBeVisible();

      // Verify transaction is removed
      await expect(page.locator('table tbody tr')).toHaveCount(initialCount - 1);
      await expect(page.locator(`td:has-text("${firstDescription}")`)).not.toBeVisible();
    });

    test('should not delete transaction when cancelled', async ({ page }) => {
      // Get initial count
      const initialCount = await page.locator('table tbody tr').count();

      // Set up dialog handler to cancel
      page.on('dialog', (dialog) => dialog.dismiss());

      // Try to delete
      await page.locator('button[aria-label*="Delete"], button.text-red-600').first().click();

      // Wait a moment
      await page.waitForTimeout(500);

      // Verify no deletion occurred
      await expect(page.locator('table tbody tr')).toHaveCount(initialCount);
      await expect(page.locator('text=Transaction deleted successfully')).not.toBeVisible();
    });

    test('should update summary after deletion', async ({ page }) => {
      // Get initial total
      const totalText = await page.locator('text=/Total: \\$[\\d,.-]+/').textContent();
      const initialTotal = totalText!.match(/\$([\d,.-]+)/)![1];

      // Set up dialog handler
      page.on('dialog', (dialog) => dialog.accept());

      // Delete a transaction (Salary - $2500)
      const salaryRow = page.locator('tr', { has: page.locator('text=Salary') });
      await salaryRow.locator('button.text-red-600').click();

      // Wait for deletion
      await expect(page.locator('text=Transaction deleted successfully')).toBeVisible();

      // Verify summary is updated
      await expect(page.locator('text=Total Transactions: 9')).toBeVisible();

      // Total should be different
      const newTotalText = await page.locator('text=/Total: \\$[\\d,.-]+/').textContent();
      const newTotal = newTotalText!.match(/\$([\d,.-]+)/)![1];
      expect(newTotal).not.toBe(initialTotal);
    });
  });

  test.describe('Export Functions', () => {
    test('should export filtered transactions', async ({ page }) => {
      // Filter by category first
      const categoryFilter = page.locator('select').first();
      await categoryFilter.selectOption('Food');

      // Set up download promise
      const downloadPromise = page.waitForEvent('download');

      // Click export transactions button
      await page.locator('button:has-text("Export Transactions")').click();

      // Wait for download
      const download = await downloadPromise;

      // Verify filename
      expect(download.suggestedFilename()).toContain('transactions');
      expect(download.suggestedFilename()).toMatch(/\.csv$/);

      // Verify success toast shows filtered count
      await expect(page.locator('text=/Exported 3 transactions to CSV/i')).toBeVisible();
    });

    test('should export category summary', async ({ page }) => {
      // Set up download promise
      const downloadPromise = page.waitForEvent('download');

      // Click export summary button
      await page.locator('button:has-text("Export Summary")').click();

      // Wait for download
      const download = await downloadPromise;

      // Verify filename
      expect(download.suggestedFilename()).toContain('category_summary');
      expect(download.suggestedFilename()).toMatch(/\.csv$/);

      // Verify success toast
      await expect(page.locator('text=Exported category summary to CSV')).toBeVisible();
    });

    test('should disable export buttons when no transactions', async ({ page }) => {
      // Set up dialog handler to accept all
      page.on('dialog', (dialog) => dialog.accept());

      // Delete all transactions
      for (let i = 0; i < 10; i++) {
        const deleteButtons = page.locator('button[aria-label*="Delete"], button.text-red-600');
        if ((await deleteButtons.count()) > 0) {
          await deleteButtons.first().click();
          await page.waitForTimeout(200);
        }
      }

      // Verify export buttons are disabled
      await expect(page.locator('button:has-text("Export Transactions")')).toBeDisabled();
      await expect(page.locator('button:has-text("Export Summary")')).toBeDisabled();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid date input gracefully', async ({ page }) => {
      // Open edit modal
      await page.locator('button[aria-label*="Edit"], button:has(svg)').first().click();

      // Enter invalid date
      const dateInput = page.locator('input#date');
      await dateInput.clear();
      await dateInput.fill('invalid-date');

      // Try to save
      await page.locator('button:has-text("Save changes")').click();

      // Should show error or not save
      // The modal should remain open
      await expect(page.locator('h2:has-text("Edit Transaction")')).toBeVisible();
    });

    test('should handle very large amounts', async ({ page }) => {
      // Open edit modal
      await page.locator('button[aria-label*="Edit"], button:has(svg)').first().click();

      // Enter very large amount
      const amountInput = page.locator('input#amount');
      await amountInput.clear();
      await amountInput.fill('99999999.99');

      // Save
      await page.locator('button:has-text("Save changes")').click();

      // Should handle large amount gracefully
      await expect(page.locator('text=Transaction updated successfully')).toBeVisible();
      await expect(page.locator('text=$99,999,999.99')).toBeVisible();
    });

    test('should handle special characters in search', async ({ page }) => {
      const searchInput = page.locator('input[placeholder="Search transactions..."]');

      // Search with special characters
      await searchInput.fill('$%^&*()');
      await page.waitForTimeout(500);

      // Should not break, just show no results
      await expect(page.locator('text=No transactions match your search criteria.')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should show transaction list on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Transaction list should still be visible
      await expect(page.locator('h3:has-text("Transaction History")')).toBeVisible();
      await expect(page.locator('table')).toBeVisible();

      // Search should be accessible
      await expect(page.locator('input[placeholder="Search transactions..."]')).toBeVisible();
    });

    test('should allow editing on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      // Click edit button
      await page.locator('button[aria-label*="Edit"], button:has(svg)').first().click();

      // Modal should be visible and usable
      await expect(page.locator('h2:has-text("Edit Transaction")')).toBeVisible();
      await expect(page.locator('input#description')).toBeVisible();
      await expect(page.locator('button:has-text("Save changes")')).toBeVisible();
    });
  });
});
