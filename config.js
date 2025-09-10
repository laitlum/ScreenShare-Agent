// Environment-based configuration for Electron Agent
const config = {
  development: {
    BACKEND_URL: 'http://localhost:3001',
    BACKEND_WS_URL: 'ws://localhost:3001',
    WS_SERVER_URL: 'ws://localhost:8081',
    SIGNALING_PORT: 8081
  },
  production: {
    BACKEND_URL: process.env.BACKEND_URL || 'https://api.laitlum.com',
    BACKEND_WS_URL: process.env.BACKEND_WS_URL || 'wss://api.laitlum.com',
    WS_SERVER_URL: process.env.WS_SERVER_URL || 'wss://signaling.laitlum.com',
    SIGNALING_PORT: process.env.SIGNALING_PORT || 8081
  }
};

// Detect environment - in Electron, we can use app.isPackaged to detect production
let environment = 'development';
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
  environment = 'production';
} else if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  environment = 'development';
} else {
  // Default to development for local development
  environment = 'development';
}

console.log(`🔧 Electron Agent Environment: ${environment}`);
console.log(`🔧 Backend URL: ${config[environment].BACKEND_URL}`);
console.log(`🔧 WebSocket URL: ${config[environment].WS_SERVER_URL}`);

module.exports = config[environment];
