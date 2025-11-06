import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ClipboardCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Paperclip,
  User,
  MessageSquare,
  Loader2
} from 'lucide-react'
import api, { fetchMyReviews, approveApproval, rejectApproval, requestRevision } from '../lib/api'
import { formatDate, formatDateTime } from '../lib/utils'
import { usePeriodStore } from '../stores/periodStore'
import TaskDetailModal from '../components/TaskDetailModal'

interface ReviewTask {
  id: number
  name: string
  description?: string
  status: string
  due_date?: string
  assignee?: { id: number; name: string }
  period: { id: number; name: string }
  file_count: number
  is_overdue: boolean
  department?: string
}

interface ReviewApproval {
  id: number
  task_id: number
  task_name: string
  status: string
  notes?: string
  requested_at: string
  period: { id: number; name: string }
  assignee?: { id: number; name: string }
  file_count: number
  is_overdue: boolean
}

interface MyReviewsResponse {
  review_tasks: ReviewTask[]
  pending_approvals: ReviewApproval[]
  total_pending: number
  overdue_count: number
}

interface ActionModalState {
  type: 'approve' | 'reject' | 'revise' | 'complete' | null
  itemId: number | null
  itemType: 'task' | 'approval' | null
  itemName: string
}

export default function Reviews() {
  const queryClient = useQueryClient()
  const { selectedPeriodId } = usePeriodStore()
  const [departmentFilter, setDepartmentFilter] = useState<string>('')
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [actionModal, setActionModal] = useState<ActionModalState>({
    type: null,
    itemId: null,
    itemType: null,
    itemName: ''
  })
  const [actionNotes, setActionNotes] = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set())
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)

  const { data: reviews, isLoading, refetch } = useQuery<MyReviewsResponse>({
    queryKey: ['my-reviews', selectedPeriodId],
    queryFn: () => fetchMyReviews(selectedPeriodId || undefined),
  })

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      const response = await api.put(`/api/tasks/${taskId}`, { status })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['review-count'] })
      setActionModal({ type: null, itemId: null, itemType: null, itemName: '' })
      setActionNotes('')
    },
  })

  const approvalActionMutation = useMutation({
    mutationFn: async ({ approvalId, action, notes }: { approvalId: number; action: string; notes?: string }) => {
      if (action === 'approve') {
        return approveApproval(approvalId, notes)
      } else if (action === 'reject') {
        return rejectApproval(approvalId, notes || '')
      } else if (action === 'revise') {
        return requestRevision(approvalId, notes || '')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['review-count'] })
      setActionModal({ type: null, itemId: null, itemType: null, itemName: '' })
      setActionNotes('')
    },
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: async (status: string) => {
      const taskIds = Array.from(selectedTaskIds)
      if (taskIds.length === 0) {
        return null
      }

      const response = await api.post('/api/tasks/bulk-update', {
        task_ids: taskIds,
        status,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['review-count'] })
      setSelectedTaskIds(new Set())
    },
  })

  const handleAction = () => {
    if (!actionModal.itemId || !actionModal.type) return

    if (actionModal.itemType === 'task') {
      if (actionModal.type === 'complete') {
        updateTaskMutation.mutate({ taskId: actionModal.itemId, status: 'complete' })
      }
    } else if (actionModal.itemType === 'approval') {
      approvalActionMutation.mutate({
        approvalId: actionModal.itemId,
        action: actionModal.type,
        notes: actionNotes
      })
    }
  }

  const openActionModal = (type: ActionModalState['type'], itemId: number, itemType: 'task' | 'approval', itemName: string) => {
    setActionModal({ type, itemId, itemType, itemName })
    setActionNotes('')
  }

  const closeActionModal = () => {
    setActionModal({ type: null, itemId: null, itemType: null, itemName: '' })
    setActionNotes('')
  }

  useEffect(() => {
    if (!reviews?.review_tasks) {
      setSelectedTaskIds(new Set())
      return
    }

    setSelectedTaskIds((prev) => {
      const validIds = new Set(reviews.review_tasks.map((task) => task.id))
      const retained = new Set<number>()
      prev.forEach((id) => {
        if (validIds.has(id)) {
          retained.add(id)
        }
      })

      if (retained.size === prev.size) {
        return prev
      }
      return retained
    })
  }, [reviews?.review_tasks])

  const toggleTaskSelection = (taskId: number) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const clearSelection = () => setSelectedTaskIds(new Set())

  const filteredTasks = useMemo(() => {
    if (!reviews?.review_tasks) return []

    return reviews.review_tasks.filter((task) => {
      const matchesDepartment = departmentFilter ? task.department === departmentFilter : true
      const matchesOverdue = showOverdueOnly ? task.is_overdue : true
      return matchesDepartment && matchesOverdue
    })
  }, [reviews?.review_tasks, departmentFilter, showOverdueOnly])

  const departments = useMemo(
    () => Array.from(new Set(reviews?.review_tasks.map((task) => task.department).filter(Boolean))),
    [reviews?.review_tasks]
  )

  const allVisibleIds = filteredTasks.map((task) => task.id)
  const allSelected = filteredTasks.length > 0 && filteredTasks.every((task) => selectedTaskIds.has(task.id))
  const toggleSelectAll = () => {
    if (allSelected) {
      clearSelection()
      return
    }
    setSelectedTaskIds(new Set(allVisibleIds))
  }

  const selectionCount = selectedTaskIds.size
  const hasSelection = selectionCount > 0

  const bulkMarkComplete = () => {
    if (!hasSelection) return
    bulkUpdateMutation.mutate('complete')
  }

  const bulkSendBack = () => {
    if (!hasSelection) return
    bulkUpdateMutation.mutate('in_progress')
  }

  const bulkBusy = bulkUpdateMutation.isPending

  const getActionButtonLabel = () => {
    if (actionModal.type === 'approve') return 'Approve'
    if (actionModal.type === 'reject') return 'Reject'
    if (actionModal.type === 'revise') return 'Request Changes'
    if (actionModal.type === 'complete') return 'Mark Complete'
    return 'Confirm'
  }

  const getActionModalTitle = () => {
    if (actionModal.type === 'approve') return 'Approve Approval Request'
    if (actionModal.type === 'reject') return 'Reject Approval Request'
    if (actionModal.type === 'revise') return 'Request Revision'
    if (actionModal.type === 'complete') return 'Mark Task Complete'
    return 'Confirm Action'
  }

  const requiresNotes = actionModal.type === 'reject' || actionModal.type === 'revise'

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-primary-600" />
            My Reviews
          </h1>
          <p className="text-gray-600 mt-1">Items awaiting your review and approval</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showOverdueOnly}
              onChange={(event) => setShowOverdueOnly(event.target.checked)}
            />
            Overdue only
          </label>
          <button
            type="button"
            onClick={toggleSelectAll}
            className="text-sm text-primary-600 hover:text-primary-700 disabled:text-gray-400"
            disabled={filteredTasks.length === 0}
          >
            {allSelected ? 'Clear selection' : 'Select all'}
          </button>
          <select
            className="input text-sm"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats cards */}
      {hasSelection && (
        <div className="card border border-primary-200 bg-primary-50 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-primary-800 font-medium">
            {selectionCount} task{selectionCount > 1 ? 's' : ''} selected for bulk action
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={bulkSendBack}
              disabled={bulkBusy}
            >
              {bulkBusy ? 'Working…' : 'Send back to work'}
            </button>
            <button
              type="button"
              className="btn-success text-xs"
              onClick={bulkMarkComplete}
              disabled={bulkBusy}
            >
              {bulkBusy ? 'Working…' : 'Mark complete'}
            </button>
            <button type="button" className="text-xs text-gray-500 hover:text-gray-700" onClick={clearSelection}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Stats cards */}
      {reviews && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pending</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{reviews.total_pending}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500">
                <ClipboardCheck className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tasks in Review</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{reviews.review_tasks.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue Items</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{reviews.overdue_count}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500">
                <XCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="card text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-gray-400" />
          <p className="text-gray-500">Loading reviews...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks in Review */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-500" />
                Tasks Awaiting Review ({filteredTasks.length})
              </h2>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No tasks awaiting review</p>
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const isSelected = selectedTaskIds.has(task.id)
                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                        task.is_overdue
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-200 bg-white hover:border-primary-300'
                      } ${isSelected ? 'ring-2 ring-primary-300 border-primary-400' : ''}`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 text-primary-600"
                          checked={isSelected}
                          onChange={() => toggleTaskSelection(task.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 mb-1">{task.name}</h3>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {task.period.name}
                            </span>
                            {task.assignee && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {task.assignee.name}
                              </span>
                            )}
                            {task.file_count > 0 && (
                              <span className="flex items-center gap-1">
                                <Paperclip className="w-3 h-3" />
                                {task.file_count} file{task.file_count !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          {task.due_date && (
                            <p className={`text-xs mt-1 ${task.is_overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                              Due: {formatDate(task.due_date)}
                              {task.is_overdue && ' (Overdue)'}
                            </p>
                          )}
                          {task.description && (
                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{task.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedTaskId(task.id)}
                          className="btn-secondary text-xs flex-1"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => openActionModal('complete', task.id, 'task', task.name)}
                          className="btn-success text-xs"
                          disabled={updateTaskMutation.isPending}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Mark Complete
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                Approval Requests ({reviews?.pending_approvals.length || 0})
              </h2>
            </div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {!reviews?.pending_approvals.length ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No pending approvals</p>
                </div>
              ) : (
                reviews.pending_approvals.map((approval) => (
                  <div
                    key={approval.id}
                    className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                      approval.is_overdue
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 bg-white hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1">{approval.task_name}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {approval.period.name}
                          </span>
                          {approval.assignee && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {approval.assignee.name}
                            </span>
                          )}
                          {approval.file_count > 0 && (
                            <span className="flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              {approval.file_count} file{approval.file_count !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Requested: {formatDateTime(approval.requested_at)}
                        </p>
                        {approval.notes && (
                          <p className="text-xs text-gray-600 mt-2 italic border-l-2 border-gray-300 pl-2">
                            {approval.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTaskId(approval.task_id)}
                        className="btn-secondary text-xs flex-1"
                      >
                        View Task
                      </button>
                      <button
                        onClick={() => openActionModal('approve', approval.id, 'approval', approval.task_name)}
                        className="btn-success text-xs"
                        disabled={approvalActionMutation.isPending}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Approve
                      </button>
                      <button
                        onClick={() => openActionModal('revise', approval.id, 'approval', approval.task_name)}
                        className="btn-secondary text-xs"
                        disabled={approvalActionMutation.isPending}
                      >
                        Revise
                      </button>
                      <button
                        onClick={() => openActionModal('reject', approval.id, 'approval', approval.task_name)}
                        className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        disabled={approvalActionMutation.isPending}
                      >
                        <XCircle className="w-3 h-3 mr-1 inline" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {actionModal.type && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">{getActionModalTitle()}</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700">
                <span className="font-medium">Task:</span> {actionModal.itemName}
              </p>
              {actionModal.type !== 'complete' && (
                <div>
                  <label className="label">
                    Notes {requiresNotes && <span className="text-red-600">*</span>}
                  </label>
                  <textarea
                    className="input min-h-[100px]"
                    placeholder={requiresNotes ? 'Provide reason (required)' : 'Optional notes'}
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                  />
                </div>
              )}
              {actionModal.type === 'complete' && (
                <p className="text-sm text-gray-600">
                  This will mark the task as complete and notify the assignee.
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button onClick={closeActionModal} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleAction}
                className={`${
                  actionModal.type === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'btn-primary'
                } disabled:opacity-50`}
                disabled={
                  (requiresNotes && !actionNotes.trim()) ||
                  updateTaskMutation.isPending ||
                  approvalActionMutation.isPending
                }
              >
                {updateTaskMutation.isPending || approvalActionMutation.isPending
                  ? 'Processing...'
                  : getActionButtonLabel()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={() => {
            refetch()
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
          }}
        />
      )}
    </div>
  )
}






