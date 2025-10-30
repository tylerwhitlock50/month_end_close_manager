import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../lib/api'

interface TaskModalProps {
  onClose: () => void
  onSuccess: () => void
  task?: any
}

interface TaskForm {
  name: string
  description: string
  period_id: number
  owner_id: number
  due_date?: string
  department: string
  priority: number
}

export default function TaskModal({ onClose, onSuccess, task }: TaskModalProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<TaskForm>({
    defaultValues: task || {},
  })

  const { data: periods } = useQuery({
    queryKey: ['periods'],
    queryFn: async () => {
      const response = await api.get('/api/periods/')
      return response.data
    },
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/api/users/')
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: TaskForm) => {
      const response = await api.post('/api/tasks/', data)
      return response.data
    },
    onSuccess,
  })

  const onSubmit = (data: TaskForm) => {
    const payload: TaskForm = {
      ...data,
      due_date: data.due_date ? data.due_date : undefined,
    }
    createMutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {task ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="label">Task Name *</label>
            <input
              {...register('name', { required: 'Task name is required' })}
              className="input"
              placeholder="Enter task name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              {...register('description')}
              className="input min-h-[100px]"
              placeholder="Enter task description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Period *</label>
              <select
                {...register('period_id', { required: 'Period is required' })}
                className="input"
              >
                <option value="">Select period</option>
                {periods?.map((period: any) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
              {errors.period_id && (
                <p className="mt-1 text-sm text-red-600">{errors.period_id.message}</p>
              )}
            </div>

            <div>
              <label className="label">Owner *</label>
              <select
                {...register('owner_id', { required: 'Owner is required' })}
                className="input"
              >
                <option value="">Select owner</option>
                {users?.map((user: any) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              {errors.owner_id && (
                <p className="mt-1 text-sm text-red-600">{errors.owner_id.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Due Date</label>
              <input
                type="datetime-local"
                {...register('due_date')}
                className="input"
              />
            </div>

            <div>
              <label className="label">Department</label>
              <input
                {...register('department')}
                className="input"
                placeholder="e.g., Accounting"
              />
            </div>
          </div>

          <div>
            <label className="label">Priority (1-10)</label>
            <input
              type="number"
              {...register('priority', { min: 1, max: 10 })}
              className="input"
              min="1"
              max="10"
              defaultValue="5"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

