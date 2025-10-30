import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import api from '../lib/api'

interface TemplateModalProps {
  onClose: () => void
  onSuccess: () => void
  template?: Template
}

interface Template {
  id: number
  name: string
  description?: string
  close_type: 'monthly' | 'quarterly' | 'year_end'
  department?: string
  default_owner_id?: number
  days_offset: number
  estimated_hours?: number
  is_active: boolean
  sort_order: number
  default_account_numbers?: string[]
}

interface TemplateForm {
  name: string
  description?: string
  close_type: 'monthly' | 'quarterly' | 'year_end'
  department?: string
  default_owner_id?: number | ''
  days_offset: number
  estimated_hours?: number | ''
  is_active: boolean
  sort_order: number
  default_account_numbers_text: string
}

export default function TemplateModal({ onClose, onSuccess, template }: TemplateModalProps) {
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TemplateForm>({
    defaultValues: {
      name: template?.name ?? '',
      description: template?.description ?? '',
      close_type: template?.close_type ?? 'monthly',
      department: template?.department ?? '',
      default_owner_id: template?.default_owner_id ?? '',
      days_offset: template?.days_offset ?? 0,
      estimated_hours: template?.estimated_hours ?? '',
      is_active: template?.is_active ?? true,
      sort_order: template?.sort_order ?? 0,
      default_account_numbers_text: template?.default_account_numbers?.join(', ') ?? '',
    },
  })

  useEffect(() => {
    reset({
      name: template?.name ?? '',
      description: template?.description ?? '',
      close_type: template?.close_type ?? 'monthly',
      department: template?.department ?? '',
      default_owner_id: template?.default_owner_id ?? '',
      days_offset: template?.days_offset ?? 0,
      estimated_hours: template?.estimated_hours ?? '',
      is_active: template?.is_active ?? true,
      sort_order: template?.sort_order ?? 0,
      default_account_numbers_text: template?.default_account_numbers?.join(', ') ?? '',
    })
  }, [template, reset])

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/api/users/')
      return response.data as Array<{ id: number; name: string }>
    },
  })

  const mutation = useMutation({
    mutationFn: async (payload: TemplateForm) => {
      const { default_account_numbers_text, ...rest } = payload

      const defaultOwner =
        rest.default_owner_id === '' || rest.default_owner_id === undefined
          ? null
          : Number(rest.default_owner_id)

      const estimatedHours =
        rest.estimated_hours === '' || rest.estimated_hours === undefined
          ? null
          : Number(rest.estimated_hours)

      const accountNumbers = default_account_numbers_text
        ? default_account_numbers_text
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
        : []

      const body = {
        ...rest,
        default_owner_id: defaultOwner,
        estimated_hours: Number.isNaN(estimatedHours as number) ? null : estimatedHours,
        default_account_numbers: accountNumbers,
      }

      if (template) {
        const response = await api.put(`/api/task-templates/${template.id}`, body)
        return response.data
      }

      const response = await api.post('/api/task-templates/', body)
      return response.data
    },
    onSuccess: () => {
      onSuccess()
      onClose()
    },
    onError: (mutationError: any) => {
      setError(mutationError.response?.data?.detail || 'Failed to save template')
    },
  })

  const title = useMemo(() => (template ? 'Edit Template' : 'New Template'), [template])

  const onSubmit = (data: TemplateForm) => {
    setError('')
    mutation.mutate(data)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
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

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Template Name *</label>
              <input
                className="input"
                placeholder="e.g., Bank Reconciliations"
                {...register('name', { required: 'Template name is required' })}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label className="label">Close Type *</label>
              <select className="input" {...register('close_type', { required: 'Close type is required' })}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="year_end">Year End</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Department</label>
              <input className="input" placeholder="e.g., Accounting" {...register('department')} />
            </div>

            <div>
              <label className="label">Default Owner</label>
              <select className="input" {...register('default_owner_id')}>
                <option value="">Unassigned</option>
                {usersQuery.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[100px]"
              placeholder="Outline what this task covers and expected outcome."
              {...register('description')}
            />
          </div>

          <div>
            <label className="label">Default Trial Balance Accounts</label>
            <textarea
              className="input min-h-[80px]"
              placeholder="Comma separated account numbers or keywords (use * for prefixes, e.g., 100*)."
              {...register('default_account_numbers_text')}
            />
            <p className="text-xs text-gray-500 mt-1">
              Tasks created from this template will auto-link to trial balance accounts whose number or name matches.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label">Days Offset</label>
              <input
                type="number"
                className="input"
                {...register('days_offset', { valueAsNumber: true })}
              />
              <p className="text-xs text-gray-500 mt-1">Positive numbers are days after period end; negative for before.</p>
            </div>

            <div>
              <label className="label">Estimated Hours</label>
              <input
                type="number"
                step="0.25"
                className="input"
                {...register('estimated_hours')}
              />
            </div>

            <div>
              <label className="label">Sort Order</label>
              <input
                type="number"
                className="input"
                {...register('sort_order', { valueAsNumber: true })}
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-3">
            <input type="checkbox" {...register('is_active')} />
            <span className="text-sm text-gray-700">Template is active</span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary disabled:opacity-50" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
