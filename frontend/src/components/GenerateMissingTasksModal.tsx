import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Sparkles, CheckSquare, Square, AlertCircle } from 'lucide-react'
import api from '../lib/api'

interface MissingTaskSuggestion {
  template_id: number
  template_name: string
  account_id: number
  account_number: string
  account_name: string
  department?: string
  estimated_hours?: number
  default_owner_id?: number
}

interface GenerateMissingTasksModalProps {
  onClose: () => void
  onSuccess: () => void
  periodId: number
  trialBalanceId: number
}

export default function GenerateMissingTasksModal({
  onClose,
  onSuccess,
  periodId,
  trialBalanceId,
}: GenerateMissingTasksModalProps) {
  const queryClient = useQueryClient()
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  // Fetch missing task suggestions from backend
  const { data: suggestions, isLoading: loadingSuggestions } = useQuery({
    queryKey: ['missing-task-suggestions', trialBalanceId],
    queryFn: async () => {
      const response = await api.get(`/api/trial-balance/${trialBalanceId}/missing-tasks`)
      return response.data as MissingTaskSuggestion[]
    },
  })

  // Group suggestions by template
  const suggestionsByTemplate = useMemo(() => {
    if (!suggestions) return {}
    
    const grouped: Record<string, MissingTaskSuggestion[]> = {}
    suggestions.forEach((suggestion) => {
      const key = `${suggestion.template_id}`
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(suggestion)
    })
    return grouped
  }, [suggestions])

  // Initialize all suggestions as selected
  useEffect(() => {
    if (suggestions && selectedSuggestions.size === 0) {
      const allKeys = suggestions.map(s => `${s.template_id}-${s.account_id}`)
      setSelectedSuggestions(new Set(allKeys))
    }
  }, [suggestions, selectedSuggestions.size])

  const handleToggleSuggestion = (templateId: number, accountId: number) => {
    const key = `${templateId}-${accountId}`
    setSelectedSuggestions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleToggleTemplate = (templateId: number) => {
    const templateSuggestions = suggestionsByTemplate[templateId] || []
    const templateKeys = templateSuggestions.map(s => `${s.template_id}-${s.account_id}`)
    const allSelected = templateKeys.every(key => selectedSuggestions.has(key))
    
    setSelectedSuggestions((prev) => {
      const next = new Set(prev)
      templateKeys.forEach(key => {
        if (allSelected) {
          next.delete(key)
        } else {
          next.add(key)
        }
      })
      return next
    })
  }

  const handleSelectAll = () => {
    if (!suggestions) return
    
    if (selectedSuggestions.size === suggestions.length) {
      setSelectedSuggestions(new Set())
    } else {
      const allKeys = suggestions.map(s => `${s.template_id}-${s.account_id}`)
      setSelectedSuggestions(new Set(allKeys))
    }
  }

  const handleGenerate = async () => {
    if (selectedSuggestions.size === 0) {
      setError('Please select at least one task to generate')
      return
    }

    if (!suggestions) return

    setError('')
    setIsGenerating(true)
    setProgress({ current: 0, total: selectedSuggestions.size })

    const suggestionsToProcess = suggestions.filter(s =>
      selectedSuggestions.has(`${s.template_id}-${s.account_id}`)
    )

    let successCount = 0

    for (let i = 0; i < suggestionsToProcess.length; i++) {
      const suggestion = suggestionsToProcess[i]
      try {
        // Create task using the trial balance account endpoint which links automatically
        await api.post(`/api/trial-balance/accounts/${suggestion.account_id}/tasks`, {
          name: suggestion.template_name,
          owner_id: suggestion.default_owner_id,
          status: 'not_started',
          department: suggestion.department,
        })

        successCount++
      } catch (err) {
        console.error(`Failed to create task for ${suggestion.account_number}:`, err)
      }

      setProgress({ current: i + 1, total: suggestionsToProcess.length })
    }

    setIsGenerating(false)

    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['trial-balance'] })
      onSuccess()
      onClose()
    } else {
      setError('Failed to create tasks. Please try again.')
    }
  }

  if (loadingSuggestions) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          <span className="text-gray-700">Finding missing tasks...</span>
        </div>
      </div>
    )
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Generate Missing Tasks</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">
              No missing tasks found!
            </p>
            <p className="text-sm text-gray-500">
              All templates with account assignments already have tasks in this period.
            </p>
          </div>
          <button onClick={onClose} className="btn-secondary w-full mt-4">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary-600" />
              Generate Missing Tasks from Templates
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Found {suggestions.length} task{suggestions.length !== 1 ? 's' : ''} that should exist based on templates
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isGenerating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-6 space-y-4 overflow-y-auto">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isGenerating && (
              <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">
                    Generating tasks... {progress.current} of {progress.total}
                  </span>
                  <span className="text-sm text-blue-700">
                    {Math.round((progress.current / progress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="label !mb-0">Select Tasks to Generate</label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                disabled={isGenerating}
              >
                {selectedSuggestions.size === suggestions.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="space-y-3">
              {Object.entries(suggestionsByTemplate).map(([templateIdStr, templateSuggestions]) => {
                const templateId = Number(templateIdStr)
                const templateName = templateSuggestions[0].template_name
                const department = templateSuggestions[0].department
                const templateKeys = templateSuggestions.map(s => `${s.template_id}-${s.account_id}`)
                const allTemplateSelected = templateKeys.every(key => selectedSuggestions.has(key))
                const someTemplateSelected = templateKeys.some(key => selectedSuggestions.has(key))

                return (
                  <div key={templateId} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 flex items-center gap-3 border-b border-gray-200">
                      <button
                        type="button"
                        onClick={() => handleToggleTemplate(templateId)}
                        className="flex items-center gap-2 hover:text-primary-600 transition-colors"
                        disabled={isGenerating}
                      >
                        {allTemplateSelected ? (
                          <CheckSquare className="w-5 h-5 text-primary-600" />
                        ) : someTemplateSelected ? (
                          <div className="w-5 h-5 border-2 border-primary-600 rounded flex items-center justify-center">
                            <div className="w-2.5 h-2.5 bg-primary-600 rounded-sm" />
                          </div>
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                        <div className="text-left">
                          <div className="font-semibold text-gray-900 text-sm">
                            {templateName}
                            {department && (
                              <span className="ml-2 text-xs font-normal text-gray-500">({department})</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {templateSuggestions.length} account{templateSuggestions.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {templateSuggestions.map((suggestion) => {
                        const key = `${suggestion.template_id}-${suggestion.account_id}`
                        const isSelected = selectedSuggestions.has(key)

                        return (
                          <label
                            key={key}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={isSelected}
                              onChange={() => handleToggleSuggestion(suggestion.template_id, suggestion.account_id)}
                              disabled={isGenerating}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900">
                                {suggestion.account_number}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {suggestion.account_name}
                              </div>
                            </div>
                            {suggestion.estimated_hours && (
                              <div className="text-xs text-gray-500">
                                ~{suggestion.estimated_hours}h
                              </div>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-gray-500 text-center pt-2">
              {selectedSuggestions.size} of {suggestions.length} task{suggestions.length !== 1 ? 's' : ''} selected
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isGenerating}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="btn-primary flex items-center gap-2"
              disabled={isGenerating || selectedSuggestions.size === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate {selectedSuggestions.size} Task{selectedSuggestions.size !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
