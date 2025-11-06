import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Paperclip,
  Loader2,
  Download,
  CheckCircle2,
  MessageSquare,
  History,
  AlertTriangle,
  GitBranch,
  GitMerge,
  Calendar,
  ArrowRight,
  UserCheck,
  Trash2,
} from 'lucide-react'
import api, { API_URL } from '../lib/api'
import { formatDate, formatDateTime, getStatusLabel, getStatusColor } from '../lib/utils'
import FilePreviewModal from './FilePreviewModal'
import TaskTimeline from './TaskTimeline'

interface TaskDetailModalProps {
  taskId: number
  onClose: () => void
  onUpdated: () => void
}

interface DependencySummary {
  id: number
  name: string
  status: string
  due_date?: string
}

interface TaskResponse {
  id: number
  name: string
  description?: string
  notes?: string
  status: string
  due_date?: string
  owner_id: number
  assignee_id?: number
  priority?: number
  period?: { id: number; name: string }
  owner?: { id: number; name: string }
  assignee?: { id: number; name: string }
  dependency_details?: DependencySummary[]
  dependent_details?: DependencySummary[]
}

interface TaskFile {
  id: number
  task_id: number
  filename: string
  original_filename: string
  file_size: number
  mime_type?: string
  uploaded_at: string
  description?: string
  file_date?: string
}

interface TaskUpdateForm {
  description?: string
  notes?: string
  status: string
  assignee_id?: number | ''
  due_date?: string
  priority?: number
}

interface PriorTaskFile {
  id: number
  filename: string
  original_filename: string
  file_size: number
  mime_type?: string
  uploaded_at: string
  uploaded_by?: { id: number; name: string }
}

interface PriorTaskComment {
  id: number
  content: string
  created_at: string
  user?: { id: number; name: string }
}

interface PriorTaskSnapshot {
  task_id: number
  period_id: number
  period_name: string
  name: string
  status: string
  due_date?: string
  files: PriorTaskFile[]
  comments: PriorTaskComment[]
}

interface Approval {
  id: number
  task_id: number
  reviewer_id: number
  status: string
  notes?: string
  requested_at: string
  reviewed_at?: string
  reviewer?: { id: number; name: string }
}

const STATUS_OPTIONS = [
  { id: 'not_started', label: 'Not Started' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Ready for Review' },
  { id: 'complete', label: 'Complete' },
  { id: 'blocked', label: 'Blocked' },
]

function formatInputDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (n: number) => n.toString().padStart(2, '0')
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const min = pad(date.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function buildFileUrl(taskId: number, fileName: string, fileId?: number) {
  const base = api.defaults.baseURL || API_URL
  if (fileId) {
    return `${base.replace(/\/$/, '')}/api/files/download/${fileId}?inline=0`
  }
  return `${base.replace(/\/$/, '')}/files/${taskId}/${fileName}`
}

export default function TaskDetailModal({ taskId, onClose, onUpdated }: TaskDetailModalProps) {
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [supportFileDate, setSupportFileDate] = useState('')
  const [supportDescription, setSupportDescription] = useState('')
  const [commentContent, setCommentContent] = useState('')
  const [commentInternal, setCommentInternal] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [previewFile, setPreviewFile] = useState<TaskFile | null>(null)
  const [showApprovalModal, setShowApprovalModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedReviewerId, setSelectedReviewerId] = useState<number | ''>('')

  const { data: taskData, isLoading: taskLoading, refetch: refetchTask } = useQuery<TaskResponse>({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const response = await api.get(`/api/tasks/${taskId}`)
      return response.data
    },
  })

  const { data: files, refetch: refetchFiles } = useQuery<TaskFile[]>({
    queryKey: ['task-files', taskId],
    queryFn: async () => {
      const response = await api.get(`/api/files/task/${taskId}`)
      return response.data
    },
  })

  const { data: priorTask } = useQuery<PriorTaskSnapshot | null>({
    queryKey: ['task-prior', taskId],
    enabled: Boolean(taskId),
    queryFn: async () => {
      try {
        const response = await api.get(`/api/tasks/${taskId}/prior`)
        return response.data as PriorTaskSnapshot
      } catch (error: any) {
        if (error.response?.status === 404) {
          return null
        }
        throw error
      }
    },
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/api/users/')
      return response.data as Array<{ id: number; name: string }>
    },
  })

  const { data: approvals, refetch: refetchApprovals } = useQuery<Approval[]>({
    queryKey: ['task-approvals', taskId],
    queryFn: async () => {
      const response = await api.get(`/api/approvals/task/${taskId}`)
      return response.data
    },
  })

  const { register, handleSubmit, reset, watch } = useForm<TaskUpdateForm>()

  useEffect(() => {
    if (taskData) {
      reset({
        description: taskData.description || '',
        notes: taskData.notes || '',
        status: taskData.status,
        assignee_id: taskData.assignee_id ?? '',
        due_date: formatInputDate(taskData.due_date),
        priority: taskData.priority ?? 5,
      })
    }
  }, [taskData, reset])

  const updateMutation = useMutation({
    mutationFn: async (payload: TaskUpdateForm) => {
     const body: Record<string, any> = {
       description: payload.description ?? '',
       notes: payload.notes ?? '',
       status: payload.status,
        priority:
          payload.priority === undefined || Number.isNaN(payload.priority)
            ? 5
            : payload.priority,
      }
      if (payload.assignee_id === '' || payload.assignee_id === undefined) {
        body.assignee_id = null
      } else if (payload.assignee_id) {
        body.assignee_id = Number(payload.assignee_id)
      }
     if (payload.due_date) {
        const parsed = new Date(payload.due_date)
        if (!Number.isNaN(parsed.getTime())) {
          body.due_date = parsed.toISOString()
        }
      } else {
        body.due_date = null
      }

      const response = await api.put(`/api/tasks/${taskId}`, body)
      return response.data
    },
    onSuccess: () => {
      refetchTask()
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onUpdated()
      queryClient.invalidateQueries({ queryKey: ['task-activity', taskId, 'infinite'] })
    },
  })

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    setUploadError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (supportDescription) {
        formData.append('description', supportDescription)
      }
      if (supportFileDate) {
        formData.append('file_date', supportFileDate)
      }

      await api.post('/api/files/upload', formData, {
        params: { task_id: taskId },
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setSupportDescription('')
      setSupportFileDate('')
      refetchFiles()
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['task-activity', taskId, 'infinite'] })
    } catch (error: any) {
      setUploadError(error.response?.data?.detail || 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleClipboardPaste = useCallback(
    (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      const items = event.clipboardData?.items
      if (!items) {
        return
      }

      for (const item of items) {
        if (item.kind !== 'file' || !item.type.startsWith('image/')) {
          continue
        }

        const blob = item.getAsFile()
        if (!blob) {
          continue
        }

        const extension = item.type === 'image/png' ? 'png' : item.type === 'image/jpeg' ? 'jpg' : 'png'
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `pasted-screenshot-${timestamp}.${extension}`
        const screenshotFile = new File([blob], filename, { type: item.type || 'image/png' })

        handleFileUpload(screenshotFile)
        event.preventDefault()
        break
      }
    },
    [handleFileUpload]
  )

  useEffect(() => {
    window.addEventListener('paste', handleClipboardPaste)
    return () => {
      window.removeEventListener('paste', handleClipboardPaste)
    }
  }, [handleClipboardPaste])

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/comments/', {
        task_id: taskId,
        content: commentContent,
        is_internal: commentInternal,
      })
      return response.data
    },
    onSuccess: () => {
      setCommentContent('')
      setCommentInternal(false)
      setCommentError('')
      queryClient.invalidateQueries({ queryKey: ['task-activity', taskId, 'infinite'] })
    },
    onError: (error: any) => {
      setCommentError(error.response?.data?.detail || 'Unable to add comment')
    },
  })

  const handleCommentSubmit = () => {
    if (!commentContent.trim()) {
      setCommentError('Add a comment before posting')
      return
    }
    addCommentMutation.mutate()
  }

  const createApprovalMutation = useMutation({
    mutationFn: async (reviewerId: number) => {
      const response = await api.post('/api/approvals/', {
        task_id: taskId,
        reviewer_id: reviewerId,
      })
      return response.data
    },
    onSuccess: () => {
      refetchApprovals()
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
      setShowApprovalModal(false)
      setSelectedReviewerId('')
    },
  })

  const deleteApprovalMutation = useMutation({
    mutationFn: async (approvalId: number) => {
      await api.delete(`/api/approvals/${approvalId}`)
    },
    onSuccess: () => {
      refetchApprovals()
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/tasks/${taskId}`)
    },
    onSuccess: () => {
      setShowDeleteConfirm(false)
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onUpdated()
      onClose()
    },
  })

  const handleRequestApproval = () => {
    if (!selectedReviewerId) return
    createApprovalMutation.mutate(selectedReviewerId as number)
  }

  const onSubmit = (data: TaskUpdateForm) => {
    updateMutation.mutate(data)
  }

  const statusWatch = watch('status')
  const currentStatus = (statusWatch as string | undefined) ?? taskData?.status ?? 'not_started'

  const nextStatusForButton = useMemo(() => {
    if (currentStatus === 'complete') return 'complete'
    if (currentStatus === 'review') return 'complete'
    return 'review'
  }, [currentStatus])

  const markComplete = () => {
    if (currentStatus === 'complete') {
      return
    }

    handleSubmit((values) =>
      updateMutation.mutate({
        ...values,
        status: nextStatusForButton,
      })
    )()
  }

  const markButtonLabel = useMemo(() => {
    if (currentStatus === 'complete') return 'Task Completed'
    if (currentStatus === 'review') return 'Mark Complete'
    return 'Send to Review'
  }, [currentStatus])

  const markButtonDisabled = currentStatus === 'complete' || updateMutation.isPending
  const markButtonClass = currentStatus === 'review' ? 'btn-success' : 'btn-secondary'

  const dependencyDetails = (taskData?.dependency_details ?? []) as DependencySummary[]
  const dependentDetails = (taskData?.dependent_details ?? []) as DependencySummary[]
  const incompleteDependencies = dependencyDetails.filter((dep) => dep.status !== 'complete')

  const headerSubtitle = useMemo(() => {
    if (!taskData) return ''
    const parts: string[] = []
    if (taskData.period?.name) parts.push(taskData.period.name)
    if (taskData.owner?.name) parts.push(`Owner: ${taskData.owner.name}`)
    return parts.join(' · ')
  }, [taskData])

  const handlePriorFileDownload = (fileId: number) => {
    const base = api.defaults.baseURL || ''
    window.open(`${base.replace(/\/$/, '')}/api/files/download/${fileId}?inline=0`, '_blank')
  }

  const handleNavigateToTask = (targetTaskId: number) => {
    window.open(`/tasks?highlight=${targetTaskId}`, '_blank')
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Task Details</h2>
            {headerSubtitle && <p className="text-sm text-gray-500 mt-1">{headerSubtitle}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {taskLoading || !taskData ? (
          <div className="p-10 text-center text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
            Loading task...
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
            <section className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <label className="label">Description</label>
                <textarea
                  {...register('description')}
                  className="input min-h-[120px]"
                  placeholder="Describe the work to be completed"
                />
              </div>
              <div className="space-y-3">
                <label className="label">Directions / Notes</label>
                <textarea
                  {...register('notes')}
                  className="input min-h-[120px]"
                  placeholder="Provide step-by-step directions or review notes"
                />
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="label">Status</label>
                <select {...register('status')} className="input">
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Assignee</label>
                <select {...register('assignee_id')} className="input">
                  <option value="">Unassigned</option>
                  {users?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Due Date</label>
                <input type="datetime-local" {...register('due_date')} className="input" />
              </div>
              <div>
                <label className="label">Priority</label>
                <input type="number" min={1} max={10} {...register('priority', { valueAsNumber: true })} className="input" />
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <GitBranch className="w-4 h-4" /> Dependencies
                  </h3>
                  {dependencyDetails.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {incompleteDependencies.length} open of {dependencyDetails.length}
                    </span>
                  )}
                </div>
                {dependencyDetails.length === 0 ? (
                  <p className="text-sm text-gray-500">This task is not waiting on any other work.</p>
                ) : (
                  <ul className="space-y-2">
                    {dependencyDetails.map((dependency) => (
                      <li
                        key={dependency.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">{dependency.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span className={`badge badge-${getStatusColor(dependency.status)}`}>
                              {getStatusLabel(dependency.status)}
                            </span>
                            {dependency.due_date && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(dependency.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleNavigateToTask(dependency.id)
                          }}
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {incompleteDependencies.length > 0 && (
                  <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>
                      {incompleteDependencies.length === 1
                        ? 'One dependency is still outstanding.'
                        : `${incompleteDependencies.length} dependencies are still outstanding.`}
                    </span>
                  </div>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <GitMerge className="w-4 h-4 text-purple-600" /> Downstream Tasks
                  </h3>
                  {dependentDetails.length > 0 && (
                    <span className="text-xs text-purple-600">Blocking {dependentDetails.length}</span>
                  )}
                </div>
                {dependentDetails.length === 0 ? (
                  <p className="text-sm text-gray-500">No other tasks are waiting on this item.</p>
                ) : (
                  <ul className="space-y-2">
                    {dependentDetails.map((dependent) => (
                      <li
                        key={dependent.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-purple-200 bg-purple-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-purple-900">{dependent.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-purple-700">
                            <span className={`badge badge-${getStatusColor(dependent.status)}`}>
                              {getStatusLabel(dependent.status)}
                            </span>
                            {dependent.due_date && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(dependent.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleNavigateToTask(dependent.id)
                          }}
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Paperclip className="w-4 h-4" /> Supporting Files
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    className="text-xs"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        handleFileUpload(file)
                        event.target.value = ''
                      }
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <input
                    type="text"
                    className="input"
                    placeholder="File description (optional)"
                    value={supportDescription}
                    onChange={(event) => setSupportDescription(event.target.value)}
                  />
                  <input
                    type="date"
                    className="input"
                    value={supportFileDate}
                    onChange={(event) => setSupportFileDate(event.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Tip: paste a screenshot with <span className="font-medium">Ctrl/⌘ + V</span> to upload instantly.
                  </p>
                  {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
                  {uploading && (
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                    </p>
                  )}
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-dashed border-gray-200 rounded-lg p-3">
                  {files && files.length > 0 ? (
                    files.map((file) => (
                      <div key={file.id} className="text-sm text-gray-700 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{file.original_filename}</p>
                          <p className="text-xs text-gray-500">
                            Uploaded {formatDate(file.uploaded_at)}
                            {file.description ? ` · ${file.description}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {!file.is_external_link && (
                            <button
                              type="button"
                              className="text-xs text-primary-600 hover:text-primary-800"
                              onClick={() => setPreviewFile(file)}
                            >
                              Preview
                            </button>
                          )}
                          <a
                            href={file.is_external_link ? file.external_url : buildFileUrl(taskId, file.filename, file.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-800"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">No files uploaded yet.</p>
                  )}
                </div>
              </div>
            </section>

            {/* Approval Requests Section */}
            <section className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-green-600" /> Approval Requests
                </h3>
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(true)}
                  className="btn-secondary text-xs"
                >
                  + Request Approval
                </button>
              </div>
              
              {approvals && approvals.length > 0 ? (
                <div className="space-y-2">
                  {approvals.map((approval) => (
                    <div
                      key={approval.id}
                      className={`p-3 rounded-lg border ${
                        approval.status === 'pending'
                          ? 'border-yellow-200 bg-yellow-50'
                          : approval.status === 'approved'
                          ? 'border-green-200 bg-green-50'
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-900">
                              {approval.reviewer?.name || 'Unknown Reviewer'}
                            </p>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                approval.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : approval.status === 'approved'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {approval.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            Requested: {formatDateTime(approval.requested_at)}
                            {approval.reviewed_at && ` • Reviewed: ${formatDateTime(approval.reviewed_at)}`}
                          </p>
                          {approval.notes && (
                            <p className="text-xs text-gray-700 mt-2 italic border-l-2 border-gray-300 pl-2">
                              {approval.notes}
                            </p>
                          )}
                        </div>
                        {approval.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => deleteApprovalMutation.mutate(approval.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Cancel approval request"
                            disabled={deleteApprovalMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No approval requests yet.</p>
              )}
            </section>

            {priorTask && (
              <section className="border border-blue-200 rounded-lg p-4 space-y-3 bg-blue-50">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                  <History className="w-4 h-4" /> Prior Period Context
                </div>
                <p className="text-xs text-blue-800">
                  {priorTask.period_name} • {getStatusLabel(priorTask.status)}
                  {priorTask.due_date ? ` • Due ${formatDate(priorTask.due_date)}` : ''}
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-blue-700 font-semibold mb-2">Files</p>
                    {priorTask.files.length === 0 ? (
                      <p className="text-xs text-blue-700">No files were attached last period.</p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {priorTask.files.slice(0, 5).map((file) => (
                          <li key={file.id} className="flex items-center justify-between">
                            <div className="truncate pr-3">
                              <button
                                type="button"
                                className="text-primary-600 hover:text-primary-800"
                                onClick={() => handlePriorFileDownload(file.id)}
                              >
                                {file.original_filename}
                              </button>
                              <span className="text-xs text-blue-600 block">
                                {(file.file_size / 1024).toFixed(1)} KB • {formatDateTime(file.uploaded_at)}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="text-blue-600 hover:text-blue-800"
                              onClick={() => handlePriorFileDownload(file.id)}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                        {priorTask.files.length > 5 && (
                          <li className="text-xs text-blue-700">{priorTask.files.length - 5} more…</li>
                        )}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase text-blue-700 font-semibold mb-2">Recent Comments</p>
                    {priorTask.comments.length === 0 ? (
                      <p className="text-xs text-blue-700">No comments were recorded last period.</p>
                    ) : (
                      <ul className="space-y-2 text-sm text-blue-900">
                        {priorTask.comments.slice(0, 5).map((comment) => (
                          <li key={comment.id} className="border border-blue-200 bg-white rounded-md p-2">
                            <p className="text-xs text-blue-800 mb-1">
                              {comment.user?.name ?? 'Team member'} • {formatDateTime(comment.created_at)}
                            </p>
                            <p className="text-sm text-blue-900 whitespace-pre-line">{comment.content}</p>
                          </li>
                        ))}
                        {priorTask.comments.length > 5 && (
                          <li className="text-xs text-blue-700">{priorTask.comments.length - 5} more…</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <MessageSquare className="w-4 h-4" /> Timeline & Comments
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <textarea
                      className="input min-h-[120px]"
                      placeholder="Leave an update or review note"
                      value={commentContent}
                      onChange={(event) => {
                        setCommentError('')
                        setCommentContent(event.target.value)
                      }}
                    />
                    <label className="inline-flex items-center text-xs text-gray-600 gap-2">
                      <input
                        type="checkbox"
                        checked={commentInternal}
                        onChange={(event) => setCommentInternal(event.target.checked)}
                      />
                      Internal note (visible only to the close team)
                    </label>
                    {commentError && <p className="text-xs text-red-600">{commentError}</p>}
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={handleCommentSubmit}
                      disabled={addCommentMutation.isPending}
                    >
                      {addCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                  <TaskTimeline taskId={taskId} />
                </div>
              </div>
            </section>

            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Task
              </button>
              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose} className="btn-secondary">
                  Close
                </button>
                <button
                  type="button"
                  onClick={markComplete}
                  className={`${markButtonClass} disabled:opacity-50`}
                  disabled={markButtonDisabled}
                >
                  {markButtonLabel}
                </button>
                <button type="submit" className="btn-primary disabled:opacity-50" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
      {previewFile && (
        <FilePreviewModal
          open={Boolean(previewFile)}
          title={previewFile.original_filename}
          fetchUrl={
            previewFile.is_external_link
              ? undefined
              : `${api.defaults.baseURL || ''}/api/files/download/${previewFile.id}`
          }
          downloadUrl={
            previewFile.is_external_link
              ? previewFile.external_url
              : buildFileUrl(taskId, previewFile.filename, previewFile.id)
          }
          mimeType={previewFile.mime_type}
          isExternal={previewFile.is_external_link}
          externalUrl={previewFile.external_url}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Task?</h3>
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete "{data?.name}"? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary"
                disabled={deleteTaskMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteTaskMutation.mutate()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
                disabled={deleteTaskMutation.isPending}
              >
                {deleteTaskMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Task
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Request Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Request Approval</h2>
              <p className="text-sm text-gray-600 mt-1">
                Select a reviewer to request approval for this task
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Reviewer</label>
                <select
                  className="input"
                  value={selectedReviewerId}
                  onChange={(e) => setSelectedReviewerId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Select a reviewer...</option>
                  {users?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-gray-500">
                <p>The selected reviewer will see this task in their Reviews screen and can approve, reject, or request revisions.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowApprovalModal(false)
                  setSelectedReviewerId('')
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestApproval}
                className="btn-primary disabled:opacity-50"
                disabled={!selectedReviewerId || createApprovalMutation.isPending}
              >
                {createApprovalMutation.isPending ? 'Requesting...' : 'Request Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
