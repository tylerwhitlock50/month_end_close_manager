import { useEffect, useState } from 'react'
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

type TemplateDraft = {
  department: string
  default_owner_id: number | null
  days_offset: number | ''
  estimated_hours: number | ''
  is_active: boolean
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
  const [quickEditMode, setQuickEditMode] = useState(false)
  const [drafts, setDrafts] = useState<Record<number, TemplateDraft>>({})
  const [savingId, setSavingId] = useState<number | null>(null)

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

  const updateMutation = useMutation({
    mutationFn: async ({
      templateId,
      payload,
    }: {
      templateId: number
      payload: Record<string, unknown>
    }) => {
      await api.put(`/api/task-templates/${templateId}`, payload)
    },
    onSuccess: () => {
      templatesQuery.refetch()
    },
    onSettled: () => {
      setSavingId(null)
    },
  })

  const ownerName = (ownerId?: number) => {
    if (!ownerId) return '—'
    return usersQuery.data?.find((user) => user.id === ownerId)?.name || '—'
  }

  const initializeDrafts = (templates: Template[]) => {
    const initialDrafts: Record<number, TemplateDraft> = {}
    templates.forEach((template) => {
      initialDrafts[template.id] = {
        department: template.department ?? '',
        default_owner_id: template.default_owner_id ?? null,
        days_offset: template.days_offset,
        estimated_hours: template.estimated_hours ?? '',
        is_active: template.is_active,
      }
    })
    setDrafts(initialDrafts)
  }

  useEffect(() => {
    if (!quickEditMode) {
      setDrafts({})
      return
    }
    if (templatesQuery.data) {
      initializeDrafts(templatesQuery.data)
    }
  }, [quickEditMode, templatesQuery.data])

  const handleDraftChange = <K extends keyof TemplateDraft>(
    templateId: number,
    field: K,
    value: TemplateDraft[K]
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [templateId]: {
        ...(prev[templateId] ?? {
          department: '',
          default_owner_id: null,
          days_offset: 0,
          estimated_hours: '',
          is_active: true,
        }),
        [field]: value,
      },
    }))
  }

  const handleQuickSave = (template: Template) => {
    const draft = drafts[template.id]
    if (!draft) {
      return
    }

    const payload: Record<string, unknown> = {}

    const draftDepartment = draft.department.trim()
    const originalDepartment = template.department ?? ''
    if (draftDepartment !== originalDepartment) {
      payload.department = draftDepartment || null
    }

    const draftOwner = draft.default_owner_id ?? null
    const originalOwner = template.default_owner_id ?? null
    if (draftOwner !== originalOwner) {
      payload.default_owner_id = draftOwner
    }

    const draftDays = draft.days_offset === '' ? 0 : draft.days_offset
    if (draftDays !== template.days_offset) {
      payload.days_offset = draftDays
    }

    const draftHours = draft.estimated_hours === '' ? null : draft.estimated_hours
    const originalHours = template.estimated_hours ?? null
    if (draftHours !== originalHours) {
      payload.estimated_hours = draftHours
    }

    if (draft.is_active !== template.is_active) {
      payload.is_active = draft.is_active
    }

    if (Object.keys(payload).length === 0) {
      return
    }

    setSavingId(template.id)
    updateMutation.mutate({ templateId: template.id, payload })
  }

  const handleQuickReset = (template: Template) => {
    handleDraftChange(template.id, 'department', template.department ?? '')
    handleDraftChange(template.id, 'default_owner_id', template.default_owner_id ?? null)
    handleDraftChange(template.id, 'days_offset', template.days_offset)
    handleDraftChange(
      template.id,
      'estimated_hours',
      template.estimated_hours ?? ''
    )
    handleDraftChange(template.id, 'is_active', template.is_active)
  }

  const ownerOptions = usersQuery.data ?? []

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
          <button
            type="button"
            className={`btn-secondary text-sm ${templatesQuery.isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => {
              if (templatesQuery.isLoading) return
              setQuickEditMode((prev) => !prev)
            }}
            disabled={templatesQuery.isLoading}
          >
            {quickEditMode ? 'Exit Quick Update' : 'Quick Update'}
          </button>
        </div>
        {quickEditMode && (
          <div className="px-6 py-3 text-xs text-gray-500 border-b border-gray-200 bg-gray-50">
            Adjust departments, owners, offsets, hours, or active status directly below. Save each template row after making changes.
          </div>
        )}
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{quickEditMode ? 'Quick Actions' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templatesQuery.data.map((template) => {
                const draft = drafts[template.id] ?? {
                  department: template.department ?? '',
                  default_owner_id: template.default_owner_id ?? null,
                  days_offset: template.days_offset,
                  estimated_hours: template.estimated_hours ?? '',
                  is_active: template.is_active,
                }

                const draftDepartment = draft.department ?? ''
                const originalDepartment = template.department ?? ''
                const departmentChanged = draftDepartment.trim() !== originalDepartment

                const draftOwner = draft.default_owner_id ?? null
                const originalOwner = template.default_owner_id ?? null
                const ownerChanged = draftOwner !== originalOwner

                const draftDays = draft.days_offset === '' ? 0 : draft.days_offset
                const daysChanged = draftDays !== template.days_offset

                const draftHoursNormalized = draft.estimated_hours === '' ? null : draft.estimated_hours
                const originalHours = template.estimated_hours ?? null
                const hoursChanged = draftHoursNormalized !== originalHours

                const statusChanged = draft.is_active !== template.is_active

                const isDirty = quickEditMode && (departmentChanged || ownerChanged || daysChanged || hoursChanged || statusChanged)
                const isSaving = savingId === template.id && updateMutation.isPending

                return (
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
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {quickEditMode ? (
                      <input
                        className="input text-sm"
                        value={draftDepartment}
                        onChange={(event) => handleDraftChange(template.id, 'department', event.target.value)}
                        placeholder="e.g., Accounting"
                      />
                    ) : (
                      template.department || '—'
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {quickEditMode ? (
                      <select
                        className="input text-sm"
                        value={draftOwner ?? ''}
                        onChange={(event) =>
                          handleDraftChange(
                            template.id,
                            'default_owner_id',
                            event.target.value ? Number(event.target.value) : null
                          )
                        }
                        disabled={usersQuery.isLoading}
                      >
                        <option value="">Unassigned</option>
                        {ownerOptions.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ownerName(template.default_owner_id)
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">
                    {quickEditMode ? (
                      <input
                        type="number"
                        className="input text-sm text-right"
                        value={draft.days_offset === '' ? '' : draft.days_offset}
                        onChange={(event) =>
                          handleDraftChange(
                            template.id,
                            'days_offset',
                            event.target.value === '' ? '' : Number(event.target.value)
                          )
                        }
                      />
                    ) : (
                      template.days_offset
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">
                    {quickEditMode ? (
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        className="input text-sm text-right"
                        value={draft.estimated_hours === '' ? '' : draft.estimated_hours}
                        onChange={(event) =>
                          handleDraftChange(
                            template.id,
                            'estimated_hours',
                            event.target.value === '' ? '' : Number(event.target.value)
                          )
                        }
                      />
                    ) : template.estimated_hours ? (
                      `${template.estimated_hours}h`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {quickEditMode ? (
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={draft.is_active}
                          onChange={(event) => handleDraftChange(template.id, 'is_active', event.target.checked)}
                        />
                        {draft.is_active ? 'Active' : 'Inactive'}
                      </label>
                    ) : (
                      <span className={`badge ${template.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">
                    {quickEditMode ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => handleQuickReset(template)}
                          disabled={isSaving || !isDirty}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          className="btn-primary text-xs disabled:opacity-50"
                          onClick={() => handleQuickSave(template)}
                          disabled={!isDirty || isSaving}
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <div className="space-x-3">
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
                          onClick={() =>
                            toggleActiveMutation.mutate({ templateId: template.id, is_active: !template.is_active })
                          }
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
                      </div>
                    )}
                  </td>
                </tr>
                )
              })}
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
