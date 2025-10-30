import { useEffect, useMemo, useState } from 'react'
import { X, Download, ExternalLink } from 'lucide-react'

interface FilePreviewModalProps {
  open: boolean
  title: string
  fetchUrl?: string
  downloadUrl?: string
  mimeType?: string | null
  isExternal?: boolean
  externalUrl?: string
  onClose: () => void
}

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml']

function isTextType(mimeType: string | undefined | null) {
  if (!mimeType) return false
  return TEXT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))
}

function isImageType(mimeType: string | undefined | null) {
  if (!mimeType) return false
  return mimeType.startsWith('image/')
}

function isPdfType(mimeType: string | undefined | null) {
  if (!mimeType) return false
  return mimeType === 'application/pdf'
}

export default function FilePreviewModal({
  open,
  title,
  fetchUrl,
  downloadUrl,
  mimeType,
  isExternal = false,
  externalUrl,
  onClose,
}: FilePreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [resolvedMimeType, setResolvedMimeType] = useState<string | null>(mimeType ?? null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
      setBlobUrl(null)
      setTextContent(null)
      setResolvedMimeType(mimeType ?? null)
      setError(null)
      setLoading(false)
      return
    }

    if (isExternal) {
      return
    }

    if (!fetchUrl) {
      setError('Preview not available for this file.')
      return
    }

    let cancelled = false

    const fetchPreview = async () => {
      try {
        setLoading(true)
        setError(null)
        const token = localStorage.getItem('token')
        const response = await fetch(fetchUrl, {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : undefined,
        })

        if (!response.ok) {
          throw new Error(`Unable to load preview (status ${response.status})`)
        }

        const blob = await response.blob()
        if (cancelled) return

        const detectedType = blob.type || mimeType || 'application/octet-stream'
        setResolvedMimeType(detectedType)

        if (isTextType(detectedType)) {
          const text = await blob.text()
          if (cancelled) return
          setTextContent(text)
        } else if (blob.size > 0) {
          const url = URL.createObjectURL(blob)
          setBlobUrl(url)
        } else {
          setError('File is empty or unsupported for preview.')
        }
      } catch (previewError: any) {
        if (!cancelled) {
          setError(previewError.message || 'Unable to load file preview.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchPreview()

    return () => {
      cancelled = true
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fetchUrl, mimeType, isExternal])

  const previewType = useMemo(() => {
    if (isExternal) return 'external'
    if (textContent) return 'text'
    if (resolvedMimeType && isImageType(resolvedMimeType)) return 'image'
    if (resolvedMimeType && isPdfType(resolvedMimeType)) return 'pdf'
    if (blobUrl) return 'binary'
    return 'unsupported'
  }, [isExternal, textContent, resolvedMimeType, blobUrl])

  if (!open) {
    return null
  }

  const handleDownload = () => {
    const targetUrl = downloadUrl || fetchUrl
    if (!targetUrl) return
    const link = document.createElement('a')
    link.href = targetUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {resolvedMimeType && (
              <p className="text-xs text-gray-500">{resolvedMimeType}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {downloadUrl || fetchUrl ? (
              <button
                type="button"
                className="btn-secondary text-xs flex items-center gap-2"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4" /> Download
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="h-64 flex items-center justify-center text-sm text-gray-500">
              Loading preview...
            </div>
          )}

          {!loading && error && (
            <div className="p-6 text-sm text-red-600">
              {error}
              {(downloadUrl || fetchUrl) && (
                <div className="mt-2 text-xs text-gray-500">
                  You can still download the file using the button above.
                </div>
              )}
            </div>
          )}

          {!loading && !error && previewType === 'external' && externalUrl && (
            <div className="p-6 text-sm text-gray-700 space-y-3">
              <p>This file lives in an external system.</p>
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
              >
                <ExternalLink className="w-4 h-4" /> Open external link
              </a>
            </div>
          )}

          {!loading && !error && previewType === 'image' && blobUrl && (
            <div className="p-6 flex items-center justify-center bg-gray-50">
              <img src={blobUrl} alt={title} className="max-h-[70vh] object-contain" />
            </div>
          )}

          {!loading && !error && previewType === 'pdf' && blobUrl && (
            <iframe
              src={blobUrl}
              title={title}
              className="w-full h-[70vh]"
            />
          )}

          {!loading && !error && previewType === 'text' && textContent && (
            <pre className="p-6 text-xs bg-gray-900 text-gray-100 overflow-auto max-h-[70vh] whitespace-pre-wrap">
              {textContent}
            </pre>
          )}

          {!loading && !error && previewType === 'binary' && blobUrl && (
            <div className="p-6 text-sm text-gray-600">
              Preview not available. Use the download button to open the file locally.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

