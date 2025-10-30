import { ReactNode, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
  FolderOpen
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { usePeriodStore } from '../stores/periodStore'
import NotificationsBell from './NotificationsBell'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { selectedPeriodId, selectedPeriodName, setPeriod } = usePeriodStore()

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

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Periods', href: '/periods', icon: Calendar },
    { name: 'Templates', href: '/templates', icon: ClipboardList },
    { name: 'Trial Balance', href: '/trial-balance', icon: FileSpreadsheet },
    { name: 'File Cabinet', href: '/file-cabinet', icon: FolderOpen },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'Reports', href: '/reports', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
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
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
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
              <NotificationsBell />
              <span className="hidden sm:inline text-sm text-gray-500">Working period</span>
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

