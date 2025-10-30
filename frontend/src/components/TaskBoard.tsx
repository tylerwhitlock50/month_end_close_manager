import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, User, Paperclip } from 'lucide-react'
import api from '../lib/api'
import { formatDate, getStatusColor, getStatusLabel } from '../lib/utils'

interface TaskBoardProps {
  tasks: any[]
  onSelectTask?: (task: any) => void
}

const STATUSES = [
  { id: 'not_started', label: 'Not Started' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'complete', label: 'Complete' },
]

export default function TaskBoard({ tasks, onSelectTask }: TaskBoardProps) {
  const queryClient = useQueryClient()

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      const response = await api.put(`/api/tasks/${taskId}`, { status })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const handleStatusChange = (taskId: number, newStatus: string) => {
    updateTaskMutation.mutate({ taskId, status: newStatus })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {STATUSES.map((status) => {
        const statusTasks = tasks.filter((task) => task.status === status.id)
        
        return (
          <div key={status.id} className="flex flex-col">
            {/* Column header */}
            <div className="card mb-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">{status.label}</h3>
                <span className={`badge badge-${getStatusColor(status.id)}`}>
                  {statusTasks.length}
                </span>
              </div>
            </div>

            {/* Tasks */}
            <div className="space-y-3 flex-1">
              {statusTasks.length === 0 ? (
                <div className="card text-center py-8 bg-gray-50">
                  <p className="text-gray-500 text-sm">No tasks</p>
                </div>
              ) : (
                statusTasks.map((task) => (
                  <div
                    key={task.id}
                    className="card hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => onSelectTask?.(task)}
                  >
                    <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">
                      {task.name}
                    </h4>

                    {task.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    <div className="space-y-2 text-xs text-gray-600">
                      {task.owner && (
                        <div className="flex items-center">
                          <User className="w-3 h-3 mr-1" />
                          {task.owner.name}
                        </div>
                      )}

                      {task.due_date && (
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(task.due_date)}
                        </div>
                      )}

                      {task.file_count > 0 && (
                        <div className="flex items-center">
                          <Paperclip className="w-3 h-3 mr-1" />
                          {task.file_count} file{task.file_count > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    {task.department && (
                      <div className="mt-3">
                        <span className="badge badge-gray text-xs">
                          {task.department}
                        </span>
                      </div>
                    )}

                    {/* Quick status change */}
                    <div className="mt-3 pt-3 border-t border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity">
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        className="w-full text-xs input py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {STATUSES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

