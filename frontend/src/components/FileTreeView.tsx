import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  Download,
  Trash2,
  ExternalLink,
  Calendar,
  User,
} from 'lucide-react'

interface FileInfo {
  id: number
  filename: string
  original_filename: string
  file_size: number
  mime_type?: string
  description?: string
  file_date?: string
  uploaded_at: string
  is_external_link: boolean
  external_url?: string
  uploaded_by?: {
    id: number
    name: string
    email: string
  }
}

interface TaskWithFiles {
  id: number
  name: string
  status: string
  files: FileInfo[]
}

interface FileTreeViewProps {
  tasks: TaskWithFiles[]
  onDownload: (file: FileInfo) => void
  onDelete: (fileId: number) => void
}

export default function FileTreeView({
  tasks,
  onDownload,
  onDelete,
}: FileTreeViewProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set())

  const toggleTask = (taskId: number) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      not_started: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      review: 'bg-yellow-100 text-yellow-700',
      complete: 'bg-green-100 text-green-700',
      blocked: 'bg-red-100 text-red-700',
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <FileIcon className="w-5 h-5 text-gray-400" />

    if (mimeType.startsWith('image/'))
      return <FileIcon className="w-5 h-5 text-blue-500" />
    if (mimeType.includes('pdf'))
      return <FileIcon className="w-5 h-5 text-red-500" />
    if (
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel') ||
      mimeType.includes('csv')
    )
      return <FileIcon className="w-5 h-5 text-green-500" />
    if (mimeType.includes('word') || mimeType.includes('document'))
      return <FileIcon className="w-5 h-5 text-blue-600" />

    return <FileIcon className="w-5 h-5 text-gray-400" />
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No tasks with files found for this period
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div key={task.id} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Task Header */}
          <button
            onClick={() => toggleTask(task.id)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center space-x-3">
              {expandedTasks.has(task.id) ? (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500" />
              )}
              <span className="font-medium text-gray-900">{task.name}</span>
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                  task.status
                )}`}
              >
                {task.status.replace('_', ' ')}
              </span>
              <span className="text-sm text-gray-500">
                ({task.files.length} file{task.files.length !== 1 ? 's' : ''})
              </span>
            </div>
          </button>

          {/* Files List */}
          {expandedTasks.has(task.id) && (
            <div className="divide-y divide-gray-200">
              {task.files.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No files attached to this task
                </div>
              ) : (
                task.files.map((file) => (
                  <div
                    key={file.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        {getFileIcon(file.mime_type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.original_filename}
                            </p>
                            {file.is_external_link && (
                              <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            )}
                          </div>

                          {file.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {file.description}
                            </p>
                          )}

                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span>{formatFileSize(file.file_size)}</span>
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(file.uploaded_at)}</span>
                            </span>
                            {file.uploaded_by && (
                              <span className="flex items-center space-x-1">
                                <User className="w-3 h-3" />
                                <span>{file.uploaded_by.name}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => onDownload(file)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `Are you sure you want to delete "${file.original_filename}"?`
                              )
                            ) {
                              onDelete(file.id)
                            }
                          }}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}








