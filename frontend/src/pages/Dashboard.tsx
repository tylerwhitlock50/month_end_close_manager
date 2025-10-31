import type { ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Users,
  AlertTriangle,
  PauseCircle,
  Activity,
} from 'lucide-react'
import api from '../lib/api'
import { formatDate } from '../lib/utils'

interface DashboardStats {
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  overdue_tasks: number
  tasks_due_today: number
  completion_percentage: number
  avg_time_to_complete?: number | null
  blocked_tasks: TaskSummary[]
  review_tasks: TaskSummary[]
  at_risk_tasks: TaskSummary[]
  critical_path_tasks: CriticalPathTask[]
}

interface TaskSummary {
  id: number
  name: string
  status: string
  due_date?: string
}

interface CriticalPathTask extends TaskSummary {
  blocked_dependents: number
  dependents: TaskSummary[]
}

export default function Dashboard() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/api/dashboard/stats')
      return response.data
    },
  })

  const { data: myTasks } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const response = await api.get('/api/tasks/my-tasks', {
        params: { limit: 5 }
      })
      return response.data
    },
  })

  const statCards = [
    {
      name: 'Total Tasks',
      value: stats?.total_tasks || 0,
      icon: CheckCircle,
      color: 'bg-blue-500',
    },
    {
      name: 'In Progress',
      value: stats?.in_progress_tasks || 0,
      icon: Clock,
      color: 'bg-yellow-500',
    },
    {
      name: 'Completed',
      value: stats?.completed_tasks || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
    },
    {
      name: 'Overdue',
      value: stats?.overdue_tasks || 0,
      icon: AlertCircle,
      color: 'bg-red-500',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's your close overview.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Completion progress */}
      {stats && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Close Progress</h2>
            <span className="text-2xl font-bold text-primary-600">
              {stats.completion_percentage.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-primary-600 h-4 rounded-full transition-all duration-500"
              style={{ width: `${stats.completion_percentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {stats.completed_tasks} of {stats.total_tasks} tasks completed
          </p>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <WorkflowColumn
            title="Blocked Tasks"
            icon={PauseCircle}
            tasks={stats.blocked_tasks}
            emptyMessage="No blocked tasks right now."
            link="/tasks?status=blocked"
          />
          <WorkflowColumn
            title="Needs Review"
            icon={Users}
            tasks={stats.review_tasks}
            emptyMessage="Nothing in review."
            link="/reviews"
          />
          <WorkflowColumn
            title="At-Risk Deadlines"
            icon={AlertTriangle}
            tasks={stats.at_risk_tasks}
            emptyMessage="No upcoming risks."
            link="/tasks?status=in_progress"
          />
          <CriticalPathColumn tasks={stats.critical_path_tasks} />
        </div>
      )}

      {/* My tasks */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">My Recent Tasks</h2>
        <div className="space-y-3">
          {myTasks?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tasks assigned</p>
          ) : (
            myTasks?.map((task: any) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{task.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {task.period?.name} • {task.department || 'No department'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {task.due_date && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(task.due_date)}
                    </div>
                  )}
                  <span className={`badge badge-${getStatusColor(task.status)}`}>
                    {getStatusLabel(task.status)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 text-right">
          <Link to="/tasks?mine=1" className="text-sm text-primary-600 hover:text-primary-700">
            View all my tasks →
          </Link>
        </div>
      </div>
    </div>
  )
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    not_started: 'gray',
    in_progress: 'blue',
    review: 'yellow',
    complete: 'green',
    blocked: 'red',
  }
  return colors[status] || 'gray'
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    review: 'Review',
    complete: 'Complete',
    blocked: 'Blocked',
  }
  return labels[status] || status
}

interface WorkflowColumnProps {
  title: string
  icon: ComponentType<{ className?: string }>
  tasks: TaskSummary[]
  emptyMessage: string
  link: string
}

function WorkflowColumn({ title, icon: Icon, tasks, emptyMessage, link }: WorkflowColumnProps) {
  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary-600" />
          {title}
        </h3>
        <Link to={link} className="text-xs text-primary-600 hover:text-primary-700">
          View all →
        </Link>
      </div>
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
              <p className="text-sm font-medium text-gray-900 line-clamp-2">{task.name}</p>
              {task.due_date && (
                <p className="text-xs text-gray-600 mt-1">Due {formatDate(task.due_date)}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

interface CriticalPathColumnProps {
  tasks: CriticalPathTask[]
}

function CriticalPathColumn({ tasks }: CriticalPathColumnProps) {
  return (
    <div className="card h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary-600" />
          Critical Path
        </h3>
        <Link to="/tasks" className="text-xs text-primary-600 hover:text-primary-700">
          View tasks →
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500">No blockers detected.</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900 line-clamp-2">{task.name}</p>
                <span className="badge badge-yellow">{task.blocked_dependents} waiting</span>
              </div>
              {task.due_date && (
                <p className="text-xs text-gray-600 mt-1">Due {formatDate(task.due_date)}</p>
              )}
              {task.dependents.length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  <p className="font-semibold text-gray-700">Unblocks:</p>
                  <ul className="mt-1 space-y-1">
                    {task.dependents.slice(0, 3).map((dependent) => (
                      <li key={dependent.id} className="flex items-center justify-between">
                        <span className="truncate mr-2">{dependent.name}</span>
                        {dependent.due_date && (
                          <span className="text-[11px] text-gray-500">{formatDate(dependent.due_date)}</span>
                        )}
                      </li>
                    ))}
                    {task.dependents.length > 3 && (
                      <li className="text-[11px] text-gray-500">+{task.dependents.length - 3} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
