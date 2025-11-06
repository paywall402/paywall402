import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { SolanaWalletProvider } from '@/components/WalletProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk'
})

export const metadata: Metadata = {
  title: 'PayWall402 - Monetize Content Instantly with x402',
  description: 'Create paywalls in seconds. Get paid in USDC with zero middlemen using the x402 protocol on Solana.',
  keywords: ['paywall', 'x402', 'solana', 'usdc', 'content monetization', 'crypto payments', 'instant payments'],
  authors: [{ name: 'PayWall402' }],
  metadataBase: new URL('https://paywall402.xyz'),
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'PayWall402 - Monetize Content Instantly',
    description: 'Create paywalls in seconds. Get paid in USDC with zero middlemen.',
    type: 'website',
    images: ['/logo.png'],
    siteName: 'PayWall402',
  },
  twitter: {
    card: 'summary',
    title: 'PayWall402 - Monetize Content Instantly',
    description: 'Create paywalls in seconds. Get paid in USDC with zero middlemen.',
    images: ['/logo.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={spaceGrotesk.className}>
        <ErrorBoundary>
          <ThemeProvider>
            <SolanaWalletProvider>
              {children}
            </SolanaWalletProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
