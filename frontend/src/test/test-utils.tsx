/**
 * Custom Testing Utilities
 * 
 * Provides helpers for rendering components with necessary providers
 */

import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create a new QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string
}

/**
 * Render component with all necessary providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { initialRoute = '/', ...renderOptions } = options || {}

  // Set initial route
  window.history.pushState({}, 'Test page', initialRoute)

  const queryClient = createTestQueryClient()

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}

/**
 * Mock authenticated user in localStorage
 */
export function mockAuthUser(token: string = 'mock-token', user?: any) {
  const defaultUser = {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
    department: 'Finance',
  }

  localStorage.setItem('token', token)
  localStorage.setItem(
    'auth-storage',
    JSON.stringify({
      state: {
        token,
        user: user || defaultUser,
      },
      version: 0,
    })
  )
}

/**
 * Clear auth from localStorage
 */
export function clearAuth() {
  localStorage.removeItem('token')
  localStorage.removeItem('auth-storage')
}

/**
 * Wait for async operations
 */
export const waitFor = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

// Re-export everything from React Testing Library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'

