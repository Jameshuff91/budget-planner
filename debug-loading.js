const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', (msg) => {
    console.log(`Browser console ${msg.type()}: ${msg.text()}`);
  });

  // Listen for page errors
  page.on('pageerror', (error) => {
    console.log(`Page error: ${error.message}`);
  });

  try {
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    console.log('Page loaded. Taking screenshot...');
    await page.screenshot({ path: 'loading-state.png', fullPage: true });

    // Check for loading indicators
    const loadingElements = await page.$$(
      '[class*="loading"], [class*="skeleton"], [class*="animate-pulse"]',
    );
    console.log(`Found ${loadingElements.length} loading elements`);

    // Check for error messages
    const errorElements = await page.$$('[class*="error"], [role="alert"]');
    console.log(`Found ${errorElements.length} error elements`);

    // Get page content for debugging
    const bodyText = await page.textContent('body');
    console.log('Page text content:', bodyText.substring(0, 500) + '...');

    // Check IndexedDB for issues
    const hasIndexedDB = await page.evaluate(() => {
      return 'indexedDB' in window;
    });
    console.log('IndexedDB available:', hasIndexedDB);

    // Wait a bit to see if anything changes
    console.log('Waiting 5 seconds to observe any changes...');
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'loading-state-after-wait.png', fullPage: true });
  } catch (error) {
    console.error('Error during page inspection:', error);
  }

  await browser.close();
})();
