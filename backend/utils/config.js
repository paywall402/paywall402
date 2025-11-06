import dotenv from 'dotenv';

dotenv.config();

/**
 * Environment configuration and validation
 * Ensures all required environment variables are set
 */

const requiredEnvVars = [
  'DB_PASSWORD',
  'JWT_SECRET'
];

const optionalEnvVars = {
  PORT: '3001',
  NODE_ENV: 'development',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_NAME: 'paywall402',
  DB_USER: 'postgres',
  X402_FACILITATOR_URL: 'https://api.payai.network/x402',
  SOLANA_RPC_ENDPOINT: 'https://api.mainnet-beta.solana.com',
  UPLOAD_MAX_SIZE: '10485760',
  RATE_LIMIT_WINDOW: '15',
  RATE_LIMIT_MAX: '100',
  FRONTEND_URL: 'http://localhost:3000',
  CORS_ORIGIN: 'http://localhost:3000'
};

/**
 * Validate environment variables
 */
export function validateEnvironment() {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check for default values in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET === 'your_secure_random_jwt_secret_here_change_in_production') {
      warnings.push('⚠️  JWT_SECRET is using default value in production!');
    }
    if (!process.env.SOLANA_RPC_ENDPOINT || process.env.SOLANA_RPC_ENDPOINT.includes('api.mainnet-beta.solana.com')) {
      warnings.push('⚠️  Consider using a premium RPC endpoint (like Helius) for production');
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease create a .env file based on .env.example');
    process.exit(1);
  }

  if (warnings.length > 0) {
    warnings.forEach(warning => console.warn(warning));
  }

  // Set defaults for optional variables
  for (const [varName, defaultValue] of Object.entries(optionalEnvVars)) {
    if (!process.env[varName]) {
      process.env[varName] = defaultValue;
    }
  }

  console.log('✅ Environment variables validated');
}

/**
 * Get configuration object
 */
export function getConfig() {
  return {
    // Server
    port: parseInt(process.env.PORT) || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database
    database: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      name: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },

    // Security
    jwtSecret: process.env.JWT_SECRET,
    uploadMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE),
    rateLimit: {
      window: parseInt(process.env.RATE_LIMIT_WINDOW),
      max: parseInt(process.env.RATE_LIMIT_MAX),
    },

    // External services
    x402FacilitatorUrl: process.env.X402_FACILITATOR_URL,
    solanaRpcEndpoint: process.env.SOLANA_RPC_ENDPOINT,

    // CORS
    frontendUrl: process.env.FRONTEND_URL,
    corsOrigin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL,
  };
}

export default {
  validateEnvironment,
  getConfig
};
