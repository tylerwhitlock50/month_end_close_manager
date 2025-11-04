import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Calendar, Users, Clock, TrendingUp, AlertCircle } from 'lucide-react'
import api from '../lib/api'

export default function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null)
  const [reportType, setReportType] = useState<'overview' | 'workload' | 'distribution'>('overview')

  const { data: periods } = useQuery({
    queryKey: ['periods'],
    queryFn: async () => {
      const response = await api.get('/api/periods/')
      return response.data
    },
  })

  const { data: metrics } = useQuery({
    queryKey: ['period-metrics'],
    queryFn: async () => {
      const response = await api.get('/api/reports/periods')
      return response.data
    },
  })

  const { data: workloadData } = useQuery({
    queryKey: ['workload-report', selectedPeriod],
    enabled: reportType === 'workload',
    queryFn: async () => {
      const response = await api.get('/api/reports/workload', {
        params: { period_id: selectedPeriod },
      })
      return response.data as Array<{
        user_id: number
        user_name: string
        assigned_tasks: number
        completed_tasks: number
        in_progress_tasks: number
        estimated_hours: number
        actual_hours: number
        completion_rate: number
      }>
    },
  })

  const { data: distributionData } = useQuery({
    queryKey: ['distribution-report', selectedPeriod],
    enabled: reportType === 'distribution',
    queryFn: async () => {
      const response = await api.get('/api/reports/distribution', {
        params: { period_id: selectedPeriod },
      })
      return response.data as Array<{
        department: string
        total_tasks: number
        completed_tasks: number
        avg_completion_days: number
        overdue_tasks: number
      }>
    },
  })

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      const response = await api.get(`/api/reports/tasks/export/${format}`, {
        params: { period_id: selectedPeriod },
        responseType: 'blob',
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `tasks_export.${format}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-600 mt-1">Insights, workload analysis, and export tools</p>
      </div>

      {/* Report Type Selector */}
      <div className="card">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Report Type:</label>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setReportType('overview')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                reportType === 'overview'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Overview
              </div>
            </button>
            <button
              onClick={() => setReportType('workload')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                reportType === 'workload'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Workload
              </div>
            </button>
            <button
              onClick={() => setReportType('distribution')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                reportType === 'distribution'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Distribution
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Export section */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Tasks</h2>
        
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 max-w-xs">
            <select
              value={selectedPeriod || ''}
              onChange={(e) => setSelectedPeriod(e.target.value ? Number(e.target.value) : null)}
              className="input"
            >
              <option value="">All Periods</option>
              {periods?.map((period: any) => (
                <option key={period.id} value={period.id}>
                  {period.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleExport('csv')}
            className="btn-primary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="btn-secondary flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Report Content */}
      {reportType === 'overview' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Period Metrics</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total Tasks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Completion Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Avg Days
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metrics?.map((metric: any) => (
                  <tr key={metric.period_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {metric.period_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {metric.total_tasks}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {metric.completed_tasks}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-900 mr-2">
                          {metric.completion_rate.toFixed(0)}%
                        </span>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${metric.completion_rate}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {metric.avg_task_completion_days?.toFixed(1) || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportType === 'workload' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-600" />
                Workload by Person
              </h2>
              {selectedPeriod && (
                <button
                  onClick={() => handleExport('csv')}
                  className="btn-secondary text-xs flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              )}
            </div>

            {!workloadData || workloadData.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  {selectedPeriod
                    ? 'No workload data available for this period'
                    : 'Select a period to view workload analysis'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Team Member
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Assigned
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        In Progress
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Completed
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Est. Hours
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Actual Hours
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Progress
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {workloadData.map((user) => (
                      <tr key={user.user_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.user_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {user.assigned_tasks}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {user.in_progress_tasks}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {user.completed_tasks}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {user.estimated_hours?.toFixed(1) || '-'}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          <span
                            className={
                              user.actual_hours > user.estimated_hours
                                ? 'text-amber-600 font-medium'
                                : ''
                            }
                          >
                            {user.actual_hours?.toFixed(1) || '-'}h
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900 min-w-[3rem]">
                              {user.completion_rate.toFixed(0)}%
                            </span>
                            <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[100px]">
                              <div
                                className={`h-2 rounded-full ${
                                  user.completion_rate >= 80
                                    ? 'bg-green-500'
                                    : user.completion_rate >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${user.completion_rate}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {reportType === 'distribution' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-600" />
              Task Distribution by Department
            </h2>
          </div>

          {!distributionData || distributionData.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">
                {selectedPeriod
                  ? 'No distribution data available for this period'
                  : 'Select a period to view task distribution'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Department
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Total Tasks
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Completed
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Overdue
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Avg Completion (days)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {distributionData.map((dept) => {
                    const completionRate = (dept.completed_tasks / dept.total_tasks) * 100
                    return (
                      <tr key={dept.department} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {dept.department || 'Unassigned'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {dept.total_tasks}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {dept.completed_tasks}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          {dept.overdue_tasks > 0 ? (
                            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                              <AlertCircle className="w-4 h-4" />
                              {dept.overdue_tasks}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                          {dept.avg_completion_days?.toFixed(1) || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900 min-w-[3rem]">
                              {completionRate.toFixed(0)}%
                            </span>
                            <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[100px]">
                              <div
                                className="bg-primary-600 h-2 rounded-full"
                                style={{ width: `${completionRate}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

