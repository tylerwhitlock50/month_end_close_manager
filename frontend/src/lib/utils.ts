import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    not_started: 'gray',
    in_progress: 'blue',
    review: 'yellow',
    complete: 'green',
    blocked: 'red',
  }
  return colors[status] || 'gray'
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    review: 'Review',
    complete: 'Complete',
    blocked: 'Blocked',
  }
  return labels[status] || status
}

export function getPriorityColor(priority: number): string {
  if (priority >= 8) return 'red'
  if (priority >= 5) return 'yellow'
  return 'gray'
}

