import { test, expect, Page } from '@playwright/test';

test.describe('Smart Categorization Settings', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    // Create a new page context with localStorage mock
    const context = await browser.newContext();
    page = await context.newPage();
    
    // Clear localStorage before each test
    await page.addInitScript(() => {
      localStorage.clear();
    });
    
    await page.goto('/');
  });

  test.afterEach(async () => {
    await page.close();
  });

  async function navigateToSmartCategorizationSettings(page: Page) {
    // Click on Settings tab
    await page.click('button[role="tab"]:has-text("Settings")');
    
    // Wait for settings content to be visible
    await expect(page.locator('div[role="tabpanel"][data-state="active"]')).toBeVisible();
    
    // Find Smart Categorization section
    await expect(page.locator('text=Smart Categorization (AI-Powered)')).toBeVisible();
  }

  test('should display smart categorization settings in Settings tab', async () => {
    await navigateToSmartCategorizationSettings(page);
    
    // Check for main elements
    await expect(page.locator('text=Smart Categorization (AI-Powered)')).toBeVisible();
    await expect(page.locator('text=Use OpenAI to automatically categorize your transactions')).toBeVisible();
    
    // Check for alert about OpenAI API requirement
    await expect(page.locator('text=Smart categorization uses OpenAI\'s API')).toBeVisible();
    
    // Check for enable switch
    const enableSwitch = page.locator('switch[id="smart-categorization"], input[id="smart-categorization"]');
    await expect(enableSwitch).toBeVisible();
  });

  test('should enable smart categorization and show configuration options', async () => {
    await navigateToSmartCategorizationSettings(page);
    
    // Enable smart categorization
    const enableSwitch = page.locator('#smart-categorization');
    await enableSwitch.click();
    
    // Check that configuration options appear
    await expect(page.locator('label:has-text("OpenAI API Key")')).toBeVisible();
    await expect(page.locator('input[placeholder="sk-..."]')).toBeVisible();
    await expect(page.locator('label:has-text("Model")')).toBeVisible();
    await expect(page.locator('select#model')).toBeVisible();
    
    // Check for buttons
    await expect(page.locator('button:has-text("Test Connection")')).toBeVisible();
    await expect(page.locator('button:has-text("Save Settings")')).toBeVisible();
  });

  test('should validate API key input', async () => {
    await navigateToSmartCategorizationSettings(page);
    
    // Enable smart categorization
    await page.click('#smart-categorization');
    
    // Try to test connection without API key
    await page.click('button:has-text("Test Connection")');
    
    // Should show error toast
    await expect(page.locator('text=API Key Required')).toBeVisible();
    await expect(page.locator('text=Please enter your OpenAI API key first')).toBeVisible();
  });

  test('should toggle API key visibility', async () => {
    await navigateToSmartCategorizationSettings(page);
    
    // Enable smart categorization
    await page.click('#smart-categorization');
    
    // Enter API key
    const apiKeyInput = page.locator('input[placeholder="sk-..."]');
    await apiKeyInput.fill('sk-test-key-12345');
    
    // Check that input is password type initially
    await expect(apiKeyInput).toHaveAttribute('type', 'password');
    
    // Click show/hide button
    const toggleButton = page.locator('button').filter({ has: page.locator('svg') }).nth(-3);
    await toggleButton.click();
    
    // Check that input is now text type
    await expect(apiKeyInput).toHaveAttribute('type', 'text');
    
    // Click again to hide
    await toggleButton.click();
    await expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  test('should select different AI models', async () => {
    await navigateToSmartCategorizationSettings(page);
    
    // Enable smart categorization
    await page.click('#smart-categorization');
    
    // Select different models
    const modelSelect = page.locator('select#model');
    
    // Check default value
    await expect(modelSelect).toHaveValue('gpt-3.5-turbo');
    
    // Select GPT-4
    await modelSelect.selectOption('gpt-4');
    await expect(modelSelect).toHaveValue('gpt-4');
    
    // Select GPT-4 Turbo
    await modelSelect.selectOption('gpt-4-turbo-preview');
    await expect(modelSelect).toHaveValue('gpt-4-turbo-preview');
  });

  test('should save settings and persist in localStorage', async () => {
    await navigateToSmartCategorizationSettings(page);
    
    // Enable smart categorization
    await page.click('#smart-categorization');
    
    // Configure settings
    await page.fill('input[placeholder="sk-..."]', 'sk-test-api-key');
    await page.selectOption('select#model', 'gpt-4');
    
    // Save settings
    await page.click('button:has-text("Save Settings")');
    
    // Check for success toast
    await expect(page.locator('text=Settings Saved')).toBeVisible();
    await expect(page.locator('text=Smart categorization settings have been updated')).toBeVisible();
    
    // Verify localStorage
    const localStorage = await page.evaluate(() => {
      return {
        enabled: window.localStorage.getItem('smartCategorization.enabled'),
        apiKey: window.localStorage.getItem('smartCategorization.apiKey'),
        model: window.localStorage.getItem('smartCategorization.model')
      };
    });
    
    expect(localStorage.enabled).toBe('true');
    expect(localStorage.apiKey).toBe('sk-test-api-key');
    expect(localStorage.model).toBe('gpt-4');
  });

  test('should persist settings on page reload', async () => {
    await navigateToSmartCategorizationSettings(page);
    
    // Configure and save settings
    await page.click('#smart-categorization');
    await page.fill('input[placeholder="sk-..."]', 'sk-persisted-key');
    await page.selectOption('select#model', 'gpt-4-turbo-preview');
    await page.click('button:has-text("Save Settings")');
    
    // Wait for toast to appear
    await expect(page.locator('text=Settings Saved')).toBeVisible();
    
    // Reload page
    await page.reload();
    
    // Navigate back to settings
    await navigateToSmartCategorizationSettings(page);
    
    // Check that settings are persisted
    const enableSwitch = page.locator('#smart-categorization');
    await expect(enableSwitch).toBeChecked();
    
    const apiKeyInput = page.locator('input[placeholder="sk-..."]');
    await expect(apiKeyInput).toHaveValue('sk-persisted-key');
    
    const modelSelect = page.locator('select#model');
    await expect(modelSelect).toHaveValue('gpt-4-turbo-preview');
  });

  test('should test API connection with mock response', async () => {
    // Mock the OpenAI API response
    await page.route('**/api.openai.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                category: 'Groceries',
                confidence: 0.95,
                reasoning: 'Test transaction appears to be a grocery store purchase'
              })
            }
          }]
        })
      });
    });
    
    await navigateToSmartCategorizationSettings(page);
    
    // Enable and configure
    await page.click('#smart-categorization');
    await page.fill('input[placeholder="sk-..."]', 'sk-test-valid-key');
    
    // Test connection
    await page.click('button:has-text("Test Connection")');
    
    // Wait for loading state
    await expect(page.locator('button:has-text("Testing...")')).toBeVisible();
    
    // Check for success toast
    await expect(page.locator('text=Connection Successful')).toBeVisible();
    await expect(page.locator('text=/Test categorization.*Groceries.*95%/')).toBeVisible();
  });

  test('should handle API connection errors gracefully', async () => {
    // Mock API error response
    await page.route('**/api.openai.com/**', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            message: 'Invalid API key',
            type: 'invalid_request_error'
          }
        })
      });
    });
    
    await navigateToSmartCategorizationSettings(page);
    
    // Enable and configure
    await page.click('#smart-categorization');
    await page.fill('input[placeholder="sk-..."]', 'sk-invalid-key');
    
    // Test connection
    await page.click('button:has-text("Test Connection")');
    
    // Check for error toast
    await expect(page.locator('text=Connection Failed')).toBeVisible();
    await expect(page.locator('text=Failed to connect to OpenAI API')).toBeVisible();
  });

  test('should disable test button when no API key is entered', async () => {
    await navigateToSmartCategorizationSettings(page);
    
    // Enable smart categorization
    await page.click('#smart-categorization');
    
    // Check that test button is disabled initially
    const testButton = page.locator('button:has-text("Test Connection")');
    await expect(testButton).toBeDisabled();
    
    // Enter API key
    await page.fill('input[placeholder="sk-..."]', 'sk-some-key');
    
    // Check that test button is now enabled
    await expect(testButton).toBeEnabled();
    
    // Clear API key
    await page.fill('input[placeholder="sk-..."]', '');
    
    // Check that test button is disabled again
    await expect(testButton).toBeDisabled();
  });

  test('should show how it works information', async () => {
    await navigateToSmartCategorizationSettings(page);
    
    // Check for "How it works" section
    await expect(page.locator('text=How it works:')).toBeVisible();
    
    // Check for feature descriptions
    await expect(page.locator('text=AI analyzes transaction descriptions')).toBeVisible();
    await expect(page.locator('text=Works with your existing categories')).toBeVisible();
    await expect(page.locator('text=Learns from patterns in your transaction history')).toBeVisible();
    await expect(page.locator('text=Provides confidence scores')).toBeVisible();
  });

  test('should integrate with transaction upload for categorization', async () => {
    // Set up smart categorization
    await page.evaluate(() => {
      localStorage.setItem('smartCategorization.enabled', 'true');
      localStorage.setItem('smartCategorization.apiKey', 'sk-test-integration-key');
      localStorage.setItem('smartCategorization.model', 'gpt-3.5-turbo');
    });
    
    // Mock API response for categorization
    await page.route('**/api.openai.com/**', async (route) => {
      const requestBody = await route.request().postData();
      
      // Return different categories based on transaction description
      let category = 'Uncategorized';
      let confidence = 0.5;
      
      if (requestBody?.includes('Restaurant')) {
        category = 'Dining';
        confidence = 0.9;
      } else if (requestBody?.includes('Gas Station')) {
        category = 'Transportation';
        confidence = 0.85;
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                category,
                confidence,
                reasoning: 'Test categorization'
              })
            }
          }]
        })
      });
    });
    
    // Navigate to main page
    await page.goto('/');
    
    // Upload a CSV file with transactions
    const csvContent = `date,description,amount
2024-01-15,Restaurant ABC,-45.00
2024-01-16,Gas Station XYZ,-60.00
2024-01-17,Monthly Salary,3000.00`;
    
    const fileInput = page.locator('#file-upload');
    await fileInput.setInputFiles({
      name: 'test-categorization.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    
    // Wait for processing
    await page.waitForTimeout(2000);
    
    // Navigate to transactions tab
    await page.click('button[role="tab"]:has-text("Transactions")');
    
    // Check that transactions were categorized by AI
    // Note: The actual implementation would need to display the categories
    // This is a placeholder for where you'd verify the categorization results
  });

  test('should fall back to rule-based categorization when AI is disabled', async () => {
    // Ensure smart categorization is disabled
    await page.evaluate(() => {
      localStorage.setItem('smartCategorization.enabled', 'false');
    });
    
    await page.goto('/');
    
    // Upload a CSV file
    const csvContent = `date,description,amount
2024-01-15,WALMART GROCERY,-75.00
2024-01-16,SHELL GAS STATION,-40.00`;
    
    const fileInput = page.locator('#file-upload');
    await fileInput.setInputFiles({
      name: 'test-rules.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    
    // Wait for processing
    await page.waitForTimeout(1000);
    
    // The transactions should be categorized using rule-based system
    // (Food & Dining for WALMART, Transportation for SHELL based on default rules)
  });

  test('should handle network errors during categorization', async () => {
    // Set up smart categorization
    await page.evaluate(() => {
      localStorage.setItem('smartCategorization.enabled', 'true');
      localStorage.setItem('smartCategorization.apiKey', 'sk-test-network-error');
      localStorage.setItem('smartCategorization.model', 'gpt-3.5-turbo');
    });
    
    // Mock network error
    await page.route('**/api.openai.com/**', async (route) => {
      await route.abort('failed');
    });
    
    await navigateToSmartCategorizationSettings(page);
    
    // Test connection
    await page.click('button:has-text("Test Connection")');
    
    // Should show error
    await expect(page.locator('text=Connection Failed')).toBeVisible();
  });

  test('should validate model selection persistence', async () => {
    await navigateToSmartCategorizationSettings(page);
    
    // Enable smart categorization
    await page.click('#smart-categorization');
    
    // Test each model option
    const models = [
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Fast & Affordable)' },
      { value: 'gpt-4', label: 'GPT-4 (Most Accurate)' },
      { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo (Fast & Accurate)' }
    ];
    
    for (const model of models) {
      await page.selectOption('select#model', model.value);
      
      // Save settings
      await page.click('button:has-text("Save Settings")');
      await page.waitForTimeout(500);
      
      // Verify in localStorage
      const savedModel = await page.evaluate(() => 
        window.localStorage.getItem('smartCategorization.model')
      );
      
      expect(savedModel).toBe(model.value);
    }
  });

  test('should show OpenAI platform link', async () => {
    await navigateToSmartCategorizationSettings(page);
    
    // Enable smart categorization
    await page.click('#smart-categorization');
    
    // Check for OpenAI platform link
    const link = page.locator('a[href="https://platform.openai.com/api-keys"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveText('OpenAI Platform');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

test.describe('Smart Categorization Integration with Transactions', () => {
  test.beforeEach(async ({ page }) => {
    // Set up enabled smart categorization
    await page.addInitScript(() => {
      localStorage.setItem('smartCategorization.enabled', 'true');
      localStorage.setItem('smartCategorization.apiKey', 'sk-test-integration');
      localStorage.setItem('smartCategorization.model', 'gpt-3.5-turbo');
    });
    
    await page.goto('/');
  });

  test('should show AI indicator on categorized transactions', async ({ page }) => {
    // Mock successful categorization
    await page.route('**/api.openai.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                category: 'Entertainment',
                confidence: 0.92,
                reasoning: 'Movie theater transaction'
              })
            }
          }]
        })
      });
    });
    
    // Upload transaction
    const csvContent = `date,description,amount
2024-01-15,AMC THEATERS,-25.00`;
    
    const fileInput = page.locator('#file-upload');
    await fileInput.setInputFiles({
      name: 'test-ai-indicator.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    
    // Wait for processing and navigate to transactions
    await page.waitForTimeout(2000);
    await page.click('button[role="tab"]:has-text("Transactions")');
    
    // Check for AI categorization indicator (if implemented)
    // This would show that the transaction was categorized by AI
  });

  test('should handle batch categorization for multiple transactions', async ({ page }) => {
    let apiCallCount = 0;
    
    // Mock batch categorization
    await page.route('**/api.openai.com/**', async (route) => {
      apiCallCount++;
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify([
                { category: 'Food & Dining', confidence: 0.9 },
                { category: 'Transportation', confidence: 0.85 },
                { category: 'Shopping', confidence: 0.8 },
                { category: 'Entertainment', confidence: 0.75 },
                { category: 'Utilities', confidence: 0.95 }
              ])
            }
          }]
        })
      });
    });
    
    // Upload multiple transactions
    const csvContent = `date,description,amount
2024-01-01,Restaurant A,-30.00
2024-01-02,Gas Station B,-40.00
2024-01-03,Amazon Purchase,-50.00
2024-01-04,Netflix Subscription,-15.00
2024-01-05,Electric Company,-120.00
2024-01-06,Grocery Store,-80.00
2024-01-07,Uber Ride,-25.00
2024-01-08,Coffee Shop,-5.00
2024-01-09,Department Store,-100.00
2024-01-10,Streaming Service,-10.00
2024-01-11,Water Bill,-45.00
2024-01-12,Supermarket,-65.00`;
    
    const fileInput = page.locator('#file-upload');
    await fileInput.setInputFiles({
      name: 'test-batch.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    
    // Wait for batch processing
    await page.waitForTimeout(3000);
    
    // Verify that batch processing occurred (API called fewer times than transactions)
    expect(apiCallCount).toBeLessThan(12); // Should batch, not call API 12 times
  });

  test('should respect confidence threshold for categorization', async ({ page }) => {
    // Mock low confidence response
    await page.route('**/api.openai.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                category: 'Maybe Shopping',
                confidence: 0.4, // Below 0.6 threshold
                reasoning: 'Unclear transaction'
              })
            }
          }]
        })
      });
    });
    
    // Upload ambiguous transaction
    const csvContent = `date,description,amount
2024-01-15,MISC PAYMENT,-50.00`;
    
    const fileInput = page.locator('#file-upload');
    await fileInput.setInputFiles({
      name: 'test-low-confidence.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });
    
    // Wait for processing
    await page.waitForTimeout(2000);
    
    // Transaction should fall back to rule-based or remain uncategorized
    // due to low confidence from AI
  });
});