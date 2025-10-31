import { useMemo, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Loader2, MessageCircle, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { formatDateTime } from '../lib/utils'
import { useAuthStore } from '../stores/authStore'

const PAGE_SIZE = 20

export interface TaskTimelineEvent {
  id: string
  event_type: 'comment' | 'activity'
  message: string
  created_at: string
  user?: { id: number; name: string }
  metadata?: Record<string, unknown>
}

interface TaskActivityResponse {
  total: number
  limit: number
  offset: number
  events: TaskTimelineEvent[]
}

interface TaskTimelineProps {
  taskId: number
}

interface FeedbackState {
  type: 'success' | 'error'
  message: string
}

export default function TaskTimeline({ taskId }: TaskTimelineProps) {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)

  const activityQuery = useInfiniteQuery<TaskActivityResponse>({
    queryKey: ['task-activity', taskId, 'infinite'],
    enabled: Boolean(taskId),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const response = await api.get(`/api/tasks/${taskId}/activity`, {
        params: { limit: PAGE_SIZE, offset: pageParam },
      })
      return response.data as TaskActivityResponse
    },
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.events.length
      if (nextOffset >= lastPage.total) {
        return undefined
      }
      return nextOffset
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (commentId: number) => {
      await api.delete(`/api/comments/${commentId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-activity', taskId, 'infinite'] })
      setFeedback({ type: 'success', message: 'Comment removed' })
    },
    onError: () => {
      setFeedback({ type: 'error', message: 'Unable to delete comment right now' })
    },
  })

  const events = useMemo(
    () => activityQuery.data?.pages.flatMap((page) => page.events) ?? [],
    [activityQuery.data]
  )

  const total = activityQuery.data?.pages.at(0)?.total ?? 0
  const hasMore = (activityQuery.hasNextPage ?? false) && total > events.length

  const handleCopyLink = async (eventId: string) => {
    const link = `${window.location.origin}/tasks?highlight=${taskId}&activity=${eventId}`
    try {
      await navigator.clipboard.writeText(link)
      setFeedback({ type: 'success', message: 'Link copied to clipboard' })
    } catch (error) {
      console.error('Failed to copy link', error)
      setFeedback({ type: 'error', message: 'Clipboard copy failed' })
    }
  }

  const handleDeleteComment = (eventId: string) => {
    const parts = eventId.split('-')
    if (parts[0] !== 'comment') {
      return
    }
    const commentId = Number(parts[1])
    if (Number.isNaN(commentId)) {
      return
    }

    const confirmed = window.confirm('Remove this comment?')
    if (!confirmed) {
      return
    }

    deleteMutation.mutate(commentId)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
        <span className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          Timeline
        </span>
        {total > 0 && (
          <span className="text-xs text-gray-500">{events.length} of {total}</span>
        )}
      </div>

      {feedback && (
        <div
          className={`text-xs px-3 py-2 rounded border ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-600'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {activityQuery.isLoading ? (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading timeline...
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-gray-500">No activity yet. Add a comment to get things started.</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto border border-dashed border-gray-200 rounded-lg p-3">
          {events.map((event) => {
            const isOwnComment =
              event.event_type === 'comment' && event.user?.id !== undefined && event.user.id === user?.id
            const isInternal = Boolean(event.metadata && event.metadata['is_internal'])

            return (
              <div
                key={event.id}
                className="text-sm text-gray-700 border-b border-gray-200 pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-2 text-xs text-gray-500 mb-1">
                  <span>{event.user?.name ?? 'System'}</span>
                  <span>{formatDateTime(event.created_at)}</span>
                </div>
                <p className="text-gray-800 whitespace-pre-line">{event.message}</p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-500">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-gray-700"
                    onClick={() => handleCopyLink(event.id)}
                  >
                    <Copy className="w-3 h-3" /> Copy link
                  </button>
                  {isOwnComment && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDeleteComment(event.id)}
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  )}
                  {isInternal && (
                    <span className="inline-flex items-center text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded px-2 py-0.5">
                      Internal
                    </span>
                  )}
                  {event.metadata && event.metadata['action'] && (
                    <span className="inline-flex items-center text-[10px] font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded px-2 py-0.5">
                      {String(event.metadata['action']).replaceAll('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => activityQuery.fetchNextPage()}
          className="btn-secondary text-xs"
          disabled={activityQuery.isFetchingNextPage}
        >
          {activityQuery.isFetchingNextPage ? 'Loading...' : 'Load more activity'}
        </button>
      )}
    </div>
  )
}

