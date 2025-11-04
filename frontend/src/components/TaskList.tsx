import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, User, Paperclip, CheckCircle2, AlertTriangle, GitBranch, GitMerge, Trash2 } from 'lucide-react'
import { formatDate, getStatusColor, getStatusLabel } from '../lib/utils'
import api from '../lib/api'

interface TaskListProps {
  tasks: any[]
  onSelectTask?: (task: any) => void
  selectedTaskIds: number[]
  onSelectionChange: (ids: number[]) => void
  compact?: boolean
  quickEditMode?: boolean
}

const STATUSES = [
  { id: 'not_started', label: 'Not Started' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'complete', label: 'Complete' },
  { id: 'blocked', label: 'Blocked' },
]

export default function TaskList({ tasks, onSelectTask, selectedTaskIds, onSelectionChange, compact = false, quickEditMode = false }: TaskListProps) {
  const queryClient = useQueryClient()
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bulkAssigneeId, setBulkAssigneeId] = useState<string>('')
  const [editingTasks, setEditingTasks] = useState<Record<number, any>>({})
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null)

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/api/users/')
      return response.data as Array<{ id: number; name: string }>
    },
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ status, taskIds, assigneeId }: { status?: string; taskIds: number[]; assigneeId?: number | null }) => {
      const payload: any = { task_ids: taskIds }
      if (status) payload.status = status
      if (assigneeId !== undefined) payload.assignee_id = assigneeId
      const response = await api.post('/api/tasks/bulk-update', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onSelectionChange([])
      setBulkAssigneeId('')
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (taskIds: number[]) => {
      const response = await api.post('/api/tasks/bulk-delete', {
        task_ids: taskIds,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onSelectionChange([])
      setShowDeleteConfirm(false)
    },
  })

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      const response = await api.put(`/api/tasks/${taskId}`, { status })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onSettled: () => {
      setUpdatingTaskId(null)
    },
  })

  const quickUpdateMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: number; updates: any }) => {
      const response = await api.put(`/api/tasks/${taskId}`, updates)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onSettled: () => {
      setSavingTaskId(null)
    },
  })

  const handleStatusChange = (taskId: number, status: string) => {
    setUpdatingTaskId(taskId)
    updateTaskMutation.mutate({ taskId, status })
  }

  const toggleTaskSelection = (taskId: number) => {
    if (selectedTaskIds.includes(taskId)) {
      onSelectionChange(selectedTaskIds.filter((id) => id !== taskId))
    } else {
      onSelectionChange([...selectedTaskIds, taskId])
    }
  }

  const allSelected = tasks.length > 0 && tasks.every((task) => selectedTaskIds.includes(task.id))

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([])
    } else {
      onSelectionChange(tasks.map((task) => task.id))
    }
  }

  const handleBulkStatusChange = (status: string) => {
    if (selectedTaskIds.length === 0 || bulkUpdateMutation.isPending) {
      return
    }
    bulkUpdateMutation.mutate({ status, taskIds: selectedTaskIds })
  }

  const handleBulkAssigneeChange = () => {
    if (selectedTaskIds.length === 0 || bulkUpdateMutation.isPending || bulkAssigneeId === '') {
      return
    }
    const assigneeId = bulkAssigneeId === 'unassigned' ? null : Number(bulkAssigneeId)
    bulkUpdateMutation.mutate({ taskIds: selectedTaskIds, assigneeId })
  }

  const handleBulkDelete = () => {
    if (selectedTaskIds.length === 0 || bulkDeleteMutation.isPending) {
      return
    }
    bulkDeleteMutation.mutate(selectedTaskIds)
  }

  const initializeTaskEdit = (task: any) => {
    setEditingTasks((prev) => ({
      ...prev,
      [task.id]: {
        status: task.status,
        assignee_id: task.assignee?.id || null,
        due_date: task.due_date || '',
        priority: task.priority || 5,
      },
    }))
  }

  const handleQuickEdit = (taskId: number, field: string, value: any) => {
    setEditingTasks((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {}),
        [field]: value,
      },
    }))
  }

  const handleQuickSave = (task: any) => {
    const draft = editingTasks[task.id]
    if (!draft) return

    const updates: any = {}
    let hasChanges = false

    if (draft.status !== task.status) {
      updates.status = draft.status
      hasChanges = true
    }

    const draftAssignee = draft.assignee_id
    const originalAssignee = task.assignee?.id || null
    if (draftAssignee !== originalAssignee) {
      updates.assignee_id = draftAssignee
      hasChanges = true
    }

    if (draft.due_date !== (task.due_date || '')) {
      updates.due_date = draft.due_date ? new Date(draft.due_date).toISOString() : null
      hasChanges = true
    }

    if (draft.priority !== (task.priority || 5)) {
      updates.priority = draft.priority
      hasChanges = true
    }

    if (!hasChanges) return

    setSavingTaskId(task.id)
    quickUpdateMutation.mutate({ taskId: task.id, updates })
  }

  const handleQuickReset = (task: any) => {
    setEditingTasks((prev) => {
      const next = { ...prev }
      delete next[task.id]
      return next
    })
  }

  // Initialize editing state when quickEditMode is enabled
  useEffect(() => {
    if (quickEditMode && tasks.length > 0) {
      const newEdits: Record<number, any> = {}
      tasks.forEach((task) => {
        newEdits[task.id] = {
          status: task.status,
          assignee_id: task.assignee?.id || null,
          due_date: task.due_date || '',
          priority: task.priority || 5,
        }
      })
      setEditingTasks(newEdits)
    } else {
      setEditingTasks({})
    }
  }, [quickEditMode, tasks])

  return (
    <div className="card overflow-hidden p-0">
      {selectedTaskIds.length > 0 && (
        <div className="px-6 py-3 border-b border-gray-200 bg-primary-50/60">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-700">
              {selectedTaskIds.length} task{selectedTaskIds.length > 1 ? 's' : ''} selected
            </div>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => onSelectionChange([])}
              disabled={bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <select
                className="input text-xs h-8"
                value={bulkAssigneeId}
                onChange={(e) => setBulkAssigneeId(e.target.value)}
                disabled={bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
              >
                <option value="">Change assignee...</option>
                <option value="unassigned">Unassigned</option>
                {users?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={handleBulkAssigneeChange}
                disabled={bulkUpdateMutation.isPending || bulkDeleteMutation.isPending || bulkAssigneeId === ''}
              >
                {bulkUpdateMutation.isPending ? 'Assigning...' : 'Assign'}
              </button>
            </div>
            <div className="h-6 w-px bg-gray-300" />
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => handleBulkStatusChange('in_progress')}
              disabled={bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
            >
              Mark In Progress
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => handleBulkStatusChange('review')}
              disabled={bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
            >
              Send to Review
            </button>
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={() => handleBulkStatusChange('complete')}
              disabled={bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
            >
              {bulkUpdateMutation.isPending ? 'Updating...' : 'Mark Complete'}
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <button
              type="button"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete {selectedTaskIds.length} task{selectedTaskIds.length > 1 ? 's' : ''}?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This action cannot be undone. All task data, files, comments, and approvals will be permanently deleted.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={bulkDeleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? (
                  <>Deleting...</>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete {selectedTaskIds.length} task{selectedTaskIds.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={allSelected}
                onChange={handleSelectAll}
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Task
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Period
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Owner
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Due Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Files
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              {quickEditMode ? 'Quick Actions' : 'Actions'}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                No tasks found
              </td>
            </tr>
          ) : (
            tasks.map((task) => {
              const dependencyDetails = (task.dependency_details ?? []) as Array<{
                id: number
                name: string
                status: string
                due_date?: string
              }>
              const dependentDetails = (task.dependent_details ?? []) as Array<{
                id: number
                name: string
                status: string
                due_date?: string
              }>
              const incompleteDependencies = dependencyDetails.filter((dep) => dep.status !== 'complete')
              const isBlocked = incompleteDependencies.length > 0

              return (
              <tr
                key={task.id}
                className={clsx(
                  'hover:bg-gray-50 transition-colors',
                  !quickEditMode && 'cursor-pointer',
                  selectedTaskIds.includes(task.id) ? 'bg-primary-50/40' : '',
                  isBlocked && 'border-l-4 border-red-300'
                )}
                onClick={() => !quickEditMode && onSelectTask?.(task)}
              >
                <td className="px-3 py-4">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedTaskIds.includes(task.id)}
                    onChange={(event) => {
                      event.stopPropagation()
                      toggleTaskSelection(task.id)
                    }}
                  />
                </td>
                <td className={compact ? 'px-4 py-2' : 'px-6 py-4'}>
                  <div>
                    <div className={clsx('font-medium text-gray-900', compact ? 'text-xs' : 'text-sm')}>{task.name}</div>
                    {!compact && task.description && (
                      <div className="text-sm text-gray-500 line-clamp-1">
                        {task.description}
                      </div>
                    )}
                    {!compact && (dependencyDetails.length > 0 || dependentDetails.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        {dependencyDetails.length > 0 && (
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 border',
                              isBlocked ? 'border-red-200 bg-red-100 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'
                            )}
                          >
                            {isBlocked ? (
                              <>
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Blocked by {incompleteDependencies.length}/{dependencyDetails.length}
                              </>
                            ) : (
                              <>
                                <GitBranch className="h-3.5 w-3.5" />
                                Dependencies {dependencyDetails.length}
                              </>
                            )}
                          </span>
                        )}
                        {dependentDetails.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-700">
                            <GitMerge className="h-3.5 w-3.5" /> Blocking {dependentDetails.length}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className={clsx('whitespace-nowrap', compact ? 'px-4 py-2 text-xs' : 'px-6 py-4 text-sm')}>
                  <span className="text-gray-900">{compact && task.period?.name ? task.period.name.slice(0, 10) : task.period?.name || '-'}</span>
                </td>
                <td className={clsx('whitespace-nowrap', compact ? 'px-4 py-2' : 'px-6 py-4')}>
                  {quickEditMode ? (
                    <select
                      className="input text-xs py-1"
                      value={editingTasks[task.id]?.assignee_id ?? (task.assignee?.id || '')}
                      onChange={(e) => handleQuickEdit(task.id, 'assignee_id', e.target.value ? Number(e.target.value) : null)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={savingTaskId === task.id}
                    >
                      <option value="">Unassigned</option>
                      {users?.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className={clsx('flex items-center text-gray-900', compact ? 'text-xs' : 'text-sm')}>
                      {!compact && <User className="w-4 h-4 mr-2 text-gray-400" />}
                      {task.owner?.name || '-'}
                    </div>
                  )}
                </td>
                <td className={clsx('whitespace-nowrap', compact ? 'px-4 py-2' : 'px-6 py-4')}>
                  {quickEditMode ? (
                    <input
                      type="datetime-local"
                      className="input text-xs py-1"
                      value={editingTasks[task.id]?.due_date ? new Date(editingTasks[task.id].due_date).toISOString().slice(0, 16) : ''}
                      onChange={(e) => handleQuickEdit(task.id, 'due_date', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={savingTaskId === task.id}
                    />
                  ) : task.due_date ? (
                    <div className={clsx('flex items-center text-gray-900', compact ? 'text-xs' : 'text-sm')}>
                      <Calendar className={compact ? 'w-3 h-3 mr-1 text-gray-400' : 'w-4 h-4 mr-2 text-gray-400'} />
                      {formatDate(task.due_date)}
                    </div>
                  ) : (
                    <span className={clsx('text-gray-400', compact ? 'text-xs' : 'text-sm')}>-</span>
                  )}
                </td>
                <td className={clsx('whitespace-nowrap', compact ? 'px-4 py-2' : 'px-6 py-4')}>
                  {quickEditMode ? (
                    <select
                      className="input text-xs py-1"
                      value={editingTasks[task.id]?.status || task.status}
                      onChange={(e) => handleQuickEdit(task.id, 'status', e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={savingTaskId === task.id}
                    >
                      {STATUSES.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className={clsx('flex flex-col gap-1', compact ? 'text-xs' : 'text-sm')}>
                      <span className={`badge badge-${getStatusColor(task.status)} ${compact ? 'text-[10px]' : ''}`}>
                        {getStatusLabel(task.status)}
                      </span>
                      {!compact && isBlocked && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3" /> {incompleteDependencies.length} dependency pending
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className={clsx('whitespace-nowrap', compact ? 'px-4 py-2' : 'px-6 py-4')}>
                  {task.file_count > 0 ? (
                    <div className={clsx('flex items-center text-gray-900', compact ? 'text-xs' : 'text-sm')}>
                      <Paperclip className={compact ? 'w-3 h-3 mr-1 text-gray-400' : 'w-4 h-4 mr-1 text-gray-400'} />
                      {task.file_count}
                    </div>
                  ) : (
                    <span className={clsx('text-gray-400', compact ? 'text-xs' : 'text-sm')}>-</span>
                  )}
                </td>
                <td className={compact ? 'px-4 py-2' : 'px-6 py-4'}>
                  <div
                    className="flex items-center justify-end gap-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {quickEditMode ? (
                      <>
                        <button
                          type="button"
                          className="btn-secondary text-xs px-2 py-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleQuickReset(task)
                          }}
                          disabled={savingTaskId === task.id}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          className="btn-primary text-xs px-2 py-1"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleQuickSave(task)
                          }}
                          disabled={savingTaskId === task.id}
                        >
                          {savingTaskId === task.id ? 'Saving...' : 'Save'}
                        </button>
                      </>
                    ) : (
                      <>
                        {!compact && (
                          <select
                            className="input text-xs py-1"
                            value={task.status}
                            disabled={updateTaskMutation.isPending && updatingTaskId === task.id}
                            onChange={(event) => handleStatusChange(task.id, event.target.value)}
                          >
                            {STATUSES.map((status) => (
                              <option key={status.id} value={status.id}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-md font-medium transition-colors',
                            compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs',
                            task.status === 'complete'
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-primary-600 text-white border border-primary-600 hover:bg-primary-700'
                          )}
                          disabled={
                            task.status === 'complete' ||
                            (updateTaskMutation.isPending && updatingTaskId === task.id)
                          }
                          onClick={() => handleStatusChange(task.id, 'complete')}
                        >
                          {updateTaskMutation.isPending && updatingTaskId === task.id ? (
                            'Saving...'
                          ) : task.status === 'complete' ? (
                            <>
                              <CheckCircle2 className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                              {!compact && 'Completed'}
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                              {!compact && 'Mark Complete'}
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

