import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Calendar, Plus, ToggleLeft, ToggleRight, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { formatDate } from '../lib/utils'
import PeriodModal from '../components/PeriodModal'

export default function Periods() {
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const { data: periods, isLoading, refetch } = useQuery({
    queryKey: ['periods'],
    queryFn: async () => {
      const response = await api.get('/api/periods/', {
        params: { include_inactive: true },
      })
      return response.data
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ periodId, isActive }: { periodId: number; isActive: boolean }) => {
      const response = await api.patch(`/api/periods/${periodId}/activation`, {
        is_active: isActive,
      })
      return response.data
    },
    onSuccess: () => {
      refetch()
    },
  })

  const activePeriods = useMemo(
    () => (periods || []).filter((period: any) => period.is_active),
    [periods]
  )

  const inactivePeriods = useMemo(
    () => (periods || []).filter((period: any) => !period.is_active),
    [periods]
  )

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Close Periods</h1>
          <p className="text-gray-600 mt-1">Manage monthly, quarterly, and year-end close cycles</p>
        </div>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setShowModal(true)}
        >
          <Plus className="w-5 h-5" />
          New Period
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Active periods: {activePeriods.length}
          {inactivePeriods.length > 0 ? ` · Inactive: ${inactivePeriods.length}` : ''}
        </p>
        {inactivePeriods.length > 0 && (
          <button
            onClick={() => setShowInactive((prev) => !prev)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            {showInactive ? (
              <>
                <ToggleLeft className="w-4 h-4" /> Hide inactive
              </>
            ) : (
              <>
                <ToggleRight className="w-4 h-4" /> Show inactive
              </>
            )}
          </button>
        )}
      </div>

      {/* Periods grid */}
      {isLoading ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">Loading periods...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(showInactive ? periods || [] : activePeriods).map((period: any) => (
            <div
              key={period.id}
              className={`card hover:shadow-md transition-shadow ${
                period.is_active ? '' : 'opacity-75 border-dashed'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    {period.name}
                    {period.is_active ? (
                      <span className="badge badge-green text-xs flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="badge badge-gray text-xs">Inactive</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1 uppercase">
                    {period.close_type}
                  </p>
                </div>
                <span className={`badge badge-${getStatusColor(period.status)}`}>
                  {getStatusLabel(period.status)}
                </span>
              </div>

              {period.target_close_date && (
                <div className="flex items-center text-sm text-gray-600 mb-4">
                  <Calendar className="w-4 h-4 mr-2" />
                  Target: {formatDate(period.target_close_date)}
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() =>
                    toggleMutation.mutate({ periodId: period.id, isActive: !period.is_active })
                  }
                  disabled={toggleMutation.isPending}
                  className={`w-full text-sm btn-${period.is_active ? 'secondary' : 'primary'} disabled:opacity-50`}
                >
                  {period.is_active ? 'Deactivate period' : 'Activate period'}
                </button>
                <button
                  className="w-full btn-secondary text-sm"
                  onClick={() => navigate(`/periods/${period.id}`)}
                >
                  View Details
                </button>
              </div>
            </div>
          ))}

          {activePeriods.length === 0 && !showInactive && (
            <div className="card text-center py-12">
              <p className="text-gray-600 text-sm">
                No active periods. Activate a period to make tasks visible to staff.
              </p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <PeriodModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            refetch()
          }}
        />
      )}
    </div>
  )
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    planned: 'gray',
    in_progress: 'blue',
    under_review: 'yellow',
    closed: 'green',
  }
  return colors[status] || 'gray'
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    planned: 'Planned',
    in_progress: 'In Progress',
    under_review: 'Under Review',
    closed: 'Closed',
  }
  return labels[status] || status
}
