import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, Settings2, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import api from '../lib/api'
import TemplateModal from '../components/TemplateModal'

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

interface UserSummary {
  id: number
  name: string
}

function closeTypeLabel(value: string) {
  const map: Record<string, string> = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    year_end: 'Year End',
  }
  return map[value] || value
}

export default function Templates() {
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | undefined>(undefined)

  const templatesQuery = useQuery({
    queryKey: ['task-templates'],
    queryFn: async () => {
      const response = await api.get('/api/task-templates/')
      return response.data as Template[]
    },
  })

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/api/users/')
      return response.data as UserSummary[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (templateId: number) => {
      await api.delete(`/api/task-templates/${templateId}`)
    },
    onSuccess: () => {
      templatesQuery.refetch()
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async (payload: { templateId: number; is_active: boolean }) => {
      await api.put(`/api/task-templates/${payload.templateId}`, {
        is_active: payload.is_active,
      })
    },
    onSuccess: () => {
      templatesQuery.refetch()
    },
  })

  const ownerName = (ownerId?: number) => {
    if (!ownerId) return '—'
    return usersQuery.data?.find((user) => user.id === ownerId)?.name || '—'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Settings2 className="w-8 h-8 text-primary-600" /> Task Templates
          </h1>
          <p className="text-gray-600 mt-1">Set up your standard close activities so each period starts with the right checklist.</p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => {
            setEditingTemplate(undefined)
            setShowModal(true)
          }}
        >
          <Plus className="w-5 h-5" />
          New Template
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {templatesQuery.data?.length || 0} template(s)
          </p>
        </div>
        {templatesQuery.isLoading ? (
          <div className="py-12 text-center text-gray-600 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading templates...
          </div>
        ) : templatesQuery.data && templatesQuery.data.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Close Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default Owner</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Days Offset</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Estimated Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templatesQuery.data.map((template) => (
                <tr key={template.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{template.name}</div>
                    {template.description && (
                      <div className="text-xs text-gray-500 mt-1">{template.description}</div>
                    )}
                    {template.default_account_numbers && template.default_account_numbers.length > 0 && (
                      <div className="text-xs text-primary-600 mt-1">
                        Default Accounts: {template.default_account_numbers.join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{closeTypeLabel(template.close_type)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{template.department || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{ownerName(template.default_owner_id)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">{template.days_offset}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">
                    {template.estimated_hours ? `${template.estimated_hours}h` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <span className={`badge ${template.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right space-x-3">
                    <button
                      className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800"
                      onClick={() => {
                        setEditingTemplate(template)
                        setShowModal(true)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-800"
                      onClick={() => toggleActiveMutation.mutate({ templateId: template.id, is_active: !template.is_active })}
                    >
                      {template.is_active ? (
                        <ToggleRight className="w-4 h-4" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                      {template.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-800"
                      onClick={() => deleteMutation.mutate(template.id)}
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center text-gray-600">
            Start by adding your recurring close activities so every period is ready to go.
          </div>
        )}
      </div>

      {showModal && (
        <TemplateModal
          template={editingTemplate}
          onClose={() => setShowModal(false)}
          onSuccess={() => templatesQuery.refetch()}
        />
      )}
    </div>
  )
}
