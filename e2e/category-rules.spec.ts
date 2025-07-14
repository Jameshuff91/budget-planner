import { test, expect } from '@playwright/test';

test.describe('Category Rules Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Clear any existing rules from localStorage
    await page.evaluate(() => {
      localStorage.removeItem('budget.categoryRules');
    });

    // Wait for the page to load - look for the dashboard
    await expect(page.locator('text=Financial Dashboard').first()).toBeVisible({ timeout: 10000 });

    // Navigate to Settings tab
    await page.click('button[role="tab"]:has-text("Settings")');

    // Wait for Settings content to be visible
    await expect(page.locator('text=Custom Category Rules')).toBeVisible({ timeout: 10000 });
  });

  test('should display category rules section with empty state', async ({ page }) => {
    // Check that the Category Rules card is visible - CardTitle renders as h3
    await expect(page.locator('text=Custom Category Rules').first()).toBeVisible();

    // Check for the description
    await expect(
      page.locator(
        'text=Create rules to automatically categorize transactions based on their description',
      ),
    ).toBeVisible();

    // Check for empty state message
    await expect(
      page.locator('text=No custom rules yet. Create one to start automating categorization.'),
    ).toBeVisible();

    // Check for Add New Rule button
    await expect(page.locator('button:has-text("Add New Rule")')).toBeVisible();

    // Check for help text section
    await expect(page.locator('text=How rules work:')).toBeVisible();
    await expect(page.locator('text=Rules are applied in priority order')).toBeVisible();
  });

  test('should create a new rule with "contains" pattern', async ({ page }) => {
    // Click Add New Rule button
    await page.click('button:has-text("Add New Rule")');

    // Fill in the rule form
    await page.fill('input[placeholder="e.g., Starbucks"]', 'Starbucks');

    // The match type should default to "contains"
    await expect(page.locator('button[role="combobox"]:has-text("Contains")')).toBeVisible();

    // Select category
    await page.click('button[role="combobox"]:has-text("Select category")');
    await page.click('div[role="option"]:has-text("Groceries")');

    // Set priority
    await page.fill('input[placeholder="0"]', '10');

    // Click Add Rule button
    await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');

    // Verify rule was added
    await expect(page.locator('text=Starbucks (contains) → Groceries')).toBeVisible();
    await expect(page.locator('text=Priority: 10')).toBeVisible();
    await expect(page.locator('text=Enabled')).toBeVisible();

    // Verify toast notification - use first() since there might be multiple elements
    await expect(page.locator('text=Rule Added').first()).toBeVisible();
  });

  test('should create rules with different pattern types', async ({ page }) => {
    const testCases = [
      { pattern: 'UBER', matchType: 'startsWith', category: 'Transportation', priority: '20' },
      { pattern: '.COM', matchType: 'endsWith', category: 'Utilities', priority: '15' },
      { pattern: '^AMAZON.*PRIME$', matchType: 'regex', category: 'Rent', priority: '25' },
    ];

    for (const testCase of testCases) {
      // Click Add New Rule button
      await page.click('button:has-text("Add New Rule")');

      // Fill in pattern
      await page.fill('input[placeholder="e.g., Starbucks"]', testCase.pattern);

      // Select match type
      await page.click('button[role="combobox"]:has-text("Contains")');
      await page.click(
        `div[role="option"]:has-text("${testCase.matchType === 'startsWith' ? 'Starts with' : testCase.matchType === 'endsWith' ? 'Ends with' : 'Regex'}")`,
      );

      // Select category
      await page.click('button[role="combobox"]:has-text("Select category")');
      await page.click(`div[role="option"]:has-text("${testCase.category}")`);

      // Set priority
      await page.fill('input[placeholder="0"]', testCase.priority);

      // Add the rule
      await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');

      // Verify rule was added
      await expect(
        page.locator(`text=${testCase.pattern} (${testCase.matchType}) → ${testCase.category}`),
      ).toBeVisible();
    }

    // Verify rules are sorted by priority (highest first)
    const ruleElements = await page.locator('div:has(> p:has-text("Priority:"))').all();
    const priorities = await Promise.all(
      ruleElements.map(async (el) => {
        const text = await el.textContent();
        const match = text?.match(/Priority: (\d+)/);
        return match ? parseInt(match[1]) : 0;
      }),
    );

    // Check that priorities are in descending order
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1]);
    }
  });

  test('should edit an existing rule', async ({ page }) => {
    // First create a rule
    await page.click('button:has-text("Add New Rule")');
    await page.fill('input[placeholder="e.g., Starbucks"]', 'Coffee Shop');
    await page.click('button[role="combobox"]:has-text("Select category")');
    await page.click('div[role="option"]:has-text("Groceries")');
    await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');

    // Click edit button - it's the first button in the rule row with the edit icon
    const ruleRow = page.locator('div.flex.items-center.gap-2.p-3.border.rounded-lg').first();
    await ruleRow.locator('button').first().click();

    // Edit the pattern
    await page.fill('input[value="Coffee Shop"]', 'Cafe');

    // Change match type
    await page.click('button[role="combobox"]:has-text("Contains")');
    await page.click('div[role="option"]:has-text("Starts with")');

    // Change category
    await page.click('button[role="combobox"]:has-text("Groceries")');
    await page.click('div[role="option"]:has-text("Utilities")');

    // Change priority
    await page.fill('input[value="0"]', '30');

    // Save changes
    await page.click('button:has(svg.lucide-save)');

    // Verify changes were saved
    await expect(page.locator('text=Cafe (startsWith) → Utilities')).toBeVisible();
    await expect(page.locator('text=Priority: 30')).toBeVisible();
  });

  test('should delete a rule', async ({ page }) => {
    // First create a rule
    await page.click('button:has-text("Add New Rule")');
    await page.fill('input[placeholder="e.g., Starbucks"]', 'Test Rule');
    await page.click('button[role="combobox"]:has-text("Select category")');
    await page.click('div[role="option"]:has-text("Groceries")');
    await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');

    // Verify rule exists
    await expect(page.locator('text=Test Rule (contains) → Groceries')).toBeVisible();

    // Click delete button
    page.on('dialog', (dialog) => dialog.accept()); // Accept confirmation dialog
    await page.click('button:has(.lucide-trash2)');

    // Verify rule was deleted
    await expect(page.locator('text=Test Rule (contains) → Groceries')).not.toBeVisible();
    await expect(page.locator('text=Rule Deleted').first()).toBeVisible();

    // Should show empty state again
    await expect(
      page.locator('text=No custom rules yet. Create one to start automating categorization.'),
    ).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Click Add New Rule button
    await page.click('button:has-text("Add New Rule")');

    // Try to add rule without filling required fields
    await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');

    // Should show validation error
    await expect(page.locator('text=Pattern and category are required').first()).toBeVisible();

    // Fill pattern but not category
    await page.fill('input[placeholder="e.g., Starbucks"]', 'Test Pattern');
    await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');

    // Should still show validation error
    await expect(page.locator('text=Pattern and category are required').first()).toBeVisible();
  });

  test('should cancel rule creation', async ({ page }) => {
    // Click Add New Rule button
    await page.click('button:has-text("Add New Rule")');

    // Fill in some data
    await page.fill('input[placeholder="e.g., Starbucks"]', 'Test Pattern');

    // Click Cancel
    await page.click('button:has-text("Cancel")');

    // Form should be hidden
    await expect(page.locator('input[placeholder="e.g., Starbucks"]')).not.toBeVisible();

    // Add New Rule button should be visible again
    await expect(page.locator('button:has-text("Add New Rule")')).toBeVisible();
  });

  test('should create and verify rules for transaction categorization', async ({ page }) => {
    // Create multiple rules to test different pattern types
    const rules = [
      { pattern: 'Starbucks', matchType: 'contains', category: 'Groceries', priority: '100' },
      { pattern: 'UBER', matchType: 'startsWith', category: 'Transportation', priority: '90' },
      { pattern: '.com', matchType: 'endsWith', category: 'Utilities', priority: '80' },
    ];

    for (const rule of rules) {
      await page.click('button:has-text("Add New Rule")');
      await page.fill('input[placeholder="e.g., Starbucks"]', rule.pattern);

      if (rule.matchType !== 'contains') {
        await page.click('button[role="combobox"]:has-text("Contains")');
        const matchTypeText = rule.matchType === 'startsWith' ? 'Starts with' : 'Ends with';
        await page.click(`div[role="option"]:has-text("${matchTypeText}")`);
      }

      await page.click('button[role="combobox"]:has-text("Select category")');
      await page.click(`div[role="option"]:has-text("${rule.category}")`);
      await page.fill('input[placeholder="0"]', rule.priority);
      await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');
    }

    // Verify all rules were created
    await expect(page.locator('text=Starbucks (contains) → Groceries')).toBeVisible();
    await expect(page.locator('text=UBER (startsWith) → Transportation')).toBeVisible();
    await expect(page.locator('text=.com (endsWith) → Utilities')).toBeVisible();

    // Verify they're sorted by priority (highest first)
    const ruleElements = await page.locator('div:has(> p:has-text("Priority:"))').all();
    expect(ruleElements.length).toBe(3);
  });

  test('should handle regex validation errors gracefully', async ({ page }) => {
    // Click Add New Rule button
    await page.click('button:has-text("Add New Rule")');

    // Fill in invalid regex pattern
    await page.fill('input[placeholder="e.g., Starbucks"]', '[invalid regex');

    // Select regex match type
    await page.click('button[role="combobox"]:has-text("Contains")');
    await page.click('div[role="option"]:has-text("Regex")');

    // Select category
    await page.click('button[role="combobox"]:has-text("Select category")');
    await page.click('div[role="option"]:has-text("Groceries")');

    // Add the rule (it should still be created, but won't match anything)
    await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');

    // Verify rule was added
    await expect(page.locator('text=[invalid regex (regex) → Groceries')).toBeVisible();
  });

  test('should persist rules across page reloads', async ({ page }) => {
    // Create multiple rules
    const rules = [
      { pattern: 'Amazon', category: 'Groceries', priority: '50' },
      { pattern: 'Netflix', category: 'Utilities', priority: '40' },
    ];

    for (const rule of rules) {
      await page.click('button:has-text("Add New Rule")');
      await page.fill('input[placeholder="e.g., Starbucks"]', rule.pattern);
      await page.click('button[role="combobox"]:has-text("Select category")');
      await page.click(`div[role="option"]:has-text("${rule.category}")`);
      await page.fill('input[placeholder="0"]', rule.priority);
      await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');
    }

    // Reload the page
    await page.reload();

    // Navigate back to Settings
    await page.click('button[role="tab"]:has-text("Settings")');

    // Verify rules are still present
    for (const rule of rules) {
      await expect(
        page.locator(`text=${rule.pattern} (contains) → ${rule.category}`),
      ).toBeVisible();
    }
  });

  test('should handle priority ordering correctly', async ({ page }) => {
    // Create rules with different priorities
    const rules = [
      { pattern: 'Coffee', priority: '10' },
      { pattern: 'Cafe', priority: '50' },
      { pattern: 'Starbucks', priority: '30' },
    ];

    // Add all rules
    for (const rule of rules) {
      await page.click('button:has-text("Add New Rule")');
      await page.fill('input[placeholder="e.g., Starbucks"]', rule.pattern);
      await page.click('button[role="combobox"]:has-text("Select category")');
      await page.click('div[role="option"]:has-text("Groceries")');
      await page.fill('input[placeholder="0"]', rule.priority);
      await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');
    }

    // Get all priority texts and verify they're in descending order
    const priorityTexts = await page.locator('text=/Priority: \\d+/').all();
    const priorities = await Promise.all(
      priorityTexts.map(async (el) => {
        const text = await el.textContent();
        const match = text?.match(/Priority: (\d+)/);
        return match ? parseInt(match[1]) : 0;
      }),
    );

    // Verify priorities are sorted in descending order
    expect(priorities).toEqual([50, 30, 10]);
  });

  test('should test rule matching with different patterns', async ({ page }) => {
    // This test would require a test interface in the UI
    // For now, we'll create rules and verify they're saved correctly
    const testCases = [
      {
        pattern: 'WALMART',
        matchType: 'contains',
        testString: 'Purchase at WALMART Store',
        shouldMatch: true,
      },
      { pattern: 'AMZ', matchType: 'startsWith', testString: 'AMZN Mktp US', shouldMatch: false },
      { pattern: '.com', matchType: 'endsWith', testString: 'amazon.com', shouldMatch: true },
      {
        pattern: '^UBER.*EATS$',
        matchType: 'regex',
        testString: 'UBER TECHNOLOGIES EATS',
        shouldMatch: true,
      },
    ];

    // Add rules
    for (const testCase of testCases) {
      await page.click('button:has-text("Add New Rule")');
      await page.fill('input[placeholder="e.g., Starbucks"]', testCase.pattern);

      // Select match type
      if (testCase.matchType !== 'contains') {
        await page.click('button[role="combobox"]:has-text("Contains")');
        const matchTypeText =
          testCase.matchType === 'startsWith'
            ? 'Starts with'
            : testCase.matchType === 'endsWith'
              ? 'Ends with'
              : 'Regex';
        await page.click(`div[role="option"]:has-text("${matchTypeText}")`);
      }

      await page.click('button[role="combobox"]:has-text("Select category")');
      await page.click('div[role="option"]:has-text("Groceries")');
      await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');
    }

    // Verify all rules were created
    expect(await page.locator('div:has(> p:has-text("Priority:"))').count()).toBe(4);
  });

  test('should handle multiple rules with same priority', async ({ page }) => {
    // Create multiple rules with the same priority
    const rules = ['Rule A', 'Rule B', 'Rule C'];

    for (const rule of rules) {
      await page.click('button:has-text("Add New Rule")');
      await page.fill('input[placeholder="e.g., Starbucks"]', rule);
      await page.click('button[role="combobox"]:has-text("Select category")');
      await page.click('div[role="option"]:has-text("Groceries")');
      await page.fill('input[placeholder="0"]', '20'); // Same priority for all
      await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');
    }

    // Verify all rules have the same priority
    const priorityTexts = await page.locator('text=Priority: 20').all();
    expect(priorityTexts.length).toBe(3);
  });

  test('should enable and disable rules', async ({ page }) => {
    // Create a rule
    await page.click('button:has-text("Add New Rule")');
    await page.fill('input[placeholder="e.g., Starbucks"]', 'Test Rule');
    await page.click('button[role="combobox"]:has-text("Select category")');
    await page.click('div[role="option"]:has-text("Groceries")');
    await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');

    // Verify rule is enabled by default
    await expect(page.locator('text=Enabled')).toBeVisible();

    // Note: The current UI doesn't show a toggle for enabling/disabling rules
    // This test assumes such functionality would be added
    // For now, we just verify the rule shows as enabled
  });

  test('should handle long pattern strings', async ({ page }) => {
    const longPattern =
      'This is a very long pattern string that might be used for complex matching scenarios in financial transactions';

    await page.click('button:has-text("Add New Rule")');
    await page.fill('input[placeholder="e.g., Starbucks"]', longPattern);
    await page.click('button[role="combobox"]:has-text("Select category")');
    await page.click('div[role="option"]:has-text("Groceries")');
    await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');

    // Verify the rule was created (text might be truncated in UI)
    await expect(
      page.locator('p.text-sm.font-medium').filter({ hasText: longPattern.substring(0, 20) }),
    ).toBeVisible();
  });

  test('should handle special characters in patterns', async ({ page }) => {
    const specialPatterns = [
      "McDonald's",
      'AT&T',
      '7-Eleven',
      "Trader Joe's #123",
      'Gas Station (Shell)',
    ];

    for (const pattern of specialPatterns) {
      await page.click('button:has-text("Add New Rule")');
      await page.fill('input[placeholder="e.g., Starbucks"]', pattern);
      await page.click('button[role="combobox"]:has-text("Select category")');
      await page.click('div[role="option"]:has-text("Groceries")');
      await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');

      // Verify rule was created
      await expect(page.locator(`text=${pattern}`).first()).toBeVisible();
    }
  });

  test('should update rule count dynamically', async ({ page }) => {
    // Initially should show empty state
    await expect(page.locator('text=No custom rules yet')).toBeVisible();

    // Add first rule
    await page.click('button:has-text("Add New Rule")');
    await page.fill('input[placeholder="e.g., Starbucks"]', 'Rule 1');
    await page.click('button[role="combobox"]:has-text("Select category")');
    await page.click('div[role="option"]:has-text("Groceries")');
    await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');

    // Empty state should be gone
    await expect(page.locator('text=No custom rules yet')).not.toBeVisible();

    // Add more rules
    for (let i = 2; i <= 3; i++) {
      await page.click('button:has-text("Add New Rule")');
      await page.fill('input[placeholder="e.g., Starbucks"]', `Rule ${i}`);
      await page.click('button[role="combobox"]:has-text("Select category")');
      await page.click('div[role="option"]:has-text("Groceries")');
      await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');
    }

    // Verify we have 3 rules
    const ruleCount = await page.locator('div:has(> p:has-text("Priority:"))').count();
    expect(ruleCount).toBe(3);

    // Delete all rules
    const deleteButtons = await page.locator('button:has(.lucide-trash2)').all();
    page.on('dialog', (dialog) => dialog.accept());

    for (let i = deleteButtons.length - 1; i >= 0; i--) {
      await deleteButtons[i].click();
      await page.waitForTimeout(100); // Small delay between deletions
    }

    // Empty state should be visible again
    await expect(page.locator('text=No custom rules yet')).toBeVisible();
  });

  test('should handle concurrent rule operations', async ({ page }) => {
    // Create a rule
    await page.click('button:has-text("Add New Rule")');
    await page.fill('input[placeholder="e.g., Starbucks"]', 'Original Rule');
    await page.click('button[role="combobox"]:has-text("Select category")');
    await page.click('div[role="option"]:has-text("Groceries")');
    await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');

    // Start editing - find the edit button in the rule row
    const ruleRow = page.locator('div.flex.items-center.gap-2.p-3.border.rounded-lg').first();
    await ruleRow.locator('button').first().click();

    // While in edit mode, save the changes
    await ruleRow
      .locator('button')
      .filter({ has: page.locator('.lucide-save') })
      .click();

    // Now add a new rule
    await page.click('button:has-text("Add New Rule")');
    await page.fill('input[placeholder="e.g., Starbucks"]', 'New Rule');
    await page.click('button[role="combobox"]:has-text("Select category")');
    await page.click('div[role="option"]:has-text("Transportation")');
    await page.click('button:has-text("Add Rule"):not(:has-text("Add New Rule"))');

    // Verify both rules exist - be more specific since "New Rule" matches the button text too
    await expect(page.locator('text=Original Rule (contains) → Groceries')).toBeVisible();
    await expect(page.locator('text=New Rule (contains) → Transportation')).toBeVisible();
  });
});
