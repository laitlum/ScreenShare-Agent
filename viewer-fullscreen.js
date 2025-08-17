console.log('🔄 VIEWER-FULLSCREEN.JS LOADED - Full Screen WebRTC Viewer');

let ws = null;
let peerConnection = null;
let currentSessionId = null;
let isConnected = false;

// DOM elements
const remoteVideo = document.getElementById('remote-video');
const fullscreenOverlay = document.getElementById('fullscreen-overlay');
const connectionStatus = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');


// Setup minimal fullscreen listeners (no exit functionality)
function setupFullscreenListeners() {
    console.log('🔍 Setting up minimal fullscreen listeners...');
    
    // Only listen for key events (no exit functionality)
    document.addEventListener('keydown', handleDocumentKeyDown, true);
    
    console.log('✅ Minimal fullscreen listeners setup complete');
}

// Handle key events at document level (no exit functionality)
function handleDocumentKeyDown(event) {
    // No key handling needed - stay in fullscreen
    console.log('🔑 Key pressed in fullscreen mode:', event.key);
}

// Enter tab-level fullscreen mode (CSS-based, not system fullscreen)
function enterTrueFullscreen() {
    try {
        console.log('🖥️ Entering tab-level fullscreen mode...');
        
        // Add fullscreen class to body for tab-level fullscreen
        document.body.classList.add('fullscreen-mode');
        

        
        // Don't request system fullscreen - stay within tab
        console.log('✅ Tab-level fullscreen mode activated');
        
    } catch (error) {
        console.error('❌ Error entering fullscreen:', error);
    }
}

// Initialize the viewer
function init() {
    console.log('🚀 Initializing full-screen viewer...');
    
    // Enter true fullscreen mode
    enterTrueFullscreen();
    
    // Setup fullscreen change listeners
    setupFullscreenListeners();
    
    // Check if session ID is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    if (sessionId) {
        connectToSession(sessionId);
    } else {
        showError('No session ID provided');
    }
    
    // Setup remote control event listeners
    setupRemoteControl();
}

// Connect to a session
async function connectToSession(sessionId) {
    try {
        console.log('🔌 Connecting to session:', sessionId);
        currentSessionId = sessionId;
        
        updateConnectionStatus('Connecting...');
        showFullscreenOverlay();
        
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
            updateConnectionStatus('Connection Failed');
        };
        
        ws.onclose = () => {
            console.log('🔌 WebSocket connection closed');
            updateConnectionStatus('Disconnected');
            if (isConnected) {
                disconnect();
            }
        };
        
    } catch (error) {
        console.error('❌ Failed to connect:', error);
        showError('Failed to connect: ' + error.message);
        updateConnectionStatus('Connection Failed');
    }
}

// Handle signaling messages
function handleSignalingMessage(data) {
    switch (data.type) {
        case 'viewer-joined':
            console.log('✅ Successfully joined session:', data.sessionId);
            updateConnectionStatus('Connected');
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
        updateConnectionStatus('Connection Failed');
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
                
                // Log stream details for debugging
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
                
                // Check for audio tracks and enable by default
                const audioTracks = stream.getAudioTracks();
                if (audioTracks.length > 0) {
                    console.log('🔊 Audio detected in fullscreen stream');
                    // Enable audio by default (no more muted)
                    remoteVideo.muted = false;
                    console.log('🔊 Fullscreen audio enabled by default');
                    
                    // Optimize audio tracks for better quality
                    audioTracks.forEach((track, index) => {
                        console.log(`🔊 Fullscreen audio track ${index} details:`, {
                            kind: track.kind,
                            label: track.label,
                            enabled: track.enabled,
                            muted: track.muted,
                            readyState: track.readyState,
                            id: track.id
                        });
                        
                        // Enable the track for better quality
                        track.enabled = true;
                        
                        // Apply audio processing if supported
                        if (track.getSettings) {
                            const settings = track.getSettings();
                            console.log('🔊 Fullscreen audio track settings:', settings);
                        }
                        
                        // Set audio track parameters for better quality
                        if (track.getCapabilities) {
                            const capabilities = track.getCapabilities();
                            console.log('🔊 Fullscreen audio track capabilities:', capabilities);
                        }
                    });
                    
                    // Apply audio context for better processing and noise reduction
                    if (window.AudioContext || window.webkitAudioContext) {
                        try {
                            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                            const source = audioContext.createMediaElementSource(remoteVideo);
                            const gainNode = audioContext.createGain();
                            const biquadFilter = audioContext.createBiquadFilter();
                            
                            // Configure audio processing chain
                            source.connect(biquadFilter);
                            biquadFilter.connect(gainNode);
                            gainNode.connect(audioContext.destination);
                            
                            // Set filter to reduce noise (high-pass filter)
                            biquadFilter.type = 'highpass';
                            biquadFilter.frequency.value = 80; // Cut off frequencies below 80Hz
                            biquadFilter.Q.value = 1;
                            
                            // Set gain
                            gainNode.gain.value = 0.7; // Reduce volume slightly to prevent clipping
                            
                            console.log('🔊 Fullscreen audio processing chain applied for noise reduction');
                        } catch (audioError) {
                            console.log('⚠️ Fullscreen audio processing not supported:', audioError.message);
                        }
                    }
                } else {
                    console.log('🔇 No audio tracks in fullscreen stream');
                }
                
                // Ensure autoplay starts when metadata is loaded
                if (typeof remoteVideo.play === 'function') {
                    remoteVideo.onloadedmetadata = () => {
                        try { 
                            remoteVideo.play(); 
                            hideFullscreenOverlay();
                            showRemoteVideo();
                            isConnected = true;
                            updateConnectionStatus('Connected');
                        } catch (_) {}
                    };
                }
                ensureVideoPlayingOnce();
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
                updateConnectionStatus('Connection Failed');
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
        hideRemoteVideo();
        showFullscreenOverlay();
        updateConnectionStatus('Disconnected');
        
        // Clear video
        remoteVideo.srcObject = null;
        
    } catch (error) {
        console.error('❌ Error disconnecting:', error);
    }
}

// Show fullscreen overlay
function showFullscreenOverlay() {
    fullscreenOverlay.classList.remove('hidden');
    remoteVideo.classList.add('hidden');
    keyboardHints.classList.add('hidden');
}

// Hide fullscreen overlay
function hideFullscreenOverlay() {
    fullscreenOverlay.classList.add('hidden');
}

// Show remote video
function showRemoteVideo() {
    remoteVideo.classList.remove('hidden');
    keyboardHints.classList.remove('hidden');
}

// Hide remote video
function hideRemoteVideo() {
    remoteVideo.classList.add('hidden');
    keyboardHints.classList.add('hidden');
}

// Update connection status
function updateConnectionStatus(status) {
    statusText.textContent = status;
    connectionStatus.classList.remove('hidden');
}

// Show error message
function showError(message) {
    console.error('❌ Error:', message);
    // In fullscreen mode, we'll just log errors to console
    // You could add a toast notification here if desired
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
    
    // Handle F11 for exiting fullscreen
    if (event.key === 'F11') {
        event.preventDefault();
        exitFullscreen();
        return;
    }
    
    // Handle ESC key for exiting fullscreen - with higher priority
    if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation(); // Stop event from bubbling up to browser
        console.log('🔑 ESC key pressed - exiting fullscreen');
        exitFullscreen();
        return;
    }
    
    // Handle A key for audio toggle
    if (event.key === 'A' || event.key === 'a') {
        event.preventDefault();
        toggleAudio();
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
