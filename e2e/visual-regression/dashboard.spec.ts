import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../helpers/auth';

// Helper to upload sample data
async function uploadSampleData(page: any) {
  await loginAsTestUser(page);

  // Upload the sample CSV file
  const fileInput = await page.locator('input[type="file"]').first();
  await fileInput.setInputFiles('./sample-transactions.csv');

  // Wait for upload to complete
  await page.waitForSelector('text=/transactions imported successfully/i', { timeout: 10000 });
  await page.waitForTimeout(2000);
}

// Helper to wait for dashboard to fully render
async function waitForDashboardRender(page: any) {
  // Wait for key dashboard elements
  await page.waitForSelector('[data-testid="month-selector"]', { timeout: 10000 });
  await page.waitForSelector('.recharts-responsive-container', { timeout: 10000 });

  // Wait for animations and fonts
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.fonts.ready);
}

test.describe('Dashboard Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing data
    await loginAsTestUser(page);
    await page.evaluate(() => {
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('BudgetPlannerDB');
      }
    });
    await page.reload();
    await page.waitForSelector('text=Budget Planner Dashboard', { timeout: 10000 });
  });

  test('Dashboard - full layout with data', async ({ page }) => {
    await uploadSampleData(page);
    await waitForDashboardRender(page);

    // Take full page screenshot
    await expect(page).toHaveScreenshot('dashboard-full-layout.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('Dashboard - header and navigation', async ({ page }) => {
    await uploadSampleData(page);
    await waitForDashboardRender(page);

    // Screenshot just the header area
    const header = await page.locator('header').first();
    await expect(header).toHaveScreenshot('dashboard-header.png');
  });

  test('Dashboard - month selector interactions', async ({ page }) => {
    await uploadSampleData(page);
    await waitForDashboardRender(page);

    // Click on month selector
    const monthSelector = await page.locator('[data-testid="month-selector"]');
    await monthSelector.click();

    // Wait for dropdown to appear
    await page.waitForSelector('[role="listbox"]', { timeout: 5000 });

    // Take screenshot with dropdown open
    await expect(page).toHaveScreenshot('dashboard-month-selector-open.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 600 },
    });
  });

  test('Dashboard - sidebar navigation', async ({ page }) => {
    await uploadSampleData(page);
    await waitForDashboardRender(page);

    // If there's a sidebar, capture it
    const sidebar = await page.locator('[data-testid="sidebar"]');
    if ((await sidebar.count()) > 0) {
      await expect(sidebar).toHaveScreenshot('dashboard-sidebar.png');
    }
  });

  test('Dashboard - transaction list view', async ({ page }) => {
    await uploadSampleData(page);
    await waitForDashboardRender(page);

    // Navigate to transactions view
    await page.click('text=Transactions');
    await page.waitForSelector('[data-testid="transaction-list"]', { timeout: 10000 });

    // Take screenshot of transaction list
    const transactionList = await page.locator('[data-testid="transaction-list"]');
    await expect(transactionList).toHaveScreenshot('dashboard-transaction-list.png');
  });

  test('Dashboard - empty state', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Take screenshot of empty dashboard
    await expect(page).toHaveScreenshot('dashboard-empty-state.png', {
      fullPage: true,
    });
  });

  test('Dashboard - file upload area', async ({ page }) => {
    await page.goto('/');

    // Take screenshot of upload area
    const uploadArea = await page.locator('[data-testid="file-upload"]');
    await expect(uploadArea).toHaveScreenshot('dashboard-upload-area.png');
  });

  test('Dashboard - settings/configuration modal', async ({ page }) => {
    await uploadSampleData(page);
    await waitForDashboardRender(page);

    // Open settings if available
    const settingsButton = await page.locator('button:has-text("Settings")');
    if ((await settingsButton.count()) > 0) {
      await settingsButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      const modal = await page.locator('[role="dialog"]');
      await expect(modal).toHaveScreenshot('dashboard-settings-modal.png');
    }
  });

  test('Dashboard - export dialog', async ({ page }) => {
    await uploadSampleData(page);
    await waitForDashboardRender(page);

    // Open export dialog
    const exportButton = await page.locator('button:has-text("Export")');
    if ((await exportButton.count()) > 0) {
      await exportButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      const modal = await page.locator('[role="dialog"]');
      await expect(modal).toHaveScreenshot('dashboard-export-dialog.png');
    }
  });

  test('Dashboard - loading states', async ({ page }) => {
    // Intercept API calls to simulate loading
    await page.route('**/api/**', (route) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          route.continue();
          resolve(undefined);
        }, 3000);
      });
    });

    await page.goto('/');

    // Capture loading state
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('dashboard-loading-state.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 },
    });
  });

  test('Dashboard - error states', async ({ page }) => {
    // Force an error by blocking all requests
    await page.route('**/*', (route) => route.abort());

    await page.goto('/');

    // Wait for error state
    await page.waitForTimeout(2000);

    // Take screenshot of error state
    await expect(page).toHaveScreenshot('dashboard-error-state.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 600 },
    });
  });

  test('Dashboard - scroll positions', async ({ page }) => {
    await uploadSampleData(page);
    await waitForDashboardRender(page);

    // Scroll to middle of page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('dashboard-scrolled-middle.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 },
    });

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('dashboard-scrolled-bottom.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 },
    });
  });
});
