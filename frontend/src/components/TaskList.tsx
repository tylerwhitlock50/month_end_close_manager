import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, User, Paperclip, CheckCircle2 } from 'lucide-react'
import { formatDate, getStatusColor, getStatusLabel } from '../lib/utils'
import api from '../lib/api'

interface TaskListProps {
  tasks: any[]
  onSelectTask?: (task: any) => void
  selectedTaskIds: number[]
  onSelectionChange: (ids: number[]) => void
}

const STATUSES = [
  { id: 'not_started', label: 'Not Started' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'complete', label: 'Complete' },
  { id: 'blocked', label: 'Blocked' },
]

export default function TaskList({ tasks, onSelectTask, selectedTaskIds, onSelectionChange }: TaskListProps) {
  const queryClient = useQueryClient()
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null)

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ status, taskIds }: { status: string; taskIds: number[] }) => {
      const response = await api.post('/api/tasks/bulk-update', {
        task_ids: taskIds,
        status,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onSelectionChange([])
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

  return (
    <div className="card overflow-hidden p-0">
      {selectedTaskIds.length > 0 && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-primary-50/60">
          <div className="text-sm font-medium text-gray-700">
            {selectedTaskIds.length} task{selectedTaskIds.length > 1 ? 's' : ''} selected
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => onSelectionChange([])}
              disabled={bulkUpdateMutation.isPending}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => handleBulkStatusChange('in_progress')}
              disabled={bulkUpdateMutation.isPending}
            >
              Mark In Progress
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => handleBulkStatusChange('review')}
              disabled={bulkUpdateMutation.isPending}
            >
              Send to Review
            </button>
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={() => handleBulkStatusChange('complete')}
              disabled={bulkUpdateMutation.isPending}
            >
              {bulkUpdateMutation.isPending ? 'Updating...' : 'Mark Complete'}
            </button>
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
              Actions
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
            tasks.map((task) => (
              <tr
                key={task.id}
                className={`hover:bg-gray-50 cursor-pointer ${selectedTaskIds.includes(task.id) ? 'bg-primary-50/40' : ''}`}
                onClick={() => onSelectTask?.(task)}
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
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{task.name}</div>
                    {task.description && (
                      <div className="text-sm text-gray-500 line-clamp-1">
                        {task.description}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">{task.period?.name || '-'}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-900">
                    <User className="w-4 h-4 mr-2 text-gray-400" />
                    {task.owner?.name || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {task.due_date ? (
                    <div className="flex items-center text-sm text-gray-900">
                      <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                      {formatDate(task.due_date)}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`badge badge-${getStatusColor(task.status)}`}>
                    {getStatusLabel(task.status)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {task.file_count > 0 ? (
                    <div className="flex items-center text-sm text-gray-900">
                      <Paperclip className="w-4 h-4 mr-1 text-gray-400" />
                      {task.file_count}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div
                    className="flex items-center justify-end gap-2"
                    onClick={(event) => event.stopPropagation()}
                  >
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
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        task.status === 'complete'
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-primary-600 text-white border border-primary-600 hover:bg-primary-700'
                      }`}
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
                          <CheckCircle2 className="w-4 h-4" />
                          Completed
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Mark Complete
                        </>
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

