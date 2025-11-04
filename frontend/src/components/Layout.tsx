import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  FileSpreadsheet,
  ClipboardList,
  FolderOpen,
  ClipboardCheck,
  Workflow,
  Info,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useQuery } from '@tanstack/react-query'
import api, { fetchPeriodSummary } from '../lib/api'
import { usePeriodStore } from '../stores/periodStore'
import NotificationsBell from './NotificationsBell'
import CommandPalette from './CommandPalette'
import { formatDate } from '../lib/utils'

interface LayoutProps {
  children: ReactNode
}

interface PeriodSummaryData {
  period_id: number
  period_name: string
  status: 'planned' | 'in_progress' | 'under_review' | 'closed'
  target_close_date?: string | null
  days_until_close?: number | null
  completion_percentage: number
  total_tasks: number
  completed_tasks: number
  overdue_tasks: number
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { selectedPeriodId, selectedPeriodName, setPeriod } = usePeriodStore()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [periodDetailsOpen, setPeriodDetailsOpen] = useState(false)
  const periodDetailsRef = useRef<HTMLDivElement | null>(null)

  const { data: periods } = useQuery({
    queryKey: ['periods'],
    queryFn: async () => {
      const response = await api.get('/api/periods/', {
        params: { include_inactive: true },
      })
      return response.data as Array<{
        id: number
        name: string
        is_active: boolean
      }>
    },
  })

  const { data: periodSummary, isFetching: summaryLoading } = useQuery<PeriodSummaryData>({
    queryKey: ['period-summary', selectedPeriodId],
    queryFn: async () => fetchPeriodSummary(selectedPeriodId as number),
    enabled: Boolean(selectedPeriodId),
    staleTime: 60_000,
  })

  const statusClassMap: Record<PeriodSummaryData['status'], string> = {
    planned: 'badge-gray',
    in_progress: 'badge-blue',
    under_review: 'badge-amber',
    closed: 'badge-green',
  }

  const statusLabelMap: Record<PeriodSummaryData['status'], string> = {
    planned: 'Planned',
    in_progress: 'In Progress',
    under_review: 'Under Review',
    closed: 'Closed',
  }

  const closeTimingLabel = periodSummary && typeof periodSummary.days_until_close === 'number'
    ? periodSummary.days_until_close > 0
      ? `${periodSummary.days_until_close} days remaining`
      : periodSummary.days_until_close === 0
        ? 'Due today'
        : `${Math.abs(periodSummary.days_until_close)} days past target`
    : null

  const currentSelection = useMemo(() => {
    if (!periods || periods.length === 0) {
      return { id: selectedPeriodId, name: selectedPeriodName }
    }

    const match = periods.find((period) => period.id === selectedPeriodId)
    if (match) {
      return { id: match.id, name: match.name }
    }

    return { id: null, name: selectedPeriodName }
  }, [periods, selectedPeriodId, selectedPeriodName])

  useEffect(() => {
    if (!periods || periods.length === 0) {
      return
    }

    if (selectedPeriodId) {
      const exists = periods.some((period) => period.id === selectedPeriodId)
      if (!exists) {
        setPeriod(null, null)
      }
      return
    }

    const firstActive = periods.find((period) => period.is_active)
    if (firstActive) {
      setPeriod(firstActive.id, firstActive.name)
    }
  }, [periods, selectedPeriodId, setPeriod])

  useEffect(() => {
    setPeriodDetailsOpen(false)
  }, [selectedPeriodId])

  useEffect(() => {
    if (!periodDetailsOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (periodDetailsRef.current && !periodDetailsRef.current.contains(event.target as Node)) {
        setPeriodDetailsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [periodDetailsOpen])

  useEffect(() => {
    if (!periodDetailsOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPeriodDetailsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [periodDetailsOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const { data: reviewCount } = useQuery({
    queryKey: ['review-count', selectedPeriodId],
    queryFn: async () => {
      const response = await api.get('/api/dashboard/my-reviews', {
        params: selectedPeriodId ? { period_id: selectedPeriodId } : undefined,
      })
      return response.data.total_pending as number
    },
    refetchInterval: 60000, // Refresh every minute
  })

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Reviews', href: '/reviews', icon: ClipboardCheck, badge: reviewCount },
    { name: 'Periods', href: '/periods', icon: Calendar },
    { name: 'Templates', href: '/templates', icon: ClipboardList },
    { name: 'Workflow Builder', href: '/workflow', icon: Workflow },
    { name: 'Trial Balance', href: '/trial-balance', icon: FileSpreadsheet },
    { name: 'File Cabinet', href: '/file-cabinet', icon: FolderOpen },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'Reports', href: '/reports', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-primary-600">Month-End Close</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center">
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                className="ml-3 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-margin duration-200 ${sidebarOpen ? 'lg:ml-64' : ''}`}>
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex items-center h-16 px-6 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between gap-4 w-full">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden sm:flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 transition-colors hover:border-primary-300 hover:text-primary-600"
              >
                <span>Search</span>
                <span className="rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                  Ctrl / ⌘ + K
                </span>
              </button>
              <NotificationsBell />
              <div className="relative" ref={periodDetailsRef}>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex flex-col">
                    <span className={`text-xs ${selectedPeriodId ? 'text-gray-400' : 'text-red-500'}`}>
                      Working period
                    </span>
                    <select
                      className="input text-sm w-48"
                      value={currentSelection.id ?? ''}
                      onChange={(event) => {
                        const value = event.target.value
                        if (!value) {
                          setPeriod(null, null)
                          return
                        }

                        const periodId = Number(value)
                        const match = periods?.find((period) => period.id === periodId)
                        setPeriod(periodId, match?.name ?? null)
                      }}
                    >
                      <option value="">All active periods</option>
                      {periods?.map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.name}
                          {!period.is_active ? ' (inactive)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={!selectedPeriodId}
                    onClick={() => setPeriodDetailsOpen((prev) => !prev)}
                    className={`inline-flex items-center justify-center rounded-lg border px-2 py-2 text-sm transition-colors ${
                      selectedPeriodId
                        ? 'border-gray-200 text-gray-500 hover:border-primary-300 hover:text-primary-600'
                        : 'cursor-not-allowed border-red-200 text-red-500'
                    }`}
                    title={selectedPeriodId ? 'View period summary' : 'Select a period to view details'}
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>

                {periodDetailsOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-xl">
                    <div className="p-4 space-y-4">
                      {summaryLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading summary...
                        </div>
                      ) : !periodSummary ? (
                        <p className="text-sm text-gray-500">Select a period to view summary details.</p>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{periodSummary.period_name}</p>
                              {periodSummary.target_close_date && (
                                <p className="text-xs text-gray-500">
                                  Target close {formatDate(periodSummary.target_close_date)}
                                  {closeTimingLabel && (
                                    <span className="ml-1">• {closeTimingLabel}</span>
                                  )}
                                </p>
                              )}
                            </div>
                            <span className={`badge ${statusClassMap[periodSummary.status]}`}>
                              {statusLabelMap[periodSummary.status]}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>Completion</span>
                              <span>{periodSummary.completion_percentage.toFixed(0)}%</span>
                            </div>
                            <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                              <div
                                className="h-2 rounded-full bg-primary-600 transition-all"
                                style={{ width: `${Math.min(periodSummary.completion_percentage, 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div>
                              <p className="text-lg font-semibold text-gray-900">{periodSummary.total_tasks}</p>
                              <p className="text-xs text-gray-500">Tasks</p>
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-gray-900">{periodSummary.completed_tasks}</p>
                              <p className="text-xs text-gray-500">Completed</p>
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-gray-900">{periodSummary.overdue_tasks}</p>
                              <p className="text-xs text-gray-500">Overdue</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPeriodDetailsOpen(false)
                                navigate(`/periods/${selectedPeriodId}`)
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-primary-300 hover:text-primary-600"
                            >
                              <span>Period details</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPeriodDetailsOpen(false)
                                navigate(`/tasks?period_id=${selectedPeriodId}`)
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-primary-300 hover:text-primary-600"
                            >
                              <span>View tasks</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPeriodDetailsOpen(false)
                                navigate(`/trial-balance?periodId=${selectedPeriodId}`)
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-primary-300 hover:text-primary-600"
                            >
                              <span>Trial balance</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
