const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8081;

// Create HTTP server to serve viewer files
const server = http.createServer((req, res) => {
  console.log(`🌐 HTTP request: ${req.method} ${req.url}`);
  
  // Handle WebSocket upgrade requests
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    // Let the WebSocket server handle this
    return;
  }
  
  // Parse URL to remove query parameters
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  let filePath = '';
  
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(__dirname, 'viewer.html');
  } else if (pathname.endsWith('.js')) {
    filePath = path.join(__dirname, pathname);
  } else {
    // Try to serve the requested file
    filePath = path.join(__dirname, pathname);
  }
  
  console.log(`📁 Serving file: ${filePath}`);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('File not found');
    return;
  }
  
  // Get file extension for content type
  const ext = path.extname(filePath);
  let contentType = 'text/plain';
  
  switch (ext) {
    case '.html':
      contentType = 'text/html';
      break;
    case '.js':
      contentType = 'application/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
  }
  
  console.log(`✅ Serving ${filePath} as ${contentType}`);
  
  // Read and serve file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`❌ Error reading file: ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error reading file');
      return;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// Create WebSocket server attached to the HTTP server
const wss = new WebSocket.Server({ server });

const sessions = {};

// Click deduplication to prevent multiple identical clicks
const recentClicks = new Map(); // Store recent clicks to prevent duplicates
const CLICK_DEDUPE_WINDOW = 500; // 500ms window for deduplication

function isClickDuplicate(sessionId, inputData) {
  if (inputData.action !== 'mouseup') return false; // Only dedupe actual clicks
  
  const clickKey = `${sessionId}-${inputData.action}-${inputData.x}-${inputData.y}-${inputData.button}`;
  const now = Date.now();
  
  if (recentClicks.has(clickKey)) {
    const lastClickTime = recentClicks.get(clickKey);
    if (now - lastClickTime < CLICK_DEDUPE_WINDOW) {
      return true; // This is a duplicate click
    }
  }
  
  // Store this click and clean up old entries
  recentClicks.set(clickKey, now);
  
  // Clean up old entries (older than the dedupe window)
  for (const [key, time] of recentClicks.entries()) {
    if (now - time > CLICK_DEDUPE_WINDOW) {
      recentClicks.delete(key);
    }
  }
  
  return false;
}

// Start the server on all network interfaces
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Combined HTTP + WebSocket server running on port ${PORT}`);
  const environment = process.env.NODE_ENV || 'development';
  if (environment === 'development') {
    console.log(`📱 Local access: http://localhost:${PORT}`);
    console.log(`📱 Network access: http://YOUR_LOCAL_IP:${PORT}`);
    console.log(`🔗 Example session: http://localhost:${PORT}?session=D0AGEVHU`);
  } else {
    console.log(`📱 Production signaling server running on port ${PORT}`);
  }
});

wss.on("connection", (ws) => {
  console.log('🔌 New client connected');
  
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      console.log('📨 Received message:', data.type, 'for session:', data.sessionId);
      
      if (data.type === "create-session") {
        // Use the provided sessionId or generate a new one
        const sessionId = data.sessionId || generateSessionId();
        sessions[sessionId] = { agent: ws, viewer: null, createdAt: Date.now() };
        ws.sessionId = sessionId;
        ws.role = "agent";
        ws.send(JSON.stringify({ type: "session-created", sessionId }));
        console.log('🤖 Agent created session:', sessionId);
      }
      
      if ((data.type === "join-session" || data.type === "join-device-session") && sessions[data.sessionId]) {
        sessions[data.sessionId].viewer = ws;
        ws.sessionId = data.sessionId;
        ws.role = "viewer";
        ws.send(JSON.stringify({ type: "viewer-joined", sessionId: data.sessionId }));
        if (sessions[data.sessionId].agent) {
          sessions[data.sessionId].agent.send(JSON.stringify({ type: "viewer-joined", sessionId: data.sessionId }));
        }
        console.log('👁️ Viewer joined session:', data.sessionId);
      }
      
      // Handle device session joining - viewer sends device ID, we need to find matching session
      if (data.type === "join-device-session") {
        // data.sessionId is something like "device-id_20250830224636"
        // We need to find a session that matches this device ID
        const deviceId = data.sessionId; // This is already "device-id_20250830224636"
        console.log('🔍 Looking for device session with ID:', deviceId);
        
        if (sessions[deviceId]) {
          sessions[deviceId].viewer = ws;
          ws.sessionId = deviceId;
          ws.role = "viewer";
          ws.send(JSON.stringify({ type: "viewer-joined", sessionId: deviceId }));
          if (sessions[deviceId].agent) {
            sessions[deviceId].agent.send(JSON.stringify({ type: "viewer-joined", sessionId: deviceId }));
          }
          console.log('👁️ Viewer joined device session:', deviceId);
        } else {
          console.log('❌ Device session not found:', deviceId);
          console.log('📋 Available sessions:', Object.keys(sessions));
          ws.send(JSON.stringify({ type: "error", message: "Session not found" }));
        }
      }
      
      if (data.type === "webrtc-offer" && sessions[data.sessionId]?.viewer) {
        sessions[data.sessionId].viewer.send(JSON.stringify({
          type: "webrtc-offer",
          sessionId: data.sessionId,
          offer: data.offer
        }));
        console.log('📤 Forwarded WebRTC offer to viewer');
      }
      
      if (data.type === "webrtc-answer" && sessions[data.sessionId]?.agent) {
        sessions[data.sessionId].agent.send(JSON.stringify({
          type: "webrtc-answer",
          sessionId: data.sessionId,
          answer: data.answer
        }));
        console.log('📤 Forwarded WebRTC answer to agent');
      }
      
      if (data.type === "webrtc-ice" && sessions[data.sessionId]) {
        const target = ws.role === "agent" ? sessions[data.sessionId].viewer : sessions[data.sessionId].agent;
        if (target) {
          target.send(JSON.stringify({
            type: "webrtc-ice",
            sessionId: data.sessionId,
            candidate: data.candidate
          }));
          console.log('📤 Forwarded ICE candidate');
        }
      }
      
      if (data.type === "viewer-input" && sessions[data.sessionId]?.agent) {
        // Extract the actual input data from the nested inputData object
        const inputData = data.inputData || data;
        
        // Check for duplicate clicks and skip if found
        if (isClickDuplicate(data.sessionId, inputData)) {
          console.log('🚫 Skipping duplicate click:', inputData.action, `(${inputData.x}, ${inputData.y})`);
          return;
        }
        
        // Debug: Log the raw input data (only for non-duplicates)
        console.log('📨 Received message:', inputData.action, 'for session:', data.sessionId);
        
        const forwardMessage = {
          type: "viewer-input",
          sessionId: data.sessionId,
          action: inputData.action,
          inputType: inputData.type,
          x: inputData.x,
          y: inputData.y,
          button: inputData.button,
          key: inputData.key,
          code: inputData.code,
          ctrlKey: inputData.ctrlKey,
          altKey: inputData.altKey,
          shiftKey: inputData.shiftKey,
          metaKey: inputData.metaKey,
          remoteWidth: inputData.remoteWidth,
          remoteHeight: inputData.remoteHeight
        };
        sessions[data.sessionId].agent.send(JSON.stringify(forwardMessage));
        console.log('🎮 Forwarded viewer input to agent:', inputData.action || 'unknown action', inputData.type || 'unknown type');
      }
      
    } catch (error) {
      console.error('❌ Error processing message:', error);
    }
  });
  
  ws.on("close", () => {
    console.log('🔌 Client disconnected, role:', ws.role, 'session:', ws.sessionId);
    if (ws.sessionId && sessions[ws.sessionId]) {
      if (ws.role === "agent") {
        if (sessions[ws.sessionId].viewer) {
          sessions[ws.sessionId].viewer.send(JSON.stringify({ type: "agent-disconnected", sessionId: ws.sessionId }));
        }
        delete sessions[ws.sessionId];
      } else if (ws.role === "viewer") {
        if (sessions[ws.sessionId].agent) {
          sessions[ws.sessionId].agent.send(JSON.stringify({ type: "viewer-disconnected", sessionId: ws.sessionId }));
        }
        sessions[ws.sessionId].viewer = null;
      }
      console.log('🧹 Cleaned up session:', ws.sessionId);
    }
  });
  
  ws.on("error", (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

function generateSessionId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Clean up old sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(sessions).forEach(sessionId => {
    if (now - sessions[sessionId].createdAt > 30 * 60 * 1000) { // 30 minutes
      delete sessions[sessionId];
      console.log('🧹 Cleaned up old session:', sessionId);
    }
  });
}, 5 * 60 * 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ Combined server ready!');
  const environment = process.env.NODE_ENV || 'development';
  if (environment === 'development') {
    console.log(`🌐 Viewer available at: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket signaling on: ws://localhost:${PORT}`);
  } else {
    console.log(`🌐 Production signaling server ready on port ${PORT}`);
  }
  console.log('📱 Mobile access: http://192.168.31.174:3000');
  console.log('🔓 Bound to all interfaces for mobile access');
});
