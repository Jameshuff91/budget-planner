# Visual Regression Tests

This directory contains visual regression tests for the Budget Planner application using Playwright's screenshot comparison features.

## Quick Start

```bash
# Run all visual tests
npm run test:visual

# Update baseline screenshots
npm run test:visual:update

# Run specific test suite
npm run test:visual:charts
npm run test:visual:dashboard
npm run test:visual:mobile

# View test report
npm run test:visual:report
```

## Test Structure

### Test Files

- **`charts.spec.ts`** - Tests for all chart components
  - SpendingByCategory (default, with budget, hover states)
  - SpendingTrend
  - SpendingOverview
  - YearOverYearComparison
  - SpendingVelocity
  - Loading and empty states

- **`dashboard.spec.ts`** - Tests for dashboard layout and interactions
  - Full layout with data
  - Header and navigation
  - Month selector
  - Transaction list
  - Modals and dialogs
  - Loading and error states

- **`mobile-views.spec.ts`** - Tests for responsive design
  - Mobile views (375px)
  - Tablet views (768px)
  - Responsive breakpoints (320px to 2560px)
  - Touch interactions
  - Landscape orientations

- **`theme-tests.spec.ts`** - Tests for theme variations
  - Light/dark mode
  - High contrast
  - Reduced motion
  - Print styles

### Helper Functions

The `helpers.ts` file provides utilities for:

- Waiting for charts to render
- Uploading sample data
- Clearing database
- Hiding dynamic elements
- Taking stable screenshots

## Configuration

Visual tests use `playwright.visual.config.ts` with:

- Separate test results directory
- Visual comparison thresholds
- Multiple viewport configurations
- Animation handling

## Baseline Management

### Updating Baselines

When UI changes are intentional:

```bash
# Update all baselines
npm run test:visual:update

# Update specific test
npx playwright test charts.spec.ts --config=playwright.visual.config.ts --update-snapshots
```

### Baseline Storage

Baselines are stored in `__screenshots__/` organized by:

- Browser (chromium, firefox, webkit)
- Viewport (desktop, tablet, mobile)
- Test name

## CI/CD Integration

The `.github/workflows/visual-tests.yml` workflow:

- Runs tests on pull requests
- Generates diff reports on failures
- Allows manual baseline updates
- Uploads artifacts for review

## Best Practices

1. **Consistent Test Data**: Always use `sample-transactions.csv`
2. **Wait for Stability**: Use helper functions to ensure rendering
3. **Mock Dynamic Content**: Mock dates, API calls, etc.
4. **Use data-testid**: Rely on testids rather than DOM structure
5. **Review Diffs Carefully**: Check if changes are intentional

## Debugging Failed Tests

### Local Debugging

```bash
# Run with UI mode
npx playwright test --config=playwright.visual.config.ts --ui

# Run headed
npx playwright test --config=playwright.visual.config.ts --headed

# Debug specific test
npx playwright test --config=playwright.visual.config.ts --debug
```

### Common Issues

1. **Font Loading**: Ensure `document.fonts.ready` is awaited
2. **Animations**: Check that animations are disabled
3. **Dynamic Content**: Mock time-based or random content
4. **Platform Differences**: Account for OS-specific rendering

## Adding New Tests

1. Create test in appropriate spec file
2. Use helpers for common operations
3. Run test to generate baseline
4. Review baseline for correctness
5. Commit baseline to git

Example:

```typescript
test('New component visual test', async ({ page }) => {
  await uploadSampleTransactions(page);
  await waitForChartsToRender(page);

  const component = await page.locator('[data-testid="new-component"]');
  await expect(component).toHaveScreenshot('new-component-default.png');
});
```

## Maintenance

- Review baselines monthly
- Update after design system changes
- Remove obsolete screenshots
- Monitor test execution time
- Keep helper functions up to date
