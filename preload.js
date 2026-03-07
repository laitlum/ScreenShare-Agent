const { contextBridge, ipcRenderer } = require("electron");

// Load runtime config safely; default to PRODUCTION URLs if require fails
let runtimeConfig;
try {
  runtimeConfig = require("./config");
  console.log("🔧 Preload: loaded runtime config from ./config");
} catch (e) {
  console.warn(
    "⚠️ Preload: failed to load ./config, defaulting to PRODUCTION URLs:",
    e?.message || e
  );
  runtimeConfig = {
    BACKEND_URL: "https://laitlum.lipiq.in",
    BACKEND_WS_URL: "wss://laitlum.lipiq.in/ws",
    WS_SERVER_URL: "wss://laitlum.lipiq.in/ws",
  };
}

let desktopCapturer;

try {
  desktopCapturer = require("electron").desktopCapturer;
  console.log("🔧 desktopCapturer imported successfully");
} catch (error) {
  console.log("🔧 Failed to import desktopCapturer:", error.message);
  desktopCapturer = null;
}

console.log("🔧 Preload script loading...");
console.log("🔧 desktopCapturer available:", !!desktopCapturer);
console.log("🔧 ipcRenderer available:", !!ipcRenderer);
console.log("🔧 Runtime config loaded:", runtimeConfig);

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Configuration
  config: {
    BACKEND_URL:    runtimeConfig.BACKEND_URL,
    BACKEND_WS_URL: runtimeConfig.BACKEND_WS_URL,
    WS_SERVER_URL:  runtimeConfig.WS_SERVER_URL,
    // TURN server (for cross-NAT WebRTC) — set in env.production or process.env
    TURN_URL:      runtimeConfig.TURN_URL      || "",
    TURN_USERNAME: runtimeConfig.TURN_USERNAME || "",
    TURN_PASSWORD: runtimeConfig.TURN_PASSWORD || "",
  },
  
  // Session management
  createSession: () => ipcRenderer.invoke("create-session"),

  // WebRTC communication
  sendWebRTCOffer: (data) => ipcRenderer.invoke("send-webrtc-offer", data),
  sendWebRTCAnswer: (data) => ipcRenderer.invoke("send-webrtc-answer", data),
  sendIceCandidate: (data) => ipcRenderer.invoke("send-ice-candidate", data),

  // Screen capture
  getDisplayMedia: () => ipcRenderer.invoke("get-display-media"),

  // Desktop capture with audio support
  getDesktopSources: async (options) => {
    try {
      console.log("🔧 getDesktopSources called with options:", options);
      console.log(
        "🔧 desktopCapturer available in function:",
        !!desktopCapturer
      );

      if (!desktopCapturer) {
        console.log("⚠️ desktopCapturer not available, using fallback method");
        // Fallback: use the main process to get sources
        return await ipcRenderer.invoke("get-desktop-sources", options);
      }

      const sources = await desktopCapturer.getSources(options);
      console.log("🔧 Got sources via desktopCapturer:", sources?.length || 0);
      return sources;
    } catch (error) {
      console.error("🔧 Error getting desktop sources:", error);
      console.log("🔄 Trying fallback method...");
      try {
        return await ipcRenderer.invoke("get-desktop-sources", options);
      } catch (fallbackError) {
        console.error("🔧 Fallback method also failed:", fallbackError);
        throw error; // Throw original error
      }
    }
  },

  // Event listeners
  onSessionCreated: (callback) => ipcRenderer.on("session-created", callback),
  onCreateWebRTCOffer: (callback) =>
    ipcRenderer.on("create-webrtc-offer", callback),
  onViewerJoined: (callback) => ipcRenderer.on("viewer-joined", callback),
  onViewerDisconnected: (callback) =>
    ipcRenderer.on("viewer-disconnected", callback),
  onWebRTCOffer: (callback) => ipcRenderer.on("webrtc-offer", callback),
  onWebRTCAnswer: (callback) => ipcRenderer.on("webrtc-answer", callback),
  onIceCandidate: (callback) => ipcRenderer.on("ice-candidate", callback),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // Device info
  getDeviceInfo: () => ipcRenderer.invoke("get-device-info"),

  // Remote control
  sendRemoteInput: (inputData) =>
    ipcRenderer.invoke("send-remote-input", inputData),
  onMainProcessLog: (callback) =>
    ipcRenderer.on("main-process-log", (event, message) => callback(message)),

  // Background/Window control
  minimizeToBackground: () => ipcRenderer.invoke("minimize-to-background"),
  showFromBackground: () => ipcRenderer.invoke("show-from-background"),
  getBackgroundStatus: () => ipcRenderer.invoke("get-background-status"),

  // Window controls (custom title bar)
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowMaximize: () => ipcRenderer.invoke("window-maximize"),
  windowClose: () => ipcRenderer.invoke("window-close"),
  windowIsMaximized: () => ipcRenderer.invoke("window-is-maximized"),

  // Auto-update
  onUpdateAvailable: (callback) =>
    ipcRenderer.on("update-available", (_event, version) => callback(version)),
  onUpdateDownloaded: (callback) =>
    ipcRenderer.on("update-downloaded", (_event, version) => callback(version)),
  installUpdate: () => ipcRenderer.send("install-update"),

  // Utility
  isAvailable: () => true,

  // Test function
  testConnection: () => {
    console.log("🔧 Test connection called from renderer");
    return {
      preloadWorking: true,
      timestamp: Date.now(),
      desktopCapturerAvailable: !!desktopCapturer,
      ipcRendererAvailable: !!ipcRenderer,
    };
  },
});

console.log("🔧 Preload script loaded, electronAPI exposed");
