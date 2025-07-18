import { test, expect } from '@playwright/test';

// Helper to upload sample data
async function uploadSampleData(page: any) {
  await page.goto('/');

  // On mobile, the file input might be different
  const fileInput = await page.locator('input[type="file"]').first();
  await fileInput.setInputFiles('./sample-transactions.csv');

  // Wait for upload to complete
  await page.waitForSelector('text=/transactions imported successfully/i', { timeout: 10000 });
  await page.waitForTimeout(2000);
}

// Helper to wait for mobile view to stabilize
async function waitForMobileRender(page: any) {
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.fonts.ready);
}

test.describe('Mobile View Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing data
    await page.goto('/');
    await page.evaluate(() => {
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('BudgetPlannerDB');
      }
    });
    await page.reload();
  });

  // Run only on mobile viewport projects
  test.skip(({ browserName, viewport }) => {
    return !viewport || viewport.width > 768;
  }, 'Mobile-only tests');

  test('Mobile - dashboard full view', async ({ page }) => {
    await uploadSampleData(page);
    await waitForMobileRender(page);

    await expect(page).toHaveScreenshot('mobile-dashboard-full.png', {
      fullPage: true,
    });
  });

  test('Mobile - navigation menu', async ({ page }) => {
    await uploadSampleData(page);
    await waitForMobileRender(page);

    // Look for hamburger menu or mobile nav toggle
    const menuButton = await page
      .locator('[data-testid="mobile-menu-toggle"], [aria-label="Menu"], button:has-text("Menu")')
      .first();
    if ((await menuButton.count()) > 0) {
      await menuButton.click();
      await page.waitForTimeout(500);

      // Take screenshot with menu open
      await expect(page).toHaveScreenshot('mobile-navigation-open.png', {
        fullPage: false,
        clip: { x: 0, y: 0, width: 375, height: 812 },
      });
    }
  });

  test('Mobile - charts view', async ({ page }) => {
    await uploadSampleData(page);
    await waitForMobileRender(page);

    // Scroll to charts section
    const chartSection = await page.locator('[data-testid="spending-by-category"]').first();
    await chartSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('mobile-charts-view.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 375, height: 812 },
    });
  });

  test('Mobile - transaction list', async ({ page }) => {
    await uploadSampleData(page);
    await waitForMobileRender(page);

    // Navigate to transactions
    await page.click('text=Transactions');
    await page.waitForSelector('[data-testid="transaction-list"]', { timeout: 10000 });

    await expect(page).toHaveScreenshot('mobile-transaction-list.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 375, height: 812 },
    });
  });

  test('Mobile - file upload interface', async ({ page }) => {
    await page.goto('/');
    await waitForMobileRender(page);

    const uploadArea = await page.locator('[data-testid="file-upload"]');
    await expect(uploadArea).toHaveScreenshot('mobile-upload-area.png');
  });

  test('Mobile - modal/dialog view', async ({ page }) => {
    await uploadSampleData(page);
    await waitForMobileRender(page);

    // Try to open any modal (e.g., settings, export)
    const modalTrigger = await page
      .locator('button:has-text("Export"), button:has-text("Settings")')
      .first();
    if ((await modalTrigger.count()) > 0) {
      await modalTrigger.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

      await expect(page).toHaveScreenshot('mobile-modal-view.png', {
        fullPage: false,
        clip: { x: 0, y: 0, width: 375, height: 812 },
      });
    }
  });

  test('Mobile - landscape orientation', async ({ page, viewport }) => {
    // Skip if not mobile viewport
    if (!viewport || viewport.width > 768) return;

    // Set landscape orientation
    await page.setViewportSize({ width: 812, height: 375 });

    await uploadSampleData(page);
    await waitForMobileRender(page);

    await expect(page).toHaveScreenshot('mobile-landscape-dashboard.png', {
      fullPage: true,
    });
  });

  test('Mobile - scrolling behavior', async ({ page }) => {
    await uploadSampleData(page);
    await waitForMobileRender(page);

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('mobile-scrolled-view.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 375, height: 812 },
    });
  });

  test('Mobile - touch interactions', async ({ page }) => {
    await uploadSampleData(page);
    await waitForMobileRender(page);

    // Simulate touch on a chart
    const chart = await page.locator('.recharts-responsive-container').first();
    const box = await chart.boundingBox();
    if (box) {
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);

      await expect(chart).toHaveScreenshot('mobile-chart-touch.png');
    }
  });

  test('Mobile - form inputs', async ({ page }) => {
    await uploadSampleData(page);
    await waitForMobileRender(page);

    // Find and focus on an input field
    const input = await page.locator('input[type="text"], input[type="number"]').first();
    if ((await input.count()) > 0) {
      await input.click();
      await page.waitForTimeout(500);

      // Take screenshot with keyboard (if visible)
      await expect(page).toHaveScreenshot('mobile-input-focused.png', {
        fullPage: false,
        clip: { x: 0, y: 0, width: 375, height: 812 },
      });
    }
  });
});

test.describe('Tablet View Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('BudgetPlannerDB');
      }
    });
    await page.reload();
  });

  // Run only on tablet viewport projects
  test.skip(({ viewport }) => {
    return !viewport || viewport.width !== 768;
  }, 'Tablet-only tests');

  test('Tablet - dashboard layout', async ({ page }) => {
    await uploadSampleData(page);
    await page.waitForTimeout(1500);

    await expect(page).toHaveScreenshot('tablet-dashboard.png', {
      fullPage: true,
    });
  });

  test('Tablet - split view layout', async ({ page }) => {
    await uploadSampleData(page);
    await page.waitForTimeout(1500);

    // If app has split view on tablet
    await expect(page).toHaveScreenshot('tablet-split-view.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 768, height: 1024 },
    });
  });

  test('Tablet - landscape orientation', async ({ page }) => {
    // Set landscape for tablet
    await page.setViewportSize({ width: 1024, height: 768 });

    await uploadSampleData(page);
    await page.waitForTimeout(1500);

    await expect(page).toHaveScreenshot('tablet-landscape.png', {
      fullPage: true,
    });
  });
});

test.describe('Responsive Breakpoint Tests', () => {
  const breakpoints = [
    { name: 'mobile-small', width: 320, height: 568 },
    { name: 'mobile-medium', width: 375, height: 812 },
    { name: 'mobile-large', width: 414, height: 896 },
    { name: 'tablet-small', width: 768, height: 1024 },
    { name: 'tablet-large', width: 1024, height: 1366 },
    { name: 'desktop-small', width: 1280, height: 720 },
    { name: 'desktop-medium', width: 1440, height: 900 },
    { name: 'desktop-large', width: 1920, height: 1080 },
    { name: 'desktop-xlarge', width: 2560, height: 1440 },
  ];

  for (const breakpoint of breakpoints) {
    test(`Responsive - ${breakpoint.name} (${breakpoint.width}x${breakpoint.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });

      await page.goto('/');
      await page.evaluate(() => {
        if ('indexedDB' in window) {
          indexedDB.deleteDatabase('BudgetPlannerDB');
        }
      });
      await page.reload();

      // Upload data
      const fileInput = await page.locator('input[type="file"]').first();
      await fileInput.setInputFiles('./sample-transactions.csv');
      await page.waitForSelector('text=/transactions imported successfully/i', { timeout: 10000 });
      await page.waitForTimeout(2000);

      // Take screenshot
      await expect(page).toHaveScreenshot(`responsive-${breakpoint.name}.png`, {
        fullPage: false,
        clip: { x: 0, y: 0, width: breakpoint.width, height: breakpoint.height },
      });
    });
  }
});
