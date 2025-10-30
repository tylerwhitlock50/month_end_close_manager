import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, LayoutGrid, List, UserCheck, ClipboardCheck } from 'lucide-react'
import api from '../lib/api'
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

export default function Tasks() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
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

  useEffect(() => {
    setMyTasksOnly(searchParams.get('mine') === '1')
    setReviewQueueOnly(searchParams.get('review') === '1')
    setStatusFilter(searchParams.get('status') ?? '')
  }, [searchParams])

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
        </div>
      </div>

      {/* Task view */}
      {isLoading ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      ) : viewMode === 'board' ? (
        <TaskBoard
          tasks={tasks || []}
          onSelectTask={(task) => setActiveTaskId(task.id)}
        />
      ) : (
        <TaskList
          tasks={tasks || []}
          onSelectTask={(task) => setActiveTaskId(task.id)}
          selectedTaskIds={selectedTaskIds}
          onSelectionChange={setSelectedTaskIds}
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
