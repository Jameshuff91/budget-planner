import { Page } from '@playwright/test';

/**
 * Wait for all charts on the page to render completely
 */
export async function waitForChartsToRender(page: Page) {
  // Wait for Recharts containers
  await page.waitForSelector('.recharts-responsive-container', {
    timeout: 10000,
    state: 'visible',
  });

  // Wait for animations to complete
  await page.waitForTimeout(1500);

  // Ensure fonts are loaded
  await page.evaluate(() => document.fonts.ready);

  // Wait for any chart animations
  await page.waitForFunction(() => {
    const animations = document.getAnimations();
    return animations.length === 0;
  });
}

/**
 * Upload sample transaction data
 */
export async function uploadSampleTransactions(page: Page) {
  await page.goto('/');

  // Wait for the upload area to be visible
  await page.waitForSelector('input[type="file"]', { timeout: 10000 });

  // Upload the sample CSV file
  const fileInput = await page.locator('input[type="file"]').first();
  await fileInput.setInputFiles('./sample-transactions.csv');

  // Wait for upload to complete
  await page.waitForSelector('text=/transactions imported successfully/i', {
    timeout: 15000,
  });

  // Additional wait for data processing
  await page.waitForTimeout(2000);
}

/**
 * Clear all IndexedDB data
 */
export async function clearDatabase(page: Page) {
  await page.evaluate(() => {
    if ('indexedDB' in window) {
      return indexedDB.deleteDatabase('BudgetPlannerDB');
    }
  });

  // Reload to ensure clean state
  await page.reload({ waitUntil: 'networkidle' });
}

/**
 * Wait for skeleton loaders to disappear
 */
export async function waitForSkeletonsToDisappear(page: Page) {
  // Wait for any skeleton elements to be hidden
  await page.waitForFunction(
    () => {
      const skeletons = document.querySelectorAll('.skeleton, [data-testid*="skeleton"]');
      return (
        skeletons.length === 0 ||
        Array.from(skeletons).every((el) => window.getComputedStyle(el).display === 'none')
      );
    },
    { timeout: 10000 },
  );
}

/**
 * Set a consistent date for reproducible screenshots
 */
export async function setConsistentDate(page: Page, date: Date = new Date('2024-01-15')) {
  await page.addInitScript((dateStr) => {
    const constantDate = new Date(dateStr);

    // Override Date constructor
    const OriginalDate = Date;
    // @ts-ignore
    window.Date = class extends OriginalDate {
      constructor(...args) {
        if (args.length === 0) {
          super(constantDate.getTime());
        } else {
          super(...args);
        }
      }

      static now() {
        return constantDate.getTime();
      }
    };

    // Override Date prototype methods
    window.Date.prototype = OriginalDate.prototype;
    window.Date.UTC = OriginalDate.UTC;
    window.Date.parse = OriginalDate.parse;
  }, date.toISOString());
}

/**
 * Hide dynamic elements that could cause flaky screenshots
 */
export async function hideDynamicElements(page: Page) {
  await page.addStyleTag({
    content: `
      /* Hide cursors and carets */
      * { 
        caret-color: transparent !important;
        cursor: none !important;
      }
      
      /* Hide scrollbars */
      ::-webkit-scrollbar {
        display: none !important;
      }
      
      /* Disable text selection */
      * {
        user-select: none !important;
      }
      
      /* Hide focus outlines for consistency */
      *:focus {
        outline: none !important;
      }
    `,
  });
}

/**
 * Scroll element into view and wait for stability
 */
export async function scrollToElement(page: Page, selector: string) {
  const element = await page.locator(selector);
  await element.scrollIntoViewIfNeeded();

  // Wait for scroll to complete
  await page.waitForTimeout(500);

  // Wait for any triggered animations
  await page.waitForFunction(() => {
    const animations = document.getAnimations();
    return animations.length === 0;
  });
}

/**
 * Take a screenshot with retry logic for stability
 */
export async function takeStableScreenshot(element: any, name: string, options?: any) {
  // Take multiple screenshots and use the last one
  // This helps ensure animations have fully completed
  for (let i = 0; i < 3; i++) {
    if (i < 2) {
      await element.page().waitForTimeout(500);
    } else {
      await expect(element).toHaveScreenshot(name, options);
    }
  }
}

/**
 * Wait for network idle state
 */
export async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 30000 });
}

/**
 * Mock API responses for consistent data
 */
export async function mockApiResponses(page: Page) {
  // Mock any external API calls that might affect visual consistency
  await page.route('**/api/plaid/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        transactions: [],
        accounts: [],
      }),
    });
  });

  await page.route('**/api/openai/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        category: 'Groceries',
        confidence: 0.95,
      }),
    });
  });
}
