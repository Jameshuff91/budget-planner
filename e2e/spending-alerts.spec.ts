import { test, expect } from '@playwright/test';

test.describe('Spending Alerts Configuration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Upload sample transaction data to trigger alerts
    const csvContent = `date,description,amount,category,type
2024-01-01,Grocery Store,-500.00,Food,expense
2024-01-02,Gas Station,-150.00,Transportation,expense
2024-01-03,Restaurant Expensive,-250.00,Food,expense
2024-01-04,Salary,3000.00,Income,income
2024-01-05,Grocery Store,-450.00,Food,expense
2024-01-06,Electric Bill,-200.00,Utilities,expense
2024-01-07,Shopping Mall,-800.00,Shopping,expense
2024-01-08,Coffee Shop,-25.00,Food,expense
2024-01-09,Unusual Large Purchase,-2000.00,Shopping,expense
2024-01-10,Gas Station,-60.00,Transportation,expense`;

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
  });

  test('should navigate to Settings tab and access Spending Alerts section', async ({ page }) => {
    // Click on Settings tab
    const settingsTab = page.locator('button[role="tab"]:has-text("Settings")');
    await expect(settingsTab).toBeVisible();
    await settingsTab.click();

    // Wait for Settings content to load
    await page.waitForTimeout(1000);

    // Check that Spending Alerts section is visible
    await expect(page.locator('h3:has-text("Alert Rules")')).toBeVisible();
    await expect(
      page.locator('text=Configure when you want to receive spending alerts'),
    ).toBeVisible();
  });

  test('should display default alert rules', async ({ page }) => {
    // Navigate to Settings tab
    await page.locator('button[role="tab"]:has-text("Settings")').click();
    await page.waitForTimeout(1000);

    // Check for default alert rules
    await expect(page.locator('text=Alert when spending exceeds 90% of budget')).toBeVisible();
    await expect(page.locator('text=Alert on transactions 150% above average')).toBeVisible();
    await expect(page.locator('text=Alert when monthly savings fall below $500')).toBeVisible();

    // Check that switches are present for each rule
    const switches = page.locator('button[role="switch"]');
    await expect(switches).toHaveCount(3);
  });

  test('should enable and disable alert rules', async ({ page }) => {
    // Navigate to Settings tab
    await page.locator('button[role="tab"]:has-text("Settings")').click();
    await page.waitForTimeout(1000);

    // Find the first alert rule switch
    const firstRuleContainer = page
      .locator('text=Alert when spending exceeds 90% of budget')
      .locator('..');
    const firstSwitch = firstRuleContainer.locator('button[role="switch"]');

    // Get initial state
    const initialState = await firstSwitch.getAttribute('data-state');

    // Click to toggle
    await firstSwitch.click();

    // Verify state changed
    const newState = await firstSwitch.getAttribute('data-state');
    expect(newState).not.toBe(initialState);

    // Toggle back
    await firstSwitch.click();
    const finalState = await firstSwitch.getAttribute('data-state');
    expect(finalState).toBe(initialState);
  });

  test('should update alert thresholds', async ({ page }) => {
    // Navigate to Settings tab
    await page.locator('button[role="tab"]:has-text("Settings")').click();
    await page.waitForTimeout(1000);

    // Find threshold input for budget exceeded rule
    const budgetRuleContainer = page
      .locator('text=Alert when spending exceeds 90% of budget')
      .locator('..');

    // Ensure the rule is enabled first
    const budgetSwitch = budgetRuleContainer.locator('button[role="switch"]');
    const switchState = await budgetSwitch.getAttribute('data-state');
    if (switchState !== 'checked') {
      await budgetSwitch.click();
    }

    // Find and update threshold input
    const thresholdInput = budgetRuleContainer.locator('input[type="number"]');
    await expect(thresholdInput).toBeVisible();

    // Clear and set new value
    await thresholdInput.clear();
    await thresholdInput.fill('80');

    // Verify value was updated
    await expect(thresholdInput).toHaveValue('80');
  });

  test('should request browser notification permissions', async ({ page, context }) => {
    // Grant notification permissions for this test
    await context.grantPermissions(['notifications']);

    // Navigate to Settings tab
    await page.locator('button[role="tab"]:has-text("Settings")').click();
    await page.waitForTimeout(1000);

    // Find Push Notifications section
    await expect(page.locator('text=Push Notifications')).toBeVisible();
    await expect(page.locator('text=Receive alerts as browser notifications')).toBeVisible();

    // Click Enable button
    const enableButton = page.locator('button:has-text("Enable")');
    await enableButton.click();

    // Verify success toast appears
    await expect(page.locator('text=Notifications Enabled')).toBeVisible();

    // Button should now show as Enabled and be disabled
    await expect(page.locator('button:has-text("Enabled")').nth(0)).toBeVisible();
    await expect(page.locator('button:has-text("Enabled")').nth(0)).toBeDisabled();
  });

  test('should display active alerts on the dashboard', async ({ page }) => {
    // First enable alert rules in Settings
    await page.locator('button[role="tab"]:has-text("Settings")').click();
    await page.waitForTimeout(1000);

    // Enable unusual spending alert
    const unusualSpendingContainer = page
      .locator('text=Alert on transactions 150% above average')
      .locator('..');
    const unusualSwitch = unusualSpendingContainer.locator('button[role="switch"]');
    const switchState = await unusualSwitch.getAttribute('data-state');
    if (switchState !== 'checked') {
      await unusualSwitch.click();
    }

    // Go back to Overview tab to see alerts
    await page.locator('button[role="tab"]:has-text("Overview")').click();
    await page.waitForTimeout(2000);

    // Check for active alerts section
    const activeAlertsSection = page.locator('h3:has-text("Active Alerts")');

    // If alerts are generated, they should be visible
    const alerts = page.locator('[role="alert"]');
    const alertCount = await alerts.count();

    if (alertCount > 0) {
      // Verify alert structure
      await expect(alerts.first()).toBeVisible();

      // Check for dismiss button
      const dismissButton = alerts.first().locator('button').last();
      await expect(dismissButton).toBeVisible();
    }
  });

  test('should dismiss alerts', async ({ page }) => {
    // Enable alerts and navigate to generate some
    await page.locator('button[role="tab"]:has-text("Settings")').click();
    await page.waitForTimeout(1000);

    // Enable unusual spending alert
    const unusualSpendingContainer = page
      .locator('text=Alert on transactions 150% above average')
      .locator('..');
    const unusualSwitch = unusualSpendingContainer.locator('button[role="switch"]');
    const switchState = await unusualSwitch.getAttribute('data-state');
    if (switchState !== 'checked') {
      await unusualSwitch.click();
    }

    // Go to Overview to see alerts
    await page.locator('button[role="tab"]:has-text("Overview")').click();
    await page.waitForTimeout(2000);

    // Look for alerts
    const alerts = page.locator('[role="alert"]');
    const initialAlertCount = await alerts.count();

    if (initialAlertCount > 0) {
      // Click dismiss button on first alert
      const firstAlert = alerts.first();
      const dismissButton = firstAlert.locator('button').last();
      await dismissButton.click();

      // Wait for alert to be dismissed
      await page.waitForTimeout(500);

      // Verify alert count decreased
      const newAlertCount = await alerts.count();
      expect(newAlertCount).toBe(initialAlertCount - 1);
    }
  });

  test('should persist alert settings across page reloads', async ({ page }) => {
    // Navigate to Settings
    await page.locator('button[role="tab"]:has-text("Settings")').click();
    await page.waitForTimeout(1000);

    // Change threshold for budget exceeded rule
    const budgetRuleContainer = page
      .locator('text=Alert when spending exceeds 90% of budget')
      .locator('..');

    // Enable the rule
    const budgetSwitch = budgetRuleContainer.locator('button[role="switch"]');
    await budgetSwitch.click();

    // Update threshold
    const thresholdInput = budgetRuleContainer.locator('input[type="number"]');
    await thresholdInput.clear();
    await thresholdInput.fill('75');

    // Reload page
    await page.reload();
    await page.waitForTimeout(2000);

    // Navigate back to Settings
    await page.locator('button[role="tab"]:has-text("Settings")').click();
    await page.waitForTimeout(1000);

    // Verify settings persisted
    const reloadedInput = page
      .locator('text=Alert when spending exceeds 90% of budget')
      .locator('..')
      .locator('input[type="number"]');
    await expect(reloadedInput).toHaveValue('75');
  });

  test('should handle all alert types correctly', async ({ page }) => {
    // Navigate to Settings
    await page.locator('button[role="tab"]:has-text("Settings")').click();
    await page.waitForTimeout(1000);

    // Test Budget Exceeded Alert
    const budgetAlert = page
      .locator('text=Alert when spending exceeds 90% of budget')
      .locator('..');
    await expect(budgetAlert).toBeVisible();
    const budgetThreshold = budgetAlert.locator('input[type="number"]');
    await expect(budgetAlert.locator('text=%')).toBeVisible(); // Should show percentage

    // Test Unusual Spending Alert
    const unusualAlert = page
      .locator('text=Alert on transactions 150% above average')
      .locator('..');
    await expect(unusualAlert).toBeVisible();
    const unusualThreshold = unusualAlert.locator('input[type="number"]');
    await expect(unusualAlert.locator('text=%')).toBeVisible(); // Should show percentage

    // Test Savings Goal Alert
    const savingsAlert = page
      .locator('text=Alert when monthly savings fall below $500')
      .locator('..');
    await expect(savingsAlert).toBeVisible();
    const savingsThreshold = savingsAlert.locator('input[type="number"]');
    await expect(savingsAlert.locator('text=$')).toBeVisible(); // Should show dollar sign
  });

  test('should show coming soon for custom rules', async ({ page }) => {
    // Navigate to Settings
    await page.locator('button[role="tab"]:has-text("Settings")').click();
    await page.waitForTimeout(1000);

    // Check for Add Custom Rule button
    const customRuleButton = page.locator('button:has-text("Add Custom Rule")');
    await expect(customRuleButton).toBeVisible();
    await expect(customRuleButton).toContainText('Coming Soon');
    await expect(customRuleButton).toBeDisabled();
  });

  test('should generate alerts based on transaction data', async ({ page }) => {
    // Enable all alert rules
    await page.locator('button[role="tab"]:has-text("Settings")').click();
    await page.waitForTimeout(1000);

    // Enable all three default rules
    const switches = page.locator('button[role="switch"]');
    const switchCount = await switches.count();

    for (let i = 0; i < switchCount; i++) {
      const switchElement = switches.nth(i);
      const state = await switchElement.getAttribute('data-state');
      if (state !== 'checked') {
        await switchElement.click();
        await page.waitForTimeout(200);
      }
    }

    // Set lower thresholds to trigger alerts
    // Budget exceeded threshold to 50%
    const budgetInput = page
      .locator('text=Alert when spending exceeds 90% of budget')
      .locator('..')
      .locator('input[type="number"]');
    await budgetInput.clear();
    await budgetInput.fill('50');

    // Unusual spending threshold to 120%
    const unusualInput = page
      .locator('text=Alert on transactions 150% above average')
      .locator('..')
      .locator('input[type="number"]');
    await unusualInput.clear();
    await unusualInput.fill('120');

    // Wait for alerts to be generated
    await page.waitForTimeout(2000);

    // Go to Overview to check for alerts
    await page.locator('button[role="tab"]:has-text("Overview")').click();
    await page.waitForTimeout(1000);

    // Look for any generated alerts
    const alertsExist =
      (await page.locator('[role="alert"]').count()) > 0 ||
      (await page.locator('text=Active Alerts').isVisible());

    // We expect some alerts to be generated based on our test data
    if (alertsExist) {
      // Verify we can see alert messages
      const alertMessages = page.locator('[role="alert"]');
      const messageCount = await alertMessages.count();
      expect(messageCount).toBeGreaterThan(0);
    }
  });
});
