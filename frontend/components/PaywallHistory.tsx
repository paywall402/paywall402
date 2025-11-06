'use client'

import { useState, useEffect } from 'react'
import { Clock, DollarSign, Eye, Copy, Check, ExternalLink, Trash2, FileText, Link2, Calendar } from 'lucide-react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface PaywallHistoryItem {
  id: string
  contentId: string
  type: 'text' | 'link' | 'file'
  filename?: string
  textContent?: string
  link?: string
  price: number
  createdAt: string
  expiresAt?: string
  views?: number
  payments?: number
  url: string
}

export default function PaywallHistory() {
  const [history, setHistory] = useState<PaywallHistoryItem[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadHistory()

    // Listen for storage changes
    const handleStorageChange = () => {
      loadHistory()
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const loadHistory = () => {
    // Load from localStorage
    const savedHistory = localStorage.getItem('paywall_history')
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        // Sort by creation date, newest first
        const sorted = parsed.sort((a: PaywallHistoryItem, b: PaywallHistoryItem) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setHistory(sorted)
      } catch (error) {
        console.error('Error loading history:', error)
      }
    }
  }

  const fetchStats = async (contentId: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/content/${contentId}/info`)
      // Update history with latest stats
      setHistory(prev => prev.map(item =>
        item.contentId === contentId
          ? { ...item, views: response.data.views, payments: response.data.payments }
          : item
      ))
      // Save updated history
      const updatedHistory = history.map(item =>
        item.contentId === contentId
          ? { ...item, views: response.data.views, payments: response.data.payments }
          : item
      )
      localStorage.setItem('paywall_history', JSON.stringify(updatedHistory))
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const copyToClipboard = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const deleteItem = (id: string) => {
    const filtered = history.filter(item => item.id !== id)
    setHistory(filtered)
    localStorage.setItem('paywall_history', JSON.stringify(filtered))
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
      // Fetch latest stats when expanding
      const item = history.find(h => h.id === id)
      if (item) {
        fetchStats(item.contentId)
      }
    }
    setExpandedItems(newExpanded)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      return `${diffMinutes} minutes ago`
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <FileText className="w-4 h-4" />
      case 'link':
        return <Link2 className="w-4 h-4" />
      case 'file':
        return <FileText className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  const getContentPreview = (item: PaywallHistoryItem) => {
    if (item.textContent) {
      return item.textContent.length > 50
        ? item.textContent.substring(0, 50) + '...'
        : item.textContent
    }
    if (item.link) {
      try {
        const url = new URL(item.link)
        return url.hostname
      } catch {
        return item.link.substring(0, 30) + '...'
      }
    }
    if (item.filename) {
      return item.filename
    }
    return 'Content'
  }

  if (history.length === 0) {
    return null
  }

  return (
    <div className="w-full max-w-6xl mx-auto mb-12">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Your Paywalls
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Track and manage your content
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {history.map((item) => (
          <div
            key={item.id}
            className="bg-white/10 dark:bg-black/20 backdrop-blur-xl rounded-xl border border-white/20 dark:border-white/10 p-4 hover:border-primary-500/50 transition-all"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-primary-500/10 rounded-lg">
                  {getContentIcon(item.type)}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {item.type} content
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                    {getContentPreview(item)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => deleteItem(item.id)}
                className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors group"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
              </button>
            </div>

            {/* Price and Time */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-1 text-primary-600 dark:text-primary-400">
                <DollarSign className="w-4 h-4" />
                <span className="font-semibold">${item.price}</span>
                <span className="text-xs text-gray-500">USDC</span>
              </div>
              <div className="flex items-center space-x-1 text-gray-500 dark:text-gray-400">
                <Clock className="w-3 h-3" />
                <span className="text-xs">{formatDate(item.createdAt)}</span>
              </div>
            </div>

            {/* Stats */}
            {expandedItems.has(item.id) && (
              <div className="flex items-center justify-around p-3 mb-3 bg-white/20 dark:bg-black/30 rounded-lg">
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 text-gray-600 dark:text-gray-400 mb-1">
                    <Eye className="w-3 h-3" />
                    <span className="text-xs">Views</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {item.views || 0}
                  </p>
                </div>
                <div className="border-l border-gray-300/30 dark:border-white/10 h-8" />
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 text-gray-600 dark:text-gray-400 mb-1">
                    <DollarSign className="w-3 h-3" />
                    <span className="text-xs">Payments</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {item.payments || 0}
                  </p>
                </div>
                <div className="border-l border-gray-300/30 dark:border-white/10 h-8" />
                <div className="text-center">
                  <div className="flex items-center justify-center space-x-1 text-gray-600 dark:text-gray-400 mb-1">
                    <Calendar className="w-3 h-3" />
                    <span className="text-xs">Status</span>
                  </div>
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                    Active
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => copyToClipboard(item.url, item.id)}
                className="flex-1 px-3 py-2 bg-primary-600/10 hover:bg-primary-600/20 dark:bg-primary-500/10 dark:hover:bg-primary-500/20 text-primary-700 dark:text-primary-400 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                aria-label="Copy paywall link"
              >
                {copiedId === item.id ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span className="text-sm">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span className="text-sm">Copy</span>
                  </>
                )}
              </button>
              <button
                onClick={() => toggleExpanded(item.id)}
                className="px-3 py-2 bg-gray-200/50 hover:bg-gray-300/50 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-all duration-200"
                title="View Stats"
                aria-label="View paywall statistics"
              >
                <Eye className="w-4 h-4" />
              </button>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-gray-200/50 hover:bg-gray-300/50 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-all duration-200"
                title="Open Paywall"
                aria-label="Open paywall in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Clear History Button */}
      {history.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to clear all history?')) {
                setHistory([])
                localStorage.removeItem('paywall_history')
              }
            }}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            Clear All History
          </button>
        </div>
      )}
    </div>
  )
}