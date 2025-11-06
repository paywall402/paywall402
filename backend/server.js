import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import app from './app.js';
import pool from './db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;

// Create uploads directory if it doesn't exist
const initializeServer = async () => {
  try {
    await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true });
    console.log('✅ Uploads directory created');
  } catch (error) {
    console.error('❌ Failed to create uploads directory:', error);
  }
};

// Start server
const startServer = async () => {
  await initializeServer();

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║     PayWall402 Backend Server            ║
║     x402 Protocol • Solana • USDC        ║
╚═══════════════════════════════════════════╝

✅ Server running on http://localhost:${PORT}
✅ Environment: ${process.env.NODE_ENV || 'development'}
✅ Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}
✅ x402 Facilitator: ${process.env.X402_FACILITATOR_URL || 'https://api.payai.network/x402'}

📝 API Endpoints:
   - POST   /api/upload
   - GET    /api/content/:id/info
   - GET    /api/content/:id/download
   - POST   /api/payment/initiate
   - POST   /api/payment/verify
   - GET    /health

Press Ctrl+C to stop the server
    `);
  });
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🔄 SIGINT received, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
