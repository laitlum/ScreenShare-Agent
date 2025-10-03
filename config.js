// Environment-based configuration for Electron Agent
const { app } = require('electron');
const config = {
  development: {
    BACKEND_URL: 'http://localhost:8000',
    BACKEND_WS_URL: 'ws://localhost:8000/ws',
    WS_SERVER_URL: 'ws://localhost:8081/ws',
  },
  production: {
    BACKEND_URL: process.env.BACKEND_URL || 'https://your-heroku-backend.herokuapp.com',
    BACKEND_WS_URL: process.env.BACKEND_WS_URL || 'wss://your-heroku-backend.herokuapp.com/ws',
    WS_SERVER_URL: process.env.WS_SERVER_URL || 'wss://your-heroku-backend.herokuapp.com/ws',
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
