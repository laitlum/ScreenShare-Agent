const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = 3000;

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

console.log('🚀 Combined HTTP + WebSocket server running on port 3000');

wss.on("connection", (ws) => {
  console.log('🔌 New client connected');
  
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      console.log('📨 Received message:', data.type, 'for session:', data.sessionId);
      
      if (data.type === "create-session") {
        const sessionId = generateSessionId();
        sessions[sessionId] = { agent: ws, viewer: null, createdAt: Date.now() };
        ws.sessionId = sessionId;
        ws.role = "agent";
        ws.send(JSON.stringify({ type: "session-created", sessionId }));
        console.log('🤖 Agent created session:', sessionId);
      }
      
      if (data.type === "join-session" && sessions[data.sessionId]) {
        sessions[data.sessionId].viewer = ws;
        ws.sessionId = data.sessionId;
        ws.role = "viewer";
        ws.send(JSON.stringify({ type: "viewer-joined", sessionId: data.sessionId }));
        if (sessions[data.sessionId].agent) {
          sessions[data.sessionId].agent.send(JSON.stringify({ type: "viewer-joined", sessionId: data.sessionId }));
        }
        console.log('👁️ Viewer joined session:', data.sessionId);
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
        sessions[data.sessionId].agent.send(JSON.stringify({
          type: "input-event",
          sessionId: data.sessionId,
          action: data.action,
          x: data.x,
          y: data.y,
          button: data.button,
          key: data.key,
          modifiers: data.modifiers,
          remoteWidth: data.remoteWidth,
          remoteHeight: data.remoteHeight
        }));
        console.log('🎮 Forwarded viewer input to agent:', data.action);
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
  console.log('🌐 Viewer available at: http://localhost:3000');
  console.log('🔌 WebSocket signaling on: ws://localhost:3000');
  console.log('📱 Mobile access: http://192.168.31.174:3000');
  console.log('🔓 Bound to all interfaces for mobile access');
});
