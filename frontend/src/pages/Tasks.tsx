import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, LayoutGrid, List } from 'lucide-react'
import api from '../lib/api'
import TaskBoard from '../components/TaskBoard'
import TaskList from '../components/TaskList'
import TaskModal from '../components/TaskModal'
import TaskDetailModal from '../components/TaskDetailModal'

export default function Tasks() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', selectedPeriod, selectedDepartment],
    queryFn: async () => {
      const response = await api.get('/api/tasks/', {
        params: {
          period_id: selectedPeriod,
          department: selectedDepartment || undefined,
          limit: 100,
        },
      })
      return response.data
    },
  })

  const { data: periods } = useQuery({
    queryKey: ['periods'],
    queryFn: async () => {
      const response = await api.get('/api/periods/', {
        params: { include_inactive: true },
      })
      return response.data
    },
  })

  const activePeriods = useMemo(
    () => (periods || []).filter((period: any) => period.is_active),
    [periods]
  )

  useEffect(() => {
    if (!selectedPeriod && activePeriods.length > 0) {
      setSelectedPeriod(activePeriods[0].id)
    }
    if (selectedPeriod && periods) {
      const exists = periods.some((period: any) => period.id === selectedPeriod)
      if (!exists) {
        setSelectedPeriod(null)
      }
    }
  }, [selectedPeriod, activePeriods, periods])

  const departments = useMemo(
    () => Array.from(new Set((tasks || []).map((t: any) => t.department).filter(Boolean))),
    [tasks]
  )

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
            {/* Period filter */}
            <div className="flex-1 max-w-xs">
              <select
                value={selectedPeriod ?? ''}
                onChange={(event) => setSelectedPeriod(event.target.value ? Number(event.target.value) : null)}
                className="input"
              >
                <option value="">
                  {activePeriods.length > 0 ? 'All active periods' : 'All periods'}
                </option>
                {activePeriods.map((period: any) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
                {(periods || [])
                  .filter((period: any) => !period.is_active)
                  .map((period: any) => (
                    <option key={period.id} value={period.id}>
                      {period.name} (inactive)
                    </option>
                  ))}
              </select>
            </div>

            {/* Department filter */}
            <div className="flex-1 max-w-xs">
              <select
                value={selectedDepartment}
                onChange={(event) => setSelectedDepartment(event.target.value)}
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
          onClose={() => setActiveTaskId(null)}
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

