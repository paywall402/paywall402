# PayWall402

**Decentralized content monetization platform built on Solana using the x402 protocol.**

Create paywalls in seconds, get paid instantly in USDC with zero middlemen.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://paywall402.xyz)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Features

- **Instant Payments** - USDC hits your wallet the moment someone pays
- **Secure Content Protection** - Content protected until payment is verified on-chain
- **No Sign-up Required** - Upload content, set your price, share the link
- **x402 Protocol** - Built on the x402 payment protocol for Solana
- **Multi-format Support** - Files, text, and links

## Tech Stack

**Frontend:**
- Next.js 14
- React 18
- TailwindCSS
- Solana Web3.js
- Framer Motion

**Backend:**
- Node.js + Express
- PostgreSQL
- x402-solana SDK
- Solana SPL Token

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Solana wallet

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Configure NEXT_PUBLIC_API_URL
npm run dev
```

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Configure DATABASE_URL, SOLANA_RPC_URL, etc.
npm run dev
```

## Deployment

### Frontend (Vercel)

1. Import project on Vercel
2. Set root directory to `frontend`
3. Add environment variable: `NEXT_PUBLIC_API_URL`
4. Deploy

### Backend (Railway)

```bash
cd backend
railway login
railway init
# Set environment variables in Railway dashboard
railway up
```

## Environment Variables

### Backend

```env
DATABASE_URL=postgresql://...
FRONTEND_URL=https://paywall402.xyz
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
PORT=3001
```

### Frontend

```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

## How It Works

1. **Upload** - Add files, text, or links and set your price ($0.01-$100 USDC)
2. **Share** - Get a unique paywall URL to share anywhere
3. **Receive** - Payments go straight to your wallet, content unlocks automatically

## License

MIT

## Links

- [Website](https://paywall402.xyz)
- [Twitter](https://x.com/paywall402)
- [Documentation](https://paywall402.gitbook.io)

---

Built with x402 protocol · Powered by Solana
