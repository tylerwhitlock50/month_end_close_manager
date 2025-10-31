/**
 * MSW API Mock Handlers
 * 
 * Mock HTTP handlers for API endpoints using Mock Service Worker (MSW)
 */

import { http, HttpResponse } from 'msw'

const API_URL = 'http://localhost:8000'

// Mock data
const mockUser = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
  department: 'Finance',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
}

const mockPeriod = {
  id: 1,
  name: 'January 2024',
  month: 1,
  year: 2024,
  close_type: 'monthly',
  status: 'in_progress',
  target_close_date: '2024-02-05',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
}

const mockTask = {
  id: 1,
  name: 'Bank Reconciliation',
  description: 'Reconcile all bank accounts',
  period_id: 1,
  owner_id: 1,
  status: 'not_started',
  department: 'Accounting',
  priority: 5,
  owner: mockUser,
  period: mockPeriod,
  file_count: 0,
  pending_approvals: 0,
  dependencies: [],
}

export const handlers = [
  // Authentication endpoints
  http.post(`${API_URL}/api/auth/login`, async () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      token_type: 'bearer',
    })
  }),

  http.post(`${API_URL}/api/auth/register`, async () => {
    return HttpResponse.json(mockUser, { status: 201 })
  }),

  // User endpoints
  http.get(`${API_URL}/api/users/me`, () => {
    return HttpResponse.json(mockUser)
  }),

  http.get(`${API_URL}/api/users/`, () => {
    return HttpResponse.json([mockUser])
  }),

  http.get(`${API_URL}/api/users/:id`, ({ params }) => {
    return HttpResponse.json({ ...mockUser, id: Number(params.id) })
  }),

  // Period endpoints
  http.get(`${API_URL}/api/periods/`, () => {
    return HttpResponse.json([mockPeriod])
  }),

  http.get(`${API_URL}/api/periods/:id`, ({ params }) => {
    return HttpResponse.json({ ...mockPeriod, id: Number(params.id) })
  }),

  http.post(`${API_URL}/api/periods/`, async () => {
    return HttpResponse.json(mockPeriod, { status: 201 })
  }),

  // Task endpoints
  http.get(`${API_URL}/api/tasks/`, () => {
    return HttpResponse.json([mockTask])
  }),

  http.get(`${API_URL}/api/tasks/:id`, ({ params }) => {
    return HttpResponse.json({ ...mockTask, id: Number(params.id) })
  }),

  http.post(`${API_URL}/api/tasks/`, async () => {
    return HttpResponse.json(mockTask, { status: 201 })
  }),

  http.put(`${API_URL}/api/tasks/:id`, async ({ params }) => {
    return HttpResponse.json({ ...mockTask, id: Number(params.id) })
  }),

  http.delete(`${API_URL}/api/tasks/:id`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Dashboard endpoints
  http.get(`${API_URL}/api/dashboard/stats`, () => {
    return HttpResponse.json({
      total_tasks: 10,
      completed_tasks: 5,
      in_progress_tasks: 3,
      overdue_tasks: 1,
      tasks_due_today: 1,
      completion_percentage: 50,
      blocked_tasks: [],
      review_tasks: [],
      at_risk_tasks: [],
      critical_path_tasks: [],
    })
  }),

  http.get(`${API_URL}/api/dashboard/my-reviews`, () => {
    return HttpResponse.json({
      review_tasks: [],
      pending_approvals: [],
      total_pending: 0,
      overdue_count: 0,
    })
  }),

  // File endpoints
  http.get(`${API_URL}/api/files/period/:id/all`, () => {
    return HttpResponse.json({
      period: mockPeriod,
      period_files: [],
      task_files: [],
      trial_balance_files: [],
    })
  }),

  http.post(`${API_URL}/api/files/upload-period`, async ({ request }) => {
    try {
      // Accessing formData() in Node test environments can throw depending on
      // the underlying implementation. We touch the body stream to ensure the
      // payload is consumed without blocking the response, but fall back quietly
      // if not supported so tests keep running.
      if (typeof request.formData === 'function') {
        await request.formData()
      } else if (typeof request.arrayBuffer === 'function') {
        await request.arrayBuffer()
      }
    } catch (error) {
      // Ignore body parsing issues during tests; the contract we're verifying is
      // that the client issues a multipart POST.
    }

    return HttpResponse.json({ success: true }, { status: 201 })
  }),

  http.options(`${API_URL}/api/files/upload-period`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${API_URL}/api/files/upload`, async ({ request }) => {
    try {
      if (typeof request.formData === 'function') {
        await request.formData()
      } else if (typeof request.arrayBuffer === 'function') {
        await request.arrayBuffer()
      }
    } catch (error) {
      // Safe no-op for environments without multipart parser support.
    }

    return HttpResponse.json({ success: true }, { status: 201 })
  }),

  http.options(`${API_URL}/api/files/upload`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete(`${API_URL}/api/files/:id`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.options(`${API_URL}/api/files/:id`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  // Approval endpoints
  http.put(`${API_URL}/api/approvals/:id`, async ({ request, params }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: Number(params.id),
      status: body.status,
      notes: body.notes ?? '',
      updated_at: new Date().toISOString(),
    })
  }),

  http.options(`${API_URL}/api/approvals/:id`, () => {
    return new HttpResponse(null, { status: 204 })
  }),
]

