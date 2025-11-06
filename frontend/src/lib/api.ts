import axios from 'axios'

function resolveApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    const apiPort = import.meta.env.VITE_API_PORT || '8000'
    const portSegment = apiPort ? `:${apiPort}` : ''
    return `${protocol}//${hostname}${portSegment}`
  }

  return 'http://backend:8000'
}

export const API_URL = resolveApiUrl()

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      try {
        localStorage.removeItem('token')
        localStorage.removeItem('auth-storage')
        sessionStorage.clear()
      } catch (storageError) {
        console.warn('Unable to clear cached auth state', storageError)
      }
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// File Cabinet API functions
export const fetchPeriodFiles = async (periodId: number) => {
  const response = await api.get(`/api/files/period/${periodId}/all`)
  return response.data
}

export const fetchPriorPeriodFiles = async (periodId: number) => {
  const response = await api.get(`/api/files/period/${periodId}/prior`)
  return response.data
}

export const uploadPeriodFile = async (
  periodId: number,
  file: File,
  description?: string,
  fileDate?: string
) => {
  const formData = new FormData()
  formData.append('file', file)
  if (description) formData.append('description', description)
  if (fileDate) formData.append('file_date', fileDate)

  const response = await api.post('/api/files/upload-period', formData, {
    params: {
      period_id: periodId,
    },
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const uploadTaskFile = async (
  taskId: number,
  file: File,
  description?: string,
  fileDate?: string
) => {
  const formData = new FormData()
  formData.append('file', file)
  if (description) formData.append('description', description)
  if (fileDate) formData.append('file_date', fileDate)

  const response = await api.post('/api/files/upload', formData, {
    params: {
      task_id: taskId,
    },
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const downloadPeriodZip = async (periodId: number, periodName: string) => {
  const response = await api.get(`/api/files/period/${periodId}/download-zip`, {
    responseType: 'blob',
  })
  
  // Create a download link
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${periodName.replace(/\s+/g, '_')}_files.zip`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const downloadFile = (fileId: number, filename: string) => {
  const link = document.createElement('a')
  link.href = `${API_URL}/files/${fileId}/${filename}`
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export const deleteFile = async (fileId: number) => {
  await api.delete(`/api/files/${fileId}`)
}

export const searchEverything = async (query: string) => {
  const response = await api.get('/api/search', {
    params: { query },
  })
  return response.data
}

export const fetchPeriodSummary = async (periodId: number) => {
  const response = await api.get(`/api/periods/${periodId}/summary`)
  return response.data
}

// Reviews API functions
export const fetchMyReviews = async (periodId?: number) => {
  const response = await api.get('/api/dashboard/my-reviews', {
    params: periodId ? { period_id: periodId } : undefined
  })
  return response.data
}

export const approveApproval = async (approvalId: number, notes?: string) => {
  const response = await api.put(`/api/approvals/${approvalId}`, {
    status: 'approved',
    notes: notes || ''
  })
  return response.data
}

export const rejectApproval = async (approvalId: number, notes: string) => {
  const response = await api.put(`/api/approvals/${approvalId}`, {
    status: 'rejected',
    notes
  })
  return response.data
}

export const requestRevision = async (approvalId: number, notes: string) => {
  const response = await api.put(`/api/approvals/${approvalId}`, {
    status: 'revision_requested',
    notes
  })
  return response.data
}

// Workflow Builder API functions
export const fetchTemplateWorkflow = async (closeType?: string) => {
  const params = closeType ? { close_type: closeType } : {}
  const response = await api.get('/api/task-templates/workflow', { params })
  return response.data
}

export const fetchPeriodWorkflow = async (periodId: number) => {
  const response = await api.get(`/api/tasks/period/${periodId}/workflow`)
  return response.data
}

export const updateTaskPosition = async (taskId: number, position_x: number, position_y: number) => {
  const response = await api.put(`/api/tasks/${taskId}/position`, { position_x, position_y })
  return response.data
}

export const updateTemplatePosition = async (templateId: number, position_x: number, position_y: number) => {
  const response = await api.put(`/api/task-templates/${templateId}/position`, { position_x, position_y })
  return response.data
}

export const updateTaskDependencies = async (taskId: number, dependencyIds: number[]) => {
  const response = await api.put(`/api/tasks/${taskId}/dependencies`, dependencyIds, {
    headers: { 'Content-Type': 'application/json' }
  })
  return response.data
}

export const updateTemplateDependencies = async (templateId: number, dependencyIds: number[]) => {
  const response = await api.put(`/api/task-templates/${templateId}/dependencies`, dependencyIds, {
    headers: { 'Content-Type': 'application/json' }
  })
  return response.data
}

export default api
