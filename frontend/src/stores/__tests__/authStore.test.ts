/**
 * Tests for Auth Store (Zustand)
 * 
 * Tests state management for authentication
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useAuthStore } from '../authStore'

describe('Auth Store', () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset store state
    useAuthStore.setState({ token: null, user: null })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should have initial state with no auth', () => {
    const { token, user } = useAuthStore.getState()
    
    expect(token).toBeNull()
    expect(user).toBeNull()
  })

  it('should set auth token and user', () => {
    const mockToken = 'test-token-123'
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
      department: 'Finance',
    }

    useAuthStore.getState().setAuth(mockToken, mockUser)

    const { token, user } = useAuthStore.getState()
    
    expect(token).toBe(mockToken)
    expect(user).toEqual(mockUser)
    expect(localStorage.getItem('token')).toBe(mockToken)
  })

  it('should persist auth state to localStorage', () => {
    const mockToken = 'test-token-456'
    const mockUser = {
      id: 2,
      email: 'user@example.com',
      name: 'Another User',
      role: 'preparer',
    }

    useAuthStore.getState().setAuth(mockToken, mockUser)

    // Check localStorage
    const stored = localStorage.getItem('auth-storage')
    expect(stored).toBeTruthy()
    
    if (stored) {
      const parsed = JSON.parse(stored)
      expect(parsed.state.token).toBe(mockToken)
      expect(parsed.state.user).toEqual(mockUser)
    }
  })

  it('should logout and clear auth', () => {
    // Set up auth first
    useAuthStore.getState().setAuth('token', {
      id: 1,
      email: 'test@example.com',
      name: 'Test',
      role: 'admin',
    })

    // Logout
    useAuthStore.getState().logout()

    const { token, user } = useAuthStore.getState()
    
    expect(token).toBeNull()
    expect(user).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('should clear localStorage on logout', () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'test' } }))

    useAuthStore.getState().logout()

    expect(localStorage.getItem('token')).toBeNull()
  })
})

