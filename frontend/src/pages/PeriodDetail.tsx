import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Folder,
  Calendar,
  ListChecks,
  Layers,
} from 'lucide-react'
import api from '../lib/api'
import { formatDate } from '../lib/utils'

interface PeriodDetailResponse {
  period: {
    id: number
    name: string
    close_type: string
    status: string
    target_close_date?: string
    actual_close_date?: string
  }
  completion_percentage: number
  total_tasks: number
  status_counts: Record<string, number>
  tasks_by_status: Record<string, Array<TaskSummary>>
  overdue_tasks: TaskSummary[]
  upcoming_tasks: TaskSummary[]
  department_breakdown: DepartmentSummary[]
  period_files_count: number
  task_files_count: number
  trial_balance_files_count: number
}

interface TaskSummary {
  id: number
  name: string
  status: string
  due_date?: string
}

interface DepartmentSummary {
  department?: string | null
  total_tasks: number
  completed_tasks: number
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  review: 'Ready for Review',
  complete: 'Complete',
  blocked: 'Blocked',
}

export default function PeriodDetail() {
  const { periodId } = useParams<{ periodId: string }>()
  const navigate = useNavigate()

  const { data, isLoading, isError } = useQuery<PeriodDetailResponse>({
    queryKey: ['period-detail', periodId],
    enabled: Boolean(periodId),
    queryFn: async () => {
      const response = await api.get(`/api/periods/${periodId}/detail`)
      return response.data
    },
  })

  const statusTotals = useMemo(() => {
    if (!data) return []
    return Object.entries(data.status_counts).map(([status, count]) => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      count,
    }))
  }, [data])

  if (!periodId) {
    return (
      <div className="p-6">
        <p className="text-gray-600">No period selected.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Loading period details...</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <p className="text-red-600">Unable to load period details. Please try again.</p>
        <button
          type="button"
          onClick={() => navigate('/periods')}
          className="btn-secondary mt-4"
        >
          Back to periods
        </button>
      </div>
    )
  }

  const { period } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => navigate('/periods')}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to periods
          </button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            {period.name}
            <span className="badge badge-blue uppercase text-xs">{period.close_type}</span>
          </h1>
          <p className="text-sm text-gray-600">Status: {STATUS_LABELS[period.status] ?? period.status}</p>
          {period.target_close_date && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Target close date: {formatDate(period.target_close_date)}
            </p>
          )}
        </div>
        <div className="card">
          <p className="text-xs uppercase text-gray-500">Completion</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">
            {data.completion_percentage.toFixed(0)}%
          </p>
          <p className="text-xs text-gray-500">
            {data.status_counts.complete ?? 0} of {data.total_tasks} tasks completed
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <ListChecks className="w-4 h-4 text-primary-600" /> Status Breakdown
          </div>
          <div className="mt-3 space-y-2">
            {statusTotals.length === 0 ? (
              <p className="text-xs text-gray-500">No tasks yet.</p>
            ) : (
              statusTotals.map((item) => (
                <div key={item.status} className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Folder className="w-4 h-4 text-primary-600" /> Files Summary
          </div>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            <li className="flex items-center justify-between">
              <span>Period files</span>
              <span className="font-medium">{data.period_files_count}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Task attachments</span>
              <span className="font-medium">{data.task_files_count}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Trial balance files</span>
              <span className="font-medium">{data.trial_balance_files_count}</span>
            </li>
            <li>
              <Link to="/file-cabinet" className="text-xs text-primary-600 hover:text-primary-700">
                Open file cabinet →
              </Link>
            </li>
          </ul>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Layers className="w-4 h-4 text-primary-600" /> Departments
          </div>
          <div className="mt-3 space-y-2">
            {data.department_breakdown.length === 0 ? (
              <p className="text-xs text-gray-500">No department assignments.</p>
            ) : (
              data.department_breakdown.map((dept) => (
                <div key={dept.department ?? 'unassigned'} className="flex items-center justify-between text-sm">
                  <span>{dept.department ?? 'Unassigned'}</span>
                  <span className="font-semibold">
                    {dept.completed_tasks}/{dept.total_tasks}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskGroupCard
          title="Overdue tasks"
          icon={AlertTriangle}
          tasks={data.overdue_tasks}
          emptyMessage="No overdue tasks."
          actionLabel="View in Tasks"
          onAction={() => navigate('/tasks')}
        />
        <TaskGroupCard
          title="Upcoming deadlines"
          icon={Clock}
          tasks={data.upcoming_tasks}
          emptyMessage="No tasks due soon."
          actionLabel="View in Tasks"
          onAction={() => navigate('/tasks')}
        />
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Tasks by status</h2>
          <Link to="/tasks" className="text-sm text-primary-600 hover:text-primary-700">
            Open task board →
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(data.tasks_by_status).map(([status, tasks]) => (
            <div key={status} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  {STATUS_LABELS[status] ?? status}
                </h3>
                <span className="text-xs text-gray-500">{tasks.length}</span>
              </div>
              {tasks.length === 0 ? (
                <p className="text-xs text-gray-500">No tasks in this status.</p>
              ) : (
                <ul className="space-y-2">
                  {tasks.slice(0, 6).map((task) => (
                    <li key={task.id} className="text-sm text-gray-700">
                      <button
                        type="button"
                        onClick={() => navigate(`/tasks?highlight=${task.id}`)}
                        className="text-left w-full hover:text-primary-600"
                      >
                        {task.name}
                        {task.due_date && (
                          <span className="block text-xs text-gray-400">
                            Due {formatDate(task.due_date)}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                  {tasks.length > 6 && (
                    <li className="text-xs text-primary-600">and {tasks.length - 6} more…</li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface TaskGroupCardProps {
  title: string
  icon: React.ComponentType<{ className?: string }>
  tasks: TaskSummary[]
  emptyMessage: string
  actionLabel: string
  onAction: () => void
}

function TaskGroupCard({ title, icon: Icon, tasks, emptyMessage, actionLabel, onAction }: TaskGroupCardProps) {
  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Icon className="w-4 h-4 text-primary-600" /> {title}
        </div>
        <button
          type="button"
          onClick={onAction}
          className="text-xs text-primary-600 hover:text-primary-700"
        >
          {actionLabel}
        </button>
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-gray-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between">
              <span className="truncate mr-2">{task.name}</span>
              {task.due_date && (
                <span className="text-xs text-gray-500">{formatDate(task.due_date)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
