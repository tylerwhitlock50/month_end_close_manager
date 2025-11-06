/**
 * Format a date string to a localized date format
 * @param dateString ISO date string
 * @returns Formatted date string (e.g., "Jan 15, 2024")
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return ''

  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a date string to a localized date and time format
 * @param dateString ISO date string
 * @returns Formatted date and time string (e.g., "Jan 15, 2024 3:45 PM")
 */
export const formatDateTime = (dateString: string): string => {
  if (!dateString) return ''

  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Get a human-readable label for a task status
 * @param status Task status code
 * @returns Human-readable status label
 */
export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    review: 'Ready for Review',
    complete: 'Complete',
    blocked: 'Blocked',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    draft: 'Draft',
    active: 'Active',
    closed: 'Closed',
  }

  return labels[status] || status
}

/**
 * Get a Tailwind CSS color class for a task status
 * @param status Task status code
 * @returns Tailwind CSS color class
 */
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    review: 'bg-yellow-100 text-yellow-700',
    complete: 'bg-green-100 text-green-700',
    blocked: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-blue-100 text-blue-700',
    closed: 'bg-gray-100 text-gray-700',
  }

  return colors[status] || 'bg-gray-100 text-gray-700'
}

/**
 * Format a file size in bytes to a human-readable format
 * @param bytes File size in bytes
 * @returns Formatted file size (e.g., "1.5 MB")
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Calculate percentage with decimal places
 * @param value Current value
 * @param total Total value
 * @param decimals Number of decimal places (default: 0)
 * @returns Percentage value
 */
export const calculatePercentage = (value: number, total: number, decimals: number = 0): number => {
  if (total === 0) return 0
  return Number(((value / total) * 100).toFixed(decimals))
}

/**
 * Check if a date is overdue
 * @param dateString ISO date string
 * @returns True if the date is in the past
 */
export const isOverdue = (dateString: string): boolean => {
  if (!dateString) return false

  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return date < today
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 * @param dateString ISO date string
 * @returns Relative time string
 */
export const getRelativeTime = (dateString: string): string => {
  if (!dateString) return ''

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffSec = Math.floor(Math.abs(diffMs) / 1000)
  const isPast = diffMs < 0

  if (diffSec < 60) {
    return isPast ? 'just now' : 'in a moment'
  }

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {
    return isPast ? `${diffMin} min ago` : `in ${diffMin} min`
  }

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) {
    return isPast ? `${diffHour} hour${diffHour > 1 ? 's' : ''} ago` : `in ${diffHour} hour${diffHour > 1 ? 's' : ''}`
  }

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) {
    return isPast ? `${diffDay} day${diffDay > 1 ? 's' : ''} ago` : `in ${diffDay} day${diffDay > 1 ? 's' : ''}`
  }

  const diffWeek = Math.floor(diffDay / 7)
  if (diffWeek < 4) {
    return isPast ? `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago` : `in ${diffWeek} week${diffWeek > 1 ? 's' : ''}`
  }

  return formatDate(dateString)
}

/**
 * Truncate text to a maximum length
 * @param text Text to truncate
 * @param maxLength Maximum length
 * @returns Truncated text with ellipsis if needed
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

/**
 * Generate initials from a name
 * @param name Full name
 * @returns Initials (e.g., "John Doe" -> "JD")
 */
export const getInitials = (name: string): string => {
  if (!name) return ''

  const parts = name.trim().split(' ')
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase()
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

/**
 * Debounce function
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 * @returns Debounced function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Class names helper to conditionally join class strings
 * @param classes Class names or conditional objects
 * @returns Joined class string
 */
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ')
}
