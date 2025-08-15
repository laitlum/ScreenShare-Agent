console.log('🔄 RENDERER.JS LOADED - New WebSocket Architecture');

let peerConnection = null;
let localStream = null;
let currentSessionId = null;
let isSharing = false;

// Initialize the application
function init() {
    console.log('🚀 Initializing application...');
    setupEventListeners();
    updateUI();
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.getElementById('share-tab').addEventListener('click', () => switchTab('share'));
    document.getElementById('permanent-tab').addEventListener('click', () => switchTab('permanent'));
    
    // Action buttons
    document.getElementById('start-sharing-btn').addEventListener('click', startSharing);
    document.getElementById('stop-sharing-btn').addEventListener('click', stopSharing);
    document.getElementById('copy-link-btn').addEventListener('click', copyLink);
    
    // Setup IPC event listeners
    setupIPCEventListeners();
}

// Setup IPC event listeners
function setupIPCEventListeners() {
    if (!window.electronAPI) {
        console.error('❌ electronAPI not available');
        return;
    }

    // Viewer events
    window.electronAPI.onViewerJoined((event, data) => {
        console.log('👁️ Viewer joined:', data);
        showStatus('Viewer connected!', 'success');
        updateUI();
        
        // Send WebRTC offer to establish connection
        if (isSharing && localStream && peerConnection) {
            sendOfferToViewer();
        }
    });

    window.electronAPI.onViewerDisconnected((event, data) => {
        console.log('👁️ Viewer disconnected');
        showStatus('Viewer disconnected', 'warning');
        updateUI();
    });

    // WebRTC events
    window.electronAPI.onWebRTCOffer((event, data) => {
        console.log('📝 Received WebRTC offer:', data);
        handleOffer(data.offer);
    });

    window.electronAPI.onWebRTCAnswer((event, data) => {
        console.log('📝 Received WebRTC answer:', data);
        handleAnswer(data.answer);
    });

    window.electronAPI.onIceCandidate((event, data) => {
        console.log('🧊 Received ICE candidate:', data);
        handleIceCandidate(data.candidate);
    });
}

// Switch between tabs
function switchTab(tab) {
    const shareTab = document.getElementById('share-tab');
    const permanentTab = document.getElementById('permanent-tab');
    const shareContent = document.getElementById('share-content');
    const permanentContent = document.getElementById('permanent-content');

    if (tab === 'share') {
        shareTab.classList.add('text-primary', 'border-primary');
        shareTab.classList.remove('text-gray-500');
        permanentTab.classList.remove('text-primary', 'border-primary');
        permanentTab.classList.add('text-gray-500');
        
        shareContent.classList.remove('hidden');
        permanentContent.classList.add('hidden');
    } else {
        permanentTab.classList.add('text-primary', 'border-primary');
        permanentTab.classList.remove('text-gray-500');
        shareTab.classList.remove('text-primary', 'border-primary');
        shareTab.classList.add('text-gray-500');
        
        permanentContent.classList.remove('hidden');
        shareContent.classList.add('hidden');
    }
}

// Start sharing
async function startSharing() {
    try {
        console.log('🎬 Starting screen sharing...');
        showStatus('Creating session...', 'info');
        
        // Create session
        currentSessionId = await window.electronAPI.createSession();
        console.log('✅ Session created:', currentSessionId);
        
        // Start screen capture
        await startScreenCapture();
        
        // Update UI
        isSharing = true;
        updateUI();
        
        showStatus('Screen sharing started!', 'success');
        
    } catch (error) {
        console.error('❌ Failed to start sharing:', error);
        showStatus('Failed to start sharing: ' + error.message, 'error');
    }
}

// Start screen capture
async function startScreenCapture() {
    try {
        console.log('🎥 Getting display sources...');
        const sources = await window.electronAPI.getDisplayMedia();
        console.log('📺 Display sources received:', sources?.length || 0);
        
        if (sources && sources.length > 0) {
            const primarySource = sources[0];
            console.log('🖥️ Using primary source:', {
                name: primarySource.name,
                id: primarySource.id
            });
            
            // Get media stream with audio
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: primarySource.id
                    }
                },
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: primarySource.id,
                        minWidth: 640,
                        maxWidth: 1920,
                        minHeight: 480,
                        maxHeight: 1080,
                        maxFrameRate: 15
                    }
                }
            });
            
            console.log('✅ Screen capture started');
            localStream = stream;
            
            // Log audio and video tracks
            const audioTracks = stream.getAudioTracks();
            const videoTracks = stream.getVideoTracks();
            console.log(`🎵 Audio tracks: ${audioTracks.length}`);
            console.log(`🎬 Video tracks: ${videoTracks.length}`);
            
            if (audioTracks.length > 0) {
                audioTracks.forEach((track, index) => {
                    console.log(`🔊 Audio track ${index}:`, {
                        kind: track.kind,
                        label: track.label,
                        enabled: track.enabled,
                        muted: track.muted,
                        readyState: track.readyState
                    });
                });
            }
            
            // Try to add system audio if not already included
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });
                
                // Add audio tracks to the main stream
                audioStream.getAudioTracks().forEach(track => {
                    localStream.addTrack(track);
                });
                console.log('🔊 System audio added to stream');
            } catch (audioError) {
                console.log('⚠️ Could not add system audio:', audioError.message);
                console.log('📺 Desktop audio should still work if available');
            }
            
            // Create WebRTC peer connection
            createPeerConnection();
            
        } else {
            throw new Error('No display sources available');
        }
        
    } catch (error) {
        console.error('❌ Screen capture failed:', error);
        throw error;
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
        
        // Add local stream
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('🧊 Generated ICE candidate');
                
                // Serialize the ICE candidate properly
                const serializedCandidate = {
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex
                };
                
                window.electronAPI.sendIce({
                    sessionId: currentSessionId,
                    candidate: serializedCandidate,
                    target: 'viewer'
                });
            }
        };
        
        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log('🔗 Connection state:', peerConnection.connectionState);
        };
        
        console.log('✅ WebRTC peer connection created');
        
    } catch (error) {
        console.error('❌ Failed to create peer connection:', error);
        throw error;
    }
}

// Send WebRTC offer to viewer
async function sendOfferToViewer() {
    try {
        console.log('📤 Creating and sending WebRTC offer to viewer');
        
        if (!peerConnection || !localStream) {
            console.error('❌ No peer connection or local stream available');
            return;
        }
        
        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Serialize the offer properly
        const serializedOffer = {
            type: offer.type,
            sdp: offer.sdp
        };
        
        console.log('📝 Serialized offer:', serializedOffer);
        
        // Send offer to viewer via signaling server
        window.electronAPI.sendOffer({
            sessionId: currentSessionId,
            offer: serializedOffer
        });
        
        console.log('✅ WebRTC offer sent to viewer');
        
    } catch (error) {
        console.error('❌ Failed to send offer:', error);
    }
}

// Handle WebRTC offer
async function handleOffer(offer) {
    try {
        console.log('📝 Processing WebRTC offer');
        
        if (!peerConnection) {
            createPeerConnection();
        }
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        console.log('📤 Sending WebRTC answer');
        window.electronAPI.sendAnswer({
            sessionId: currentSessionId,
            answer: answer
        });
        
    } catch (error) {
        console.error('❌ Error handling offer:', error);
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
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('✅ Added ICE candidate from viewer');
        }
    } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
    }
}

// Stop sharing
function stopSharing() {
    try {
        console.log('🛑 Stopping screen sharing...');
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        isSharing = false;
        currentSessionId = null;
        updateUI();
        
        showStatus('Screen sharing stopped', 'info');
        
    } catch (error) {
        console.error('❌ Error stopping sharing:', error);
    }
}

// Copy link to clipboard
async function copyLink() {
    try {
        const link = `http://localhost:3000?session=${currentSessionId}`;
        await navigator.clipboard.writeText(link);
        showStatus('Link copied to clipboard!', 'success');
    } catch (error) {
        console.error('❌ Failed to copy link:', error);
        showStatus('Failed to copy link', 'error');
    }
}

// Update UI based on current state
function updateUI() {
    const startBtn = document.getElementById('start-sharing-btn');
    const stopBtn = document.getElementById('stop-sharing-btn');
    const copyBtn = document.getElementById('copy-link-btn');
    const sessionLink = document.getElementById('session-link');
    
    if (isSharing && currentSessionId) {
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        copyBtn.classList.remove('hidden');
        sessionLink.textContent = `http://localhost:3000?session=${currentSessionId}`;
    } else {
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        copyBtn.classList.add('hidden');
        sessionLink.textContent = 'Click "Start Sharing" to generate';
    }
}

// Show status message
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('status-message');
    const statusText = document.getElementById('status-text');
    
    // Set message and color
    statusText.textContent = message;
    
    // Remove existing color classes
    statusElement.classList.remove('bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500');
    
    // Add appropriate color class
    switch (type) {
        case 'success':
            statusElement.classList.add('bg-green-500');
            break;
        case 'error':
            statusElement.classList.add('bg-red-500');
            break;
        case 'warning':
            statusElement.classList.add('bg-yellow-500');
            break;
        default:
            statusElement.classList.add('bg-blue-500');
    }
    
    // Show message
    statusElement.classList.remove('translate-x-full');
    
    // Hide after 3 seconds
    setTimeout(() => {
        statusElement.classList.add('translate-x-full');
    }, 3000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
