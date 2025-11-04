import { useState, useCallback, type ChangeEvent, type MouseEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  User,
  Paperclip,
  CheckCircle2,
  ChevronDown,
  GripVertical,
  AlertTriangle,
  GitBranch,
  GitMerge,
} from 'lucide-react'
import clsx from 'clsx'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

import api from '../lib/api'
import { formatDate, getStatusColor, getStatusLabel } from '../lib/utils'

interface TaskBoardProps {
  tasks: any[]
  onSelectTask?: (task: any) => void
  compact?: boolean
}

const BOARD_STATUSES = [
  { id: 'not_started', label: 'Not Started' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'complete', label: 'Complete' },
]

const ItemTypes = {
  TASK: 'task-card',
} as const

type DragItem = {
  id: number
  status: string
}

interface TaskCardProps {
  task: any
  statuses: { id: string; label: string }[]
  isExpanded: boolean
  onToggleExpand: (taskId: number) => void
  onSelectTask?: (task: any) => void
  onStatusChange: (taskId: number, status: string) => void
  isMutating: boolean
  isCurrentTaskMutating: boolean
  compact?: boolean
}

interface StatusColumnProps {
  statusId: string
  children: React.ReactNode
  onDropTask: (taskId: number, status: string) => void
}

function TaskCard({
  task,
  statuses,
  isExpanded,
  onToggleExpand,
  onSelectTask,
  onStatusChange,
  isMutating,
  isCurrentTaskMutating,
  compact = false,
}: TaskCardProps) {
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

  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: ItemTypes.TASK,
      item: { id: task.id, status: task.status },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [task.id, task.status]
  )

  const handleExpandToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onToggleExpand(task.id)
  }

  const handleStatusSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    event.stopPropagation()
    onStatusChange(task.id, event.target.value)
  }

  const handleMarkComplete = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (task.status !== 'complete') {
      onStatusChange(task.id, 'complete')
    }
  }

  return (
    <div
      ref={dragRef}
      className={clsx(
        'card cursor-grab active:cursor-grabbing transition-shadow border border-transparent',
        compact ? 'p-2' : 'p-3 sm:p-3',
        'hover:shadow-md focus-within:shadow-md',
        isBlocked && 'border-red-200 shadow-sm bg-red-50/50',
        isDragging && 'opacity-60'
      )}
      style={{ opacity: isDragging ? 0.6 : 1 }}
      onClick={() => onSelectTask?.(task)}
    >
      <div className="flex items-start gap-2">
        {!compact && <GripVertical className="mt-1 h-4 w-4 text-gray-300" />}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className={clsx('font-semibold text-gray-900 line-clamp-2', compact ? 'text-xs' : 'text-sm')}>
              {task.name}
            </h4>
            {!compact && (
              <button
                type="button"
                onClick={handleExpandToggle}
                className="text-gray-400 hover:text-gray-600"
                aria-label={isExpanded ? 'Collapse task details' : 'Expand task details'}
              >
                <ChevronDown
                  className={clsx('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
                />
              </button>
            )}
          </div>

          <div className={clsx('flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600', compact ? 'mt-1 text-[10px]' : 'mt-2 text-xs')}>
            {task.owner && !compact && (
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {task.owner.name}
              </span>
            )}
            {task.due_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                {formatDate(task.due_date)}
              </span>
            )}
            {task.file_count > 0 && !compact && (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" />
                {task.file_count}
              </span>
            )}
            {task.department && !compact && (
              <span className="badge badge-gray text-[10px] uppercase tracking-wide">
                {task.department}
              </span>
            )}
            <span className={clsx('badge text-[10px] font-medium', `badge-${getStatusColor(task.status)}`)}>
              {getStatusLabel(task.status)}
            </span>
          </div>

          {!compact && (dependencyDetails.length > 0 || dependentDetails.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              {dependencyDetails.length > 0 && (
                <span
                  className={clsx(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 border',
                    isBlocked ? 'border-red-200 bg-red-100 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'
                  )}
                >
                  {isBlocked ? (
                    <>
                      <AlertTriangle className="h-3 w-3" />
                      Blocked by {incompleteDependencies.length}/{dependencyDetails.length}
                    </>
                  ) : (
                    <>
                      <GitBranch className="h-3 w-3" />
                      Dependencies {dependencyDetails.length}
                    </>
                  )}
                </span>
              )}

              {dependentDetails.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-700">
                  <GitMerge className="h-3 w-3" />
                  Blocking {dependentDetails.length}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {isExpanded && !compact && (
        <div className="mt-3 space-y-3 text-xs text-gray-600">
          {task.description && <p className="leading-relaxed">{task.description}</p>}

          <div className="flex items-center justify-between gap-2">
            <span className={clsx('badge text-[11px] font-medium', `badge-${getStatusColor(task.status)}`)}>
              {getStatusLabel(task.status)}
            </span>
            <div className="flex items-center gap-2">
              <select
                value={task.status}
                onChange={handleStatusSelect}
                className="input h-8 min-w-[9rem] border-gray-200 text-xs"
                disabled={isMutating && isCurrentTaskMutating}
              >
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleMarkComplete}
                disabled={task.status === 'complete' || (isMutating && isCurrentTaskMutating)}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  task.status === 'complete'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                )}
              >
                {isMutating && isCurrentTaskMutating ? (
                  'Saving...'
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    {task.status === 'complete' ? 'Completed' : 'Mark Complete'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusColumn({ statusId, children, onDropTask }: StatusColumnProps) {
  const [{ isOver, canDrop }, dropRef] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>(
    () => ({
      accept: ItemTypes.TASK,
      drop: (item) => {
        if (item.status !== statusId) {
          onDropTask(item.id, statusId)
          item.status = statusId
        }
      },
      canDrop: (item) => item.status !== statusId,
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    }),
    [statusId, onDropTask]
  )

  return (
    <div
      ref={dropRef}
      className={clsx(
        'flex min-h-[220px] flex-col gap-2 rounded-xl border border-transparent bg-white/80 p-2 transition-colors',
        isOver && canDrop && 'border-primary-300 bg-primary-50/80',
        isOver && !canDrop && 'border-gray-300 bg-gray-100'
      )}
    >
      {children}
    </div>
  )
}

export default function TaskBoard({ tasks = [], onSelectTask, compact = false }: TaskBoardProps) {
  const queryClient = useQueryClient()
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null)
  const [expandedTasks, setExpandedTasks] = useState<number[]>([])

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

  const handleStatusChange = useCallback(
    (taskId: number, newStatus: string) => {
      setUpdatingTaskId(taskId)
      updateTaskMutation.mutate({ taskId, status: newStatus })
    },
    [updateTaskMutation]
  )

  const handleToggleExpand = useCallback((taskId: number) => {
    setExpandedTasks((previous) =>
      previous.includes(taskId)
        ? previous.filter((id) => id !== taskId)
        : [...previous, taskId]
    )
  }, [])

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {BOARD_STATUSES.map((status) => {
          const statusTasks = tasks.filter((task) => task.status === status.id)

          return (
            <div key={status.id} className="flex flex-col">
              <div className="mb-2 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                <h3 className="text-sm font-semibold text-gray-900">{status.label}</h3>
                <span className={clsx('badge text-xs', `badge-${getStatusColor(status.id)}`)}>
                  {statusTasks.length}
                </span>
              </div>

              <StatusColumn statusId={status.id} onDropTask={handleStatusChange}>
                {statusTasks.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white/60 py-8 text-center text-xs text-gray-500">
                    Drag tasks here
                  </div>
                ) : (
                  statusTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      statuses={BOARD_STATUSES}
                      isExpanded={expandedTasks.includes(task.id)}
                      onToggleExpand={handleToggleExpand}
                      onSelectTask={onSelectTask}
                      onStatusChange={handleStatusChange}
                      isMutating={updateTaskMutation.isPending}
                      isCurrentTaskMutating={updateTaskMutation.isPending && updatingTaskId === task.id}
                      compact={compact}
                    />
                  ))
                )}
              </StatusColumn>
            </div>
          )
        })}
      </div>
    </DndProvider>
  )
}
