import Image from 'next/image'
import UploadForm from '@/components/UploadForm'
import PaywallHistory from '@/components/PaywallHistory'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { DotScreenShader } from '@/components/ui/dot-shader-background'

export default function HomePage() {
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
            <div className="flex items-center space-x-3">
              <Image
                src="/logo.png"
                alt="PayWall402 Logo"
                width={40}
                height={40}
                className="rounded-lg dark:invert-0 invert"
              />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                PayWall<span className="text-primary-600 dark:text-primary-500">402</span>
              </h1>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 md:py-20 text-center relative z-10">
        <div className="max-w-4xl mx-auto mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4 leading-tight max-w-3xl mx-auto">
            Monetize Content Instantly with x402
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Create paywalls in seconds. Get paid in USDC. Zero middlemen, just you and your audience.
          </p>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-12 animate-slide-up max-w-4xl mx-auto">
            <div className="group text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 group-hover:scale-105 transition-transform duration-200">
                <Image
                  src="/paidinstantly.png"
                  alt="Get paid instantly"
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-white mb-2">
                Get paid instantly
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                USDC hits your wallet the moment someone pays
              </p>
            </div>

            <div className="group text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 group-hover:scale-105 transition-transform duration-200">
                <Image
                  src="/safe.png"
                  alt="Your content stays safe"
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-white mb-2">
                Your content stays safe
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                Protected until payment is verified on-chain
              </p>
            </div>

            <div className="group text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 group-hover:scale-105 transition-transform duration-200">
                <Image
                  src="/nosignup.png"
                  alt="No sign-up needed"
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="font-semibold text-base text-gray-900 dark:text-white mb-2">
                No sign-up needed
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                Upload content, set your price, share the link
              </p>
            </div>
          </div>
        </div>

        {/* Upload Form */}
        <UploadForm />
      </section>

      {/* Paywall History */}
      <section className="container mx-auto px-4 py-12 relative z-10">
        <PaywallHistory />
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16 relative z-10">
        <div className="max-w-3xl mx-auto relative">
          {/* Decorative background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-purple-500/5 to-primary-500/5 dark:from-primary-500/10 dark:via-purple-500/10 dark:to-primary-500/10 rounded-3xl blur-3xl -z-10" />
          <div className="absolute inset-0 bg-gradient-to-tl from-primary-400/5 via-transparent to-purple-400/5 dark:from-primary-400/10 dark:via-transparent dark:to-purple-400/10 rounded-3xl -z-10" />

          <div className="relative bg-white/40 dark:bg-black/20 backdrop-blur-xl rounded-3xl border border-gray-200/50 dark:border-white/10 p-8 md:p-12 shadow-xl">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-10 text-center">
              How It Works
            </h2>
            <div className="space-y-8">
            <div className="flex items-start space-x-5 group">
              <div className="flex-shrink-0 w-10 h-10 bg-primary-600 dark:bg-primary-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-md group-hover:scale-105 transition-transform duration-200">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
                  Upload your content
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Add files, text, or links. Set your price from $0.01 to $100 USDC.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-5 group">
              <div className="flex-shrink-0 w-10 h-10 bg-primary-600 dark:bg-primary-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-md group-hover:scale-105 transition-transform duration-200">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
                  Share your link
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Get a unique paywall URL. Share it on social media, email, or anywhere.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-5 group">
              <div className="flex-shrink-0 w-10 h-10 bg-primary-600 dark:bg-primary-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-md group-hover:scale-105 transition-transform duration-200">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-2">
                  Receive payment instantly
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Payments go straight to your wallet. Content unlocks automatically via x402 protocol.
                </p>
              </div>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200/50 dark:border-white/10 mt-20 relative z-10">
        <div className="container mx-auto px-4 py-10">
          <div className="text-center space-y-4">
            {/* Social Icons */}
            <div className="flex items-center justify-center space-x-4 mb-4">
              <a
                href="https://x.com/paywall402"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
                aria-label="Follow us on X (Twitter)"
              >
                <Image src="/x.png" alt="X" width={20} height={20} className="opacity-70 hover:opacity-100 transition-opacity dark:invert-0 invert" />
              </a>
              <a
                href="https://paywall402.gitbook.io"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
                aria-label="Read our documentation on GitBook"
              >
                <Image src="/gitbook.webp" alt="GitBook" width={20} height={20} className="opacity-70 hover:opacity-100 transition-opacity dark:invert-0 invert" />
              </a>
              <a
                href="https://github.com/paywall402/paywall402"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
                aria-label="View source code on GitHub"
              >
                <Image src="/github.png" alt="GitHub" width={20} height={20} className="opacity-70 hover:opacity-100 transition-opacity dark:invert-0 invert" />
              </a>
            </div>

            <div className="text-gray-500 dark:text-gray-400 space-y-3">
              <p className="text-sm">
                Built with x402 protocol · Powered by Solana
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                © 2025 PayWall402
              </p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
