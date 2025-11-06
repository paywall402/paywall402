'use client'

import { useState } from 'react'
import { Upload, File, Link as LinkIcon, Type, DollarSign, Clock, Wallet, CheckCircle, Copy } from 'lucide-react'
import axios from 'axios'
import { PublicKey } from '@solana/web3.js'
import { SparklesText } from '@/components/ui/sparkles-text'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Validate Solana wallet address
const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address)
    return true
  } catch (error) {
    return false
  }
}

type ContentType = 'file' | 'text' | 'link'

interface UploadResult {
  id: string
  type: string
  price: number
  shareUrl: string
  paymentLink: string
}

export default function UploadForm() {
  const [contentType, setContentType] = useState<ContentType>('file')
  const [file, setFile] = useState<File | null>(null)
  const [textContent, setTextContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [price, setPrice] = useState('1.00')
  const [expiresIn, setExpiresIn] = useState('never')
  const [creatorWallet, setCreatorWallet] = useState('')
  const [walletError, setWalletError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.size > 10485760) {
        setError('File size must be less than 10MB')
        return
      }
      setFile(selectedFile)
      setError('')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  const handleWalletChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim()
    setCreatorWallet(value)

    if (value && !isValidSolanaAddress(value)) {
      setWalletError('Invalid Solana wallet address')
    } else {
      setWalletError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResult(null)

    // Validation
    if (!creatorWallet) {
      setError('Please enter your Solana wallet address')
      return
    }

    if (!isValidSolanaAddress(creatorWallet)) {
      setError('Invalid Solana wallet address. Please enter a valid address.')
      return
    }

    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0.01 || priceNum > 100) {
      setError('Price must be between $0.01 and $100')
      return
    }

    if (contentType === 'file' && !file) {
      setError('Please select a file to upload')
      return
    }

    if (contentType === 'text' && !textContent.trim()) {
      setError('Please enter text content')
      return
    }

    if (contentType === 'link' && !linkUrl.trim()) {
      setError('Please enter a link URL')
      return
    }

    setUploading(true)

    try {
      let response;

      if (contentType === 'file' && file) {
        // For file uploads, use FormData
        const formData = new FormData()
        formData.append('file', file)
        formData.append('price', price)
        formData.append('expiresIn', expiresIn)
        formData.append('creatorWallet', creatorWallet)

        response = await axios.post(`${API_URL}/api/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      } else {
        // For text and link content, use JSON
        const data: any = {
          price: parseFloat(price),
          expiresIn,
          creatorWallet,
          contentType
        }

        if (contentType === 'text') {
          data.textContent = textContent
        } else if (contentType === 'link') {
          data.linkUrl = linkUrl
        }

        response = await axios.post(`${API_URL}/api/upload`, data, {
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }

      const contentData = response.data.content
      setResult(contentData)

      // Save to history
      const historyItem = {
        id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        contentId: contentData.id,
        type: contentType,
        filename: file?.name,
        textContent: textContent.substring(0, 100),
        link: linkUrl,
        price: parseFloat(price),
        createdAt: new Date().toISOString(),
        expiresAt: contentData.expiresAt,
        views: 0,
        payments: 0,
        url: contentData.shareUrl
      }

      // Get existing history
      const existingHistory = localStorage.getItem('paywall_history')
      const history = existingHistory ? JSON.parse(existingHistory) : []

      // Add new item to beginning
      history.unshift(historyItem)

      // Keep only last 50 items
      if (history.length > 50) {
        history.splice(50)
      }

      // Save updated history
      localStorage.setItem('paywall_history', JSON.stringify(history))

      // Reset form
      setFile(null)
      setTextContent('')
      setLinkUrl('')
      setPrice('1.00')

      // Trigger refresh of history component
      window.dispatchEvent(new Event('storage'))

    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Upload failed. Please try again.'
      setError(errorMessage)
      console.error('Upload error:', err)
      console.error('Error response:', err.response?.data)
    } finally {
      setUploading(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="p-8 bg-white/10 dark:bg-black/20 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Paywall Created Successfully
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Your link is ready to share
            </p>
          </div>

          <div className="space-y-4">
          <div className="p-4 bg-white/30 dark:bg-black/30 backdrop-blur rounded-xl border border-white/20 dark:border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Share URL
              </span>
              <button
                onClick={() => copyToClipboard(result.shareUrl)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-900 dark:text-white font-mono break-all">
              {result.shareUrl}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/30 dark:bg-black/30 backdrop-blur rounded-xl border border-white/20 dark:border-white/10">
              <p className="text-sm text-gray-600 dark:text-gray-400">Price</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                ${result.price} USDC
              </p>
            </div>
            <div className="p-4 bg-white/30 dark:bg-black/30 backdrop-blur rounded-xl border border-white/20 dark:border-white/10">
              <p className="text-sm text-gray-600 dark:text-gray-400">Type</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                {result.type}
              </p>
            </div>
          </div>

          <button
            onClick={() => setResult(null)}
            className="w-full px-4 py-3 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Create Another Paywall
          </button>
        </div>
      </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      <div className="p-8 bg-white/10 dark:bg-black/20 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl">
        <div className="mb-8 flex justify-center">
          <SparklesText
            text="Create Paywall"
            className="text-3xl font-bold text-center"
            colors={{ first: "#9E7AFF", second: "#FE8BBB" }}
            sparklesCount={10}
          />
        </div>

      {/* Content Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Content Type
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { type: 'file' as ContentType, icon: File, label: 'File' },
            { type: 'text' as ContentType, icon: Type, label: 'Text' },
            { type: 'link' as ContentType, icon: LinkIcon, label: 'Link' },
          ].map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => setContentType(type)}
              className={`p-4 rounded-lg border-2 transition-all backdrop-blur-sm ${
                contentType === type
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20'
                  : 'border-gray-300/30 dark:border-white/10 hover:border-primary-400/50'
              }`}
            >
              <Icon className={`w-6 h-6 mx-auto mb-2 ${
                contentType === type ? 'text-primary-600' : 'text-gray-400'
              }`} />
              <span className={`text-sm font-medium ${
                contentType === type ? 'text-primary-600' : 'text-gray-600 dark:text-gray-400'
              }`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* File Upload */}
      {contentType === 'file' && (
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Upload File
          </label>
          <div className="flex items-center justify-center w-full">
            <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all backdrop-blur-sm ${
              file
                ? 'border-green-500 bg-green-50/50 dark:bg-green-900/20'
                : 'border-gray-300/30 dark:border-white/10 bg-white/30 dark:bg-black/30 hover:bg-white/50 dark:hover:bg-black/50'
            }`}>
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {file ? (
                  <>
                    <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-gray-500" />
                    <p className="text-sm text-gray-500">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">
                      PDF, Images, Videos, Text, ZIP (Max 10MB)
                    </p>
                  </>
                )}
              </div>
              <input
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.txt,.zip"
              />
            </label>
          </div>
          {file && (
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setError('')
              }}
              className="mt-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400"
            >
              Remove file
            </button>
          )}
        </div>
      )}

      {/* Text Content */}
      {contentType === 'text' && (
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Text Content
          </label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            className="w-full px-4 py-3 bg-white/50 dark:bg-black/30 backdrop-blur border border-white/30 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-primary-500 focus:bg-white/70 dark:focus:bg-black/50 transition-all text-gray-900 dark:text-white placeholder-gray-500"
            rows={6}
            placeholder="Enter your text content here..."
          />
        </div>
      )}

      {/* Link URL */}
      {contentType === 'link' && (
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Link URL
          </label>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="w-full px-4 py-3 bg-white/50 dark:bg-black/30 backdrop-blur border border-white/30 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-primary-500 focus:bg-white/70 dark:focus:bg-black/50 transition-all text-gray-900 dark:text-white placeholder-gray-500"
            placeholder="https://example.com/your-content"
          />
        </div>
      )}

      {/* Price */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
          <DollarSign className="w-4 h-4 inline mr-1" />
          Price in USDC
        </label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          step="0.01"
          min="0.01"
          max="100"
          className="w-full px-4 py-3 bg-white/50 dark:bg-black/30 backdrop-blur border border-white/30 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-primary-500 focus:bg-white/70 dark:focus:bg-black/50 transition-all text-gray-900 dark:text-white placeholder-gray-500"
          placeholder="1.00"
        />
        <p className="mt-1 text-sm text-gray-500">Minimum: $0.01, Maximum: $100</p>
      </div>

      {/* Expiration */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
          <Clock className="w-4 h-4 inline mr-1" />
          Expires After
        </label>
        <select
          value={expiresIn}
          onChange={(e) => setExpiresIn(e.target.value)}
          className="w-full px-4 py-3 bg-white/50 dark:bg-black/30 backdrop-blur border border-white/30 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-primary-500 focus:bg-white/70 dark:focus:bg-black/50 transition-all text-gray-900 dark:text-white placeholder-gray-500"
        >
          <option value="never">Never</option>
          <option value="1h">1 Hour</option>
          <option value="1d">1 Day</option>
          <option value="7d">7 Days</option>
        </select>
      </div>

      {/* Creator Wallet */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
          <Wallet className="w-4 h-4 inline mr-1" />
          Your Solana Wallet Address
        </label>
        <input
          type="text"
          value={creatorWallet}
          onChange={handleWalletChange}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 bg-white/50 dark:bg-black/50 backdrop-blur-sm dark:text-white font-mono text-sm transition-colors ${
            walletError
              ? 'border-red-500 focus:ring-red-500 dark:border-red-500'
              : 'border-gray-300/30 dark:border-white/10 focus:ring-primary-500'
          }`}
          placeholder="Enter your Solana wallet address"
        />
        {walletError && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{walletError}</p>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 backdrop-blur border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={uploading}
        className="w-full px-6 py-4 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center min-h-[56px]"
      >
        {uploading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Creating Paywall...
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 mr-2" />
            Create Paywall
          </>
        )}
      </button>
      </div>
    </form>
  )
}
