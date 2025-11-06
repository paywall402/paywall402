'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Lock, Eye, DollarSign, Calendar, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import axios from 'axios'
import X402PaywallWrapper from '@/components/X402PaywallWrapper'
import ContentViewer from '@/components/ContentViewer'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { DotScreenShader } from '@/components/ui/dot-shader-background'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ContentInfo {
  id: string
  type: string
  filename?: string
  mimetype?: string
  price: number
  views: number
  payments: number
  expiresAt?: string
  isExpired: boolean
  createdAt: string
  creatorWallet: string
}

export default function ContentPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const contentId = params.id as string
  const accessToken = searchParams.get('payment')

  const [contentInfo, setContentInfo] = useState<ContentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const hasPaid = !!accessToken

  useEffect(() => {
    if (contentId) {
      loadContentInfo()
    }
  }, [contentId])

  const loadContentInfo = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await axios.get(`${API_URL}/api/content/${contentId}/info`)
      setContentInfo(response.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Content not found')
      console.error('Load content info error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white dark:bg-black relative flex items-center justify-center">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <DotScreenShader />
        </div>
        <div className="text-center relative z-10">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading content...</p>
        </div>
      </main>
    )
  }

  if (error || !contentInfo) {
    return (
      <main className="min-h-screen bg-white dark:bg-black relative">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <DotScreenShader />
        </div>
        <header className="border-b border-gray-300/30 dark:border-white/10 sticky top-0 z-50 backdrop-blur-md">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center space-x-2 text-gray-900 dark:text-white hover:text-primary-600">
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Home</span>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12 relative z-10">
          <div className="max-w-md mx-auto p-8 bg-white/10 dark:bg-black/20 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-red-400/20 to-red-600/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent mb-2">
                Content Not Found
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                {error || 'The content you are looking for does not exist or has been removed.'}
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Go to Homepage
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (contentInfo.isExpired) {
    return (
      <main className="min-h-screen bg-white dark:bg-black relative">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <DotScreenShader />
        </div>
        <header className="border-b border-gray-300/30 dark:border-white/10 sticky top-0 z-50 backdrop-blur-md">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center space-x-2 text-gray-900 dark:text-white hover:text-primary-600">
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Home</span>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12 relative z-10">
          <div className="max-w-md mx-auto p-8 bg-white/10 dark:bg-black/20 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-yellow-500" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-orange-600 bg-clip-text text-transparent mb-2">
                Content Expired
              </h2>
              <p className="text-gray-700 dark:text-gray-300">
                This content is no longer available.
              </p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white dark:bg-black relative">
      {/* Animated Shader Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <DotScreenShader />
      </div>

      {/* Header */}
      <header className="border-b border-gray-300/30 dark:border-white/10 sticky top-0 z-50 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2 text-gray-900 dark:text-white hover:text-primary-600">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Home</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 relative z-10">
        {/* Stats Bar */}
        {!hasPaid && (
          <div className="max-w-md mx-auto mb-6 p-4 bg-white/10 dark:bg-black/20 backdrop-blur-xl rounded-xl border border-white/20 dark:border-white/10">
            <div className="flex justify-around text-center">
              <div>
                <div className="flex items-center justify-center text-gray-600 dark:text-gray-400 mb-1">
                  <Eye className="w-4 h-4 mr-1" />
                  <span className="text-xs font-semibold">Views</span>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{contentInfo.views}</p>
              </div>
              <div className="border-l border-gray-300/30 dark:border-white/10" />
              <div>
                <div className="flex items-center justify-center text-gray-600 dark:text-gray-400 mb-1">
                  <DollarSign className="w-4 h-4 mr-1" />
                  <span className="text-xs font-semibold">Payments</span>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{contentInfo.payments}</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Gate or Content Viewer */}
        {hasPaid && accessToken ? (
          <ContentViewer contentId={contentId} accessToken={accessToken} />
        ) : (
          <X402PaywallWrapper
            contentId={contentId}
            price={contentInfo.price}
            contentType={contentInfo.type}
            filename={contentInfo.filename}
            creatorWallet={contentInfo.creatorWallet || ''}
          />
        )}
      </div>
    </main>
  )
}
