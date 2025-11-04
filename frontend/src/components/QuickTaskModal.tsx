import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Plus } from 'lucide-react'
import api from '../lib/api'

interface QuickTaskModalProps {
  onClose: () => void
  onSuccess: () => void
  periodId: number
  accountId: number
  accountNumber: string
  accountName: string
}

export default function QuickTaskModal({
  onClose,
  onSuccess,
  periodId,
  accountId,
  accountNumber,
  accountName,
}: QuickTaskModalProps) {
  const queryClient = useQueryClient()
  const [taskName, setTaskName] = useState('')
  const [ownerId, setOwnerId] = useState<number | ''>('')
  const [templateId, setTemplateId] = useState<number | ''>('')
  const [error, setError] = useState('')

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/api/users/')
      return response.data as Array<{ id: number; name: string }>
    },
  })

  const { data: templates } = useQuery({
    queryKey: ['task-templates'],
    queryFn: async () => {
      const response = await api.get('/api/task-templates/')
      return response.data as Array<{
        id: number
        name: string
        department?: string
        default_owner_id?: number
      }>
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: async (payload: {
      name: string
      owner_id: number
      status?: string
    }) => {
      // Use the trial balance account endpoint that creates and links the task in one go
      const response = await api.post(`/api/trial-balance/accounts/${accountId}/tasks`, payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['trial-balance', periodId] })
      onSuccess()
      onClose()
    },
    onError: (mutationError: any) => {
      setError(
        mutationError.response?.data?.detail || 'Failed to create task. Please try again.'
      )
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!taskName.trim()) {
      setError('Task name is required')
      return
    }

    if (!ownerId) {
      setError('Please select an owner')
      return
    }

    createTaskMutation.mutate({
      name: taskName.trim(),
      owner_id: ownerId as number,
      status: 'not_started',
    })
  }

  const handleTemplateSelect = (selectedTemplateId: number) => {
    setTemplateId(selectedTemplateId)
    const template = templates?.find((t) => t.id === selectedTemplateId)
    if (template) {
      setTaskName(template.name)
      if (template.default_owner_id) {
        setOwnerId(template.default_owner_id)
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Quick Create Task</h2>
            <p className="text-sm text-gray-600 mt-1">
              For {accountNumber} - {accountName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="label">Use Template (Optional)</label>
            <select
              className="input"
              value={templateId}
              onChange={(e) =>
                e.target.value ? handleTemplateSelect(Number(e.target.value)) : setTemplateId('')
              }
            >
              <option value="">Create from scratch</option>
              {templates?.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} {template.department ? `(${template.department})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Task Name *</label>
            <input
              type="text"
              className="input"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g., Review bank reconciliation"
              required
            />
          </div>

          <div>
            <label className="label">Owner *</label>
            <select
              className="input"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value ? Number(e.target.value) : '')}
              required
            >
              <option value="">Select owner</option>
              {users?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={createTaskMutation.isPending}
            >
              {createTaskMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

