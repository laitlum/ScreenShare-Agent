const { contextBridge, ipcRenderer } = require('electron');

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
  
  // Event listeners
  onViewerJoined: (callback) => ipcRenderer.on('viewer-joined', callback),
  onViewerDisconnected: (callback) => ipcRenderer.on('viewer-disconnected', callback),
  onWebRTCOffer: (callback) => ipcRenderer.on('webrtc-offer', callback),
  onWebRTCAnswer: (callback) => ipcRenderer.on('webrtc-answer', callback),
  onIceCandidate: (callback) => ipcRenderer.on('ice-candidate', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Utility
  isAvailable: () => true
});
