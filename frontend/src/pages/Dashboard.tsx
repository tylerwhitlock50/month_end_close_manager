import { useQuery } from '@tanstack/react-query'
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  Calendar,
  Users
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

