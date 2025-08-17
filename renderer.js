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
        console.log('🔍 Checking conditions for sending offer:');
        console.log('  - isSharing:', isSharing);
        console.log('  - localStream:', !!localStream);
        console.log('  - peerConnection:', !!peerConnection);
        
        showStatus('Viewer connected!', 'success');
        updateUI();
        
        // Send WebRTC offer to establish connection
        if (isSharing && localStream && peerConnection) {
            console.log('✅ All conditions met, sending offer...');
            sendOfferToViewer();
        } else {
            console.log('⚠️ Conditions not met for sending offer, waiting for setup...');
            if (!isSharing) console.log('  ❌ isSharing is false');
            if (!localStream) console.log('  ❌ localStream is missing');
            if (!peerConnection) console.log('  ❌ peerConnection is missing');
            
            // If we're sharing but peer connection isn't ready, wait a bit and try again
            if (isSharing && localStream && !peerConnection) {
                console.log('⏳ Waiting for peer connection to be ready...');
                setTimeout(() => {
                    if (peerConnection) {
                        console.log('✅ Peer connection ready, sending offer now...');
                        sendOfferToViewer();
                    } else {
                        console.log('❌ Peer connection still not ready after timeout');
                    }
                }, 2000); // Wait 2 seconds
            }
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

// Capture system audio safely
async function captureSystemAudio(primarySource) {
    try {
        console.log('🔊 Attempting to capture system audio...');
        
        // Add timeout to prevent hanging
        const audioCapturePromise = captureSystemAudioInternal(primarySource);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Audio capture timeout after 15 seconds')), 15000);
        });
        
        await Promise.race([audioCapturePromise, timeoutPromise]);
        
    } catch (audioError) {
        console.error('❌ Audio capture failed:', audioError);
        console.log('⚠️ Audio error details:', {
            name: audioError.name,
            message: audioError.message,
            stack: audioError.stack
        });
        console.log('📺 Continuing without audio capture');
    }
}

// Internal audio capture function
async function captureSystemAudioInternal(primarySource) {
    // Check if we're in Electron
    const isElectron = window && window.process && window.process.type;
    console.log('🔍 Running in Electron:', !!isElectron);
    
    // Test basic audio support
    console.log('🔍 Testing basic audio support...');
    try {
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Basic audio capture works');
        testStream.getTracks().forEach(track => track.stop()); // Clean up test stream
    } catch (testError) {
        console.log('⚠️ Basic audio capture failed:', testError.message);
    }
    
    // Check available media devices
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log(`🔍 Available devices: ${audioDevices.length} audio, ${videoDevices.length} video`);
        audioDevices.forEach((device, index) => {
            console.log(`🎤 Audio device ${index}: ${device.label} (${device.deviceId})`);
        });
    } catch (deviceError) {
        console.log('⚠️ Could not enumerate devices:', deviceError.message);
    }
    
    // Try to capture desktop audio using getDisplayMedia (more reliable)
    console.log('🎯 Attempting desktop audio capture with getDisplayMedia...');
    try {
        // Use getDisplayMedia which is more reliable than chromeMediaSource
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: false, // We already have video
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                suppressLocalAudioPlayback: false,
                sampleRate: 48000,
                channelCount: 2,
                latency: 0.01,
                googEchoCancellation: true,
                googAutoGainControl: true,
                googNoiseSuppression: true,
                googHighpassFilter: true,
                googTypingNoiseDetection: true,
                googAudioMirroring: false
            }
        });
        
        console.log('🎵 getDisplayMedia audio capture succeeded, checking tracks...');
        const displayAudioTracks = displayStream.getAudioTracks();
        
        console.log(`🔊 Display audio stream: ${displayAudioTracks.length} audio tracks`);
        
        if (displayAudioTracks.length > 0) {
            // Add audio tracks to the main stream
            displayAudioTracks.forEach((track, index) => {
                console.log('🔊 Adding display audio track:', {
                    kind: track.kind,
                    label: track.label,
                    enabled: track.enabled,
                    muted: track.muted,
                    readyState: track.readyState
                });
                localStream.addTrack(track);
            });
            
            console.log('✅ Display audio captured and added to stream');
            
            // Clean up the display stream (we only need the audio tracks)
            displayStream.getTracks().forEach(track => track.stop());
            
            return; // Exit early since we got audio
        } else {
            console.log('⚠️ Display audio stream has no tracks, trying fallback methods');
        }
    } catch (displayAudioError) {
        console.log('⚠️ Display audio capture failed, trying fallback methods:', displayAudioError.message);
        console.log('⚠️ Display audio error details:', {
            name: displayAudioError.name,
            message: displayAudioError.message,
            stack: displayAudioError.stack
        });
    }
    
    // Fallback: try to add microphone audio to existing video stream
    console.log('🎤 Attempting to add microphone audio as fallback...');
    try {
        const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });
        
        const micTracks = micStream.getAudioTracks();
        console.log(`🎤 Got ${micTracks.length} microphone audio tracks`);
        
        micTracks.forEach((track, index) => {
            console.log('🎤 Adding microphone audio track:', {
                kind: track.kind,
                label: track.label,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState
            });
            localStream.addTrack(track);
        });
        
        console.log('✅ Microphone audio added as fallback');
        
    } catch (micError) {
        console.error('❌ Microphone audio also failed:', micError);
        console.log('⚠️ Microphone error details:', {
            name: micError.name,
            message: micError.message,
            stack: micError.stack
        });
        console.log('📺 Continuing without audio capture');
    }
    
    // Log final stream tracks
    const finalAudioTracks = localStream.getAudioTracks();
    const finalVideoTracks = localStream.getVideoTracks();
    console.log(`🎵 Final audio tracks: ${finalAudioTracks.length}`);
    console.log(`🎬 Final video tracks: ${finalVideoTracks.length}`);
    
    if (finalAudioTracks.length > 0) {
        finalAudioTracks.forEach((track, index) => {
            console.log(`🔊 Final audio track ${index}:`, {
                kind: track.kind,
                label: track.label,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState
            });
        });
    }
}

// Fallback screen capture method (when getDisplayMedia is not available)
async function startScreenCaptureFallback() {
    try {
        console.log('🔄 Using fallback screen capture method...');
        
        let sources;
        try {
            console.log('📺 Attempting to get display sources via Electron...');
            sources = await window.electronAPI.getDisplayMedia();
            console.log('✅ Display sources received via Electron:', sources?.length || 0);
        } catch (electronError) {
            console.log('⚠️ Electron display capture failed, trying browser fallback:', electronError.message);
            try {
                // Fallback to browser getDisplayMedia
                const displayStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
                console.log('✅ Browser getDisplayMedia fallback succeeded');
                // Convert stream to sources format for compatibility
                sources = [{
                    id: 'browser-fallback',
                    name: 'Browser Display',
                    stream: displayStream
                }];
            } catch (browserError) {
                console.error('❌ Both Electron and browser methods failed:', browserError.message);
                throw new Error('No display capture method available');
            }
        }
        
        if (sources && sources.length > 0) {
            const primarySource = sources[0];
            console.log('🖥️ Using primary source:', {
                name: primarySource.name,
                id: primarySource.id
            });
            
            // Get media stream with video only
            const videoStream = await navigator.mediaDevices.getUserMedia({
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
            
            console.log('✅ Fallback video capture started');
            localStream = videoStream;
            
            // Log video tracks
            const videoTracks = videoStream.getVideoTracks();
            console.log(`🎬 Video tracks: ${videoTracks.length}`);
            
            // Try to add microphone audio as fallback
            try {
                console.log('🎤 Adding microphone audio as fallback...');
                const micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 48000,
                        channelCount: 2,
                        latency: 0.01,
                        googEchoCancellation: true,
                        googAutoGainControl: true,
                        googNoiseSuppression: true,
                        googHighpassFilter: true,
                        googTypingNoiseDetection: true,
                        googAudioMirroring: false
                    }
                });
                
                const micTracks = micStream.getAudioTracks();
                console.log(`🎤 Got ${micTracks.length} microphone audio tracks`);
                
                micTracks.forEach((track, index) => {
                    console.log('🎤 Adding microphone audio track:', {
                        kind: track.kind,
                        label: track.label,
                        enabled: track.enabled,
                        muted: track.muted,
                        readyState: track.readyState
                    });
                    localStream.addTrack(track);
                });
                
                console.log('✅ Microphone audio added as fallback');
                
            } catch (micError) {
                console.log('⚠️ Microphone audio failed:', micError.message);
                console.log('📺 Continuing without audio');
            }
            
            // Create WebRTC peer connection
            createPeerConnection();
            
        } else {
            throw new Error('No display sources available');
        }
        
    } catch (error) {
        console.error('❌ Fallback screen capture failed:', error);
        throw error;
    }
}

// Start screen capture
async function startScreenCapture() {
    try {
        console.log('🎥 Getting display sources...');
        
        // Check if getDisplayMedia is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            console.log('⚠️ getDisplayMedia not available, using fallback method');
            await startScreenCaptureFallback();
            return;
        }
        
        // Add error boundary to prevent crashes
        window.addEventListener('error', (event) => {
            console.error('🚨 Global error caught:', event.error);
            event.preventDefault();
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('🚨 Unhandled promise rejection:', event.reason);
            event.preventDefault();
        });
        
        let sources;
        try {
            console.log('📺 Attempting to get display sources via Electron...');
            sources = await window.electronAPI.getDisplayMedia();
            console.log('✅ Display sources received via Electron:', sources?.length || 0);
        } catch (electronError) {
            console.log('⚠️ Electron display capture failed, trying browser fallback:', electronError.message);
            try {
                // Fallback to browser getDisplayMedia
                const displayStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
                console.log('✅ Browser getDisplayMedia fallback succeeded');
                // Convert stream to sources format for compatibility
                sources = [{
                    id: 'browser-fallback',
                    name: 'Browser Display',
                    stream: displayStream
                }];
            } catch (browserError) {
                console.error('❌ Both Electron and browser methods failed:', browserError.message);
                throw new Error('No display capture method available');
            }
        }
        
        if (sources && sources.length > 0) {
            const primarySource = sources[0];
            console.log('🖥️ Using primary source:', {
                name: primarySource.name,
                id: primarySource.id
            });
            
            // Try to get both video and audio in one call first (more reliable)
            console.log('🎯 Attempting combined video+audio capture...');
            try {
                const combinedStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        displaySurface: 'monitor',
                        logicalSurface: true,
                        cursor: 'always'
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        suppressLocalAudioPlayback: false,
                        sampleRate: 48000,
                        channelCount: 2,
                        latency: 0.01,
                        googEchoCancellation: true,
                        googAutoGainControl: true,
                        googNoiseSuppression: true,
                        googHighpassFilter: true,
                        googTypingNoiseDetection: true,
                        googAudioMirroring: false
                    }
                });
                
                console.log('🎬 Combined capture succeeded, checking tracks...');
                const combinedAudioTracks = combinedStream.getAudioTracks();
                const combinedVideoTracks = combinedStream.getVideoTracks();
                
                console.log(`🔊 Combined stream: ${combinedAudioTracks.length} audio, ${combinedVideoTracks.length} video tracks`);
                
                if (combinedAudioTracks.length > 0) {
                    // Use the combined stream instead
                    console.log('✅ Using combined stream with audio');
                    localStream = combinedStream;
                    
                    // Log final stream tracks
                    const finalAudioTracks = localStream.getAudioTracks();
                    const finalVideoTracks = localStream.getVideoTracks();
                    console.log(`🎵 Final audio tracks: ${finalAudioTracks.length}`);
                    console.log(`🎬 Final video tracks: ${finalVideoTracks.length}`);
                    
                    if (finalAudioTracks.length > 0) {
                        finalAudioTracks.forEach((track, index) => {
                            console.log(`🔊 Final audio track ${index}:`, {
                                kind: track.kind,
                                label: track.label,
                                enabled: track.enabled,
                                muted: track.muted,
                                readyState: track.readyState
                            });
                        });
                    }
                    
                    // Create WebRTC peer connection
                    createPeerConnection();
                    return; // Exit early since we got audio
                } else {
                    console.log('⚠️ Combined stream has no audio, falling back to separate capture');
                }
            } catch (combinedError) {
                console.log('⚠️ Combined capture failed, trying separate capture:', combinedError.message);
            }
            
            // Fallback: separate video capture
            console.log('🎬 Starting separate video capture...');
            const videoStream = await navigator.mediaDevices.getUserMedia({
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
            
            console.log('✅ Video capture started');
            localStream = videoStream;
            
            // Log video tracks
            const videoTracks = videoStream.getVideoTracks();
            console.log(`🎬 Video tracks: ${videoTracks.length}`);
            
            // Try to capture system audio using Electron's desktopCapturer
            await captureSystemAudio(primarySource);
            
            // Create WebRTC peer connection
            createPeerConnection();
            
        } else {
            throw new Error('No display sources available');
        }
        
    } catch (error) {
        console.error('❌ Screen capture failed:', error);
        console.error('❌ Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// Create WebRTC peer connection
function createPeerConnection() {
    try {
        peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ],
            // Audio optimization settings
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        });
        
        // Add local stream tracks
        const tracks = localStream.getTracks();
        console.log(`🔗 Adding ${tracks.length} tracks to peer connection:`, tracks.map(t => ({ kind: t.kind, label: t.label })));
        
        tracks.forEach((track, index) => {
            console.log(`🔗 Adding track ${index}:`, {
                kind: track.kind,
                label: track.label,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState
            });
            
            // Optimize audio tracks for better quality
            if (track.kind === 'audio') {
                // Set audio track constraints for better quality
                track.enabled = true;
                
                // Apply audio processing if supported
                if (track.getSettings) {
                    const settings = track.getSettings();
                    console.log('🔊 Audio track settings:', settings);
                }
                
                // Set audio track parameters for WebRTC
                if (track.getCapabilities) {
                    const capabilities = track.getCapabilities();
                    console.log('🔊 Audio track capabilities:', capabilities);
                }
            }
            
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
        
        // If we already have a viewer waiting, send the offer immediately
        if (isSharing && localStream) {
            console.log('📤 Sending offer immediately after peer connection creation');
            setTimeout(() => sendOfferToViewer(), 100); // Small delay to ensure connection is ready
        }
        
    } catch (error) {
        console.error('❌ Failed to create peer connection:', error);
        throw error;
    }
}

// Send WebRTC offer to viewer
async function sendOfferToViewer() {
    try {
        console.log('📤 Creating and sending WebRTC offer to viewer');
        console.log('🔍 Pre-offer state check:');
        console.log('  - peerConnection:', !!peerConnection);
        console.log('  - localStream:', !!localStream);
        console.log('  - currentSessionId:', currentSessionId);
        
        if (!peerConnection || !localStream) {
            console.error('❌ No peer connection or local stream available');
            return;
        }
        
        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Check if the offer contains audio tracks
        const offerSdp = offer.sdp;
        const hasAudio = offerSdp.includes('m=audio');
        const hasVideo = offerSdp.includes('m=video');
        console.log(`📝 Offer created - Audio: ${hasAudio}, Video: ${hasVideo}`);
        
        if (hasAudio) {
            console.log('✅ Offer contains audio tracks');
        } else {
            console.log('⚠️ Offer does not contain audio tracks');
        }
        
        // Serialize the offer properly
        const serializedOffer = {
            type: offer.type,
            sdp: offer.sdp
        };
        
        console.log('📝 Serialized offer:', serializedOffer);
        
        // Send offer to viewer via signaling server
        console.log('📤 Sending offer via electronAPI.sendOffer...');
        console.log('  - sessionId:', currentSessionId);
        console.log('  - offer type:', serializedOffer.type);
        console.log('  - offer sdp length:', serializedOffer.sdp.length);
        
        window.electronAPI.sendOffer({
            sessionId: currentSessionId,
            offer: serializedOffer
        });
        
        console.log('✅ WebRTC offer sent to viewer via electronAPI');
        
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
