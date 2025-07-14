import { test, expect } from '@playwright/test';
import { 
  uploadSampleTransactions, 
  clearDatabase, 
  waitForChartsToRender,
  hideDynamicElements,
  setConsistentDate
} from './helpers';

test.describe('Theme Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await clearDatabase(page);
    await setConsistentDate(page);
    await hideDynamicElements(page);
  });

  test('Light theme - dashboard', async ({ page }) => {
    // Ensure light theme is active
    await page.goto('/');
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    });
    
    await uploadSampleTransactions(page);
    await waitForChartsToRender(page);
    
    await expect(page).toHaveScreenshot('theme-light-dashboard.png', {
      fullPage: true,
    });
  });

  test('Dark theme - dashboard', async ({ page }) => {
    // Skip if dark mode not implemented
    await page.goto('/');
    const hasDarkMode = await page.evaluate(() => {
      // Check if dark mode is available
      return document.documentElement.classList.contains('dark') || 
             window.matchMedia('(prefers-color-scheme: dark)').matches ||
             !!document.querySelector('[data-theme-toggle]');
    });
    
    if (!hasDarkMode) {
      test.skip();
      return;
    }
    
    // Enable dark theme
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });
    
    await uploadSampleTransactions(page);
    await waitForChartsToRender(page);
    
    await expect(page).toHaveScreenshot('theme-dark-dashboard.png', {
      fullPage: true,
    });
  });

  test('Theme transition', async ({ page }) => {
    await page.goto('/');
    
    // Check if theme toggle exists
    const themeToggle = await page.locator('[data-theme-toggle], button:has-text("Theme")').first();
    if (await themeToggle.count() === 0) {
      test.skip();
      return;
    }
    
    await uploadSampleTransactions(page);
    await waitForChartsToRender(page);
    
    // Start in light mode
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
    });
    
    // Click theme toggle
    await themeToggle.click();
    await page.waitForTimeout(500); // Wait for transition
    
    // Capture mid-transition if possible
    await expect(page).toHaveScreenshot('theme-transition.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });
  });

  test('Chart colors in dark mode', async ({ page }) => {
    await page.goto('/');
    
    const hasDarkMode = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark') || 
             !!document.querySelector('[data-theme-toggle]');
    });
    
    if (!hasDarkMode) {
      test.skip();
      return;
    }
    
    // Enable dark theme
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    
    await uploadSampleTransactions(page);
    await waitForChartsToRender(page);
    
    // Focus on chart area
    const chartArea = await page.locator('.recharts-responsive-container').first();
    await expect(chartArea).toHaveScreenshot('theme-dark-chart-colors.png');
  });

  test('Form elements in dark mode', async ({ page }) => {
    await page.goto('/');
    
    const hasDarkMode = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark') || 
             !!document.querySelector('[data-theme-toggle]');
    });
    
    if (!hasDarkMode) {
      test.skip();
      return;
    }
    
    // Enable dark theme
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    
    // Find a form or input area
    const formArea = await page.locator('form, [data-testid="file-upload"]').first();
    await expect(formArea).toHaveScreenshot('theme-dark-form-elements.png');
  });

  test('High contrast mode', async ({ page }) => {
    await page.goto('/');
    
    // Enable high contrast mode if available
    await page.evaluate(() => {
      // Add high contrast styles
      const style = document.createElement('style');
      style.textContent = `
        * {
          forced-color-adjust: none !important;
        }
        body {
          filter: contrast(1.5) !important;
        }
      `;
      document.head.appendChild(style);
    });
    
    await uploadSampleTransactions(page);
    await waitForChartsToRender(page);
    
    await expect(page).toHaveScreenshot('theme-high-contrast.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });
  });

  test('Reduced motion mode', async ({ page }) => {
    // Force reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    
    await page.goto('/');
    await uploadSampleTransactions(page);
    await waitForChartsToRender(page);
    
    // Test that animations are disabled
    const hasAnimations = await page.evaluate(() => {
      const animations = document.getAnimations();
      return animations.length > 0;
    });
    
    expect(hasAnimations).toBe(false);
    
    await expect(page).toHaveScreenshot('theme-reduced-motion.png', {
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });
  });

  test('Print mode styling', async ({ page }) => {
    await page.goto('/');
    await uploadSampleTransactions(page);
    await waitForChartsToRender(page);
    
    // Emulate print media
    await page.emulateMedia({ media: 'print' });
    
    await expect(page).toHaveScreenshot('theme-print-mode.png', {
      fullPage: true,
    });
  });
});