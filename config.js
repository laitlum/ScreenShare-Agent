// Environment-based configuration for Electron Agent
const path = require('path');
const fs = require('fs');

// Production URLs - deployed server
const PRODUCTION_URLS = {
  BACKEND_URL: 'https://laitlum.lipiq.in',
  BACKEND_WS_URL: 'wss://laitlum.lipiq.in/ws',
  WS_SERVER_URL: 'wss://laitlum.lipiq.in/ws',
};

const DEVELOPMENT_URLS = {
  BACKEND_URL: 'http://localhost:8000',
  BACKEND_WS_URL: 'ws://localhost:8000/ws',
  WS_SERVER_URL: 'ws://localhost:8081/ws',
};

// Detect if running from source (development) vs packaged
// Packaged apps have __dirname inside app.asar or in .app/Contents/Resources
const isDevelopment = process.env.NODE_ENV !== 'production' &&
                     !__dirname.includes('app.asar') &&
                     !__dirname.includes('.app/Contents/Resources');

// Load environment variables from env.production file when packaged or in production mode
if (!isDevelopment) {
  const envPath = path.join(__dirname, 'env.production');
  if (fs.existsSync(envPath)) {
    try {
      const envConfig = fs.readFileSync(envPath, 'utf-8');
      envConfig.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=');
            process.env[key] = value;
          }
        }
      });
      console.log('✅ Loaded environment variables from env.production');
    } catch (e) {
      console.log('⚠️ Failed to load env.production:', e.message);
    }
  }
}

// REVERSED LOGIC: Default to production, only use development if explicitly in dev mode
let environment;
let selectedUrls;

if (isDevelopment) {
  environment = 'development';
  selectedUrls = {
    ...DEVELOPMENT_URLS,
    TURN_URL:      process.env.TURN_URL      || "",
    TURN_USERNAME: process.env.TURN_USERNAME || "",
    TURN_PASSWORD: process.env.TURN_PASSWORD || "",
  };
  console.log('🔧 Running in DEVELOPMENT mode (source files detected)');
} else {
  environment = 'production';
  // Use env vars if available, otherwise use hardcoded production URLs
  selectedUrls = {
    BACKEND_URL:    process.env.BACKEND_URL    || PRODUCTION_URLS.BACKEND_URL,
    BACKEND_WS_URL: process.env.BACKEND_WS_URL || PRODUCTION_URLS.BACKEND_WS_URL,
    WS_SERVER_URL:  process.env.WS_SERVER_URL  || PRODUCTION_URLS.WS_SERVER_URL,
    // TURN server for cross-NAT P2P — set these in env.production
    TURN_URL:      process.env.TURN_URL      || "",
    TURN_USERNAME: process.env.TURN_USERNAME || "",
    TURN_PASSWORD: process.env.TURN_PASSWORD || "",
  };
  console.log('🚀 Running in PRODUCTION mode');
}

console.log(`🔧 Electron Agent Environment: ${environment}`);
console.log(`🔧 Backend URL: ${selectedUrls.BACKEND_URL}`);
console.log(`🔧 WebSocket URL: ${selectedUrls.WS_SERVER_URL}`);

module.exports = selectedUrls;
