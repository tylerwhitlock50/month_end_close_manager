import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  X,
  CheckCircle2,
  Loader2,
  Trash2,
  Link as LinkIcon,
  Upload,
  Calendar,
  BookmarkPlus,
  Loader,
} from 'lucide-react'
import api from '../lib/api'

interface TaskOption {
  id: number
  name: string
  status: string
}

interface Attachment {
  id: number
  original_filename: string
  file_size: number
  is_external_link: boolean
  external_url?: string
  uploaded_at: string
  description?: string
}

interface AccountSummaryTask {
  id: number
  name: string
  status: string
}

interface Validation {
  id: number
  supporting_amount: number
  difference: number
  matches_balance: boolean
  notes?: string
  evidence_original_filename?: string
  evidence_size?: number
  evidence_mime_type?: string
  evidence_file_date?: string
  evidence_uploaded_at?: string
  evidence_url?: string
  task?: AccountSummaryTask
}

interface TrialBalanceAccountModalProps {
  periodId: number
  account: {
    id: number
    account_number: string
    account_name: string
    account_type?: string
    debit?: number
    credit?: number
    ending_balance?: number
    notes?: string
    is_verified: boolean
    tasks: AccountSummaryTask[]
    attachments: Attachment[]
    validations: Validation[]
  }
  onClose: () => void
  onRefetch: () => void
}

type TaskStatusValue = 'not_started' | 'in_progress' | 'review' | 'complete' | 'blocked'

const TASK_STATUS_OPTIONS: Array<{ value: TaskStatusValue; label: string }> = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Ready for Review' },
  { value: 'complete', label: 'Complete' },
  { value: 'blocked', label: 'Blocked' },
]

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatBytes(size: number) {
  if (!size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let idx = 0
  let value = size
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  return `${value.toFixed(value < 10 && idx > 0 ? 1 : 0)} ${units[idx]}`
}

export default function TrialBalanceAccountModal({ periodId, account, onClose, onRefetch }: TrialBalanceAccountModalProps) {
  const [notes, setNotes] = useState(account.notes ?? '')
  const [isVerified, setIsVerified] = useState(account.is_verified)
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>(account.tasks.map((task) => task.id))
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [linkError, setLinkError] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkDescription, setLinkDescription] = useState('')
  const [linkDate, setLinkDate] = useState('')
  const [fileDescription, setFileDescription] = useState('')
  const [fileDate, setFileDate] = useState('')
  const [validationTaskId, setValidationTaskId] = useState<number | ''>('')
  const [validationAmount, setValidationAmount] = useState<string>(account.ending_balance !== undefined && account.ending_balance !== null ? account.ending_balance.toString() : '')
  const [validationNotes, setValidationNotes] = useState('')
  const [validationFile, setValidationFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState('')
  const [validationFileDate, setValidationFileDate] = useState('')
  const [newTaskName, setNewTaskName] = useState(`${account.account_name} Task`)
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskOwnerId, setNewTaskOwnerId] = useState<number | ''>('')
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<number | ''>('')
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatusValue>('not_started')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<number>(5)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState(`${account.account_name} Task Template`)
  const [templateNameTouched, setTemplateNameTouched] = useState(false)
  const [templateDepartment, setTemplateDepartment] = useState('Accounting')
  const [templateEstimatedHours, setTemplateEstimatedHours] = useState('0.25')
  const [templateAccountNumbers, setTemplateAccountNumbers] = useState(
    account.account_number ? account.account_number : ''
  )
  const [createTaskError, setCreateTaskError] = useState('')

  useEffect(() => {
    setNotes(account.notes ?? '')
    setIsVerified(account.is_verified)
    setSelectedTaskIds(account.tasks.map((task) => task.id))
    setValidationAmount(account.ending_balance !== undefined && account.ending_balance !== null ? account.ending_balance.toString() : '')
    setValidationTaskId('')
    setValidationNotes('')
    setValidationFile(null)
   setValidationError('')
    setValidationFileDate('')
    setNewTaskName(`${account.account_name} Task`)
    setNewTaskDescription('')
    setNewTaskOwnerId('')
    setNewTaskAssigneeId('')
    setNewTaskStatus('not_started')
    setNewTaskDueDate('')
    setNewTaskPriority(5)
    setSaveAsTemplate(false)
    setTemplateName(`${account.account_name} Task Template`)
    setTemplateNameTouched(false)
    setTemplateDepartment('Accounting')
    setTemplateEstimatedHours('0.25')
    setTemplateAccountNumbers(account.account_number ? account.account_number : '')
    setCreateTaskError('')
  }, [account])

  useEffect(() => {
    if (!templateNameTouched) {
      setTemplateName(newTaskName)
    }
  }, [newTaskName, templateNameTouched])

  useEffect(() => {
    if (saveAsTemplate && !templateAccountNumbers && account.account_number) {
      setTemplateAccountNumbers(account.account_number)
    }
    if (!saveAsTemplate) {
      setTemplateNameTouched(false)
    }
  }, [saveAsTemplate, account.account_number, templateAccountNumbers])

  const tasksQuery = useQuery({
    queryKey: ['tasks', periodId],
    enabled: Boolean(periodId),
    queryFn: async () => {
      const response = await api.get('/api/tasks/', {
        params: {
          period_id: periodId,
          limit: 1000,
        },
      })
      return response.data as TaskOption[]
    },
  })

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/api/users/')
      return response.data as Array<{ id: number; name: string }>
    },
  })

  const updateAccountMutation = useMutation({
    mutationFn: async (payload: { notes?: string; is_verified?: boolean }) => {
      const response = await api.patch(`/api/trial-balance/accounts/${account.id}`, payload)
      return response.data
    },
    onSuccess: () => {
      onRefetch()
    },
  })

  const toggleVerificationMutation = useMutation({
    mutationFn: async (payload: { is_verified: boolean; notes?: string }) => {
      const body: Record<string, unknown> = {
        is_verified: payload.is_verified,
      }
      if (payload.notes !== undefined) {
        body.notes = payload.notes
      }
      const response = await api.patch(`/api/trial-balance/accounts/${account.id}`, body)
      return response.data
    },
    onSuccess: () => {
      onRefetch()
    },
    onError: () => {
      setIsVerified((prev) => !prev)
    },
  })

  const updateTasksMutation = useMutation({
    mutationFn: async (taskIds: number[]) => {
      const response = await api.put(`/api/trial-balance/accounts/${account.id}/tasks`, {
        task_ids: taskIds,
      })
      return response.data
    },
    onSuccess: () => {
      onRefetch()
    },
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: number) => {
      await api.delete(`/api/trial-balance/attachments/${attachmentId}`)
    },
    onSuccess: () => {
      onRefetch()
    },
  })

  const createValidationMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await api.post(`/api/trial-balance/accounts/${account.id}/validations`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data
    },
    onSuccess: () => {
      onRefetch()
      setValidationTaskId('')
      setValidationAmount(account.ending_balance !== undefined && account.ending_balance !== null ? account.ending_balance.toString() : '')
      setValidationNotes('')
      setValidationFile(null)
      setValidationError('')
    },
    onError: (error: any) => {
      setValidationError(error.response?.data?.detail || 'Failed to save validation')
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: async (payload: {
      name: string
      description?: string
      owner_id: number
      assignee_id?: number
      status: TaskStatusValue
      due_date?: string
      priority?: number
      department?: string
      save_as_template?: boolean
      template_name?: string
      template_department?: string
      template_estimated_hours?: number
      template_default_account_numbers?: string[]
    }) => {
      const response = await api.post(`/api/trial-balance/accounts/${account.id}/tasks`, payload)
      return response.data as TaskOption
    },
    onSuccess: (createdTask) => {
      setCreateTaskError('')
      setSelectedTaskIds((prev) => Array.from(new Set([...prev, createdTask.id])))
      setNewTaskName(`${account.account_name} Task`)
      setNewTaskDescription('')
      setNewTaskOwnerId('')
      setNewTaskAssigneeId('')
      setNewTaskStatus('not_started')
      setNewTaskDueDate('')
      setNewTaskPriority(5)
      setSaveAsTemplate(false)
      setTemplateName(`${account.account_name} Task Template`)
      setTemplateNameTouched(false)
      setTemplateDepartment('Accounting')
      setTemplateEstimatedHours('0.25')
      setTemplateAccountNumbers(account.account_number ? account.account_number : '')
      onRefetch()
      tasksQuery.refetch()
    },
    onError: (error: any) => {
      setCreateTaskError(error.response?.data?.detail || 'Unable to create task')
    },
  })

  const deleteValidationMutation = useMutation({
    mutationFn: async (validationId: number) => {
      await api.delete(`/api/trial-balance/validations/${validationId}`)
    },
    onSuccess: () => {
      onRefetch()
    },
  })

  const handleSaveNotes = () => {
    updateAccountMutation.mutate({
      notes,
      is_verified: isVerified,
    })
  }

  const handleToggleVerified = () => {
    if (toggleVerificationMutation.isPending) {
      return
    }

    const nextValue = !isVerified
    setIsVerified(nextValue)
    toggleVerificationMutation.mutate({
      is_verified: nextValue,
      notes,
    })
  }

  const handleTasksSave = () => {
    updateTasksMutation.mutate(selectedTaskIds)
  }

  const handleFileUpload = async (file?: File) => {
    if (!file) {
      return
    }

    setUploading(true)
    setUploadError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (fileDescription) {
        formData.append('description', fileDescription)
      }
      if (fileDate) {
        formData.append('file_date', fileDate)
      }

      await api.post(`/api/trial-balance/accounts/${account.id}/attachments/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setFileDescription('')
      setFileDate('')
      onRefetch()
    } catch (error: any) {
      setUploadError(error.response?.data?.detail || 'Failed to upload attachment')
    } finally {
      setUploading(false)
    }
  }

  const handleLinkSubmit = async () => {
    if (!linkUrl.trim()) {
      setLinkError('Provide a valid URL before saving')
      return
    }

    setLinkError('')
    try {
      await api.post(`/api/trial-balance/accounts/${account.id}/attachments/link`, {
        external_url: linkUrl,
        description: linkDescription || undefined,
        file_date: linkDate || undefined,
      })

      setLinkUrl('')
      setLinkDescription('')
      setLinkDate('')
      onRefetch()
    } catch (error: any) {
      setLinkError(error.response?.data?.detail || 'Failed to link attachment')
    }
  }

  const taskOptions = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data])
  const userOptions = useMemo(() => usersQuery.data ?? [], [usersQuery.data])

  const handleValidationSubmit = () => {
    if (!validationAmount || validationAmount.trim() === '') {
      setValidationError('Enter an amount to validate against the trial balance')
      return
    }

    setValidationError('')
    const formData = new FormData()
    formData.append('supporting_amount', validationAmount)
    if (validationNotes) {
      formData.append('notes', validationNotes)
    }
    if (validationTaskId) {
      formData.append('task_id', validationTaskId.toString())
    }
    if (validationFile) {
      formData.append('file', validationFile)
    }
    if (validationFileDate) {
      formData.append('file_date', validationFileDate)
    }

    createValidationMutation.mutate(formData)
  }

  const handleValidationDelete = (validationId: number) => {
    deleteValidationMutation.mutate(validationId)
  }

  const handleCreateTask = () => {
    if (!newTaskName.trim()) {
      setCreateTaskError('Provide a task name before creating it')
      return
    }
    if (newTaskOwnerId === '') {
      setCreateTaskError('Select an owner before creating the task')
      return
    }

    const normalizedTemplateDepartment = templateDepartment.trim() || 'Accounting'
    const estimatedHoursValue = Number(templateEstimatedHours)
    const normalizedEstimatedHours = Number.isNaN(estimatedHoursValue) ? 0.25 : Math.max(0, estimatedHoursValue)
    const normalizedAccountNumbers = templateAccountNumbers
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)

    const payload: {
      name: string
      description?: string
      owner_id: number
      assignee_id?: number
      status: TaskStatusValue
      due_date?: string
      priority?: number
      department?: string
      save_as_template?: boolean
      template_name?: string
      template_department?: string
      template_estimated_hours?: number
      template_default_account_numbers?: string[]
    } = {
      name: newTaskName.trim(),
      owner_id: Number(newTaskOwnerId),
      status: newTaskStatus,
      department: normalizedTemplateDepartment,
    }

    if (newTaskDescription.trim()) {
      payload.description = newTaskDescription.trim()
    }
    if (newTaskAssigneeId !== '') {
      payload.assignee_id = Number(newTaskAssigneeId)
    }
    if (newTaskDueDate) {
      const dateValue = new Date(newTaskDueDate)
      if (!Number.isNaN(dateValue.getTime())) {
        payload.due_date = dateValue.toISOString()
      }
    }
    if (newTaskPriority) {
      payload.priority = newTaskPriority
    }
    if (saveAsTemplate) {
      payload.save_as_template = true
      payload.template_name = (templateName || newTaskName).trim()
      payload.template_department = normalizedTemplateDepartment
      payload.template_estimated_hours = normalizedEstimatedHours
      if (normalizedAccountNumbers.length > 0) {
        payload.template_default_account_numbers = normalizedAccountNumbers
      }
    } else if (!payload.department && account.account_type) {
      payload.department = account.account_type
    }

    setCreateTaskError('')
    createTaskMutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{account.account_name}</h2>
            <p className="text-sm text-gray-500">
              {account.account_number} • {account.account_type || 'Account'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs uppercase text-gray-500">Ending Balance</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{formatCurrency(account.ending_balance)}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs uppercase text-gray-500">Debit</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{formatCurrency(account.debit)}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-xs uppercase text-gray-500">Credit</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{formatCurrency(account.credit)}</p>
            </div>
            <div className={`border border-gray-200 rounded-lg p-4 ${isVerified ? 'bg-green-50 border-green-200' : ''}`}>
              <p className="text-xs uppercase text-gray-500">Verification</p>
              <div className="flex items-center mt-2 gap-2">
                <button
                  type="button"
                  onClick={handleToggleVerified}
                  disabled={toggleVerificationMutation.isPending || updateAccountMutation.isPending}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    isVerified
                      ? 'bg-green-600 text-white border-green-600'
                      : 'border-gray-300 text-gray-700'
                  }`}
                >
                  {toggleVerificationMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {toggleVerificationMutation.isPending
                    ? 'Saving...'
                    : isVerified
                    ? 'Verified'
                    : 'Mark Verified'}
                </button>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
              <button
                type="button"
                className="btn-primary text-sm px-3 py-1"
                onClick={handleSaveNotes}
                disabled={updateAccountMutation.isPending}
              >
                {updateAccountMutation.isPending ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
            <textarea
              className="input min-h-[120px]"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add supporting commentary, reconciliation notes, or next steps."
            />
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Create task from this account</h3>
                <p className="text-xs text-gray-500">Spin up a follow-up task and link it automatically.</p>
              </div>
            </div>

            {createTaskError && <p className="text-xs text-red-600">{createTaskError}</p>}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label className="label">Task name</label>
                <input
                  className="input"
                  value={newTaskName}
                  onChange={(event) => setNewTaskName(event.target.value)}
                  placeholder="e.g., Reconcile cash - January"
                />
              </div>
              <div className="space-y-2">
                <label className="label">Owner</label>
                <select
                  className="input"
                  value={newTaskOwnerId}
                  onChange={(event) => setNewTaskOwnerId(event.target.value ? Number(event.target.value) : '')}
                >
                  <option value="">Select owner</option>
                  {userOptions.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="label">Assignee</label>
                <select
                  className="input"
                  value={newTaskAssigneeId}
                  onChange={(event) => setNewTaskAssigneeId(event.target.value ? Number(event.target.value) : '')}
                >
                  <option value="">Unassigned</option>
                  {userOptions.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="label">Status</label>
                <select
                  className="input"
                  value={newTaskStatus}
                  onChange={(event) => setNewTaskStatus(event.target.value as TaskStatusValue)}
                >
                  {TASK_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="label">Due date</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={newTaskDueDate}
                  onChange={(event) => setNewTaskDueDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="label">Priority</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="input"
                  value={newTaskPriority}
                  onChange={(event) => {
                    const numeric = Number(event.target.value)
                    setNewTaskPriority(Number.isNaN(numeric) ? 5 : numeric)
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="label">Description</label>
              <textarea
                className="input min-h-[80px]"
                value={newTaskDescription}
                onChange={(event) => setNewTaskDescription(event.target.value)}
                placeholder="Provide instructions or context for the assignee"
              />
            </div>

            <div className="space-y-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={saveAsTemplate}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setSaveAsTemplate(checked)
                    if (checked) {
                      setTemplateNameTouched(false)
                    }
                  }}
                />
                Save as template for future periods
              </label>
              {saveAsTemplate && (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <label className="label text-sm">Template name</label>
                    <input
                      className="input text-sm"
                      value={templateName}
                      onChange={(event) => {
                        setTemplateName(event.target.value)
                        setTemplateNameTouched(true)
                      }}
                      placeholder="Template name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="label text-sm">Estimated hours</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      className="input text-sm"
                      value={templateEstimatedHours}
                      onChange={(event) => setTemplateEstimatedHours(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="label text-sm">Department</label>
                    <input
                      className="input text-sm"
                      value={templateDepartment}
                      onChange={(event) => setTemplateDepartment(event.target.value)}
                      placeholder="e.g., Accounting"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <label className="label text-sm">Account tags</label>
                    <input
                      className="input text-sm"
                      value={templateAccountNumbers}
                      onChange={(event) => setTemplateAccountNumbers(event.target.value)}
                      placeholder="Comma-separated account numbers or keywords"
                    />
                    <p className="text-xs text-gray-500">
                      Defaults to this account number so new tasks auto-link to the right balance.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">New task will be linked automatically to this account.</span>
              <button
                type="button"
                className={clsx(
                  'btn-primary text-sm flex items-center gap-2',
                  createTaskMutation.isPending && 'opacity-80 cursor-wait'
                )}
                onClick={handleCreateTask}
                disabled={createTaskMutation.isPending}
              >
                {createTaskMutation.isPending ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" /> Creating…
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="h-4 w-4" /> Create & link task
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Linked Tasks</h3>
                <p className="text-xs text-gray-500">Map supporting close tasks to this account.</p>
              </div>
              <button
                type="button"
                className="btn-secondary text-sm px-3 py-1"
                onClick={handleTasksSave}
                disabled={updateTasksMutation.isPending}
              >
                {updateTasksMutation.isPending ? 'Saving...' : 'Update Links'}
              </button>
            </div>
            {tasksQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading tasks...
              </div>
            ) : (
              <select
                multiple
                value={selectedTaskIds.map(String)}
                onChange={(event) => {
                  const options = Array.from(event.target.selectedOptions)
                  setSelectedTaskIds(options.map((option) => Number(option.value)))
                }}
                className="input min-h-[160px]"
              >
                {taskOptions.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.name} ({task.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Validation Checks</h3>
                <p className="text-xs text-gray-500">
                  Record supporting amounts from reconciliations and confirm they match the trial balance balance.
                </p>
              </div>
            </div>

            {account.validations.length > 0 ? (
              <div className="border border-gray-200 rounded-lg divide-y">
                {account.validations.map((validation) => (
                  <div key={validation.id} className="px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className={`badge ${validation.matches_balance ? 'badge-green' : 'badge-red'}`}>
                          {validation.matches_balance ? 'Matches' : 'Mismatch'}
                        </span>
                        <p className="text-sm text-gray-700">
                          Supporting amount {formatCurrency(validation.supporting_amount)}
                          {' '}• Difference{' '}
                          <span className={validation.matches_balance ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {formatCurrency(validation.difference)}
                          </span>
                        </p>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {validation.task ? `Task: ${validation.task.name} (${validation.task.status})` : 'No task linked'}
                      </div>
                      {validation.notes && (
                        <p className="text-xs text-gray-600 mt-1">{validation.notes}</p>
                      )}
                      <div className="text-xs text-gray-500 mt-1 space-x-3">
                        {validation.evidence_original_filename && (
                          <span>
                            Evidence: {validation.evidence_original_filename}
                            {validation.evidence_size ? ` (${formatBytes(validation.evidence_size)})` : ''}
                          </span>
                        )}
                        {validation.evidence_url && (
                          <a
                            href={validation.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:underline"
                          >
                            Open support
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-800 text-sm flex items-center gap-1"
                      onClick={() => handleValidationDelete(validation.id)}
                      disabled={deleteValidationMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No validation checks recorded yet.</p>
            )}

            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Add Validation</h4>
              {validationError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                  {validationError}
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-1">
                  <label className="label text-xs">Link Task</label>
                  <select
                    className="input"
                    value={validationTaskId}
                    onChange={(event) => setValidationTaskId(event.target.value ? Number(event.target.value) : '')}
                  >
                    <option value="">Select task (optional)</option>
                    {taskOptions.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.name} ({task.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="label text-xs">Supporting Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={validationAmount}
                    onChange={(event) => setValidationAmount(event.target.value)}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="label text-xs">Notes</label>
                  <input
                    type="text"
                    className="input"
                    value={validationNotes}
                    onChange={(event) => setValidationNotes(event.target.value)}
                    placeholder="e.g., AR aging as of month end"
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3 mt-3">
                <div className="md:col-span-1">
                  <label className="label text-xs">Supporting File</label>
                  <input
                    type="file"
                    accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      setValidationFile(file)
                      if (event.target.value) {
                        event.target.value = ''
                      }
                    }}
                    className="w-full text-xs"
                  />
                  {validationFile && (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-500">Selected: {validationFile.name}</p>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:text-red-800"
                        onClick={() => setValidationFile(null)}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
                <div className="md:col-span-1">
                  <label className="label text-xs">Supporting Date</label>
                  <input
                    type="date"
                    className="input"
                    value={validationFileDate}
                    onChange={(event) => setValidationFileDate(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-4">
                <button
                  type="button"
                  className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
                  onClick={handleValidationSubmit}
                  disabled={createValidationMutation.isPending}
                >
                  {createValidationMutation.isPending ? 'Saving...' : 'Save Validation'}
                </button>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Attachments</h3>
              <p className="text-xs text-gray-500">
                Upload reconciliations, support schedules, or link to shared documents.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="border border-dashed border-gray-300 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Upload supporting file
                </h4>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".pdf,.csv,.xlsx,.xls,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        handleFileUpload(file)
                        event.target.value = ''
                      }
                    }}
                    className="w-full text-sm"
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="Description (optional)"
                    value={fileDescription}
                    onChange={(event) => setFileDescription(event.target.value)}
                  />
                  <input
                    type="date"
                    className="input"
                    value={fileDate}
                    onChange={(event) => setFileDate(event.target.value)}
                  />
                  {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
                  {uploading && (
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                    </p>
                  )}
                </div>
              </div>

              <div className="border border-dashed border-gray-300 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" /> Link external evidence
                </h4>
                <div className="space-y-2">
                  <input
                    type="url"
                    className="input"
                    placeholder="https://..."
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="Description (optional)"
                    value={linkDescription}
                    onChange={(event) => setLinkDescription(event.target.value)}
                  />
                  <input
                    type="date"
                    className="input"
                    value={linkDate}
                    onChange={(event) => setLinkDate(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    onClick={handleLinkSubmit}
                  >
                    Save Link
                  </button>
                  {linkError && <p className="text-xs text-red-600">{linkError}</p>}
                </div>
              </div>
            </div>

            {account.attachments.length > 0 ? (
              <div className="border border-gray-200 rounded-lg divide-y">
                {account.attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {attachment.original_filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatBytes(attachment.file_size)} • Uploaded {new Date(attachment.uploaded_at).toLocaleString()}
                      </p>
                      {attachment.description && (
                        <p className="text-xs text-gray-500">{attachment.description}</p>
                      )}
                      {attachment.is_external_link && attachment.external_url && (
                        <a
                          href={attachment.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 hover:underline"
                        >
                          Open link
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-800"
                      onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No supporting documents yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
