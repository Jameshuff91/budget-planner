import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/visual-regression',
  outputDir: './test-results/visual',
  timeout: 60 * 1000,
  expect: {
    timeout: 10000,
    // Visual comparison settings
    toHaveScreenshot: {
      // Maximum difference in pixels
      maxDiffPixels: 100,
      // Threshold between 0-1 for pixel difference tolerance
      threshold: 0.2,
      // Animation handling
      animations: 'disabled',
      // CSS animations to wait for
      caret: 'hide',
    },
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report/visual' }],
    ['json', { outputFile: 'test-results/visual/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Force consistent rendering
    deviceScaleFactor: 1,
    // Disable animations for consistent screenshots
    launchOptions: {
      args: ['--force-prefers-reduced-motion'],
    },
    // Wait for fonts to load
    // waitForLoadState: 'networkidle',
  },

  projects: [
    // Desktop viewports
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
    },

    // Tablet viewports
    {
      name: 'chromium-tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 768, height: 1024 },
      },
    },

    // Mobile viewports
    {
      name: 'chromium-mobile',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'webkit-mobile',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 375, height: 812 },
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
