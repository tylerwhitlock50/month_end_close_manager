import { useEffect, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Command, Search, Loader2, ArrowUpRight } from 'lucide-react'

import { searchEverything } from '../lib/api'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

type SearchCategory = 'tasks' | 'templates' | 'accounts' | 'page'

interface SearchResultItem {
  id?: number | null
  title: string
  subtitle?: string | null
  url: string
  type: SearchCategory
}

interface SearchResponse {
  tasks: SearchResultItem[]
  templates: SearchResultItem[]
  accounts: SearchResultItem[]
  pages: SearchResultItem[]
}

const MIN_QUERY_LENGTH = 2

interface FlattenedItem extends SearchResultItem {
  group: string
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data, isFetching } = useQuery<SearchResponse>({
    queryKey: ['command-search', query],
    queryFn: async () => searchEverything(query),
    enabled: open && query.trim().length >= MIN_QUERY_LENGTH,
    staleTime: 5_000,
  })

  const groupedResults = useMemo(() => {
    if (!data) {
      return [] as { label: string; type: SearchCategory; items: SearchResultItem[] }[]
    }

    return (
      [
        { label: 'Tasks', type: 'tasks' as const, items: data.tasks || [] },
        { label: 'Templates', type: 'templates' as const, items: data.templates || [] },
        { label: 'Trial Balance Accounts', type: 'accounts' as const, items: data.accounts || [] },
        { label: 'Navigation', type: 'page' as const, items: data.pages || [] },
      ]
        // Show empty state only when query >= min length and all empty
        .filter((group) => group.items.length > 0)
    )
  }, [data])

  const flatResults: FlattenedItem[] = useMemo(() => {
    if (!groupedResults.length) {
      return []
    }

    return groupedResults.flatMap((group) =>
      group.items.map((item) => ({ ...item, group: group.label }))
    )
  }, [groupedResults])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (open) {
      window.addEventListener('keydown', handler)
    }

    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    setActiveIndex(0)
  }, [groupedResults.length])

  const handleSelect = (item: SearchResultItem) => {
    onClose()
    if (!item.url) return
    navigate(item.url)
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!flatResults.length) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => (prev + 1) % flatResults.length)
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length)
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const item = flatResults[activeIndex]
      if (item) {
        handleSelect(item)
      }
    }
  }

  if (!open) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[999] bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto mt-24 max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gray-100 text-gray-500">
            <Command className="h-4 w-4" />
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search for tasks, templates, accounts..."
            className="w-full border-none bg-transparent text-sm focus:outline-none"
          />
          <span className="text-xs text-gray-400">Ctrl / ⌘ + K</span>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {query.trim().length < MIN_QUERY_LENGTH ? (
            <div className="px-6 py-8 text-sm text-gray-500 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Start typing to search (minimum {MIN_QUERY_LENGTH} characters)
            </div>
          ) : isFetching ? (
            <div className="px-6 py-8 text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : groupedResults.length === 0 ? (
            <div className="px-6 py-8 text-sm text-gray-500">No results found.</div>
          ) : (
            groupedResults.map((group) => (
              <div key={group.label} className="py-2">
                <p className="px-6 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const index = flatResults.findIndex(
                      (flat) => flat.type === item.type && flat.id === item.id && flat.title === item.title
                    )
                    const isActive = index === activeIndex

                    return (
                      <li key={`${item.type}-${item.id ?? item.title}`}>
                        <button
                          type="button"
                          onClick={() => handleSelect(item)}
                          className={`flex w-full items-start justify-between rounded-lg px-6 py-2 text-left text-sm transition-colors ${
                            isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <div>
                            <p className="font-medium">{item.title}</p>
                            {item.subtitle && (
                              <p className="mt-1 text-xs text-gray-500">{item.subtitle}</p>
                            )}
                          </div>
                          <ArrowUpRight className="h-4 w-4 mt-1 flex-shrink-0 text-gray-400" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
