

# Frontend Testing Guide

## Overview

This guide explains the comprehensive testing setup for the React + TypeScript frontend, including unit tests, integration tests, and API request verification.

## Table of Contents

- [Testing Stack](#testing-stack)
- [Running Tests](#running-tests)
- [Test Types](#test-types)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

---

## Testing Stack

### Core Libraries

- **Vitest** - Fast unit test framework (Vite-native alternative to Jest)
- **React Testing Library** - Component testing utilities
- **@testing-library/user-event** - User interaction simulation
- **@testing-library/jest-dom** - Custom matchers for assertions
- **MSW (Mock Service Worker)** - API mocking
- **jsdom** - DOM implementation for Node.js

### Why These Tools?

- **Vitest**: Faster than Jest, better Vite integration, similar API
- **React Testing Library**: Encourages testing from user's perspective
- **MSW**: Intercepts API calls at network level (more realistic than axios-mock-adapter)

---

## Running Tests

### Installation

First, install the testing dependencies:

```bash
cd frontend
npm install
```

### Basic Commands

```bash
# Run tests in watch mode (recommended for development)
npm test

# Run tests once and exit
npm run test:run

# Run tests with UI (browser-based test viewer)
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Docker Commands

```bash
# Run tests in Docker container
docker-compose exec frontend npm test

# Run once with coverage
docker-compose exec frontend npm run test:coverage
```

### Specific Test Execution

```bash
# Run specific test file
npm test -- src/lib/__tests__/api.test.ts

# Run tests matching a pattern
npm test -- login

# Run tests in a directory
npm test -- src/pages/__tests__

# Run with verbose output
npm test -- --reporter=verbose
```

---

## Test Types

### 1. Unit Tests

Test individual functions, hooks, or utilities in isolation.

**Example**: Testing API functions

```typescript
// src/lib/__tests__/api.test.ts
import { describe, it, expect } from 'vitest'
import { fetchPeriodFiles } from '../api'

describe('fetchPeriodFiles', () => {
  it('should return period files structure', async () => {
    const result = await fetchPeriodFiles(1)
    
    expect(result).toHaveProperty('period')
    expect(result).toHaveProperty('period_files')
    expect(result).toHaveProperty('task_files')
  })
})
```

### 2. Store Tests

Test Zustand stores for state management.

**Example**: Testing auth store

```typescript
// src/stores/__tests__/authStore.test.ts
import { describe, it, expect } from 'vitest'
import { useAuthStore } from '../authStore'

describe('Auth Store', () => {
  it('should set auth token and user', () => {
    const mockToken = 'test-token'
    const mockUser = { id: 1, email: 'test@example.com', name: 'Test', role: 'admin' }

    useAuthStore.getState().setAuth(mockToken, mockUser)

    const { token, user } = useAuthStore.getState()
    expect(token).toBe(mockToken)
    expect(user).toEqual(mockUser)
  })
})
```

### 3. Component Tests

Test React components with user interactions.

**Example**: Testing Login component

```typescript
// src/pages/__tests__/Login.test.tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders, userEvent } from '../../test/test-utils'
import Login from '../Login'

describe('Login Component', () => {
  it('should render login form', () => {
    renderWithProviders(<Login />)
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('should submit form on button click', async () => {
    renderWithProviders(<Login />)
    const user = userEvent.setup()
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    // Assert expected behavior
  })
})
```

### 4. API Integration Tests

Verify API calls use correct HTTP methods and data formats.

**Example**: Verifying request types

```typescript
import { server } from '../../test/mocks/server'
import { http, HttpResponse } from 'msw'

it('should use POST with FormData for login', async () => {
  let requestMethod = ''
  let contentType = ''
  
  server.use(
    http.post('http://localhost:8000/api/auth/login', async ({ request }) => {
      requestMethod = request.method
      contentType = request.headers.get('content-type') || ''
      return HttpResponse.json({ access_token: 'token', token_type: 'bearer' })
    })
  )

  // Trigger login
  // ...

  expect(requestMethod).toBe('POST')
  expect(contentType).toContain('multipart/form-data')
})
```

---

## Writing Tests

### Test File Structure

```
src/
├── components/
│   ├── TaskBoard.tsx
│   └── __tests__/
│       └── TaskBoard.test.tsx
├── pages/
│   ├── Login.tsx
│   └── __tests__/
│       └── Login.test.tsx
├── stores/
│   ├── authStore.ts
│   └── __tests__/
│       └── authStore.test.ts
└── lib/
    ├── api.ts
    └── __tests__/
        └── api.test.ts
```

### Test Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, userEvent } from '../../test/test-utils'
import ComponentName from '../ComponentName'

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
  })

  describe('Rendering', () => {
    it('should render component', () => {
      renderWithProviders(<ComponentName />)
      // Assertions
    })
  })

  describe('User Interactions', () => {
    it('should handle button click', async () => {
      renderWithProviders(<ComponentName />)
      const user = userEvent.setup()
      
      await user.click(screen.getByRole('button'))
      // Assertions
    })
  })

  describe('API Integration', () => {
    it('should make correct API call', async () => {
      // Mock API response
      // Render component
      // Verify request
    })
  })
})
```

---

## Best Practices

### 1. Use Accessible Queries

Prefer queries that reflect how users interact:

```typescript
// ✅ Good - Query by accessible role/label
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/email/i)
screen.getByText(/welcome/i)

// ❌ Bad - Query by implementation details
screen.getByTestId('submit-button')
screen.getByClassName('email-input')
```

### 2. Test User Behavior, Not Implementation

```typescript
// ✅ Good - Tests what user sees and does
it('should show error message on invalid login', async () => {
  renderWithProviders(<Login />)
  const user = userEvent.setup()
  
  await user.type(screen.getByLabelText(/email/i), 'invalid')
  await user.click(screen.getByRole('button', { name: /sign in/i }))
  
  expect(await screen.findByText(/invalid email/i)).toBeInTheDocument()
})

// ❌ Bad - Tests implementation details
it('should set error state', () => {
  const { rerender } = render(<Login />)
  expect(component.state.error).toBe(null)
  // Don't test internal state directly
})
```

### 3. Use Test Utilities

Always use `renderWithProviders` instead of plain `render`:

```typescript
// ✅ Good - Includes all necessary providers
import { renderWithProviders } from '../../test/test-utils'
renderWithProviders(<Component />)

// ❌ Bad - Missing providers (Router, QueryClient, etc.)
import { render } from '@testing-library/react'
render(<Component />)
```

### 4. Clean Up After Tests

```typescript
import { beforeEach, afterEach } from 'vitest'
import { clearAuth } from '../../test/test-utils'

beforeEach(() => {
  // Setup
  clearAuth()
  localStorage.clear()
})

afterEach(() => {
  // Cleanup happens automatically via setup.ts
  // But you can add custom cleanup here
})
```

### 5. Mock API Responses with MSW

```typescript
import { server } from '../../test/mocks/server'
import { http, HttpResponse } from 'msw'

it('should handle API error', async () => {
  // Override default handler for this test
  server.use(
    http.get('http://localhost:8000/api/tasks/', () => {
      return HttpResponse.json(
        { detail: 'Server error' },
        { status: 500 }
      )
    })
  )

  // Test error handling
})
```

---

## Common Patterns

### Testing Forms

```typescript
it('should submit form with valid data', async () => {
  renderWithProviders(<TaskModal />)
  const user = userEvent.setup()
  
  await user.type(screen.getByLabelText(/task name/i), 'New Task')
  await user.selectOptions(screen.getByLabelText(/priority/i), '5')
  await user.click(screen.getByRole('button', { name: /save/i }))
  
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

### Testing Async Data Loading

```typescript
it('should load and display tasks', async () => {
  renderWithProviders(<Tasks />)
  
  // Initially shows loading
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
  
  // Wait for data to load
  const taskElement = await screen.findByText(/bank reconciliation/i)
  expect(taskElement).toBeInTheDocument()
})
```

### Testing Modal Interactions

```typescript
it('should open and close modal', async () => {
  renderWithProviders(<TaskBoard />)
  const user = userEvent.setup()
  
  // Open modal
  await user.click(screen.getByRole('button', { name: /new task/i }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  
  // Close modal
  await user.click(screen.getByRole('button', { name: /cancel/i }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
```

### Testing File Uploads

```typescript
it('should upload file', async () => {
  renderWithProviders(<FileUploadModal taskId={1} />)
  const user = userEvent.setup()
  
  const file = new File(['test'], 'test.pdf', { type: 'application/pdf' })
  const input = screen.getByLabelText(/upload file/i)
  
  await user.upload(input, file)
  await user.click(screen.getByRole('button', { name: /upload/i }))
  
  await waitFor(() => {
    expect(screen.getByText(/uploaded successfully/i)).toBeInTheDocument()
  })
})
```

### Testing API Request Types

```typescript
it('should use PUT request for updates', async () => {
  let requestMethod = ''
  
  server.use(
    http.put('http://localhost:8000/api/tasks/:id', async ({ request }) => {
      requestMethod = request.method
      return HttpResponse.json({ id: 1, name: 'Updated' })
    })
  )

  // Trigger update action
  // ...

  await waitFor(() => {
    expect(requestMethod).toBe('PUT')
  })
})
```

---

## Troubleshooting

### Tests Fail with "Cannot find module"

```bash
# Install dependencies
npm install

# Clear cache
rm -rf node_modules/.vite
npm test
```

### MSW Handlers Not Working

```typescript
// Make sure server is set up in setup.ts
import { server } from './mocks/server'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Tests Timeout

```typescript
// Increase timeout for slow operations
it('should load data', async () => {
  // ...
  await waitFor(() => {
    expect(screen.getByText(/data/i)).toBeInTheDocument()
  }, { timeout: 5000 })
})
```

### localStorage Not Persisting

```typescript
// Clear localStorage between tests
beforeEach(() => {
  localStorage.clear()
})
```

### React Router Errors

```typescript
// Use renderWithProviders which includes BrowserRouter
import { renderWithProviders } from '../../test/test-utils'

// Set initial route if needed
renderWithProviders(<Component />, { initialRoute: '/tasks' })
```

---

## Coverage Reports

### Generate Coverage

```bash
npm run test:coverage
```

### View Coverage

Coverage reports are generated in `coverage/` directory:

- **Terminal**: Shows coverage summary
- **HTML**: Open `coverage/index.html` in browser for detailed view

### Coverage Goals

- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

### What to Test

✅ **Do Test**:
- User interactions (clicks, form inputs)
- API integration (correct HTTP methods)
- Error handling and edge cases
- Conditional rendering
- Form validation

❌ **Don't Test**:
- Third-party libraries
- CSS styling details
- Exact DOM structure
- Internal React implementation

---

## Examples by Component Type

### Testing a Page Component

```typescript
// src/pages/__tests__/Dashboard.test.tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import Dashboard from '../Dashboard'

describe('Dashboard Page', () => {
  it('should display dashboard statistics', async () => {
    renderWithProviders(<Dashboard />)
    
    expect(await screen.findByText(/total tasks/i)).toBeInTheDocument()
    expect(await screen.findByText(/completion/i)).toBeInTheDocument()
  })

  it('should filter by period', async () => {
    renderWithProviders(<Dashboard />)
    const user = userEvent.setup()
    
    await user.selectOptions(screen.getByLabelText(/period/i), '1')
    
    // Verify filtered data appears
  })
})
```

### Testing a Form Component

```typescript
// src/components/__tests__/TaskModal.test.tsx
describe('TaskModal', () => {
  it('should validate required fields', async () => {
    renderWithProviders(<TaskModal onClose={() => {}} />)
    const user = userEvent.setup()
    
    await user.click(screen.getByRole('button', { name: /save/i }))
    
    expect(await screen.findByText(/task name is required/i)).toBeInTheDocument()
  })

  it('should submit form with all fields', async () => {
    const onSave = vi.fn()
    renderWithProviders(<TaskModal onClose={() => {}} onSave={onSave} />)
    const user = userEvent.setup()
    
    await user.type(screen.getByLabelText(/task name/i), 'New Task')
    await user.type(screen.getByLabelText(/description/i), 'Task description')
    await user.selectOptions(screen.getByLabelText(/owner/i), '1')
    await user.click(screen.getByRole('button', { name: /save/i }))
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Task',
          description: 'Task description',
        })
      )
    })
  })
})
```

---

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [MSW Documentation](https://mswjs.io/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## Summary

Your frontend now has:
- ✅ Vitest configuration for fast testing
- ✅ React Testing Library for component tests
- ✅ MSW for realistic API mocking
- ✅ Test utilities for common scenarios
- ✅ Example tests for API, stores, and components
- ✅ Coverage reporting
- ✅ Request type verification

**Run tests with**: `npm test`  
**View coverage**: `npm run test:coverage`  
**Test specific files**: `npm test -- login`

