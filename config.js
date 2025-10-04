// Environment-based configuration for Electron Agent
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Load environment variables from env.production file if in production mode
if (process.env.NODE_ENV === 'production' && !app?.isPackaged) {
  const envPath = path.join(__dirname, 'env.production');
  if (fs.existsSync(envPath)) {
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
  }
}

const config = {
  development: {
    BACKEND_URL: 'http://localhost:8000',
    BACKEND_WS_URL: 'ws://localhost:8000/ws',
    WS_SERVER_URL: 'ws://localhost:8081/ws',
  },
  production: {
    BACKEND_URL: process.env.BACKEND_URL || 'https://screenshare-production.up.railway.app',
    BACKEND_WS_URL: process.env.BACKEND_WS_URL || 'wss://screenshare-production.up.railway.app/ws',
    WS_SERVER_URL: process.env.WS_SERVER_URL || 'wss://screenshare-production.up.railway.app/ws',
  }
};

// Detect environment: packaged apps => production; otherwise use NODE_ENV (default to development)
let environment;
if (app && app.isPackaged) {
  environment = 'production';
} else if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
  environment = 'production';
} else {
  environment = 'development';
}

console.log(`🔧 Electron Agent Environment: ${environment}`);
console.log(`🔧 Backend URL: ${config[environment].BACKEND_URL}`);
console.log(`🔧 WebSocket URL: ${config[environment].WS_SERVER_URL}`);

module.exports = config[environment];
