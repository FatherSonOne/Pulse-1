# Testing Guide for Pulse Messaging Enhancement

Comprehensive testing documentation for the Pulse messaging platform with AI features.

## Table of Contents

- [Overview](#overview)
- [Test Infrastructure](#test-infrastructure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Coverage Requirements](#coverage-requirements)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Pulse testing suite consists of:

1. **Unit Tests** - Test individual components, services, and hooks
2. **Integration Tests** - Test feature interactions and data flow
3. **E2E Tests** - Test complete user journeys with Playwright
4. **Visual Regression Tests** - Ensure UI consistency

### Testing Stack

- **Vitest** - Fast unit test runner with Jest-compatible API
- **Testing Library** - User-centric component testing utilities
- **Playwright** - Cross-browser E2E testing
- **MSW** - Mock Service Worker for API mocking

---

## Test Infrastructure

### Directory Structure

```
f:/pulse1/
├── src/
│   ├── __tests__/
│   │   ├── components/          # Component unit tests
│   │   │   ├── MessageInput.test.tsx
│   │   │   ├── AIComposer.test.tsx
│   │   │   └── ToneAnalyzer.test.tsx
│   │   ├── services/            # Service layer tests
│   │   │   ├── brainstormService.test.ts
│   │   │   └── messageEnhancementsService.test.ts
│   │   ├── hooks/               # Custom hook tests
│   │   │   └── useMessageEnhancements.test.ts
│   │   └── integration/         # Integration tests
│   │       ├── message-sending.test.tsx
│   │       └── ai-features.test.tsx
│   ├── test/
│   │   ├── setup.ts             # Global test configuration
│   │   ├── mocks/
│   │   │   ├── handlers.ts      # MSW request handlers
│   │   │   └── server.ts        # MSW server setup
│   │   ├── utils/
│   │   │   └── testUtils.tsx    # Reusable test utilities
│   │   └── fixtures/
│   │       ├── mockMessages.json
│   │       └── mockAIResponses.json
├── e2e/
│   ├── messaging.spec.ts        # E2E messaging tests
│   ├── ai-features.spec.ts      # E2E AI features tests
│   ├── tools-panel.spec.ts      # E2E tools panel tests
│   ├── fixtures/
│   │   └── test-data.ts         # E2E test data
│   └── screenshots/             # Test screenshots
└── playwright.config.ts         # Playwright configuration
```

### Test Setup Files

#### `src/test/setup.ts`
Global configuration and mocks for all tests. Includes:
- Testing Library setup
- Environment variable mocking
- MSW server initialization
- Browser API mocks (matchMedia, ResizeObserver, etc.)

#### `src/test/mocks/handlers.ts`
MSW request handlers for:
- Supabase API endpoints
- AI providers (OpenAI, Anthropic, Google)
- Brainstorm service endpoints
- Message enhancement endpoints

#### `src/test/utils/testUtils.tsx`
Reusable utilities:
- `renderWithProviders()` - Render components with routing
- Mock data factories (`createMockMessage`, `createMockIdea`, etc.)
- Async helpers (`waitForAsync`, `flushPromises`)
- Storage mocks (`createStorageMock`)
- Fetch mocks (`mockFetchSuccess`, `mockFetchError`)

---

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- src/__tests__/components/MessageInput.test.tsx

# Run tests with coverage
npm run test:coverage

# Run tests matching pattern
npm test -- --grep "MessageInput"
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in UI mode (interactive)
npm run test:e2e:ui

# Run E2E tests in debug mode
npm run test:e2e:debug

# Run specific E2E test file
npx playwright test e2e/messaging.spec.ts

# Run E2E tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Show test report
npm run test:e2e:report
```

### Test Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/index.html  # macOS
start coverage/index.html  # Windows
xdg-open coverage/index.html  # Linux
```

---

## Writing Tests

### Unit Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../../test/utils/testUtils';
import { MyComponent } from '@/src/components/MyComponent';

describe('MyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render correctly', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    const mockHandler = vi.fn();

    renderWithProviders(<MyComponent onAction={mockHandler} />);

    await user.click(screen.getByRole('button'));
    expect(mockHandler).toHaveBeenCalled();
  });
});
```

### Integration Test Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '../../test/utils/testUtils';

describe('Feature Integration', () => {
  it('should complete full user flow', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FeatureView />);

    // Step 1: User action
    await user.type(screen.getByRole('textbox'), 'Test input');

    // Step 2: System response
    await waitFor(() => {
      expect(screen.getByText(/result/i)).toBeInTheDocument();
    });

    // Step 3: Verification
    expect(screen.getByTestId('success-indicator')).toBeVisible();
  });
});
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Login and setup
  });

  test('should complete user journey', async ({ page }) => {
    // Navigate
    await page.click('[data-testid="nav-button"]');

    // Interact
    await page.fill('[data-testid="input"]', 'Test');
    await page.click('[data-testid="submit"]');

    // Verify
    await expect(page.locator('text=Success')).toBeVisible();

    // Screenshot
    await page.screenshot({ path: 'e2e/screenshots/feature.png' });
  });
});
```

### Service Test Template

```typescript
import { describe, it, expect, vi } from 'vitest';
import { myService } from '@/src/services/myService';

describe('MyService', () => {
  it('should process data correctly', async () => {
    const input = { test: 'data' };
    const result = await myService.process(input);

    expect(result).toHaveProperty('processed', true);
    expect(result.value).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    await expect(myService.process(null)).rejects.toThrow();
  });
});
```

### Hook Test Template

```typescript
import { renderHook, waitFor, act } from '@testing-library/react';
import { useMyHook } from '@/src/hooks/useMyHook';

describe('useMyHook', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useMyHook());

    expect(result.current.value).toBe(null);
    expect(result.current.loading).toBe(false);
  });

  it('should update state on action', async () => {
    const { result } = renderHook(() => useMyHook());

    act(() => {
      result.current.performAction();
    });

    await waitFor(() => {
      expect(result.current.value).not.toBe(null);
    });
  });
});
```

---

## Coverage Requirements

### Target Coverage

- **Services**: 80% minimum
- **Components**: 70% minimum
- **Hooks**: 75% minimum
- **Integration**: Critical paths covered
- **Overall**: 70% minimum

### Coverage Report

After running `npm run test:coverage`, view the report:

```
Coverage Summary:
┌─────────────┬────────┬──────┬────────┬───────┐
│ File        │ % Stmts│ % Branch│ % Funcs│ % Lines│
├─────────────┼────────┼──────┼────────┼───────┤
│ All files   │   75.2 │  68.4│   72.1 │  75.8 │
│ services/   │   82.5 │  75.3│   80.2 │  83.1 │
│ components/ │   71.8 │  65.2│   68.9 │  72.4 │
│ hooks/      │   76.4 │  70.1│   74.3 │  77.2 │
└─────────────┴────────┴──────┴────────┴───────┘
```

### Coverage Enforcement

Coverage thresholds are enforced in CI. If coverage drops below minimum:

1. Build will fail
2. PR cannot be merged
3. Review coverage report: `coverage/index.html`
4. Add tests for uncovered code

---

## CI/CD Integration

### GitHub Actions Workflows

#### Test Workflow (`.github/workflows/test.yml`)

Runs on every push and PR:

1. **Unit Tests**
   - Runs on Node 18.x and 20.x
   - Executes linting and type checking
   - Runs unit tests with coverage
   - Uploads coverage to Codecov
   - Enforces coverage thresholds

2. **E2E Tests**
   - Installs Playwright browsers
   - Builds application
   - Runs E2E tests
   - Uploads test reports and screenshots

3. **Performance Tests**
   - Analyzes bundle size
   - Checks bundle size limits
   - Reports bundle size in PR

#### Visual Regression Workflow (`.github/workflows/visual-regression.yml`)

Runs on main branch and PRs:

1. Takes screenshots of key pages
2. Compares with baseline
3. Reports visual differences
4. Updates baseline on main branch

### CI Requirements

For PR to be merged:

- ✅ All unit tests must pass
- ✅ All E2E tests must pass
- ✅ Coverage thresholds must be met
- ✅ No type errors
- ✅ Bundle size within limits
- ✅ No visual regressions (if enabled)

---

## Best Practices

### 1. Test Naming

```typescript
// Good
it('should send message when user clicks Send button')
it('should show error message when API fails')

// Bad
it('test 1')
it('works')
```

### 2. Test Organization

```typescript
describe('MessageInput', () => {
  describe('Rendering', () => {
    // Rendering tests
  });

  describe('User Interactions', () => {
    // Interaction tests
  });

  describe('Error Handling', () => {
    // Error tests
  });
});
```

### 3. Mock Appropriately

```typescript
// Mock external dependencies
vi.mock('@/src/services/api', () => ({
  fetchData: vi.fn(),
}));

// Don't mock what you're testing
// BAD: vi.mock('@/src/components/MyComponent')
```

### 4. Clean Up After Tests

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up side effects
  localStorage.clear();
});
```

### 5. Use Test IDs

```tsx
// Component
<button data-testid="send-button">Send</button>

// Test
const button = screen.getByTestId('send-button');
```

---

## Troubleshooting

### Common Issues

#### Tests Timeout

```bash
# Increase timeout
npm test -- --timeout=10000

# Or in test file
it('slow test', async () => {
  // ...
}, { timeout: 10000 });
```

#### Flaky Tests

```typescript
// Use waitFor for async operations
await waitFor(() => {
  expect(screen.getByText('Result')).toBeInTheDocument();
}, { timeout: 5000 });

// Avoid fixed timeouts
// BAD: await sleep(1000);
// GOOD: await waitFor(() => ...)
```

#### E2E Tests Failing Locally

```bash
# Update Playwright browsers
npx playwright install --with-deps

# Clear cache
npx playwright clear-cache

# Run in debug mode
npm run test:e2e:debug
```

#### Coverage Not Updating

```bash
# Clear coverage cache
rm -rf coverage/

# Regenerate coverage
npm run test:coverage
```

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)

---

## Contact

For testing questions or issues:
- Create GitHub issue with label `testing`
- Tag @qa-team in Slack
- Review test failures in CI logs

**Happy Testing! 🧪**
