'use client'

import { Suspense } from 'react'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/theme-toggle'

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const contentId = searchParams.get('contentId')
  const signature = searchParams.get('signature')

  useEffect(() => {
    // Redirect to content page with payment proof
    if (contentId && signature) {
      setTimeout(() => {
        router.push(`/${contentId}?signature=${signature}`)
      }, 2000)
    }
  }, [contentId, signature, router])

  return (
    <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="max-w-md mx-auto p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg text-center">
        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6 animate-pulse" />

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Payment Successful!
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your payment has been confirmed. Redirecting you to your content...
        </p>

        <div className="flex items-center justify-center mb-6">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>

        {contentId && (
          <Link
            href={`/${contentId}${signature ? `?signature=${signature}` : ''}`}
            className="inline-block px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
          >
            Access Content Now
          </Link>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Transaction verified via x402 protocol on Solana
          </p>
        </div>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-gray-900 dark:text-white">
              PayWall<span className="text-primary-600">402</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <Suspense fallback={
        <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[calc(100vh-200px)]">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </main>
  )
}