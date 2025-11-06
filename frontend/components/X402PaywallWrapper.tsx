'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Lock, Loader2 } from 'lucide-react'
import axios from 'axios'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// USDC Token Mint on Solana Mainnet
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const USDC_DECIMALS = 6 // USDC has 6 decimals

// Solana Mainnet RPC - IMPORTANT: Set NEXT_PUBLIC_SOLANA_RPC_HOST in your .env.local file
const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC_HOST || 'https://api.mainnet-beta.solana.com'

interface X402PaywallWrapperProps {
  contentId: string
  price: number
  contentType: string
  filename?: string
  creatorWallet: string
}

export default function X402PaywallWrapper({
  contentId,
  price,
  contentType,
  filename,
  creatorWallet,
}: X402PaywallWrapperProps) {
  const { publicKey, sendTransaction } = useWallet()
  const [loading, setLoading] = useState(false)
  const [paid, setPaid] = useState(false)
  const [error, setError] = useState('')
  const [txSignature, setTxSignature] = useState('')
  const [accessToken, setAccessToken] = useState('')

  // Check if user already paid
  useEffect(() => {
    // Check localStorage for this content
    const paidData = localStorage.getItem(`paid_${contentId}`)
    if (paidData) {
      try {
        const data = JSON.parse(paidData)
        setPaid(true)
        setTxSignature(data.signature)
        setAccessToken(data.accessToken)
      } catch {
        // Legacy format - just signature
        setPaid(true)
        setTxSignature(paidData)
      }
    }
  }, [contentId])

  const handlePayment = async () => {
    if (!publicKey) {
      setError('Please connect your wallet first')
      return
    }

    if (!sendTransaction) {
      setError('Wallet does not support sending transactions')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Create connection to Solana mainnet
      const connection = new Connection(SOLANA_RPC, 'confirmed')

      // Convert creator wallet string to PublicKey
      const recipientPubkey = new PublicKey(creatorWallet)

      // Get associated token accounts for USDC
      const fromTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        publicKey
      )

      const toTokenAccount = await getAssociatedTokenAddress(
        USDC_MINT,
        recipientPubkey
      )

      // Calculate amount in smallest units (USDC has 6 decimals)
      const amountInSmallestUnit = Math.floor(price * Math.pow(10, USDC_DECIMALS))

      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        publicKey,
        amountInSmallestUnit
      )

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized')

      // Create transaction
      const transaction = new Transaction({
        feePayer: publicKey,
        blockhash,
        lastValidBlockHeight
      }).add(transferInstruction)

      // Send transaction through wallet
      const signature = await sendTransaction(transaction, connection)
      setTxSignature(signature)

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed')

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`)
      }

      // Verify payment with backend
      const response = await axios.post(`${API_URL}/api/payment/verify`, {
        contentId,
        transactionSignature: signature,
        payerWallet: publicKey.toString(),
      })

      if (response.data.verified) {
        setPaid(true)
        const paymentData = {
          signature,
          accessToken: response.data.accessToken
        }
        localStorage.setItem(`paid_${contentId}`, JSON.stringify(paymentData))
        setAccessToken(response.data.accessToken)
      } else {
        setError('Payment verification failed: ' + (response.data.error || 'Unknown error'))
      }
    } catch (err: any) {
      // User-friendly error messages
      if (err.message?.includes('User rejected')) {
        setError('Transaction cancelled by user')
      } else if (err.message?.includes('Insufficient funds')) {
        setError('Insufficient USDC balance in your wallet')
      } else if (err.message?.includes('TokenAccountNotFoundError')) {
        setError('USDC token account not found. Please ensure you have USDC in your wallet.')
      } else {
        setError(err.response?.data?.error || err.message || 'Payment failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (paid) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white/10 dark:bg-black/20 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-green-400/20 to-green-600/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent mb-2">
            Payment Confirmed!
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            You now have access to this content
          </p>
        </div>

        {filename && (
          <div className="p-4 bg-white/30 dark:bg-black/30 backdrop-blur rounded-xl border border-white/20 dark:border-white/10 mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Content</p>
            <p className="font-semibold text-gray-900 dark:text-white">{filename}</p>
          </div>
        )}

        <div className="p-4 bg-blue-500/10 backdrop-blur rounded-xl border border-blue-500/30 mb-6">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 font-semibold">Transaction</p>
          <p className="text-xs font-mono text-gray-800 dark:text-gray-200 break-all">{txSignature}</p>
        </div>

        <a
          href={`${API_URL}/api/content/${contentId}/download?payment=${accessToken}`}
          className="w-full px-6 py-4 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center"
        >
          Download Content
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-8 bg-white/10 dark:bg-black/20 backdrop-blur-xl rounded-2xl border border-white/20 dark:border-white/10 shadow-2xl">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-primary-400/20 to-primary-600/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-primary-500" />
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-primary-500 to-purple-600 bg-clip-text text-transparent mb-2">
          Payment Required
        </h2>
        <p className="text-gray-700 dark:text-gray-300">
          This content is protected by x402 payment protocol
        </p>
      </div>

      <div className="p-6 bg-gradient-to-br from-primary-500/10 to-purple-500/10 backdrop-blur rounded-xl border border-white/10 dark:border-white/5 mb-6">
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Price</p>
          <p className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
            ${price}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">USDC on Solana</p>
        </div>
      </div>

      {filename && (
        <div className="p-4 bg-white/30 dark:bg-black/30 backdrop-blur rounded-xl border border-white/20 dark:border-white/10 mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Content</p>
          <p className="font-medium text-gray-900 dark:text-white truncate">{filename}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">{contentType}</p>
        </div>
      )}

      <div className="mb-6">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Connect your Solana wallet to proceed:
        </p>
        <div className="flex justify-center">
          <WalletMultiButton className="!bg-gradient-to-r !from-primary-600 !to-purple-600 hover:!from-primary-700 hover:!to-purple-700 !transition-all !shadow-lg hover:!shadow-xl !transform hover:!-translate-y-0.5" />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 backdrop-blur border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <button
        onClick={handlePayment}
        disabled={!publicKey || loading}
        className="w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            Pay ${price} USDC
          </>
        )}
      </button>

      <div className="mt-6 p-4 bg-white/20 dark:bg-black/20 backdrop-blur rounded-xl border border-white/10 dark:border-white/5">
        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
          Secure payment powered by x402 protocol on Solana Mainnet
        </p>
      </div>
    </div>
  )
}
