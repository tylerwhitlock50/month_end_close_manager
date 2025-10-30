import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Paperclip, Loader2, Download, CheckCircle2, MessageSquare } from 'lucide-react'
import api from '../lib/api'
import { formatDate, formatDateTime, getStatusLabel } from '../lib/utils'
import FilePreviewModal from './FilePreviewModal'

interface TaskDetailModalProps {
  taskId: number
  onClose: () => void
  onUpdated: () => void
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

interface TaskActivityEvent {
  id: string
  event_type: 'comment' | 'activity'
  message: string
  created_at: string
  user: { id: number; name: string }
  metadata?: Record<string, any>
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
  const base = api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://localhost:8000'
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

  const { data: activityEvents, refetch: refetchActivity } = useQuery<TaskActivityEvent[]>({
    queryKey: ['task-activity', taskId],
    queryFn: async () => {
      const response = await api.get(`/api/tasks/${taskId}/activity`)
      return response.data
    },
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/api/users/')
      return response.data as Array<{ id: number; name: string }>
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
      refetchActivity()
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
      refetchActivity()
    } catch (error: any) {
      setUploadError(error.response?.data?.detail || 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

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
      refetchActivity()
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

  const headerSubtitle = useMemo(() => {
    if (!taskData) return ''
    const parts: string[] = []
    if (taskData.period?.name) parts.push(taskData.period.name)
    if (taskData.owner?.name) parts.push(`Owner: ${taskData.owner.name}`)
    return parts.join(' · ')
  }, [taskData])

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

            <section className="border border-gray-200 rounded-lg p-4 space-y-4">
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
                <div className="space-y-3 max-h-64 overflow-y-auto border border-dashed border-gray-200 rounded-lg p-3">
                  {activityEvents && activityEvents.length > 0 ? (
                    activityEvents.map((event) => (
                      <div key={event.id} className="text-sm text-gray-700 border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{event.user?.name ?? 'System'}</span>
                          <span>{formatDateTime(event.created_at)}</span>
                        </div>
                        <p className="text-gray-800 whitespace-pre-line">{event.message}</p>
                        {event.event_type === 'comment' && event.metadata?.is_internal && (
                          <span className="inline-flex items-center text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded px-2 py-0.5 mt-2">
                            Internal
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">No activity yet.</p>
                  )}
                </div>
              </div>
            </section>

            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle2 className="w-4 h-4" />
                Update the task to notify reviewers when you are ready for approval.
              </div>
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
    </div>
  )
}
