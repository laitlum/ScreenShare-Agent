console.log('🔄 VIEWER.JS LOADED - WebSocket WebRTC Viewer');

let ws = null;
let peerConnection = null;
let currentSessionId = null;
let isConnected = false;

// DOM elements
const connectionForm = document.getElementById('connection-form');
const sessionInput = document.getElementById('session-input');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const audioToggleBtn = document.getElementById('audio-toggle-btn');
const remoteScreenContainer = document.getElementById('remote-screen-container');
const remoteVideo = document.getElementById('remote-video');
const videoOverlay = document.getElementById('video-overlay');
const connectionStatus = document.getElementById('connection-status');
const sessionIdSpan = document.getElementById('session-id');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const errorText = document.getElementById('error-text');
const successText = document.getElementById('success-text');
const audioControls = document.getElementById('audio-controls');
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');
const audioInstructions = document.getElementById('audio-instructions');

// Initialize the viewer
function init() {
    console.log('🚀 Initializing viewer...');
    setupEventListeners();
    
    // Check if session ID is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    if (sessionId) {
        sessionInput.value = sessionId;
        connectToSession(sessionId);
    }
}

// Setup event listeners
function setupEventListeners() {
    connectBtn.addEventListener('click', () => {
        const sessionId = sessionInput.value.trim();
        if (sessionId) {
            connectToSession(sessionId);
        } else {
            showError('Please enter a session ID');
        }
    });

    disconnectBtn.addEventListener('click', disconnect);
    fullscreenBtn.addEventListener('click', enterFullscreen);
    audioToggleBtn.addEventListener('click', toggleAudio);

    // Handle Enter key in session input
    sessionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            connectBtn.click();
        }
    });

    // Handle volume slider
    volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value;
        volumeValue.textContent = volume + '%';
        if (remoteVideo) {
            remoteVideo.volume = volume / 100;
        }
    });
}

// Connect to a session
async function connectToSession(sessionId) {
    try {
        console.log('🔌 Connecting to session:', sessionId);
        currentSessionId = sessionId;
        
        updateConnectionStatus('connecting');
        showSuccess('Connecting to session...');
        
        // Create WebSocket connection
        const wsProtocol = (location.protocol === 'https:' ? 'wss://' : 'ws://');
        const wsUrl = wsProtocol + location.host;
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('✅ WebSocket connected to signaling server');
            // Join the session
            ws.send(JSON.stringify({
                type: 'join-session',
                sessionId: sessionId
            }));
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 Received message:', data.type);
                handleSignalingMessage(data);
            } catch (error) {
                console.error('❌ Error parsing message:', error);
            }
        };
        
        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            showError('Connection failed. Please try again.');
            updateConnectionStatus('disconnected');
        };
        
        ws.onclose = () => {
            console.log('🔌 WebSocket connection closed');
            updateConnectionStatus('disconnected');
            if (isConnected) {
                disconnect();
            }
        };
        
    } catch (error) {
        console.error('❌ Failed to connect:', error);
        showError('Failed to connect: ' + error.message);
        updateConnectionStatus('disconnected');
    }
}

// Handle signaling messages
function handleSignalingMessage(data) {
    switch (data.type) {
        case 'viewer-joined':
            console.log('✅ Successfully joined session:', data.sessionId);
            showSuccess('Connected to session! Establishing video connection...');
            updateConnectionStatus('connected');
            showRemoteScreen();
            break;
            
        case 'webrtc-offer':
            console.log('📝 Received WebRTC offer');
            handleOffer(data.offer);
            break;
            
        case 'webrtc-answer':
            console.log('📝 Received WebRTC answer');
            handleAnswer(data.answer);
            break;
            
        case 'webrtc-ice':
            console.log('🧊 Received ICE candidate');
            handleIceCandidate(data.candidate);
            break;
            
        case 'agent-disconnected':
            console.log('❌ Agent disconnected');
            showError('Agent disconnected from the session');
            disconnect();
            break;
            
        default:
            console.log('📨 Unknown message type:', data.type);
    }
}

// Handle WebRTC offer
async function handleOffer(offer) {
    try {
        console.log('📝 Processing WebRTC offer:', offer);
        
        if (!peerConnection) {
            createPeerConnection();
        }
        
        // Ensure the offer has the required properties
        if (!offer.type || !offer.sdp) {
            throw new Error('Invalid offer: missing type or sdp');
        }
        
        const sessionDescription = new RTCSessionDescription({
            type: offer.type,
            sdp: offer.sdp
        });
        
        await peerConnection.setRemoteDescription(sessionDescription);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        console.log('📤 Sending WebRTC answer');
        ws.send(JSON.stringify({
            type: "webrtc-answer",
            sessionId: currentSessionId,
            answer: {
                type: answer.type,
                sdp: answer.sdp
            }
        }));
        
    } catch (error) {
        console.error('❌ Error handling offer:', error);
        showError('Failed to establish video connection: ' + error.message);
    }
}

// Handle WebRTC answer
async function handleAnswer(answer) {
    try {
        console.log('📝 Processing WebRTC answer');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('✅ WebRTC connection established');
        
    } catch (error) {
        console.error('❌ Error handling answer:', error);
    }
}

// Handle ICE candidate
async function handleIceCandidate(candidate) {
    try {
        if (peerConnection && candidate) {
            console.log('🧊 Adding ICE candidate:', candidate);
            
            // Ensure the candidate has the required properties
            if (!candidate.candidate) {
                throw new Error('Invalid ICE candidate: missing candidate property');
            }
            
            const iceCandidate = new RTCIceCandidate({
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid || null,
                sdpMLineIndex: candidate.sdpMLineIndex || null
            });
            
            await peerConnection.addIceCandidate(iceCandidate);
            console.log('✅ Added ICE candidate from agent');
        }
    } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
    }
}

// Create WebRTC peer connection
function createPeerConnection() {
    try {
        peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        });
        
                // Handle incoming tracks
        peerConnection.ontrack = (event) => {
          console.log('🎥 Received remote track');
          if (event.streams && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            
            // Log stream details
            const stream = event.streams[0];
            console.log(`🎬 Stream tracks: ${stream.getTracks().length}`);
            stream.getTracks().forEach((track, index) => {
                console.log(`Track ${index}:`, {
                    kind: track.kind,
                    label: track.label,
                    enabled: track.enabled,
                    muted: track.muted,
                    readyState: track.readyState
                });
            });
            
            // Check for audio tracks and show audio controls
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
                console.log('🔊 Audio detected in stream');
                audioControls.classList.remove('hidden');
                audioToggleBtn.classList.remove('hidden');
                
                // Show audio instructions
                const audioInstructions = document.getElementById('audio-instructions');
                if (audioInstructions) {
                    audioInstructions.classList.remove('hidden');
                }
                
                // Start muted to avoid autoplay issues
                remoteVideo.muted = true;
                console.log('🔇 Video muted initially to avoid autoplay issues');
            } else {
                console.log('🔇 No audio tracks in stream');
                audioControls.classList.add('hidden');
                audioToggleBtn.classList.add('hidden');
                
                // Hide audio instructions
                const audioInstructions = document.getElementById('audio-instructions');
                if (audioInstructions) {
                    audioInstructions.classList.add('hidden');
                }
            }
            
            // Ensure autoplay starts when metadata is loaded (muted)
            if (typeof remoteVideo.play === 'function') {
              remoteVideo.onloadedmetadata = () => {
                try { 
                    remoteVideo.play(); 
                    console.log('✅ Video started playing (muted)');
                } catch (error) {
                    console.log('⚠️ Video autoplay failed:', error.message);
                }
              };
            }
            ensureVideoPlayingOnce();
            hideVideoOverlay();
            isConnected = true;
            showSuccess('Remote screen connected! You can now control the remote computer.');
            
            // Setup remote control event listeners
            setupRemoteControl();
          }
        };
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('🧊 Generated ICE candidate');
                ws.send(JSON.stringify({
                    type: 'webrtc-ice',
                    sessionId: currentSessionId,
                    candidate: event.candidate,
                    target: 'agent'
                }));
            }
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log('🔗 Connection state:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                console.log('✅ WebRTC connection established');
            } else if (peerConnection.connectionState === 'failed') {
                console.error('❌ WebRTC connection failed');
                showError('Video connection failed. Please try reconnecting.');
            }
        };
        
        console.log('✅ WebRTC peer connection created');
        
    } catch (error) {
        console.error('❌ Failed to create peer connection:', error);
        throw error;
    }
}

// Disconnect from session
function disconnect() {
    try {
        console.log('🛑 Disconnecting from session...');
        
        // Close WebRTC connection
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        // Close WebSocket connection
        if (ws) {
            ws.close();
            ws = null;
        }
        
        // Reset state
        isConnected = false;
        currentSessionId = null;
        
        // Update UI
        hideRemoteScreen();
        updateConnectionStatus('disconnected');
        showSuccess('Disconnected from session');
        
        // Clear video
        remoteVideo.srcObject = null;
        
    } catch (error) {
        console.error('❌ Error disconnecting:', error);
    }
}

// Show remote screen interface
function showRemoteScreen() {
    connectionForm.classList.add('hidden');
    remoteScreenContainer.classList.remove('hidden');
    sessionIdSpan.textContent = currentSessionId;
}

// Hide remote screen interface
function hideRemoteScreen() {
    connectionForm.classList.remove('hidden');
    remoteScreenContainer.classList.add('hidden');
    sessionIdSpan.textContent = 'Connecting...';
}

// Hide video overlay
function hideVideoOverlay() {
    videoOverlay.classList.add('hidden');
}

// Update connection status
function updateConnectionStatus(status) {
    const statusDot = connectionStatus.querySelector('div');
    const statusText = connectionStatus.querySelector('span');
    
    statusDot.className = 'w-3 h-3 rounded-full';
    
    switch (status) {
        case 'connecting':
            statusDot.classList.add('bg-yellow-500');
            statusText.textContent = 'Connecting...';
            break;
        case 'connected':
            statusDot.classList.add('bg-green-500');
            statusText.textContent = 'Connected';
            break;
        case 'disconnected':
        default:
            statusDot.classList.add('bg-red-500');
            statusText.textContent = 'Disconnected';
            break;
    }
}

// Show error message
function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    successMessage.classList.add('hidden');
    
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 5000);
}

// Show success message
function showSuccess(message) {
    successText.textContent = message;
    successMessage.classList.remove('hidden');
    errorMessage.classList.add('hidden');
    
    setTimeout(() => {
        successMessage.classList.add('hidden');
    }, 5000);
}

// Setup remote control event listeners
function setupRemoteControl() {
  console.log('🎮 Setting up remote control...');
  
  // Mouse events on video
  remoteVideo.addEventListener('mousemove', handleMouseMove);
  remoteVideo.addEventListener('click', handleMouseClick);
  remoteVideo.addEventListener('contextmenu', handleRightClick);
  
  // Keyboard events
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  
  console.log('✅ Remote control setup complete');
}

// Utility: map client event to video content pixel coordinates
function getVideoContentCoords(event) {
  const rect = remoteVideo.getBoundingClientRect();
  const containerW = rect.width;
  const containerH = rect.height;
  const videoW = remoteVideo.videoWidth || containerW;
  const videoH = remoteVideo.videoHeight || containerH;
  // Scale used by object-contain
  const scale = Math.min(containerW / videoW, containerH / videoH) || 1;
  const displayedW = videoW * scale;
  const displayedH = videoH * scale;
  const offsetX = (containerW - displayedW) / 2;
  const offsetY = (containerH - displayedH) / 2;
  // Position within the displayed content (clamped)
  const cx = event.clientX - rect.left - offsetX;
  const cy = event.clientY - rect.top - offsetY;
  const clampedX = Math.max(0, Math.min(displayedW, cx));
  const clampedY = Math.max(0, Math.min(displayedH, cy));
  // Convert to source video pixel coordinates
  const px = Math.round((clampedX / displayedW) * videoW);
  const py = Math.round((clampedY / displayedH) * videoH);
  return { x: px, y: py, videoW: Math.round(videoW), videoH: Math.round(videoH) };
}

// Handle mouse movement
function handleMouseMove(event) {
  if (!isConnected || !ws) return;
  const { x, y, videoW, videoH } = getVideoContentCoords(event);
  ws.send(JSON.stringify({
    type: 'viewer-input',
    sessionId: currentSessionId,
    action: 'mousemove',
    x,
    y,
    remoteWidth: videoW,
    remoteHeight: videoH
  }));
}

// Handle mouse click
function handleMouseClick(event) {
  if (!isConnected || !ws) return;
  const { x, y, videoW, videoH } = getVideoContentCoords(event);
  ws.send(JSON.stringify({
    type: 'viewer-input',
    sessionId: currentSessionId,
    action: 'click',
    x,
    y,
    button: 'left',
    remoteWidth: videoW,
    remoteHeight: videoH
  }));
}

// Handle right click
function handleRightClick(event) {
  event.preventDefault();
  if (!isConnected || !ws) return;
  const { x, y, videoW, videoH } = getVideoContentCoords(event);
  ws.send(JSON.stringify({
    type: 'viewer-input',
    sessionId: currentSessionId,
    action: 'click',
    x,
    y,
    button: 'right',
    remoteWidth: videoW,
    remoteHeight: videoH
  }));
}

// Handle key down
function handleKeyDown(event) {
    if (!isConnected || !ws) return;
    
    // Prevent default for special keys
    if (['Tab', 'F5', 'F12'].includes(event.key)) {
        event.preventDefault();
    }
    
    // Handle F11 for fullscreen
    if (event.key === 'F11') {
        event.preventDefault();
        enterFullscreen();
        return;
    }
    
    // Send key press event
    ws.send(JSON.stringify({
        type: 'viewer-input',
        sessionId: currentSessionId,
        action: 'keypress',
        key: event.key,
        modifiers: getModifiers(event)
    }));
}

// Handle key up
function handleKeyUp(event) {
  if (!isConnected || !ws) return;
  
  // Send key release event if needed
  // For now, we'll just handle key down
}

// Get modifier keys
function getModifiers(event) {
  const modifiers = [];
  if (event.ctrlKey) modifiers.push('ctrl');
  if (event.altKey) modifiers.push('alt');
  if (event.shiftKey) modifiers.push('shift');
  if (event.metaKey) modifiers.push('meta');
  return modifiers;
}

function ensureVideoPlayingOnce() {
  if (!remoteVideo) return;
  let attempted = false;
  const tryPlay = async () => {
    if (attempted) return;
    attempted = true;
    try { await remoteVideo.play(); } catch (_) { /* ignore */ }
    window.removeEventListener('click', tryPlay, true);
    window.removeEventListener('keydown', tryPlay, true);
  };
  window.addEventListener('click', tryPlay, true);
  window.addEventListener('keydown', tryPlay, true);
}

// Toggle audio on/off
function toggleAudio() {
    if (remoteVideo.muted) {
        // Try to unmute - this requires user interaction
        try {
            remoteVideo.muted = false;
            
            // Try to play to ensure audio is active
            remoteVideo.play().then(() => {
                console.log('✅ Audio successfully enabled');
                audioToggleBtn.textContent = '🔊 Audio On';
                audioToggleBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
                audioToggleBtn.classList.add('bg-green-600', 'hover:bg-green-700');
                audioControls.classList.remove('hidden');
                showSuccess('Audio enabled! You can now hear the remote computer.');
            }).catch(error => {
                console.log('⚠️ Audio play failed:', error.message);
                // Revert to muted state
                remoteVideo.muted = true;
                showError('Audio failed to start. Please try clicking again.');
            });
        } catch (error) {
            console.error('❌ Error enabling audio:', error);
            showError('Failed to enable audio');
        }
    } else {
        remoteVideo.muted = true;
        audioToggleBtn.textContent = '🔇 Audio Off';
        audioToggleBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        audioToggleBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        audioControls.classList.add('hidden');
        showSuccess('Audio disabled');
    }
}

// Enter fullscreen mode
function enterFullscreen() {
    if (!currentSessionId) {
        showError('No active session to enter fullscreen');
        return;
    }
    
    // Redirect to fullscreen viewer with current session
    const fullscreenUrl = new URL(window.location);
    fullscreenUrl.pathname = '/viewer-fullscreen.html';
    window.location.href = fullscreenUrl.toString();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
