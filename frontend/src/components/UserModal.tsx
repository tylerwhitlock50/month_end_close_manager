import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import api from '../lib/api'

interface UserModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface UserForm {
  name: string
  email: string
  password: string
  role: 'admin' | 'reviewer' | 'preparer' | 'viewer'
  department?: string
  phone?: string
  slack_user_id?: string
}

export default function UserModal({ onClose, onSuccess }: UserModalProps) {
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserForm>({
    defaultValues: {
      role: 'preparer',
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: UserForm) => {
      const response = await api.post('/api/users/', payload)
      return response.data
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (mutationError: any) => {
      setError(mutationError.response?.data?.detail || 'Failed to create user')
    },
  })

  const onSubmit = (data: UserForm) => {
    setError('')
    createMutation.mutate(data)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Team Member</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name *</label>
              <input
                className="input"
                placeholder="Jane Doe"
                {...register('name', { required: 'Name is required' })}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label className="label">Email *</label>
              <input
                type="email"
                className="input"
                placeholder="jane@example.com"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">Temporary Password *</label>
            <input
              type="password"
              className="input"
              placeholder="At least 8 characters"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' },
              })}
            />
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Role *</label>
              <select className="input" {...register('role', { required: 'Role is required' })}>
                <option value="admin">Admin</option>
                <option value="reviewer">Reviewer</option>
                <option value="preparer">Preparer</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <div>
              <label className="label">Department</label>
              <input className="input" placeholder="Accounting" {...register('department')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="(555) 123-4567" {...register('phone')} />
            </div>

            <div>
              <label className="label">Slack User ID</label>
              <input className="input" placeholder="U123456" {...register('slack_user_id')} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

