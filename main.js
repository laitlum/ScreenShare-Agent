const { app, BrowserWindow, ipcMain, desktopCapturer, screen, systemPreferences } = require("electron");
const runtimeConfig = require('./config');
const WebSocket = require("ws");
const { moveMouse, clickMouse, typeChar, pressKey } = require("./remoteControl");
const path = require("path");
const os = require('os');

let mainWindow;
let ws;
let sessionId;
let agentDeviceId;

async function resolveAgentDeviceId() {
  try {
    // Allow override via env for development
    if (process.env.LA_DEVICE_ID) {
      console.log('Using device_id from env:', process.env.LA_DEVICE_ID);
      return process.env.LA_DEVICE_ID;
    }

    const hostname = os.hostname();
    console.log('Resolving device_id for host:', hostname);

    const resp = await fetch(`${runtimeConfig.BACKEND_URL}/api/devices`, {
      headers: {
        // Dev-only header accepted by backend in debug mode
        'X-User-Email': 'sattiramakrishna333@gmail.com'
      }
    });
    if (!resp.ok) {
      throw new Error(`devices api status ${resp.status}`);
    }
    const devices = await resp.json();
    if (!Array.isArray(devices) || devices.length === 0) {
      throw new Error('no devices found');
    }

    // Prefer a device that matches this host, else first active device
    let matched = devices.find(d => (d?.device_name || d?.name || '').toLowerCase().includes(hostname.toLowerCase()));
    if (!matched) {
      matched = devices.find(d => d?.is_active) || devices[0];
    }

    console.log('Selected device record:', {
      id: matched?.id,
      device_id: matched?.device_id,
      name: matched?.device_name || matched?.name
    });
    return matched?.device_id;
  } catch (e) {
    console.log('Failed to resolve device_id:', e?.message || e);
    return undefined;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Laitlum Antivirus - Advanced",
    show: true,  // Force window to be visible
    center: true,  // Center the window
    alwaysOnTop: false,  // Don't keep on top
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      enableScreenCapturing: true,
      webSecurity: false,
      // Enable these for better media capture support
      enableWebCodecs: true,
      // Allow insecure content for development
      allowRunningInsecureContent: true
    },
  });

  // The renderer uses renderer-permanent.js; a minimal HTML will attach to it.
  mainWindow.loadFile(path.join(__dirname, "renderer.html"));
  
  // Add event listeners for debugging
  mainWindow.on('ready-to-show', () => {
    console.log('✅ Window ready to show');
    mainWindow.show();
    mainWindow.focus();
    mainWindow.moveTop();
  });
  
  mainWindow.on('show', () => {
    console.log('✅ Window shown');
  });
  
  mainWindow.on('focus', () => {
    console.log('✅ Window focused');
  });
  
  // Force show the window
  mainWindow.show();
  mainWindow.focus();
  mainWindow.moveTop();
  
  console.log('✅ Window created and shown');
  
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

  // Request screen recording permissions (required for desktop audio on macOS)
  if (process.platform === 'darwin') {
    try {
      const screenRecordingPermission = systemPreferences.getMediaAccessStatus('screen');
      console.log('Screen recording permission status:', screenRecordingPermission);
      
      if (screenRecordingPermission !== 'granted') {
        console.log('⚠️ Screen recording permission required for desktop audio capture');
        console.log('Please enable screen recording for this app in System Preferences > Security & Privacy > Privacy > Screen Recording');
        
        // Try to request screen recording permission
        try {
          const screenRecordingRequest = await systemPreferences.askForMediaAccess('screen');
          console.log('Screen recording permission request result:', screenRecordingRequest);
        } catch (requestError) {
          console.log('Screen recording permission request failed:', requestError.message);
        }
      }
    } catch (error) {
      console.log('Screen recording permission check failed:', error.message);
    }
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

    // Ensure we have the correct device_id for this agent so the backend can map viewer -> agent
    if (!agentDeviceId) {
      agentDeviceId = await resolveAgentDeviceId();
    }
    if (!agentDeviceId) {
      throw new Error('Could not determine agent device_id');
    }

    // Build WS URL based on environment config
    const baseWs = runtimeConfig.WS_SERVER_URL || `ws://127.0.0.1:8081/ws`;
    const urlObj = new URL(baseWs);
    // Ensure path is /ws and append query params
    urlObj.searchParams.set('device_id', agentDeviceId);
    urlObj.searchParams.set('role', 'agent');
    const wsUrl = urlObj.toString();
    console.log('Connecting to signaling WebSocket:', wsUrl);

    ws = new WebSocket(wsUrl, { family: 4 });
    
    return new Promise((resolve, reject) => {
      ws.on("open", () => {
        console.log('✅ WebSocket connected to signaling server');
        const tempSessionId = Math.random().toString(36).substring(2, 10).toUpperCase();
        ws.send(JSON.stringify({
          type: 'create-session',
          sessionId: tempSessionId
        }));
      });
      
      ws.on("message", (msg) => {
        try {
          const data = JSON.parse(msg);
          console.log('📨 Received message:', data.type);
          if (data.type === 'viewer-input') {
            console.log('📨 Full viewer-input message:', JSON.stringify(data, null, 2));
          }
          
          if (data.type === "session-created") {
            console.log('🤖 Session created:', data.sessionId);
            
            // Store the correct session ID from server
            sessionId = data.sessionId;
            
            // Send session creation success to renderer
            mainWindow.webContents.send('session-created', { sessionId: data.sessionId });
            
            resolve(data.sessionId);
          }
          
          // When viewer joins, immediately create and send offer
          if (data.type === 'viewer-joined') {
            console.log('👁️ Viewer joined, creating WebRTC offer...');
            
            // Send message to renderer to handle screen capture and WebRTC
            mainWindow.webContents.send('create-webrtc-offer', { sessionId: data.sessionId });
            
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
            const payload = (data && typeof data.data === 'object' && data.data !== null) ? data.data : data;
            console.log('🎮 Received input event:', payload.action);
            handleInput(payload);
          }
          
          if (data.type === "viewer-input") {
            console.log('🎮 Received viewer input:', data.action, 'at', data.x, data.y);
            console.log('🎮 Full viewer input data:', JSON.stringify(data, null, 2));
            // Convert viewer-input to the format expected by handleInput
            const inputData = {
              action: data.action,
              x: data.x,
              y: data.y,
              button: data.button,
              key: data.key,
              char: data.char,
              modifiers: data.modifiers,
              remoteWidth: data.remoteWidth,
              remoteHeight: data.remoteHeight
            };
            handleInput(inputData);
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

// IPC handler for getting desktop sources (fallback)
ipcMain.handle("get-desktop-sources", async (event, options) => {
  try {
    const types = options?.types || ['screen'];
    console.log('🔍 Getting desktop sources via main process with types:', types);
    
    const sources = await desktopCapturer.getSources({
      types: types,
      thumbnailSize: { width: 1920, height: 1080 },
      ...options
    });
    
    console.log(`📺 Found ${sources.length} desktop sources via main process:`, sources.map(s => ({ name: s.name, id: s.id })));
    
    if (sources.length > 0) {
      return sources;
    } else {
      throw new Error('No desktop sources found');
    }
  } catch (error) {
    console.error('❌ Failed to get desktop sources via main process:', error.message);
    throw error;
  }
});

// Handle WebRTC messages from renderer
ipcMain.handle("send-webrtc-offer", async (event, offerData) => {
  try {
    console.log('🔍 Main received offer data:', offerData);
    console.log('🔍 Offer data type:', offerData?.type);
    console.log('🔍 Offer data SDP length:', offerData?.sdp?.length);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'webrtc-offer',
        sessionId: sessionId,
        offer: offerData
      };
      console.log('🔍 Sending message to signaling server:', message);
      ws.send(JSON.stringify(message));
      console.log('📤 Sent WebRTC offer to viewer via signaling server');
      return { success: true };
    } else {
      throw new Error('WebSocket not connected');
    }
  } catch (error) {
    console.error('❌ Failed to send WebRTC offer:', error);
    throw error;
  }
});

ipcMain.handle("send-webrtc-answer", async (event, answerData) => {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'webrtc-answer',
        sessionId: sessionId,
        answer: answerData.answer
      }));
      console.log('📤 Sent WebRTC answer to viewer via signaling server');
      return { success: true };
    } else {
      throw new Error('WebSocket not connected');
    }
  } catch (error) {
    console.error('❌ Failed to send WebRTC answer:', error);
    throw error;
  }
});

ipcMain.handle("send-ice-candidate", async (event, candidateData) => {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'webrtc-ice',
        sessionId: sessionId,
        candidate: candidateData.candidate
      }));
      console.log('📤 Sent ICE candidate to viewer via signaling server');
      return { success: true };
    } else {
      throw new Error('WebSocket not connected');
    }
  } catch (error) {
    console.error('❌ Failed to send ICE candidate:', error);
    throw error;
  }
});

// Device information handler
ipcMain.handle("get-device-info", async () => {
  const os = require('os');
  const { networkInterfaces } = os;
  
  try {
    // Get network interfaces to find IP and MAC
    const interfaces = networkInterfaces();
    let ipAddress = 'Unknown';
    let macAddress = 'Unknown';
    
    // Find the first non-internal interface
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.family === 'IPv4') {
          ipAddress = iface.address;
          macAddress = iface.mac;
          break;
        }
      }
      if (ipAddress !== 'Unknown') break;
    }
    
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      ipAddress: ipAddress,
      macAddress: macAddress,
      architecture: os.arch(),
      type: os.type()
    };
  } catch (error) {
    console.error('❌ Failed to get device info:', error);
    return {
      hostname: 'Unknown',
      platform: process.platform,
      ipAddress: 'Unknown',
      macAddress: 'Unknown',
      architecture: process.arch,
      type: 'Unknown'
    };
  }
});

// Remote control input handler
ipcMain.handle("send-remote-input", async (event, inputData) => {
  try {
    // Safe console logging with error handling
    try {
      console.log('🎮 Received remote input via IPC:', inputData.action);
    } catch (logError) {
      // Ignore console logging errors
    }
    await handleInput(inputData);
    return { success: true };
  } catch (error) {
    try {
      console.error('❌ Error processing remote input:', error);
    } catch (logError) {
      // Ignore console logging errors
    }
    return { success: false, error: error.message };
  }
});

// Handle input events from viewer
async function handleInput(data) {
  try {
    const { width, height } = screen.getPrimaryDisplay().bounds;
    console.log(`🖥️ Screen dimensions: ${width}x${height}`);
    
    if (data.action === "mousemove" || data.action === "move") {
      console.log('🖱️ Processing mouse move:', data);
      console.log(`🖱️ Move coordinates: (${data.x}, ${data.y})`);
      console.log(`🖱️ Remote dimensions: ${data.remoteWidth}x${data.remoteHeight}`);
      // If the viewer sent content pixel coords with remoteWidth/remoteHeight, scale to host
      await moveMouse(data.x, data.y, width, height, data.remoteWidth || width, data.remoteHeight || height);
    }
    
    // Handle click events - process both "click" and "mouseup" actions
    if (data.action === "click" || data.action === "mouseup") {
      console.log('🖱️ Processing mouse click:', data);
      console.log(`🖱️ Click coordinates: (${data.x}, ${data.y})`);
      console.log(`🖱️ Remote dimensions: ${data.remoteWidth}x${data.remoteHeight}`);
      console.log(`🖱️ Mac screen: ${width}x${height}`);
      
      // Move mouse to click coordinates first, then click
      if (data.x !== undefined && data.y !== undefined) {
        await moveMouse(data.x, data.y, width, height, data.remoteWidth || width, data.remoteHeight || height);
      }
      
      await clickMouse(data.button || 'left');
      console.log(`✅ Click executed successfully at (${data.x}, ${data.y})`);
    }
    
    // Skip mousedown to prevent multiple clicks
    if (data.action === "mousedown") {
      console.log(`⏸️ Ignoring ${data.action} - preventing duplicate clicks`);
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
