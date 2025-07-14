# Visual Testing Guide

This guide explains how to use and maintain visual regression tests for the Budget Planner application.

## Overview

Visual regression testing ensures that UI components render consistently across different browsers, viewports, and states. We use Playwright's built-in screenshot comparison features to detect unintended visual changes.

## Configuration

Visual tests use a separate configuration file: `playwright.visual.config.ts`

Key settings:

- **maxDiffPixels**: 100 - Maximum allowed pixel differences
- **threshold**: 0.2 - Pixel difference tolerance (0-1)
- **animations**: 'disabled' - Ensures consistent screenshots
- **deviceScaleFactor**: 1 - Consistent rendering across devices

## Running Visual Tests

### Run all visual tests

```bash
npx playwright test --config=playwright.visual.config.ts
```

### Run specific test suite

```bash
# Charts only
npx playwright test charts.spec.ts --config=playwright.visual.config.ts

# Dashboard only
npx playwright test dashboard.spec.ts --config=playwright.visual.config.ts

# Mobile views only
npx playwright test mobile-views.spec.ts --config=playwright.visual.config.ts
```

### Run for specific viewport

```bash
# Desktop only
npx playwright test --config=playwright.visual.config.ts --project=chromium-desktop

# Mobile only
npx playwright test --config=playwright.visual.config.ts --project=chromium-mobile

# Tablet only
npx playwright test --config=playwright.visual.config.ts --project=chromium-tablet
```

### Update baseline screenshots

```bash
npx playwright test --config=playwright.visual.config.ts --update-snapshots
```

### Update specific test's screenshots

```bash
npx playwright test charts.spec.ts --config=playwright.visual.config.ts --update-snapshots
```

## Test Structure

### 1. Chart Visual Tests (`charts.spec.ts`)

Tests individual chart components:

- SpendingByCategory (default, with budget, hover state)
- SpendingTrend
- SpendingOverview
- YearOverYearComparison
- SpendingVelocity
- Loading states
- Empty states

### 2. Dashboard Visual Tests (`dashboard.spec.ts`)

Tests overall dashboard layout and interactions:

- Full dashboard layout
- Header and navigation
- Month selector
- Transaction list
- Settings modal
- Export dialog
- Loading and error states
- Scroll positions

### 3. Mobile View Tests (`mobile-views.spec.ts`)

Tests responsive design on mobile and tablet:

- Mobile dashboard (375px)
- Mobile navigation menu
- Touch interactions
- Landscape orientation
- Tablet layouts (768px)
- Responsive breakpoints (320px to 2560px)

## Baseline Screenshots

Baseline screenshots are stored in:

- `e2e/visual-regression/__screenshots__/`

Directory structure:

```
__screenshots__/
├── chromium-desktop/
├── firefox-desktop/
├── webkit-desktop/
├── chromium-tablet/
├── chromium-mobile/
└── webkit-mobile/
```

## Viewing Test Results

### HTML Report

```bash
npx playwright show-report playwright-report/visual
```

### JSON Results

Located at: `test-results/visual/results.json`

## Best Practices

### 1. Consistent Test Data

Always use the same sample data for visual tests:

```typescript
await fileInput.setInputFiles('./sample-transactions.csv');
```

### 2. Wait for Stability

Ensure elements are fully rendered:

```typescript
await waitForChartRender(page);
await page.waitForTimeout(1000);
await page.evaluate(() => document.fonts.ready);
```

### 3. Isolate Components

Use data-testid attributes for reliable selection:

```typescript
await page.locator('[data-testid="spending-by-category"]');
```

### 4. Handle Dynamic Content

- Disable animations
- Mock dates/times if needed
- Use consistent viewport sizes

### 5. Meaningful Names

Use descriptive screenshot names:

```typescript
await expect(chart).toHaveScreenshot('spending-by-category-with-budget.png');
```

## Handling Failures

### 1. Review Differences

When tests fail, check the diff images:

- Actual: What the test captured
- Expected: The baseline screenshot
- Diff: Highlighted differences

### 2. Determine if Change is Intentional

- **Intentional changes**: Update baselines with `--update-snapshots`
- **Bugs**: Fix the regression and re-run tests

### 3. Common Issues

- **Font loading**: Ensure `document.fonts.ready` is awaited
- **Animations**: Check that animations are disabled
- **Dynamic data**: Mock or use consistent test data
- **Flaky hover states**: Add wait times after hover

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run visual tests
  run: npx playwright test --config=playwright.visual.config.ts

- name: Upload visual test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: visual-test-results
    path: |
      playwright-report/visual/
      test-results/visual/
```

## Maintenance

### Regular Tasks

1. **Review baselines monthly**: Ensure they reflect current design
2. **Update after design changes**: Run with `--update-snapshots`
3. **Clean up obsolete screenshots**: Remove unused baseline images
4. **Monitor test performance**: Visual tests can be slow

### Adding New Visual Tests

1. Add test to appropriate spec file
2. Run test to generate initial screenshot
3. Review screenshot for correctness
4. Commit baseline to version control

### Debugging Visual Tests

```bash
# Run with headed browser
npx playwright test --config=playwright.visual.config.ts --headed

# Debug specific test
npx playwright test --config=playwright.visual.config.ts --debug

# Slow down execution
npx playwright test --config=playwright.visual.config.ts --slow-mo=1000
```

## Platform-Specific Considerations

### macOS

- Ensure consistent font rendering
- Account for Retina displays

### Windows

- Check ClearType settings
- Verify font antialiasing

### Linux (CI)

- Install required fonts
- Use headless mode

## Troubleshooting

### "Screenshot comparison failed"

1. Check if UI actually changed
2. Review threshold settings
3. Update baselines if needed

### "Timeout waiting for selector"

1. Increase timeout in config
2. Check if element exists
3. Verify test data loaded

### "Different screenshot sizes"

1. Ensure consistent viewport
2. Check responsive breakpoints
3. Verify full page vs. element screenshot

## Resources

- [Playwright Screenshots](https://playwright.dev/docs/screenshots)
- [Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [CI Configuration](https://playwright.dev/docs/ci)
