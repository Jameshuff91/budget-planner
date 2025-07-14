# Integration Tests

This directory contains integration tests that verify the complete functionality of complex systems within the budget planner application.

## Categorization Pipeline Tests

The `categorization-pipeline.test.ts` file contains comprehensive tests for the transaction categorization system, which follows this priority order:

1. **Custom Rules** (highest priority) - User-defined rules based on patterns
2. **AI Categorization** - OpenAI-powered smart categorization (when enabled)
3. **Built-in Rules** - Fallback categorization

### Test Coverage

#### Rule Priority System
- Tests that rules are applied in priority order (highest priority wins)
- Verifies disabled rules are skipped
- Tests all match types: contains, startsWith, endsWith, regex
- Handles invalid regex patterns gracefully

#### AI Categorization
- Tests categorization with configurable confidence thresholds (0.6 minimum)
- Handles API errors and network issues gracefully
- Respects enabled/disabled settings
- Validates API key requirements
- Tests fallback behavior when confidence is too low

#### Batch Processing
- Tests batch categorization of multiple transactions
- Verifies proper batching (10 transactions per batch)
- Handles partial batch failures
- Maintains correct transaction-to-result mapping

#### Performance
- Validates categorization of 1000 transactions completes in under 100ms
- Tests with large rule sets (100+ rules)
- Handles very long transaction descriptions

#### Edge Cases
- Empty or null values
- Special characters in patterns
- Malformed API responses
- Zero and extreme transaction amounts
- Various transaction description formats

#### Error Handling
- API rate limiting (429 errors)
- Network timeouts
- Invalid API keys (401 errors)
- Malformed JSON responses

### Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test file
npm test -- __tests__/integration/categorization-pipeline.test.ts

# Run in watch mode
npm run test:watch -- __tests__/integration/
```

### Mock Strategy

The tests use the following mocking approach:
- `localStorage` is mocked globally for settings storage
- `fetch` is mocked to simulate OpenAI API responses
- Logger is mocked to prevent console output during tests
- All external dependencies are isolated

### Adding New Integration Tests

When adding new integration tests:
1. Create a new file in this directory
2. Mock all external dependencies
3. Test the complete flow from input to output
4. Include error scenarios and edge cases
5. Ensure tests are isolated and can run independently