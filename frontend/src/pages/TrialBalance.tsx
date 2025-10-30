import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download
} from 'lucide-react'
import api from '../lib/api'
import { formatDate } from '../lib/utils'
import TrialBalanceAccountModal from '../components/TrialBalanceAccountModal'

interface Period {
  id: number
  name: string
  status: string
  target_close_date?: string
}

interface TrialBalanceAttachment {
  id: number
  original_filename: string
  file_size: number
  is_external_link: boolean
  external_url?: string
  uploaded_at: string
  description?: string
}

interface TrialBalanceValidationItem {
  id: number
  task?: { id: number; name: string; status: string }
  task_id?: number
  supporting_amount: number
  difference: number
  matches_balance: boolean
  notes?: string
  evidence_original_filename?: string
  evidence_size?: number
  evidence_mime_type?: string
  evidence_file_date?: string
  evidence_uploaded_at?: string
  evidence_url?: string
}

interface TrialBalanceAccount {
  id: number
  account_number: string
  account_name: string
  account_type?: string
  ending_balance?: number
  debit?: number
  credit?: number
  is_verified: boolean
  notes?: string
  tasks: Array<{ id: number; name: string; status: string }>
  attachments: TrialBalanceAttachment[]
  validations: TrialBalanceValidationItem[]
}

interface TrialBalanceResponse {
  id: number
  name: string
  total_debit?: number
  total_credit?: number
  total_balance?: number
  uploaded_at: string
  accounts: TrialBalanceAccount[]
}

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null) return '-' 
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

export default function TrialBalance() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | ''>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null)
  const showAccountModal = activeAccountId !== null

  const periodsQuery = useQuery({
    queryKey: ['periods'],
    queryFn: async () => {
      const response = await api.get('/api/periods/')
      return response.data as Period[]
    },
  })

  const trialBalanceQuery = useQuery({
    queryKey: ['trial-balance', selectedPeriodId],
    enabled: Boolean(selectedPeriodId),
    queryFn: async () => {
      if (!selectedPeriodId) return null
      try {
        const response = await api.get(`/api/trial-balance/${selectedPeriodId}`)
        return response.data as TrialBalanceResponse
      } catch (error: any) {
        if (error.response?.status === 404) {
          return null
        }
        throw error
      }
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (payload: { periodId: number; file: File; replaceExisting: boolean }) => {
      const formData = new FormData()
      formData.append('file', payload.file)

      const response = await api.post(
        `/api/trial-balance/${payload.periodId}/import?replace_existing=${payload.replaceExisting}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      return response.data
    },
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Trial balance uploaded successfully.' })
      setSelectedFile(null)
      trialBalanceQuery.refetch()
    },
    onError: (error: any) => {
      setFeedback({
        type: 'error',
        message: error.response?.data?.detail || 'Failed to upload trial balance. Please confirm the CSV format.',
      })
    },
  })

  const handleUpload = () => {
    setFeedback(null)
    if (!selectedPeriodId) {
      setFeedback({ type: 'error', message: 'Select a period before uploading a trial balance.' })
      return
    }
    if (!selectedFile) {
      setFeedback({ type: 'error', message: 'Choose a CSV file to upload.' })
      return
    }

    uploadMutation.mutate({
      periodId: selectedPeriodId,
      file: selectedFile,
      replaceExisting,
    })
  }

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/api/trial-balance/template', {
        responseType: 'blob',
      })

      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'trial_balance_template.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: error.response?.data?.detail || 'Unable to download the trial balance template right now.',
      })
    }
  }

  const currentPeriod = periodsQuery.data?.find((period) => period.id === selectedPeriodId)
  const trialBalance = trialBalanceQuery.data

  const activeAccount = useMemo(() => {
    if (!trialBalance || activeAccountId === null) {
      return null
    }
    return trialBalance.accounts.find((accountItem) => accountItem.id === activeAccountId) || null
  }, [trialBalance, activeAccountId])

  useEffect(() => {
    if (activeAccountId !== null && !activeAccount) {
      setActiveAccountId(null)
    }
  }, [activeAccount, activeAccountId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-8 h-8 text-primary-600" /> Trial Balance
          </h1>
          <p className="text-gray-600 mt-1">
            Upload your monthly trial balance, review balances, and connect accounts to tasks.
          </p>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="label">Close Period</label>
            <select
              className="input"
              value={selectedPeriodId}
              onChange={(event) => {
                const value = event.target.value
                setSelectedPeriodId(value ? Number(value) : '')
                setFeedback(null)
              }}
            >
              <option value="">Select a period</option>
              {periodsQuery.data?.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="label">Trial Balance CSV</label>
            <input
              type="file"
              accept=".csv"
              className="input"
              onChange={(event) => {
                const file = event.target.files?.[0]
                setSelectedFile(file ?? null)
              }}
            />
            {selectedFile && (
              <p className="text-xs text-gray-500 mt-1">{selectedFile.name}</p>
            )}
          </div>

          <div className="md:col-span-1 flex flex-col justify-between">
            <label className="label">Options</label>
            <label className="inline-flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                className="mr-2"
                checked={replaceExisting}
                onChange={(event) => setReplaceExisting(event.target.checked)}
              />
              Replace existing trial balance for this period
            </label>
            {currentPeriod?.target_close_date && (
              <p className="text-xs text-gray-500 mt-2">
                Target close date: {formatDate(currentPeriod.target_close_date)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={handleDownloadTemplate}
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
          >
            <Upload className="w-4 h-4" />
            {uploadMutation.isPending ? 'Uploading...' : 'Upload Trial Balance'}
          </button>
          {selectedPeriodId && (
            <button
              className="btn-secondary flex items-center gap-2"
              onClick={() => trialBalanceQuery.refetch()}
              disabled={trialBalanceQuery.isFetching}
            >
              <RefreshCw className={`w-4 h-4 ${trialBalanceQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>

        {feedback && (
          <div
            className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 mt-0.5" />
            )}
            <p>{feedback.message}</p>
          </div>
        )}
      </div>

      {selectedPeriodId ? (
        trialBalanceQuery.isLoading ? (
          <div className="card text-center py-12">
            <p className="text-gray-600">Loading trial balance...</p>
          </div>
        ) : trialBalance ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="card">
                <p className="text-xs uppercase text-gray-500">Uploaded</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {new Date(trialBalance.uploaded_at).toLocaleString()}
                </p>
              </div>
              <div className="card">
                <p className="text-xs uppercase text-gray-500">Total Debit</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {formatCurrency(trialBalance.total_debit)}
                </p>
              </div>
              <div className="card">
                <p className="text-xs uppercase text-gray-500">Total Credit</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {formatCurrency(trialBalance.total_credit)}
                </p>
              </div>
              <div className="card">
                <p className="text-xs uppercase text-gray-500">Net Balance</p>
                <p className={`text-lg font-semibold mt-1 ${
                  (trialBalance.total_balance ?? 0) === 0 ? 'text-green-600' : 'text-gray-900'
                }`}>
                  {formatCurrency(trialBalance.total_balance)}
                </p>
              </div>
            </div>

            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Accounts ({trialBalance.accounts.length})</h2>
                  <p className="text-sm text-gray-500">Review balances and link supporting tasks.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Debit
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credit
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ending Balance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Linked Tasks
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {trialBalance.accounts.map((account) => (
                      <tr key={account.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{account.account_name}</div>
                          <div className="text-sm text-gray-500">{account.account_number}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {account.account_type || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                          {formatCurrency(account.debit)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                          {formatCurrency(account.credit)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                          {formatCurrency(account.ending_balance)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {account.tasks.length > 0
                            ? account.tasks.map((task) => task.name).join(', ')
                            : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`badge ${account.is_verified ? 'badge-green' : 'badge-yellow'}`}>
                            {account.is_verified ? 'Verified' : 'Needs Review'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            className="btn-secondary text-xs"
                            onClick={() => setActiveAccountId(account.id)}
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-600">
              No trial balance uploaded for this period yet. Select a CSV above to get started.
            </p>
          </div>
        )
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-600">Select a period to view or upload a trial balance.</p>
        </div>
      )}

      {showAccountModal && activeAccount && selectedPeriodId && (
        <TrialBalanceAccountModal
          periodId={Number(selectedPeriodId)}
          account={activeAccount}
          onClose={() => setActiveAccountId(null)}
          onRefetch={() => trialBalanceQuery.refetch()}
        />
      )}
    </div>
  )
}
