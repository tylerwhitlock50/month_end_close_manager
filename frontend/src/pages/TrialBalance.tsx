import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Sparkles,
  ShieldAlert,
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

interface TrialBalanceSummaryResponse {
  trial_balance_id: number
  period_id: number
  account_count: number
  total_debit?: number | null
  total_credit?: number | null
  total_balance?: number | null
  metadata?: Record<string, string | null> | null
  warnings?: string[]
}

interface TrialBalanceComparisonAccount {
  account_number: string
  account_name?: string | null
  current_account_id?: number | null
  previous_account_id?: number | null
  current_balance?: number | null
  previous_balance?: number | null
  delta?: number | null
  delta_percent?: number | null
}

interface TrialBalanceComparisonResponse {
  period_id: number
  previous_period_id?: number | null
  accounts: TrialBalanceComparisonAccount[]
}

type TrialBalanceTableRow = {
  accountNumber: string
  current: TrialBalanceAccount | null
  comparison?: TrialBalanceComparisonAccount
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
  const [importMode, setImportMode] = useState<'standard' | 'netsuite'>('standard')
  const [importSummary, setImportSummary] = useState<TrialBalanceSummaryResponse | null>(null)
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

  const comparisonQuery = useQuery({
    queryKey: ['trial-balance-comparison', selectedPeriodId],
    enabled: Boolean(selectedPeriodId),
    queryFn: async () => {
      if (!selectedPeriodId) return null
      const response = await api.get(`/api/trial-balance/${selectedPeriodId}/comparison`)
      return response.data as TrialBalanceComparisonResponse
    },
  })

  const successMessageForMode = (mode: 'standard' | 'netsuite') =>
    mode === 'netsuite'
      ? 'NetSuite trial balance imported successfully.'
      : 'Trial balance uploaded successfully.'

  const uploadMutation = useMutation<
    TrialBalanceSummaryResponse,
    any,
    { periodId: number; file: File; replaceExisting: boolean; mode: 'standard' | 'netsuite' }
  >({
    mutationFn: async (payload: { periodId: number; file: File; replaceExisting: boolean; mode: 'standard' | 'netsuite' }) => {
      const formData = new FormData()
      formData.append('file', payload.file)

      const endpoint =
        payload.mode === 'netsuite'
          ? `/api/trial-balance/${payload.periodId}/import-netsuite?replace_existing=${payload.replaceExisting}`
          : `/api/trial-balance/${payload.periodId}/import?replace_existing=${payload.replaceExisting}`

      const response = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      return response.data as TrialBalanceSummaryResponse
    },
    onSuccess: (data, variables) => {
      setFeedback({ type: 'success', message: successMessageForMode(variables.mode) })
      setImportSummary(data)
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
    setImportSummary(null)
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
      mode: importMode,
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
  const comparison = comparisonQuery.data

  const previousPeriodName = useMemo(() => {
    if (!comparison?.previous_period_id) return null
    return periodsQuery.data?.find((p) => p.id === comparison.previous_period_id)?.name ?? null
  }, [comparison?.previous_period_id, periodsQuery.data])

  const comparisonMap = useMemo(() => {
    const map = new Map<string, TrialBalanceComparisonAccount>()
    comparison?.accounts.forEach((account) => {
      map.set(account.account_number, account)
    })
    return map
  }, [comparison?.accounts])

  const currentAccountMap = useMemo(() => {
    const map = new Map<string, TrialBalanceAccount>()
    trialBalance?.accounts.forEach((account) => {
      map.set(account.account_number, account)
    })
    return map
  }, [trialBalance?.accounts])

  const accountNumbers = useMemo(() => {
    const numbers = new Set<string>()
    currentAccountMap.forEach((_, key) => numbers.add(key))
    comparisonMap.forEach((_, key) => numbers.add(key))
    return Array.from(numbers).sort()
  }, [currentAccountMap, comparisonMap])

  const tableRows: TrialBalanceTableRow[] = useMemo(() => {
    return accountNumbers.map((accountNumber) => ({
      accountNumber,
      current: currentAccountMap.get(accountNumber) || null,
      comparison: comparisonMap.get(accountNumber) || undefined,
    }))
  }, [accountNumbers, currentAccountMap, comparisonMap])

  const whatsNewMetrics = useMemo(() => {
    const newAccounts = tableRows.filter(
      (row) => row.current && (!row.comparison || !row.comparison.previous_account_id)
    )
    const priorOnlyAccounts = tableRows.filter((row) => !row.current && row.comparison)
    const accountsWithoutTasks = tableRows.filter(
      (row) => row.current && row.current.tasks.length === 0
    )
    const pendingVerification = tableRows.filter(
      (row) => row.current && !row.current.is_verified
    )

    return {
      newAccounts,
      priorOnlyAccounts,
      accountsWithoutTasks,
      pendingVerification,
    }
  }, [tableRows])

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

  useEffect(() => {
    setImportSummary(null)
  }, [selectedPeriodId])

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
        <div className="flex flex-wrap items-center gap-3">
          <label className="label !mb-0">Import Mode</label>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 text-sm">
            <button
              type="button"
              onClick={() => {
                setImportMode('standard')
                setImportSummary(null)
              }}
              className={`px-4 py-2 rounded-l-lg border-r border-gray-200 ${
                importMode === 'standard' ? 'bg-white text-primary-600 font-medium shadow-sm' : 'text-gray-600'
              }`}
            >
              Standard CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setImportMode('netsuite')
                setImportSummary(null)
              }}
              className={`px-4 py-2 rounded-r-lg ${
                importMode === 'netsuite' ? 'bg-white text-primary-600 font-medium shadow-sm' : 'text-gray-600'
              }`}
            >
              NetSuite Export
            </button>
          </div>
        </div>

        {importMode === 'netsuite' && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <Sparkles className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-semibold">NetSuite upload tips</p>
              <p>
                Use the standard Trial Balance export. Totals and parent headers are ignored automatically, and balances are derived
                from debit and credit columns. Need an example? See <code>netsuite_file/TrialBalance677.csv</code>.
              </p>
            </div>
          </div>
        )}

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
                setImportSummary(null)
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
            <label className="label">{importMode === 'netsuite' ? 'NetSuite CSV' : 'Trial Balance CSV'}</label>
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

        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" className="btn-secondary flex items-center gap-2" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4" />
            Download Template
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {importMode === 'netsuite' ? 'Import from NetSuite' : 'Upload Trial Balance'}
              </>
            )}
          </button>
          {selectedPeriodId && (
            <button
              type="button"
              className="btn-secondary flex items-center gap-2"
              onClick={() => trialBalanceQuery.refetch()}
              disabled={trialBalanceQuery.isFetching}
            >
              <RefreshCw className={`w-4 h-4 ${trialBalanceQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>

        {importSummary && (
          <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 text-sm text-primary-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <FileSpreadsheet className="h-4 w-4" /> Latest import summary
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-primary-600">Accounts</p>
                <p className="text-base font-semibold">{importSummary.account_count}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-primary-600">Total Debit</p>
                <p className="text-base font-semibold">{formatCurrency(importSummary.total_debit)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-primary-600">Total Credit</p>
                <p className="text-base font-semibold">{formatCurrency(importSummary.total_credit)}</p>
              </div>
            </div>
            {importSummary.metadata && (
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                {importSummary.metadata.entity && <p><span className="font-semibold">Entity:</span> {importSummary.metadata.entity}</p>}
                {importSummary.metadata.period_label && (
                  <p><span className="font-semibold">Label:</span> {importSummary.metadata.period_label}</p>
                )}
                {importSummary.metadata.generated_at && (
                  <p><span className="font-semibold">Generated:</span> {importSummary.metadata.generated_at}</p>
                )}
              </div>
            )}
            {importSummary.warnings && importSummary.warnings.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-100 p-3 text-amber-800">
                <ShieldAlert className="h-4 w-4 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs uppercase">Import warnings</p>
                  <ul className="mt-1 space-y-1 text-sm list-disc pl-4">
                    {importSummary.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {(importSummary || whatsNewMetrics.newAccounts.length > 0 || whatsNewMetrics.accountsWithoutTasks.length > 0 || whatsNewMetrics.pendingVerification.length > 0) && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4" /> What's New This Period
            </div>
            <ul className="space-y-1">
              <li>
                <span className="font-semibold">New accounts:</span>{' '}
                {whatsNewMetrics.newAccounts.length > 0
                  ? `${whatsNewMetrics.newAccounts.length} (${whatsNewMetrics.newAccounts
                      .slice(0, 5)
                      .map((row) => row.accountNumber)
                      .join(', ')}${
                      whatsNewMetrics.newAccounts.length > 5 ? '…' : ''
                    })`
                  : 'None'}
              </li>
              <li>
                <span className="font-semibold">Accounts missing linked tasks:</span>{' '}
                {whatsNewMetrics.accountsWithoutTasks.length || 'None'}
              </li>
              <li>
                <span className="font-semibold">Accounts pending verification:</span>{' '}
                {whatsNewMetrics.pendingVerification.length || 'None'}
              </li>
              {whatsNewMetrics.priorOnlyAccounts.length > 0 && (
                <li>
                  <span className="font-semibold">Dropped from current period:</span>{' '}
                  {whatsNewMetrics.priorOnlyAccounts.length} accounts only existed in the prior period.
                </li>
              )}
            </ul>
          </div>
        )}

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
                  <h2 className="text-lg font-semibold text-gray-900">Accounts ({tableRows.length})</h2>
                  <p className="text-sm text-gray-500">Review balances and link supporting tasks.</p>
                  {comparison?.previous_period_id && (
                    <p className="text-xs text-gray-500 mt-1">
                      Comparing against {previousPeriodName ?? 'previous period'}.
                    </p>
                  )}
                  {comparisonQuery.isLoading && (
                    <p className="text-xs text-gray-400 mt-1">Loading comparison data…</p>
                  )}
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
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Prior Balance
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Δ vs Prior
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
                    {tableRows.map((row) => {
                      const currentAccount = row.current
                      const comparisonAccount = row.comparison
                      const accountName = currentAccount?.account_name || comparisonAccount?.account_name || row.accountNumber
                      const accountNumber = currentAccount?.account_number || row.accountNumber
                      const currentDebit = currentAccount?.debit ?? null
                      const currentCredit = currentAccount?.credit ?? null
                      const currentBalance = currentAccount?.ending_balance ?? comparisonAccount?.current_balance ?? null
                      const previousBalance = comparisonAccount?.previous_balance ?? null
                      const delta = comparisonAccount?.delta ?? null
                      const deltaPercent = comparisonAccount?.delta_percent ?? null
                      const deltaClass = delta === null
                        ? 'text-gray-600'
                        : delta > 0
                          ? 'text-green-600'
                          : delta < 0
                            ? 'text-red-600'
                            : 'text-gray-600'

                      return (
                        <tr key={`${accountNumber}-${currentAccount?.id ?? 'prior'}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{accountName}</div>
                            <div className="text-sm text-gray-500">{accountNumber}</div>
                            {!currentAccount && (
                              <p className="text-xs text-amber-600 mt-1">Not present in current period</p>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {currentAccount?.account_type || '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                            {formatCurrency(currentDebit)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                            {formatCurrency(currentCredit)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                            {formatCurrency(currentBalance)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                            {formatCurrency(previousBalance)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${deltaClass}`}>
                            {delta === null ? '—' : formatCurrency(delta)}
                            {deltaPercent === null ? '' : ` (${deltaPercent.toFixed(1)}%)`}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {currentAccount && currentAccount.tasks.length > 0
                              ? currentAccount.tasks.map((task) => task.name).join(', ')
                              : '—'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {currentAccount ? (
                              <span className={`badge ${currentAccount.is_verified ? 'badge-green' : 'badge-yellow'}`}>
                                {currentAccount.is_verified ? 'Verified' : 'Needs Review'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-gray-600 bg-gray-100 border border-gray-200 rounded px-2 py-0.5 text-xs">
                                Prior only
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            {currentAccount ? (
                              <button
                                className="btn-secondary text-xs"
                                onClick={() => setActiveAccountId(currentAccount.id)}
                              >
                                Manage
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
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
