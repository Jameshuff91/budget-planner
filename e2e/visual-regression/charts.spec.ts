import { test, expect } from '@playwright/test';

// Helper to wait for charts to render
async function waitForChartRender(page) {
  // Wait for Recharts containers
  await page.waitForSelector('.recharts-responsive-container', { timeout: 10000 });
  // Wait for animations to complete
  await page.waitForTimeout(1000);
  // Ensure fonts are loaded
  await page.evaluate(() => document.fonts.ready);
}

// Helper to upload sample data
async function uploadSampleData(page) {
  await page.goto('/');

  // Upload the sample CSV file
  const fileInput = await page.locator('input[type="file"]').first();
  await fileInput.setInputFiles('./sample-transactions.csv');

  // Wait for upload to complete
  await page.waitForSelector('text=/transactions imported successfully/i', { timeout: 10000 });
  await page.waitForTimeout(1000);
}

test.describe('Chart Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing data
    await page.goto('/');
    await page.evaluate(() => {
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('BudgetPlannerDB');
      }
    });
    await page.reload();

    // Upload sample data
    await uploadSampleData(page);
  });

  test('SpendingByCategory chart - default view', async ({ page }) => {
    await page.goto('/');

    // Wait for the chart to render
    await page.waitForSelector('[data-testid="spending-by-category"]', { timeout: 10000 });
    await waitForChartRender(page);

    // Take screenshot of the chart
    const chart = await page.locator('[data-testid="spending-by-category"]');
    await expect(chart).toHaveScreenshot('spending-by-category-default.png');
  });

  test('SpendingByCategory chart - with budget limits', async ({ page }) => {
    await page.goto('/');

    // Wait for the chart
    await page.waitForSelector('[data-testid="spending-by-category"]', { timeout: 10000 });

    // Set budget for a category
    const budgetButton = await page.locator('button:has-text("Set Budget")').first();
    await budgetButton.click();

    const budgetInput = await page.locator('input[type="number"]').first();
    await budgetInput.fill('1000');

    const saveButton = await page.locator('button:has-text("Save")').first();
    await saveButton.click();

    await waitForChartRender(page);

    // Take screenshot
    const chart = await page.locator('[data-testid="spending-by-category"]');
    await expect(chart).toHaveScreenshot('spending-by-category-with-budget.png');
  });

  test('SpendingTrend chart - multiple months', async ({ page }) => {
    await page.goto('/');

    // Navigate to trends view
    await page.click('text=Spending Trend');

    // Wait for the chart
    await page.waitForSelector('[data-testid="spending-trend"]', { timeout: 10000 });
    await waitForChartRender(page);

    // Take screenshot
    const chart = await page.locator('[data-testid="spending-trend"]');
    await expect(chart).toHaveScreenshot('spending-trend-default.png');
  });

  test('SpendingOverview chart - default view', async ({ page }) => {
    await page.goto('/');

    // Wait for the overview chart
    await page.waitForSelector('[data-testid="spending-overview"]', { timeout: 10000 });
    await waitForChartRender(page);

    // Take screenshot
    const chart = await page.locator('[data-testid="spending-overview"]');
    await expect(chart).toHaveScreenshot('spending-overview-default.png');
  });

  test('YearOverYearComparison chart', async ({ page }) => {
    await page.goto('/');

    // Navigate to year comparison if not visible
    await page.waitForSelector('[data-testid="year-over-year-comparison"]', { timeout: 10000 });
    await waitForChartRender(page);

    // Take screenshot
    const chart = await page.locator('[data-testid="year-over-year-comparison"]');
    await expect(chart).toHaveScreenshot('year-over-year-comparison.png');
  });

  test('SpendingVelocity chart', async ({ page }) => {
    await page.goto('/');

    // Wait for velocity chart
    await page.waitForSelector('[data-testid="spending-velocity"]', { timeout: 10000 });
    await waitForChartRender(page);

    // Take screenshot
    const chart = await page.locator('[data-testid="spending-velocity"]');
    await expect(chart).toHaveScreenshot('spending-velocity-default.png');
  });

  test('Chart hover states', async ({ page }) => {
    await page.goto('/');

    // Wait for a pie chart
    await page.waitForSelector('[data-testid="spending-by-category"]', { timeout: 10000 });
    await waitForChartRender(page);

    // Hover over a pie slice
    const pieSlice = await page.locator('.recharts-pie-sector').first();
    await pieSlice.hover();
    await page.waitForTimeout(500);

    // Take screenshot with tooltip
    const chart = await page.locator('[data-testid="spending-by-category"]');
    await expect(chart).toHaveScreenshot('spending-by-category-hover.png');
  });

  test('Chart loading states', async ({ page }) => {
    // Intercept data loading to simulate loading state
    await page.route('**/api/**', (route) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          route.continue();
          resolve();
        }, 2000);
      });
    });

    await page.goto('/');

    // Capture loading skeleton
    const skeleton = await page.locator('.chart-skeleton').first();
    await expect(skeleton).toHaveScreenshot('chart-loading-skeleton.png');
  });

  test('Empty state charts', async ({ page }) => {
    // Don't upload data for this test
    await page.goto('/');
    await page.evaluate(() => {
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('BudgetPlannerDB');
      }
    });
    await page.reload();

    // Wait for empty state
    await page.waitForSelector('text=/No data available/i', { timeout: 10000 });

    // Take screenshot of empty state
    await expect(page).toHaveScreenshot('charts-empty-state.png', {
      fullPage: false,
      clip: { x: 0, y: 100, width: 1200, height: 800 },
    });
  });
});
