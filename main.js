const { app, BrowserWindow, ipcMain, desktopCapturer, screen, systemPreferences } = require("electron");
const WebSocket = require("ws");
const { moveMouse, clickMouse, typeChar, pressKey } = require("./remoteControl");
const path = require("path");

let mainWindow;
let ws;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      enableScreenCapturing: true,
      webSecurity: false
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer.html"));
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  // Check accessibility permissions on macOS
  if (process.platform === 'darwin') {
    try {
      const hasAccess = systemPreferences.isTrustedAccessibilityClient(true);
      console.log('Accessibility trusted:', hasAccess);
      
      if (!hasAccess) {
        console.log('⚠️  Accessibility permissions required for remote control');
        console.log('Please enable accessibility for this app in System Preferences > Security & Privacy > Privacy > Accessibility');
      }
    } catch (error) {
      console.error('Error checking accessibility:', error);
    }
  }

  // Request screen capture permissions
  try {
    const permission = await systemPreferences.askForMediaAccess('screen');
    console.log('Screen capture permission granted:', permission);
  } catch (error) {
    console.log('Screen capture permission request failed:', error.message);
  }

  // Request microphone permissions for audio capture
  try {
    const audioPermission = await systemPreferences.askForMediaAccess('microphone');
    console.log('Microphone permission granted:', audioPermission);
  } catch (error) {
    console.log('Microphone permission request failed:', error.message);
  }

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handler for creating session
ipcMain.handle("create-session", async () => {
  try {
    console.log('🔌 Creating WebSocket connection to signaling server...');
    ws = new WebSocket("ws://127.0.0.1:3000");
    
    return new Promise((resolve, reject) => {
      ws.on("open", () => {
        console.log('✅ WebSocket connected to signaling server');
        ws.send(JSON.stringify({ type: "create-session" }));
      });
      
      ws.on("message", (msg) => {
        try {
          const data = JSON.parse(msg);
          console.log('📨 Received message:', data.type);
          
          if (data.type === "session-created") {
            console.log('🤖 Session created:', data.sessionId);
            resolve(data.sessionId);
          }
          
          if (data.type === "viewer-joined") {
            console.log('👁️ Viewer joined session:', data.sessionId);
            mainWindow.webContents.send('viewer-joined', data);
          }
          
          if (data.type === "viewer-disconnected") {
            console.log('👁️ Viewer disconnected');
            mainWindow.webContents.send('viewer-disconnected');
          }
          
          if (data.type === "webrtc-offer") {
            console.log('📝 Received WebRTC offer from viewer');
            mainWindow.webContents.send('webrtc-offer', data);
          }
          
          if (data.type === "webrtc-answer") {
            console.log('📝 Received WebRTC answer from viewer');
            mainWindow.webContents.send('webrtc-answer', data);
          }
          
          if (data.type === "webrtc-ice") {
            console.log('🧊 Received ICE candidate from viewer');
            mainWindow.webContents.send('ice-candidate', data);
          }
          
          if (data.type === "input-event") {
            console.log('🎮 Received input event:', data.action);
            handleInput(data);
          }
          
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      });
      
      ws.on("error", (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });
      
      ws.on("close", () => {
        console.log('🔌 WebSocket connection closed');
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);
    });
    
  } catch (error) {
    console.error('❌ Failed to create session:', error.message);
    throw error;
  }
});

// IPC handler for sending WebRTC offer
ipcMain.handle("send-offer", (event, data) => {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "webrtc-offer",
        sessionId: data.sessionId,
        offer: data.offer
      }));
      console.log('📤 Sent WebRTC offer to signaling server');
      return { success: true };
    } else {
      throw new Error('WebSocket not connected');
    }
  } catch (error) {
    console.error('❌ Failed to send offer:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC handler for sending WebRTC answer
ipcMain.handle("send-answer", (event, data) => {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "webrtc-answer",
        sessionId: data.sessionId,
        answer: data.answer
      }));
      console.log('📤 Sent WebRTC answer to signaling server');
      return { success: true };
    } else {
      throw new Error('WebSocket not connected');
    }
  } catch (error) {
    console.error('❌ Failed to send answer:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC handler for sending ICE candidates
ipcMain.handle("send-ice", (event, data) => {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "webrtc-ice",
        sessionId: data.sessionId,
        candidate: data.candidate,
        target: data.target
      }));
      console.log('📤 Sent ICE candidate to signaling server');
      return { success: true };
    } else {
      throw new Error('WebSocket not connected');
    }
  } catch (error) {
    console.error('❌ Failed to send ICE candidate:', error.message);
    return { success: false, error: error.message };
  }
});

// IPC handler for getting display media
ipcMain.handle("get-display-media", async () => {
  try {
    console.log('🔍 Getting display sources...');
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    
    console.log(`📺 Found ${sources.length} display sources:`, sources.map(s => ({ name: s.name, id: s.id })));
    
    if (sources.length > 0) {
      return sources; // Return ALL sources
    } else {
      throw new Error('No screen sources found');
    }
  } catch (error) {
    console.error('❌ Failed to get display media:', error.message);
    throw error;
  }
});

// Handle input events from viewer
async function handleInput(data) {
  try {
    const { width, height } = screen.getPrimaryDisplay().bounds;
    console.log(`🖥️ Screen dimensions: ${width}x${height}`);
    
    if (data.action === "mousemove") {
      console.log('🖱️ Processing mouse move:', data);
      // If the viewer sent content pixel coords with remoteWidth/remoteHeight, scale to host
      await moveMouse(data.x, data.y, width, height, data.remoteWidth || width, data.remoteHeight || height);
    }
    
    if (data.action === "click") {
      console.log('🖱️ Processing mouse click:', data);
      await clickMouse(data.button || 'left');
    }
    
    if (data.action === "type") {
      console.log('⌨️ Processing character type:', data);
      await typeChar(data.char);
    }
    
    if (data.action === "keypress") {
      console.log('⌨️ Processing key press:', data);
      await pressKey(data.key, data.modifiers || []);
    }
    
  } catch (error) {
    console.error('❌ Error handling input:', error.message);
  }
}

console.log('🚀 Electron main process ready!');
