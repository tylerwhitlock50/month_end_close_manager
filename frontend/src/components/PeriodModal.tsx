import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import api from '../lib/api'

interface PeriodModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface PeriodForm {
  name: string
  month: number
  year: number
  close_type: 'monthly' | 'quarterly' | 'year_end'
  target_close_date?: string
}

export default function PeriodModal({ onClose, onSuccess }: PeriodModalProps) {
  const [error, setError] = useState('')
  const [includeTemplates, setIncludeTemplates] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PeriodForm>({
    defaultValues: {
      close_type: 'monthly',
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: { data: PeriodForm; includeTemplates: boolean }) => {
      const response = await api.post('/api/periods/', payload.data, {
        params: {
          roll_forward_tasks: payload.includeTemplates,
        },
      })
      return response.data
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (mutationError: any) => {
      setError(mutationError.response?.data?.detail || 'Failed to create period')
    },
  })

  const onSubmit = (data: PeriodForm) => {
    setError('')
    createMutation.mutate({
      data: {
        ...data,
        month: Number(data.month),
        year: Number(data.year),
      },
      includeTemplates,
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Period</h2>
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

          <div>
            <label className="label">Period Name *</label>
            <input
              className="input"
              placeholder="e.g., September 2025"
              {...register('name', { required: 'Period name is required' })}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Month *</label>
              <input
                type="number"
                className="input"
                min={1}
                max={12}
                {...register('month', {
                  required: 'Month is required',
                  min: { value: 1, message: 'Month must be between 1 and 12' },
                  max: { value: 12, message: 'Month must be between 1 and 12' },
                })}
              />
              {errors.month && <p className="mt-1 text-sm text-red-600">{errors.month.message}</p>}
            </div>

            <div>
              <label className="label">Year *</label>
              <input
                type="number"
                className="input"
                min={2020}
                {...register('year', {
                  required: 'Year is required',
                  min: { value: 2020, message: 'Year must be 2020 or later' },
                })}
              />
              {errors.year && <p className="mt-1 text-sm text-red-600">{errors.year.message}</p>}
            </div>
          </div>

          <div>
            <label className="label">Close Type *</label>
            <select
              className="input"
              {...register('close_type', { required: 'Close type is required' })}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="year_end">Year End</option>
            </select>
            {errors.close_type && (
              <p className="mt-1 text-sm text-red-600">{errors.close_type.message}</p>
            )}
          </div>

          <div>
            <label className="label">Target Close Date</label>
            <input type="date" className="input" {...register('target_close_date')} />
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-gray-50 border border-gray-200 p-4">
            <input
              id="include-templates"
              type="checkbox"
              className="mt-1"
              checked={includeTemplates}
              onChange={(event) => setIncludeTemplates(event.target.checked)}
            />
            <div>
              <label htmlFor="include-templates" className="text-sm font-medium text-gray-900">
                Generate tasks from templates
              </label>
              <p className="text-xs text-gray-600 mt-1">
                When enabled, any active templates matching the close type will create starter tasks for this period.
              </p>
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
              {createMutation.isPending ? 'Creating...' : 'Create Period'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
