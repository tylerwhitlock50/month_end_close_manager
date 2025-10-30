import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { formatDateTime } from '../lib/utils'

interface NotificationItem {
  id: number
  title: string
  message: string
  notification_type: string
  is_read: boolean
  link_url?: string | null
  created_at: string
  read_at?: string | null
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: notifications, isLoading } = useQuery<NotificationItem[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get('/api/notifications/', {
        params: { limit: 20 },
      })
      return response.data
    },
    refetchInterval: 60000,
  })

  const unreadCount = notifications?.filter((notification) => !notification.is_read).length ?? 0

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      await api.post(`/api/notifications/${notificationId}/read`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/notifications/mark-all-read')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.is_read) {
      await markReadMutation.mutateAsync(notification.id)
    }

    setOpen(false)

    if (notification.link_url) {
      if (notification.link_url.startsWith('http')) {
        window.open(notification.link_url, '_blank')
      } else {
        navigate(notification.link_url)
      }
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div>
              <p className="text-sm font-semibold text-gray-900">Notifications</p>
              <p className="text-xs text-gray-500">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending || unreadCount === 0}
              className="text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading notifications...
              </div>
            ) : notifications && notifications.length > 0 ? (
              notifications.map((notification) => (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                    notification.is_read ? 'text-gray-500' : 'text-gray-800 bg-primary-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs mt-1 whitespace-pre-line">{notification.message}</p>
                    </div>
                    {!notification.is_read && (
                      <Check className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    {formatDateTime(notification.created_at)}
                  </p>
                </button>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-gray-500">
                No notifications yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
