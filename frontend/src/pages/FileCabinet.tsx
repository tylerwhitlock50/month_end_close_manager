import { useState, useEffect } from 'react'
import {
  FolderOpen,
  Folder,
  FolderClosed,
  Upload,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  Trash2,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
} from 'lucide-react'
import api, { fetchPeriodFiles, downloadPeriodZip, deleteFile } from '../lib/api'
import FileUploadModal from '../components/FileUploadModal'

interface Period {
  id: number
  name: string
  month: number
  year: number
  status: string
}

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

interface TrialBalanceFile {
  id: number
  account_id: number
  account_number: string
  account_name: string
  filename: string
  original_filename: string
  file_size: number
  mime_type?: string
  description?: string
  file_date?: string
  uploaded_at: string
  file_path: string
}

interface FileCabinetData {
  period: Period
  period_files: FileInfo[]
  task_files: TaskWithFiles[]
  trial_balance_files: TrialBalanceFile[]
}

export default function FileCabinet() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null)
  const [cabinetData, setCabinetData] = useState<FileCabinetData | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['period', 'tasks', 'trial-balance'])
  )
  const [downloadingZip, setDownloadingZip] = useState(false)

  useEffect(() => {
    loadPeriods()
  }, [])

  useEffect(() => {
    if (selectedPeriod) {
      loadFileCabinetData()
    }
  }, [selectedPeriod])

  // Auto-expand task folders when data loads
  useEffect(() => {
    if (cabinetData) {
      const taskFolders = cabinetData.task_files.map((task) => `task-${task.id}`)
      setExpandedSections((prev) => {
        const newSet = new Set(prev)
        taskFolders.forEach((folder) => newSet.add(folder))
        return newSet
      })
    }
  }, [cabinetData])

  const loadPeriods = async () => {
    try {
      const response = await api.get('/api/periods')
      setPeriods(response.data)
      if (response.data.length > 0 && !selectedPeriod) {
        setSelectedPeriod(response.data[0].id)
      }
    } catch (error) {
      console.error('Failed to load periods:', error)
    }
  }

  const loadFileCabinetData = async () => {
    if (!selectedPeriod) return

    setLoading(true)
    try {
      const data = await fetchPeriodFiles(selectedPeriod)
      setCabinetData(data)
    } catch (error) {
      console.error('Failed to load file cabinet data:', error)
      alert('Failed to load files. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadZip = async () => {
    if (!selectedPeriod || !cabinetData) return

    setDownloadingZip(true)
    try {
      await downloadPeriodZip(selectedPeriod, cabinetData.period.name)
    } catch (error) {
      console.error('Failed to download zip:', error)
      alert('Failed to download zip file. Please try again.')
    } finally {
      setDownloadingZip(false)
    }
  }

  const handleDownloadFile = (file: FileInfo) => {
    if (file.is_external_link && file.external_url) {
      window.open(file.external_url, '_blank')
    } else {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      window.open(`${API_URL}/files/${file.task_id || 'period'}/${file.filename}`, '_blank')
    }
  }

  const handleDeleteFile = async (fileId: number) => {
    try {
      await deleteFile(fileId)
      loadFileCabinetData()
    } catch (error) {
      console.error('Failed to delete file:', error)
      alert('Failed to delete file. Please try again.')
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
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

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <FileText className="w-4 h-4 text-gray-500" />

    if (mimeType.startsWith('image/'))
      return <ImageIcon className="w-4 h-4 text-blue-500" />
    if (mimeType.includes('pdf'))
      return <FileText className="w-4 h-4 text-red-500" />
    if (
      mimeType.includes('spreadsheet') ||
      mimeType.includes('excel') ||
      mimeType.includes('csv')
    )
      return <FileSpreadsheet className="w-4 h-4 text-green-600" />
    if (mimeType.includes('word') || mimeType.includes('document'))
      return <FileText className="w-4 h-4 text-blue-600" />

    return <FileText className="w-4 h-4 text-gray-500" />
  }

  const toggleFolder = (folderId: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(folderId)) {
        newSet.delete(folderId)
      } else {
        newSet.add(folderId)
      }
      return newSet
    })
  }

  const renderFileRow = (file: FileInfo, level: number = 2) => {
    return (
      <div
        key={file.id}
        className="flex items-center hover:bg-blue-50 px-2 py-1 group cursor-pointer"
        style={{ paddingLeft: `${level * 20}px` }}
        onClick={() => handleDownloadFile(file)}
      >
        <div className="flex items-center flex-1 min-w-0">
          {getFileIcon(file.mime_type)}
          <span className="ml-2 text-sm text-gray-700 truncate">{file.original_filename}</span>
          {file.is_external_link && (
            <ExternalLink className="w-3 h-3 text-gray-400 ml-1 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-gray-500 mr-2">{formatFileSize(file.file_size)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDownloadFile(file)
            }}
            className="p-1 text-gray-600 hover:text-blue-600 rounded"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (
                confirm(
                  `Are you sure you want to delete "${file.original_filename}"?`
                )
              ) {
                handleDeleteFile(file.id)
              }
            }}
            className="p-1 text-gray-600 hover:text-red-600 rounded"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  const renderTrialBalanceFileRow = (file: TrialBalanceFile, level: number = 2) => {
    return (
      <div
        key={file.id}
        className="flex items-center hover:bg-blue-50 px-2 py-1 group cursor-pointer"
        style={{ paddingLeft: `${level * 20}px` }}
        onClick={() => {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
          window.open(`${API_URL}${file.file_path}`, '_blank')
        }}
      >
        <div className="flex items-center flex-1 min-w-0">
          {getFileIcon(file.mime_type)}
          <span className="ml-2 text-sm text-gray-700 truncate">
            {file.original_filename}
          </span>
          <span className="ml-2 text-xs text-gray-500 truncate">
            ({file.account_number} - {file.account_name})
          </span>
        </div>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-gray-500 mr-2">{formatFileSize(file.file_size)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
              window.open(`${API_URL}${file.file_path}`, '_blank')
            }}
            className="p-1 text-gray-600 hover:text-blue-600 rounded"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <FolderOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">File Cabinet</h1>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={loadFileCabinetData}
              disabled={!selectedPeriod || loading}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setUploadModalOpen(true)}
              disabled={!selectedPeriod}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Files</span>
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={!selectedPeriod || downloadingZip}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingZip ? 'Preparing...' : 'Download All as ZIP'}</span>
            </button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Period:</label>
          <select
            value={selectedPeriod || ''}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content - File Tree View */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : cabinetData ? (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          {/* File Tree Container */}
          <div className="font-mono text-sm">
            {/* Root: Period Name */}
            <div className="flex items-center px-3 py-2 bg-gray-50 border-b border-gray-200">
              <FolderOpen className="w-4 h-4 text-yellow-600 mr-2" />
              <span className="font-semibold text-gray-900">{cabinetData.period.name}</span>
            </div>

            {/* Period Files Folder */}
            <div>
              <div
                className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer select-none"
                style={{ paddingLeft: '20px' }}
                onClick={() => toggleFolder('period')}
              >
                {expandedSections.has('period') ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 mr-1" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 mr-1" />
                )}
                {expandedSections.has('period') ? (
                  <FolderOpen className="w-4 h-4 text-yellow-600 mr-2" />
                ) : (
                  <FolderClosed className="w-4 h-4 text-yellow-600 mr-2" />
                )}
                <span className="text-gray-700">Period Files</span>
                <span className="ml-2 text-xs text-gray-500">
                  ({cabinetData.period_files.length})
                </span>
              </div>
              {expandedSections.has('period') && (
                <div>
                  {cabinetData.period_files.length === 0 ? (
                    <div className="px-3 py-1 text-xs text-gray-500 italic" style={{ paddingLeft: '60px' }}>
                      No files
                    </div>
                  ) : (
                    cabinetData.period_files.map((file) => renderFileRow(file, 2))
                  )}
                </div>
              )}
            </div>

            {/* Task Files Folder */}
            <div>
              <div
                className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer select-none"
                style={{ paddingLeft: '20px' }}
                onClick={() => toggleFolder('tasks')}
              >
                {expandedSections.has('tasks') ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 mr-1" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 mr-1" />
                )}
                {expandedSections.has('tasks') ? (
                  <FolderOpen className="w-4 h-4 text-yellow-600 mr-2" />
                ) : (
                  <FolderClosed className="w-4 h-4 text-yellow-600 mr-2" />
                )}
                <span className="text-gray-700">Task Files</span>
                <span className="ml-2 text-xs text-gray-500">
                  ({cabinetData.task_files.length} tasks)
                </span>
              </div>
              {expandedSections.has('tasks') && (
                <div>
                  {cabinetData.task_files.length === 0 ? (
                    <div className="px-3 py-1 text-xs text-gray-500 italic" style={{ paddingLeft: '60px' }}>
                      No tasks with files
                    </div>
                  ) : (
                    cabinetData.task_files.map((task) => (
                      <div key={task.id}>
                        {/* Task Folder */}
                        <div
                          className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer select-none"
                          style={{ paddingLeft: '40px' }}
                          onClick={() => toggleFolder(`task-${task.id}`)}
                        >
                          {expandedSections.has(`task-${task.id}`) ? (
                            <ChevronDown className="w-4 h-4 text-gray-500 mr-1" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500 mr-1" />
                          )}
                          {expandedSections.has(`task-${task.id}`) ? (
                            <Folder className="w-4 h-4 text-blue-500 mr-2" />
                          ) : (
                            <FolderClosed className="w-4 h-4 text-blue-500 mr-2" />
                          )}
                          <span className="text-gray-700">{task.name}</span>
                          <span className="ml-2 text-xs text-gray-500">
                            ({task.files.length})
                          </span>
                        </div>
                        {/* Task Files */}
                        {expandedSections.has(`task-${task.id}`) && (
                          <div>
                            {task.files.length === 0 ? (
                              <div className="px-3 py-1 text-xs text-gray-500 italic" style={{ paddingLeft: '80px' }}>
                                No files
                              </div>
                            ) : (
                              task.files.map((file) => renderFileRow(file, 3))
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Trial Balance Files Folder */}
            <div>
              <div
                className="flex items-center px-3 py-1.5 hover:bg-gray-50 cursor-pointer select-none"
                style={{ paddingLeft: '20px' }}
                onClick={() => toggleFolder('trial-balance')}
              >
                {expandedSections.has('trial-balance') ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 mr-1" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 mr-1" />
                )}
                {expandedSections.has('trial-balance') ? (
                  <FolderOpen className="w-4 h-4 text-yellow-600 mr-2" />
                ) : (
                  <FolderClosed className="w-4 h-4 text-yellow-600 mr-2" />
                )}
                <span className="text-gray-700">Trial Balance Files</span>
                <span className="ml-2 text-xs text-gray-500">
                  ({cabinetData.trial_balance_files.length})
                </span>
              </div>
              {expandedSections.has('trial-balance') && (
                <div>
                  {cabinetData.trial_balance_files.length === 0 ? (
                    <div className="px-3 py-1 text-xs text-gray-500 italic" style={{ paddingLeft: '60px' }}>
                      No trial balance files
                    </div>
                  ) : (
                    cabinetData.trial_balance_files.map((file) =>
                      renderTrialBalanceFileRow(file, 2)
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          Select a period to view files
        </div>
      )}

      {/* Upload Modal */}
      {cabinetData && (
        <FileUploadModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          periodId={selectedPeriod!}
          tasks={cabinetData.task_files.map((t) => ({ id: t.id, name: t.name }))}
          onUploadComplete={loadFileCabinetData}
        />
      )}
    </div>
  )
}

