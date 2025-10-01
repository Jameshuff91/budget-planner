import { Page } from '@playwright/test';

/**
 * Helper function to register a new test user and log in
 */
export async function loginAsTestUser(page: Page) {
  // Navigate to the home page
  await page.goto('/');

  // Wait for the auth form to load
  await page.waitForSelector('text=Welcome to Budget Planner', { timeout: 10000 });

  // Generate a unique email for this test session with extra randomness to avoid conflicts
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const testEmail = `test-${timestamp}-${random}@example.com`;
  const testPassword = 'TestPass123!';

  // Click on Register tab
  await page.click('button:has-text("Register")');

  // Fill in registration form
  await page.fill('#register-email', testEmail);
  await page.fill('#register-password', testPassword);

  // Submit the registration form
  await page.click('button:has-text("Create Account")');

  // Wait for successful authentication (dashboard should load)
  await page.waitForSelector('text=Budget Planner Dashboard', { timeout: 15000 });
}

/**
 * Helper function to log in with existing credentials
 */
export async function loginWithCredentials(page: Page, email: string, password: string) {
  // Navigate to the home page
  await page.goto('/');

  // Wait for the auth form to load
  await page.waitForSelector('text=Welcome to Budget Planner', { timeout: 10000 });

  // Fill in login form
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);

  // Submit the login form
  await page.click('button:has-text("Sign In")');

  // Wait for successful authentication (dashboard should load)
  await page.waitForSelector('text=Budget Planner Dashboard', { timeout: 15000 });
}
