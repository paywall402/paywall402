'use client'

import { useState, useEffect } from 'react'
import { Download, FileText, Link as LinkIcon, CheckCircle, ExternalLink } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ContentViewerProps {
  contentId: string
  accessToken: string
}

interface ContentData {
  type: 'file' | 'text' | 'link'
  content?: string
  url?: string
  filename?: string
}

export default function ContentViewer({ contentId, accessToken }: ContentViewerProps) {
  const [content, setContent] = useState<ContentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    loadContent()
  }, [contentId, accessToken])

  const loadContent = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await axios.get(
        `${API_URL}/api/content/${contentId}/download?payment=${accessToken}`,
        {
          responseType: 'json',
        }
      )

      if (response.data.type === 'text') {
        setContent({
          type: 'text',
          content: response.data.content,
        })
      } else if (response.data.type === 'link') {
        setContent({
          type: 'link',
          url: response.data.url,
        })
      } else {
        // File type - will be downloaded
        setContent({
          type: 'file',
          filename: response.headers['content-disposition']?.split('filename=')[1] || 'download',
        })
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load content')
      console.error('Content load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)

    try {
      const response = await axios.get(
        `${API_URL}/api/content/${contentId}/download?payment=${accessToken}`,
        {
          responseType: 'blob',
        }
      )

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url

      // Get filename from header or use default
      const contentDisposition = response.headers['content-disposition']
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : 'download'

      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      setError('Failed to download file')
      console.error('Download error:', err)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading content...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <p className="text-gray-600 dark:text-gray-400">No content available</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      <div className="text-center mb-6">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Payment Successful!
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Your content is ready to access
        </p>
      </div>

      {/* Text Content */}
      {content.type === 'text' && content.content && (
        <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center mb-4">
            <FileText className="w-5 h-5 text-primary-600 mr-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Text Content</h3>
          </div>
          <div className="prose dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono bg-white dark:bg-gray-800 p-4 rounded border border-gray-200 dark:border-gray-600">
              {content.content}
            </pre>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(content.content!)
              alert('Copied to clipboard!')
            }}
            className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Copy to Clipboard
          </button>
        </div>
      )}

      {/* Link Content */}
      {content.type === 'link' && content.url && (
        <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center mb-4">
            <LinkIcon className="w-5 h-5 text-primary-600 mr-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Protected Link</h3>
          </div>
          <div className="p-4 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 mb-4">
            <p className="text-sm text-gray-800 dark:text-gray-200 break-all">{content.url}</p>
          </div>
          <a
            href={content.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Open Link
            <ExternalLink className="w-4 h-4 ml-2" />
          </a>
        </div>
      )}

      {/* File Content */}
      {content.type === 'file' && (
        <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center mb-4">
            <Download className="w-5 h-5 text-primary-600 mr-2" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Download File</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Click the button below to download your file
          </p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
          >
            {downloading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Download File
              </>
            )}
          </button>
        </div>
      )}

      <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <p className="text-sm text-green-700 dark:text-green-400 text-center">
          ✓ This content has been permanently unlocked with your payment
        </p>
      </div>
    </div>
  )
}
