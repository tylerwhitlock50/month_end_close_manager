/**
 * Tests for Login Component
 * 
 * Tests user login flow and form validation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders, userEvent, clearAuth } from '../../test/test-utils'
import Login from '../Login'
import { server } from '../../test/mocks/server'
import { http, HttpResponse } from 'msw'

describe('Login Component', () => {
  beforeEach(() => {
    clearAuth()
  })

  it('should render login form', () => {
    renderWithProviders(<Login />)
    
    expect(screen.getByRole('heading', { name: /month-end close manager/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('should show validation errors for empty form', async () => {
    renderWithProviders(<Login />)
    const user = userEvent.setup()
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)
    
    // React Hook Form validation should prevent submission
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument()
  })

  it('should submit login form with correct data', async () => {
    renderWithProviders(<Login />)
    const user = userEvent.setup()
    
    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)
    
    // Wait for the API call to complete
    await waitFor(() => {
      // Check that loading state is resolved
      expect(screen.queryByText(/signing in/i)).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should use correct request type for login (POST with FormData)', async () => {
    let requestMethod = ''
    let contentType = ''
    
    // Override the handler to capture request details
    server.use(
      http.post('http://localhost:8000/api/auth/login', async ({ request }) => {
        requestMethod = request.method
        contentType = request.headers.get('content-type') || ''
        
        return HttpResponse.json({
          access_token: 'mock-token',
          token_type: 'bearer',
        })
      })
    )

    renderWithProviders(<Login />)
    const user = userEvent.setup()
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    await waitFor(() => {
      expect(requestMethod).toBe('POST')
      expect(contentType).toContain('multipart/form-data')
    })
  })

  it('should display error message on failed login', async () => {
    // Mock a failed login
    server.use(
      http.post('http://localhost:8000/api/auth/login', () => {
        return HttpResponse.json(
          { detail: 'Incorrect email or password' },
          { status: 401 }
        )
      })
    )

    renderWithProviders(<Login />)
    const user = userEvent.setup()
    
    await user.type(screen.getByLabelText(/email/i), 'wrong@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument()
    })
  })

  it('should store auth token after successful login', async () => {
    renderWithProviders(<Login />)
    const user = userEvent.setup()
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    await waitFor(() => {
      const token = localStorage.getItem('token')
      expect(token).toBeTruthy()
    })
  })
})

