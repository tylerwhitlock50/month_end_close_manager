import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  LayoutGrid,
  List,
  UserCheck,
  ClipboardCheck,
  AlertTriangle,
  GitBranch,
  GitMerge,
  ArrowRight,
  Calendar,
  Maximize2,
  Minimize2,
  Edit3,
} from 'lucide-react'
import api from '../lib/api'
import { formatDate } from '../lib/utils'
import TaskBoard from '../components/TaskBoard'
import TaskList from '../components/TaskList'
import TaskModal from '../components/TaskModal'
import TaskDetailModal from '../components/TaskDetailModal'
import { usePeriodStore } from '../stores/periodStore'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Ready for Review' },
  { value: 'complete', label: 'Complete' },
  { value: 'blocked', label: 'Blocked' },
]

type TaskDependencySummary = {
  id: number
  name: string
  status: string
  due_date?: string
}

export default function Tasks() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const [viewDensity, setViewDensity] = useState<'comfortable' | 'compact'>(() => {
    const saved = localStorage.getItem('task-view-density')
    return (saved === 'compact' ? 'compact' : 'comfortable') as 'comfortable' | 'compact'
  })
  const [quickEditMode, setQuickEditMode] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const { selectedPeriodId } = usePeriodStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()
  const [myTasksOnly, setMyTasksOnly] = useState(searchParams.get('mine') === '1')
  const [reviewQueueOnly, setReviewQueueOnly] = useState(searchParams.get('review') === '1')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? '')
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([])
  const previousStatusRef = useRef<string>('')
  const highlightTaskId = searchParams.get('highlight')

  const toggleViewDensity = () => {
    setViewDensity((prev) => {
      const next = prev === 'comfortable' ? 'compact' : 'comfortable'
      localStorage.setItem('task-view-density', next)
      return next
    })
  }

  useEffect(() => {
    setMyTasksOnly(searchParams.get('mine') === '1')
    setReviewQueueOnly(searchParams.get('review') === '1')
    setStatusFilter(searchParams.get('status') ?? '')
  }, [searchParams])

  useEffect(() => {
    if (!highlightTaskId) {
      return
    }
    setActiveTaskId(Number(highlightTaskId))
  }, [highlightTaskId])

  const handleToggleMyTasks = () => {
    setSelectedTaskIds([])
    setMyTasksOnly((prev) => {
      const next = !prev
      const params = new URLSearchParams(searchParams.toString())
      if (next) {
        params.set('mine', '1')
        params.delete('review')
        setReviewQueueOnly(false)
      } else {
        params.delete('mine')
      }
      setSearchParams(params, { replace: true })
      return next
    })
  }

  const handleToggleReviewQueue = () => {
    setSelectedTaskIds([])
    setReviewQueueOnly((prev) => {
      const next = !prev
      const params = new URLSearchParams(searchParams.toString())
      if (next) {
        previousStatusRef.current = statusFilter
        params.set('review', '1')
        params.set('status', 'review')
        params.delete('mine')
        setMyTasksOnly(false)
        setStatusFilter('review')
      } else {
        params.delete('review')
        const restore = previousStatusRef.current
        if (restore) {
          params.set('status', restore)
          setStatusFilter(restore)
        } else {
          params.delete('status')
          setStatusFilter('')
        }
      }
      setSearchParams(params, { replace: true })
      return next
    })
  }

  const handleStatusFilterChange = (value: string) => {
    setSelectedTaskIds([])
    setStatusFilter(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('status', value)
    } else {
      params.delete('status')
    }
    setSearchParams(params, { replace: true })
  }

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', selectedPeriodId, selectedDepartment, myTasksOnly, statusFilter, reviewQueueOnly],
    queryFn: async () => {
      const baseParams = {
        period_id: selectedPeriodId ?? undefined,
        department: selectedDepartment || undefined,
        limit: 100,
      }

      if (reviewQueueOnly) {
        const response = await api.get('/api/tasks/review-queue', {
          params: baseParams,
        })
        return response.data
      }

      const params: Record<string, unknown> = { ...baseParams }

      if (myTasksOnly) {
        params.mine = true
      }

      if (statusFilter) {
        params.status = statusFilter
      }

      const response = await api.get('/api/tasks/', {
        params,
      })
      return response.data
    },
  })

  const departments = useMemo(
    () => Array.from(new Set((tasks || []).map((t: any) => t.department).filter(Boolean))),
    [tasks]
  )

  const dependencyInsights = useMemo(() => {
    const list = Array.isArray(tasks) ? (tasks as any[]) : []
    const dueValue = (value?: string) => {
      if (!value) return Number.POSITIVE_INFINITY
      const ts = new Date(value).getTime()
      return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts
    }

    const blocked = list
      .filter(
        (task) =>
          Array.isArray(task.dependency_details) &&
          task.dependency_details.some((dep: any) => dep.status !== 'complete')
      )
      .sort((a, b) => dueValue(a.due_date) - dueValue(b.due_date))

    const blockers = list
      .filter((task) => Array.isArray(task.dependent_details) && task.dependent_details.length > 0)
      .sort((a, b) => (b.dependent_details?.length ?? 0) - (a.dependent_details?.length ?? 0))

    return {
      blocked: blocked.slice(0, 5),
      blockers: blockers.slice(0, 5),
    }
  }, [tasks])

  const blockedTasks = dependencyInsights.blocked
  const topBlockingTasks = dependencyInsights.blockers
  const hasDependencyInsights = blockedTasks.length > 0 || topBlockingTasks.length > 0

  useEffect(() => {
    if (!tasks) return
    setSelectedTaskIds((previous) => previous.filter((id) => (tasks as any[]).some((task) => task.id === id)))
  }, [tasks])

  useEffect(() => {
    if (viewMode !== 'list' && selectedTaskIds.length > 0) {
      setSelectedTaskIds([])
    }
  }, [viewMode, selectedTaskIds])

  useEffect(() => {
    if (!tasks || !highlightTaskId) {
      return
    }
    const numericId = Number(highlightTaskId)
    if (Number.isNaN(numericId)) {
      return
    }
    if ((tasks as any[]).some((task) => task.id === numericId)) {
      setActiveTaskId(numericId)
    }
  }, [tasks, highlightTaskId])

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">Manage your month-end close tasks</p>
        </div>
        <button
          onClick={() => setShowTaskModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Task
        </button>
      </div>

      {/* Filters and view toggle */}
      <div className="card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            {/* Department filter */}
            <div className="flex-1 max-w-xs">
              <select
                value={selectedDepartment}
                onChange={(event) => {
                  setSelectedTaskIds([])
                  setSelectedDepartment(event.target.value)
                }}
                className="input"
              >
                <option value="">All Departments</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 max-w-xs">
              <select
                value={statusFilter}
                onChange={(event) => handleStatusFilterChange(event.target.value)}
                className="input"
                disabled={reviewQueueOnly}
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleToggleMyTasks}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 ${
                myTasksOnly
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              {myTasksOnly ? 'Showing My Tasks' : 'My Tasks'}
            </button>

            <button
              type="button"
              onClick={handleToggleReviewQueue}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 ${
                reviewQueueOnly
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
              disabled={!user}
            >
              <ClipboardCheck className="w-4 h-4" />
              {reviewQueueOnly ? 'Review Queue' : 'My Reviews'}
            </button>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('board')}
                className={`p-2 rounded ${
                  viewMode === 'board'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Board View"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${
                  viewMode === 'list'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="List View"
              >
                <List className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={toggleViewDensity}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors"
              title={viewDensity === 'comfortable' ? 'Compact View' : 'Comfortable View'}
            >
              {viewDensity === 'comfortable' ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>
            {viewMode === 'list' && (
              <button
                onClick={() => setQuickEditMode(!quickEditMode)}
                className={`p-2 rounded-lg transition-colors ${
                  quickEditMode
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                }`}
                title={quickEditMode ? 'Exit Quick Edit' : 'Quick Edit Mode'}
              >
                <Edit3 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {hasDependencyInsights && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Blocked tasks
              </h2>
              <span className="text-xs text-red-600">{blockedTasks.length} needing attention</span>
            </div>
            {blockedTasks.length === 0 ? (
              <p className="text-sm text-gray-500">No tasks are currently blocked.</p>
            ) : (
              <ul className="space-y-2">
                {blockedTasks.map((taskItem: any) => {
                  const dependencies = (taskItem.dependency_details ?? []) as TaskDependencySummary[]
                  const openDependencies = dependencies.filter((dep) => dep.status !== 'complete')
                  return (
                    <li key={taskItem.id}>
                      <button
                        type="button"
                        onClick={() => setActiveTaskId(taskItem.id)}
                        className="w-full text-left rounded-md border border-red-200 bg-red-50 px-3 py-2 transition-colors hover:bg-red-100"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-red-900">{taskItem.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-red-700">
                              <span>{openDependencies.length} dependency outstanding</span>
                              {taskItem.due_date && (
                                <span className="inline-flex items-center gap-1 text-red-600">
                                  <Calendar className="h-3 w-3" /> {formatDate(taskItem.due_date)}
                                </span>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-red-600" />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                <GitMerge className="w-4 h-4" /> Top blockers
              </h2>
              <span className="text-xs text-purple-600">
                {topBlockingTasks.length === 0 ? 'All clear' : `${topBlockingTasks.length} upstream tasks`}
              </span>
            </div>
            {topBlockingTasks.length === 0 ? (
              <p className="text-sm text-gray-500">No downstream work is currently waiting on a single task.</p>
            ) : (
              <ul className="space-y-2">
                {topBlockingTasks.map((taskItem: any) => {
                  const dependents = (taskItem.dependent_details ?? []) as TaskDependencySummary[]
                  return (
                    <li key={taskItem.id}>
                      <button
                        type="button"
                        onClick={() => setActiveTaskId(taskItem.id)}
                        className="w-full text-left rounded-md border border-purple-200 bg-purple-50 px-3 py-2 transition-colors hover:bg-purple-100"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-purple-900">{taskItem.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-purple-700">
                              <span>
                                Blocking {dependents.length} task{dependents.length === 1 ? '' : 's'}
                              </span>
                              {taskItem.due_date && (
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3 w-3" /> {formatDate(taskItem.due_date)}
                                </span>
                              )}
                            </div>
                          </div>
                          <GitBranch className="h-4 w-4 text-purple-600" />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Task view */}
      {isLoading ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      ) : viewMode === 'board' ? (
        <TaskBoard
          tasks={tasks || []}
          onSelectTask={(task) => setActiveTaskId(task.id)}
          compact={viewDensity === 'compact'}
        />
      ) : (
        <TaskList
          tasks={tasks || []}
          onSelectTask={(task) => setActiveTaskId(task.id)}
          selectedTaskIds={selectedTaskIds}
          onSelectionChange={setSelectedTaskIds}
          compact={viewDensity === 'compact'}
          quickEditMode={quickEditMode}
        />
      )}

      {/* Task modal */}
      {showTaskModal && (
        <TaskModal
          onClose={() => setShowTaskModal(false)}
          onSuccess={() => {
            setShowTaskModal(false)
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
          }}
        />
      )}

      {activeTaskId && (
        <TaskDetailModal
          taskId={activeTaskId}
          onClose={() => {
            setActiveTaskId(null)
            if (searchParams.has('highlight')) {
              const params = new URLSearchParams(searchParams)
              params.delete('highlight')
              setSearchParams(params, { replace: true })
            }
          }}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
            queryClient.invalidateQueries({ queryKey: ['task', activeTaskId] })
            queryClient.invalidateQueries({ queryKey: ['task-files', activeTaskId] })
          }}
        />
      )}
    </div>
  )
}
