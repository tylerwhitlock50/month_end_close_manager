import axios from 'axios'

// Get API base URL from environment variable
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add authentication token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 errors by redirecting to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Export default axios instance
export default api

// File Cabinet API functions
export const fetchPeriodFiles = async (periodId: number) => {
  const response = await api.get(`/api/files/period/${periodId}`)
  return response.data
}

export const fetchPriorPeriodFiles = async (periodId: number) => {
  const response = await api.get(`/api/files/period/${periodId}/prior`)
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
  link.setAttribute('download', `${periodName}_files.zip`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export const deleteFile = async (fileId: number) => {
  const response = await api.delete(`/api/files/${fileId}`)
  return response.data
}

// File Upload API functions
export const uploadPeriodFile = async (periodId: number, file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('period_id', periodId.toString())

  const response = await api.post('/api/files/upload/period', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const uploadTaskFile = async (taskId: number, file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('task_id', taskId.toString())

  const response = await api.post('/api/files/upload/task', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

// Reviews/Approvals API functions
export const fetchMyReviews = async () => {
  const response = await api.get('/api/approvals/my-reviews')
  return response.data
}

export const approveApproval = async (approvalId: number) => {
  const response = await api.post(`/api/approvals/${approvalId}/approve`)
  return response.data
}

export const rejectApproval = async (approvalId: number) => {
  const response = await api.post(`/api/approvals/${approvalId}/reject`)
  return response.data
}

export const requestRevision = async (approvalId: number) => {
  const response = await api.post(`/api/approvals/${approvalId}/request-revision`)
  return response.data
}

// Search API function
export const searchEverything = async (query: string) => {
  const response = await api.get('/api/search', {
    params: { q: query },
  })
  return response.data
}

// Period Summary API function
export const fetchPeriodSummary = async (periodId: number) => {
  const response = await api.get(`/api/periods/${periodId}/summary`)
  return response.data
}

// Workflow API functions
export const fetchTemplateWorkflow = async (closeType?: string) => {
  const response = await api.get('/api/task-templates/workflow', {
    params: closeType ? { close_type: closeType } : {},
  })
  return response.data
}

export const fetchPeriodWorkflow = async (periodId: number) => {
  const response = await api.get(`/api/tasks/workflow/${periodId}`)
  return response.data
}

export const updateTaskPosition = async (taskId: number, x: number, y: number) => {
  const response = await api.patch(`/api/tasks/${taskId}/position`, { x, y })
  return response.data
}

export const updateTemplatePosition = async (templateId: number, x: number, y: number) => {
  const response = await api.patch(`/api/task-templates/${templateId}/position`, { x, y })
  return response.data
}

export const updateTaskDependencies = async (taskId: number, dependencyIds: number[]) => {
  const response = await api.patch(`/api/tasks/${taskId}/dependencies`, {
    dependency_ids: dependencyIds,
  })
  return response.data
}

export const updateTemplateDependencies = async (templateId: number, dependencyIds: number[]) => {
  const response = await api.patch(`/api/task-templates/${templateId}/dependencies`, {
    dependency_ids: dependencyIds,
  })
  return response.data
}
