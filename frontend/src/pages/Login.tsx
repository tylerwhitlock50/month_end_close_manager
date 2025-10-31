import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { LogIn } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import api from '../lib/api'

interface LoginForm {
  username: string
  password: string
}

export default function Login() {
  const { setAuth } = useAuthStore()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    setError('')

    try {
      // Login
      const formData = new FormData()
      formData.append('username', data.username)
      formData.append('password', data.password)

      const response = await api.post('/api/auth/login', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      const { access_token } = response.data

      // Get user info
      const userResponse = await api.get('/api/users/me', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      })

      setAuth(access_token, userResponse.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
              <LogIn className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Month-End Close Manager</h1>
            <p className="text-gray-600 mt-2">Sign in to your account</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="label" htmlFor="login-email">Email</label>
              <input
                type="email"
                id="login-email"
                {...register('username', { 
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
                className="input"
                placeholder="you@example.com"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="login-password">Password</label>
              <input
                type="password"
                id="login-password"
                {...register('password', { required: 'Password is required' })}
                className="input"
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 font-medium mb-2">Demo Credentials:</p>
            <p className="text-xs text-gray-600">Email: admin@monthend.com</p>
            <p className="text-xs text-gray-600">Password: admin123</p>
          </div>
        </div>
      </div>
    </div>
  )
}

