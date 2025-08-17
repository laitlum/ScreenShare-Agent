const { contextBridge, ipcRenderer } = require('electron');
let desktopCapturer;

try {
  desktopCapturer = require('electron').desktopCapturer;
  console.log('🔧 desktopCapturer imported successfully');
} catch (error) {
  console.log('🔧 Failed to import desktopCapturer:', error.message);
  desktopCapturer = null;
}

console.log('🔧 Preload script loading...');
console.log('🔧 desktopCapturer available:', !!desktopCapturer);
console.log('🔧 ipcRenderer available:', !!ipcRenderer);

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Session management
  createSession: () => ipcRenderer.invoke('create-session'),
  
  // WebRTC communication
  sendOffer: (data) => ipcRenderer.invoke('send-offer', data),
  sendAnswer: (data) => ipcRenderer.invoke('send-answer', data),
  sendIce: (data) => ipcRenderer.invoke('send-ice', data),
  
  // Screen capture
  getDisplayMedia: () => ipcRenderer.invoke('get-display-media'),
  
  // Desktop capture with audio support
  getDesktopSources: async (options) => {
    try {
      console.log('🔧 getDesktopSources called with options:', options);
      console.log('🔧 desktopCapturer available in function:', !!desktopCapturer);
      
      if (!desktopCapturer) {
        console.log('⚠️ desktopCapturer not available, using fallback method');
        // Fallback: use the main process to get sources
        return await ipcRenderer.invoke('get-desktop-sources', options);
      }
      
      const sources = await desktopCapturer.getSources(options);
      console.log('🔧 Got sources via desktopCapturer:', sources?.length || 0);
      return sources;
    } catch (error) {
      console.error('🔧 Error getting desktop sources:', error);
      console.log('🔄 Trying fallback method...');
      try {
        return await ipcRenderer.invoke('get-desktop-sources', options);
      } catch (fallbackError) {
        console.error('🔧 Fallback method also failed:', fallbackError);
        throw error; // Throw original error
      }
    }
  },
  
  // Event listeners
  onViewerJoined: (callback) => ipcRenderer.on('viewer-joined', callback),
  onViewerDisconnected: (callback) => ipcRenderer.on('viewer-disconnected', callback),
  onWebRTCOffer: (callback) => ipcRenderer.on('webrtc-offer', callback),
  onWebRTCAnswer: (callback) => ipcRenderer.on('webrtc-answer', callback),
  onIceCandidate: (callback) => ipcRenderer.on('ice-candidate', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Utility
  isAvailable: () => true,
  
  // Test function
  testConnection: () => {
    console.log('🔧 Test connection called from renderer');
    return {
      preloadWorking: true,
      timestamp: Date.now(),
      desktopCapturerAvailable: !!desktopCapturer,
      ipcRendererAvailable: !!ipcRenderer
    };
  }
});

console.log('🔧 Preload script loaded, electronAPI exposed');
