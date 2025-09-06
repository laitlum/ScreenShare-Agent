console.log('🔄 PERMANENT ACCESS RENDERER LOADED');

let peerConnection = null;
let localStream = null;
let isAgentRunning = false;
let deviceInfo = null;
let backendWS = null;
let userEmail = null;
let jwtToken = null;
let isAuthenticated = false;
let currentSessionId = null;
let sessionConnected = false;

// Configuration
const BACKEND_URL = 'http://localhost:3001';
const BACKEND_WS_URL = 'ws://localhost:3001';

// Initialize the application
function init() {
    console.log('🚀 Initializing permanent access application...');
    loadDeviceInfo();
    setupEventListeners();
    updateStatus('Ready for authentication');
}

// Load device information
async function loadDeviceInfo() {
    try {
        // Get device info from main process if available
        if (window.electronAPI && window.electronAPI.getDeviceInfo) {
            try {
                const systemInfo = await window.electronAPI.getDeviceInfo();
                deviceInfo = {
                    name: systemInfo.hostname || navigator.platform || 'Unknown Device',
                    deviceId: generateDeviceId(),
                    platform: systemInfo.platform || navigator.platform || 'unknown',
                    ipAddress: systemInfo.ipAddress || 'Unknown',
                    macAddress: systemInfo.macAddress || 'Unknown'
                };
                console.log('📱 Device info loaded from system:', deviceInfo);
            } catch (error) {
                console.warn('⚠️ Could not get system info, using fallback:', error);
                // Fallback if system info fails
                deviceInfo = {
                    name: navigator.platform || 'Unknown Device',
                    deviceId: generateDeviceId(),
                    platform: navigator.platform || 'unknown',
                    ipAddress: 'Unknown',
                    macAddress: 'Unknown'
                };
            }
        } else {
            // Fallback device info since we may not have OS module in renderer
            deviceInfo = {
                name: navigator.platform || 'Unknown Device',
                deviceId: generateDeviceId(),
                platform: navigator.platform || 'unknown',
                ipAddress: 'Unknown',
                macAddress: 'Unknown'
            };
        }
        
        updateDeviceDisplay();
    } catch (error) {
        console.error('❌ Failed to load device info:', error);
        updateDeviceDisplay();
    }
}

// Generate a persistent device ID (stored in localStorage)
function generateDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        // Create a new persistent device ID based on machine characteristics
        const machineId = navigator.platform + '_' + (navigator.hardwareConcurrency || 4);
        deviceId = 'device_' + btoa(machineId).replace(/[^a-zA-Z0-9]/g, '').substr(0, 16) + '_' + Date.now().toString(36);
        localStorage.setItem('device_id', deviceId);
        console.log('📱 Generated new persistent device ID:', deviceId);
    } else {
        console.log('📱 Using existing device ID:', deviceId);
    }
    return deviceId;
}

// Update device information display
function updateDeviceDisplay() {
    if (!deviceInfo) return;
    
    document.getElementById('device-name').textContent = deviceInfo.name || 'Unknown';
    document.getElementById('device-id').textContent = deviceInfo.deviceId || 'Not generated';
    document.getElementById('device-platform').textContent = deviceInfo.platform || 'Unknown';
}

// Setup event listeners
function setupEventListeners() {
    console.log('🎛️ Setting up event listeners...');
    
    // Device setup
    const setupBtn = document.getElementById('setup-btn');
    if (setupBtn) {
        console.log('✅ Found setup-btn, adding event listener');
        setupBtn.addEventListener('click', handleDeviceSetup);
    } else {
        console.error('❌ setup-btn element not found!');
    }
    
    // Action buttons
    document.getElementById('register-device-btn').addEventListener('click', registerDevice);
    
    // Setup IPC event listeners if available
    if (window.electronAPI) {
        setupIPCEventListeners();
    }
}

// Setup IPC event listeners
function setupIPCEventListeners() {
    // Access request events
    if (window.electronAPI.onAccessRequestReceived) {
        window.electronAPI.onAccessRequestReceived((event, data) => {
            console.log('📨 Access request received:', data);
            handleAccessRequest(data);
        });
    }

    // Session events for permanent access
    if (window.electronAPI.onPermanentSessionStart) {
        window.electronAPI.onPermanentSessionStart((event, data) => {
            console.log('🔐 Permanent session starting:', data);
            handlePermanentSession(data);
        });
    }
}

// Handle device setup
async function handleDeviceSetup() {
    console.log('🚀 handleDeviceSetup called!');
    const emailInput = document.getElementById('user-email');
    const newEmail = emailInput.value.trim();
    console.log('📧 Email input value:', newEmail);
    
    if (!newEmail) {
        showMessage('Please enter an email address', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        updateStatus('Setting up device access...');
        
        // Check if email has changed and device is already registered
        const emailChanged = userEmail && userEmail !== newEmail;
        if (emailChanged && deviceInfo && deviceInfo.registered) {
            console.log('📧 Email changed from', userEmail, 'to', newEmail);
            console.log('🔄 Re-registering device with new owner...');
            
            // Stop current heartbeat
            stopHeartbeat();
            
            // Reset device registration status
            deviceInfo.registered = false;
            deviceInfo.registered_device_id = null;
            deviceInfo.id = null;
            
            // Update UI to show register button
            updateUI();
        }
        
        // Update user email
        userEmail = newEmail;
        
        // Check if the user exists (try to find/create them)
        await findOrCreateUser(userEmail);
        
        // Show device setup UI
        showDeviceSetupUI();
        connectToBackend();
        showMessage('Device setup complete! User can now access this device from the dashboard.', 'success');
        
    } catch (error) {
        console.error('❌ Device setup failed:', error);
        showMessage(`Setup failed: ${error.message}`, 'error');
        updateStatus('Setup failed');
    }
}

// Find or create user by email
async function findOrCreateUser(email) {
    try {
        // For now, we'll just store the email locally
        // In a real system, you might sync with the backend
        console.log(`📧 Setting up access for: ${email}`);
        userEmail = email;
        isAuthenticated = true; // Mark as "authenticated" for local use
        return { email: email };
    } catch (error) {
        throw new Error(`Failed to setup user: ${error.message}`);
    }
}

// Show device setup UI
function showDeviceSetupUI() {
    document.getElementById('auth-setup').style.display = 'none';
    document.getElementById('device-setup').style.display = 'block';
    
    // Update device status
    const deviceStatus = document.getElementById('device-status');
    deviceStatus.textContent = `Device Access: Enabled for ${userEmail}`;
}

// Connect to backend
async function connectToBackend() {
    try {
        // Test HTTP connection first
        const response = await fetch(`${BACKEND_URL}/health`);
        if (response.ok) {
            console.log('✅ Backend HTTP connection successful');
            updateStatus('Connected to backend');
            
            // Connect WebSocket
            connectWebSocket();
        } else {
            throw new Error('Backend not responding');
        }
    } catch (error) {
        console.error('❌ Failed to connect to backend:', error);
        updateStatus('Backend offline - Check if Go backend is running on port 3001');
        
        // Retry connection after delay
        setTimeout(connectToBackend, 5000);
    }
}

// Connect WebSocket to backend
function connectWebSocket() {
    if (backendWS && backendWS.readyState === WebSocket.OPEN) {
        return;
    }

    try {
        backendWS = new WebSocket(`${BACKEND_WS_URL}/ws`);
        
        backendWS.onopen = () => {
            console.log('✅ Backend WebSocket connected');
            updateStatus('Agent ready');
            
            // Register device if not already done
            if (deviceInfo && !deviceInfo.registered) {
                registerDeviceAutomatically();
            }
        };
        
        backendWS.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleBackendMessage(data);
            } catch (error) {
                console.error('❌ Failed to parse backend message:', error);
            }
        };
        
        backendWS.onclose = () => {
            console.log('🔌 Backend WebSocket disconnected');
            updateStatus('Disconnected from backend');
            
            // Retry connection
            setTimeout(connectWebSocket, 3000);
        };
        
        backendWS.onerror = (error) => {
            console.error('❌ Backend WebSocket error:', error);
        };
        
    } catch (error) {
        console.error('❌ Failed to connect WebSocket:', error);
        updateStatus('WebSocket connection failed');
    }
}

// Handle messages from backend
function handleBackendMessage(data) {
    console.log('📨 Backend message:', data);
    
    switch (data.type) {
        case 'access_request':
            handleAccessRequest(data.data);
            break;
        case 'session_start':
            handlePermanentSession(data.data);
            break;
        case 'device_status':
            updateDeviceStatus(data.data);
            break;
        default:
            console.log('📝 Unknown backend message type:', data.type);
    }
}

// Register device with backend
async function registerDevice() {
    if (!userEmail) {
        showMessage('Please setup device access first', 'error');
        return;
    }
    
    if (!deviceInfo) {
        showMessage('Device info not loaded', 'error');
        return;
    }

    try {
        updateStatus('Registering device...');
        
        const registrationData = {
            name: deviceInfo.name,
            device_id: deviceInfo.deviceId,
            platform: deviceInfo.platform,
            ip_address: deviceInfo.ipAddress,
            mac_address: deviceInfo.macAddress,
            agent_version: "1.0.0",
            owner_email: userEmail
        };

        const response = await fetch(`${BACKEND_URL}/public/agent/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registrationData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Device registered successfully:', result);
            
            deviceInfo.registered = true;
            // Store the database device ID for session creation
            if (result.device && result.device.id) {
                deviceInfo.registered_device_id = result.device.id;
                console.log('💾 Stored database device ID:', deviceInfo.registered_device_id);
            }
            deviceInfo.id = result.device.id;
            
            updateStatus('Agent running - Ready for connections');
            showMessage('Device registered successfully! Ready for remote connections.', 'success');
            showAgentRunning();
            updateUI();
            
        } else {
            const error = await response.text();
            throw new Error(`Registration failed: ${error}`);
        }
        
    } catch (error) {
        console.error('❌ Device registration failed:', error);
        showMessage(`Registration failed: ${error.message}`, 'error');
        updateStatus('Registration failed');
    }
}

// Auto-register device (called when WebSocket connects)
async function registerDeviceAutomatically() {
    console.log('🔄 Auto-registering device...');
    await registerDevice();
}

// Start the agent
// Show agent running status
function showAgentRunning() {
    // Hide register button and show status
    document.getElementById('register-device-btn').style.display = 'none';
    document.getElementById('agent-status').classList.remove('hidden');
    
    // Start heartbeat to backend
    startHeartbeat();
    
    // Mark agent as running
    isAgentRunning = true;
}

// Heartbeat functionality
let heartbeatInterval = null;

function startHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    
    heartbeatInterval = setInterval(async () => {
        if (!deviceInfo || !deviceInfo.registered) return;
        
        try {
            const heartbeatData = {
                deviceId: deviceInfo.deviceId,
                cpuUsage: null, // Could add system monitoring
                memUsage: null,
                diskUsage: null
            };

            await fetch(`${BACKEND_URL}/public/devices/${deviceInfo.deviceId}/heartbeat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(heartbeatData)
            });
            
            // Update connection status
            document.getElementById('device-connection-status').textContent = 'Online';
            
        } catch (error) {
            console.error('❌ Heartbeat failed:', error);
            document.getElementById('device-connection-status').textContent = 'Offline';
        }
    }, 30000); // Every 30 seconds
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    
    document.getElementById('device-connection-status').textContent = 'Offline';
}

// Handle access requests
function handleAccessRequest(requestData) {
    console.log('📨 Handling access request:', requestData);
    
    // Show access request in UI
    const requestsSection = document.getElementById('access-requests');
    const requestsList = document.getElementById('requests-list');
    
    const requestElement = document.createElement('div');
    requestElement.className = 'bg-white border border-blue-300 rounded p-2 text-sm';
    requestElement.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <div class="font-semibold">${requestData.email || 'Unknown User'}</div>
                <div class="text-xs text-gray-500">${new Date(requestData.requestedAt).toLocaleString()}</div>
            </div>
            <div class="space-x-2">
                <button onclick="approveAccessRequest('${requestData.id}')" class="bg-green-500 text-white px-2 py-1 rounded text-xs">Approve</button>
                <button onclick="denyAccessRequest('${requestData.id}')" class="bg-red-500 text-white px-2 py-1 rounded text-xs">Deny</button>
            </div>
        </div>
    `;
    
    requestsList.appendChild(requestElement);
    requestsSection.classList.remove('hidden');
    
    // Show notification
    showMessage(`Access request from ${requestData.email}`, 'info');
}

// Approve access request
async function approveAccessRequest(requestId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/access/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requestId })
        });

        if (response.ok) {
            showMessage('Access request approved', 'success');
            // Remove request from UI would go here
        } else {
            throw new Error('Failed to approve request');
        }
    } catch (error) {
        console.error('❌ Failed to approve access request:', error);
        showMessage(`Failed to approve: ${error.message}`, 'error');
    }
}

// Deny access request
async function denyAccessRequest(requestId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/access/deny`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requestId })
        });

        if (response.ok) {
            showMessage('Access request denied', 'info');
        } else {
            throw new Error('Failed to deny request');
        }
    } catch (error) {
        console.error('❌ Failed to deny access request:', error);
        showMessage(`Failed to deny: ${error.message}`, 'error');
    }
}

// Handle permanent session start
async function handlePermanentSession(sessionData) {
    console.log('🔐 Starting permanent session:', sessionData);
    
    try {
        // Use existing Electron API for screen sharing if available
        if (window.electronAPI && window.electronAPI.getDisplaySources) {
            await initializeScreenShareElectron();
        } else {
            await initializeScreenShare();
        }
        
        showMessage('Remote session started', 'success');
        
    } catch (error) {
        console.error('❌ Failed to start permanent session:', error);
        showMessage(`Session failed: ${error.message}`, 'error');
    }
}

// Initialize screen sharing using Electron API
async function initializeScreenShareElectron() {
    try {
        const sources = await window.electronAPI.getDisplaySources();
        console.log('📺 Available sources:', sources);
        
        // Use the first available source (entire screen)
        const source = sources[0];
        
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: source.id,
                    maxWidth: 1920,
                    maxHeight: 1080,
                    maxFrameRate: 30
                }
            }
        });
        
        localStream = stream;
        console.log('✅ Screen capture initialized');
        
    } catch (error) {
        console.error('❌ Failed to initialize screen share:', error);
        throw error;
    }
}

// Initialize screen sharing (fallback)
async function initializeScreenShare() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            },
            audio: false
        });
        
        localStream = stream;
        console.log('✅ Screen capture initialized');
        
    } catch (error) {
        console.error('❌ Failed to initialize screen share:', error);
        throw error;
    }
}

// Update UI based on current state
function updateUI() {
    const registerBtn = document.getElementById('register-device-btn');
    const agentStatus = document.getElementById('agent-status');
    
    if (!deviceInfo || !deviceInfo.registered || !isAgentRunning) {
        // Device not registered or agent not running - show register button
        registerBtn.style.display = 'block';
        agentStatus.classList.add('hidden');
    } else {
        // Agent running - show status
        registerBtn.style.display = 'none';
        agentStatus.classList.remove('hidden');
    }
}

// Update status display
function updateStatus(status) {
    document.getElementById('device-status').textContent = `Status: ${status}`;
}

// Update device status from backend
function updateDeviceStatus(statusData) {
    console.log('📊 Device status update:', statusData);
    
    if (statusData.isOnline !== undefined) {
        const statusText = statusData.isOnline ? 'Online' : 'Offline';
        document.getElementById('device-connection-status').textContent = statusText;
    }
}

// Show status message
function showMessage(message, type = 'info') {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    
    // Create or update status message
    let statusMsg = document.getElementById('status-message');
    if (!statusMsg) {
        statusMsg = document.createElement('div');
        statusMsg.id = 'status-message';
        statusMsg.className = 'fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg transition-transform duration-300 transform translate-x-full';
        document.body.appendChild(statusMsg);
    }
    
    // Set colors based on type
    statusMsg.className = statusMsg.className.replace(/bg-\w+-\d+/, '');
    switch (type) {
        case 'success':
            statusMsg.classList.add('bg-green-500');
            break;
        case 'error':
            statusMsg.classList.add('bg-red-500');
            break;
        case 'info':
        default:
            statusMsg.classList.add('bg-blue-500');
            break;
    }
    
    statusMsg.textContent = message;
    statusMsg.classList.add('text-white');
    
    // Show message
    statusMsg.classList.remove('translate-x-full');
    
    // Hide after 3 seconds
    setTimeout(() => {
        statusMsg.classList.add('translate-x-full');
    }, 3000);
}

// WebSocket connection for remote control
let ws = null;
// peerConnection and localStream already declared above
let isWebSocketConnected = false;

// WebSocket server configuration
const WS_SERVER_URL = 'ws://localhost:8081';

// Initialize WebSocket connection for remote control
function initializeWebSocket() {
    if (!deviceInfo || !deviceInfo.registered) {
        console.log('🔄 Device not registered yet, skipping WebSocket connection');
        return;
    }

    const sessionId = `device-${deviceInfo.registered_device_id || deviceInfo.deviceId}`;
    console.log('🔌 Connecting to WebSocket server:', WS_SERVER_URL);
    
    try {
        ws = new WebSocket(WS_SERVER_URL);
        
        ws.onopen = () => {
            console.log('✅ WebSocket connected successfully');
            isWebSocketConnected = true;
            
            // Create session for this device
            ws.send(JSON.stringify({
                type: 'create-session',
                sessionId: sessionId
            }));
            
            updateStatus('WebSocket connected - Ready for remote access');
        };
        
        ws.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 WebSocket message:', data.type, data);
                
                switch (data.type) {
                    case 'session-created':
                        console.log('✅ Agent session created successfully');
                        currentSessionId = data.sessionId;
                        sessionConnected = true;
                        console.log('💾 Session variables set:', { currentSessionId, sessionConnected });
                        updateStatus('Remote session ready');
                        break;
                        
                    case 'viewer-joined':
                        console.log('🎉 Viewer connected - starting screen sharing');
                        updateStatus('Viewer connected - Starting screen share...');
                        await startScreenShare(currentSessionId);
                        break;
                        
                    case 'webrtc-answer':
                        console.log('📝 Received WebRTC answer from viewer');
                        await handleWebRTCAnswer(data.answer);
                        break;
                        
                    case 'webrtc-ice':
                        console.log('🧊 Received ICE candidate from viewer');
                        await handleICECandidate(data.candidate);
                        break;
                        
                    case 'viewer-input':
                        console.log('🖱️ Remote control input received:', data);
                        console.log('🖱️ Input action:', data.action, 'type:', data.type);
                        handleRemoteInput(data);
                        break;
                        
                    case 'viewer-disconnected':
                        console.log('👋 Viewer disconnected');
                        updateStatus('Viewer disconnected');
                        stopScreenShare();
                        break;
                }
            } catch (error) {
                console.error('❌ Error parsing WebSocket message:', error);
            }
        };
        
        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            isWebSocketConnected = false;
            updateStatus('WebSocket connection error');
        };
        
        ws.onclose = () => {
            console.log('🔌 WebSocket connection closed');
            isWebSocketConnected = false;
            updateStatus('WebSocket disconnected');
            
            // Attempt to reconnect after 5 seconds
            setTimeout(() => {
                if (!isWebSocketConnected && deviceInfo && deviceInfo.registered) {
                    console.log('🔄 Attempting to reconnect WebSocket...');
                    initializeWebSocket();
                }
            }, 5000);
        };
        
    } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
        updateStatus('Failed to connect to WebSocket server');
    }
}

// Start screen sharing with WebRTC
async function startScreenShare(sessionId) {
    try {
        console.log('🖥️ Starting screen capture...');
        
        // Create peer connection
        peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        
        // Get screen stream using Electron's desktopCapturer API
        console.log('🔍 Getting desktop sources...');
        const sources = await window.electronAPI.getDesktopSources({
            types: ['screen'],
            thumbnailSize: { width: 1920, height: 1080 }
        });
        
        if (sources.length === 0) {
            throw new Error('No screen sources available');
        }
        
        const primaryScreen = sources[0]; // Use the first (primary) screen
        console.log('🖥️ Using screen source:', primaryScreen.name);
        
        // First, try video-only capture to avoid crashes
        console.log('🎬 Starting video capture...');
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: false, // Start without audio to avoid crashes
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: primaryScreen.id,
                    minWidth: 1280,
                    maxWidth: 1920,
                    minHeight: 720,
                    maxHeight: 1080
                }
            }
        });
        
        // Professional system audio capture implementation
        console.log('🔊 Starting professional system audio capture...');
        
        let audioAdded = false;
        
        // Method 1: BlackHole Virtual Audio Driver (macOS - Professional Solution)
        if (!audioAdded) {
            try {
                console.log('🎵 Checking for BlackHole virtual audio device...');
                const audioDevices = await navigator.mediaDevices.enumerateDevices();
                console.log('🎧 Available audio devices:', audioDevices.filter(d => d.kind === 'audioinput').map(d => d.label));
                
                const blackHoleDevice = audioDevices.find(device => 
                    device.kind === 'audioinput' && 
                    (device.label.toLowerCase().includes('blackhole') || 
                     device.label.toLowerCase().includes('soundflower') ||
                     device.label.toLowerCase().includes('virtual') ||
                     device.label.toLowerCase().includes('loopback'))
                );
                
                if (blackHoleDevice) {
                    console.log('✅ Found BlackHole device:', blackHoleDevice.label);
                    const blackHoleStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            deviceId: { exact: blackHoleDevice.deviceId },
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false,
                            suppressLocalAudioPlayback: true,
                            sampleRate: 48000,
                            channelCount: 2
                        }
                    });
                    
                    blackHoleStream.getAudioTracks().forEach(track => {
                        // Remove any existing audio tracks to avoid conflicts
                        const existingAudioTracks = localStream.getAudioTracks();
                        existingAudioTracks.forEach(existingTrack => {
                            localStream.removeTrack(existingTrack);
                            existingTrack.stop();
                            console.log('🗑️ Removed existing audio track:', existingTrack.label);
                        });
                        
                        localStream.addTrack(track);
                        console.log('✅ BlackHole audio track added:', track.label);
                    });
                    audioAdded = true;
                    console.log('🎉 BlackHole system audio capture successful!');
                    console.log('💡 Configure macOS: System Preferences > Sound > Output > BlackHole 2ch');
                } else {
                    console.log('⚠️ BlackHole not found. Install with: brew install blackhole-2ch');
                }
            } catch (blackHoleError) {
                console.log('⚠️ BlackHole capture failed:', blackHoleError.message);
            }
        }
        
        // Method 2: Windows Stereo Mix (Windows - Built-in Solution)
        if (!audioAdded && navigator.platform.toLowerCase().includes('win')) {
            try {
                console.log('🎵 Checking for Windows Stereo Mix...');
                const audioDevices = await navigator.mediaDevices.enumerateDevices();
                const stereoMixDevice = audioDevices.find(device => 
                    device.kind === 'audioinput' && 
                    (device.label.toLowerCase().includes('stereo mix') || 
                     device.label.toLowerCase().includes('what u hear') ||
                     device.label.toLowerCase().includes('wave out mix'))
                );
                
                if (stereoMixDevice) {
                    console.log('✅ Found Stereo Mix:', stereoMixDevice.label);
                    const stereoMixStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            deviceId: { exact: stereoMixDevice.deviceId },
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false
                        }
                    });
                    
                    stereoMixStream.getAudioTracks().forEach(track => {
                        // Remove any existing audio tracks to avoid conflicts
                        const existingAudioTracks = localStream.getAudioTracks();
                        existingAudioTracks.forEach(existingTrack => {
                            localStream.removeTrack(existingTrack);
                            existingTrack.stop();
                            console.log('🗑️ Removed existing audio track:', existingTrack.label);
                        });
                        
                        localStream.addTrack(track);
                        console.log('✅ Stereo Mix track added:', track.label);
                    });
                    audioAdded = true;
                    console.log('🎉 Windows Stereo Mix capture successful!');
                } else {
                    console.log('⚠️ Stereo Mix not available. Enable in Sound settings.');
                }
            } catch (stereoMixError) {
                console.log('⚠️ Stereo Mix failed:', stereoMixError.message);
            }
        }
        
        // Method 3: Forced macOS System Audio (Most Reliable)
        if (!audioAdded) {
            try {
                console.log('🎵 Method 3: Forcing macOS system audio permission dialog...');
                console.log('🚨 IMPORTANT: Click "Share Audio" in the upcoming dialog!');
                
                // Force the permission dialog by requesting video+audio together
                console.log('🔄 Requesting screen sharing with audio (MUST click "Share Audio")...');
                const fullStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        mediaSource: 'screen',
                        width: { max: 1920 },
                        height: { max: 1080 },
                        frameRate: { max: 30 }
                    },
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        suppressLocalAudioPlayback: true,
                        systemAudio: 'include'
                    }
                });
                
                console.log('📋 Received stream tracks:', fullStream.getTracks().map(t => `${t.kind}: ${t.label}`));
                
                // Extract audio tracks
                const audioTracks = fullStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    console.log('🎉 SUCCESS! Got system audio tracks:', audioTracks.length);
                    
                    audioTracks.forEach(track => {
                        // Remove any existing audio tracks to avoid conflicts
                        const existingAudioTracks = localStream.getAudioTracks();
                        existingAudioTracks.forEach(existingTrack => {
                            localStream.removeTrack(existingTrack);
                            existingTrack.stop();
                            console.log('🗑️ Removed existing audio track:', existingTrack.label);
                        });
                        
                        // Add the new audio track
                        localStream.addTrack(track);
                        console.log('✅ System audio track added:', track.label);
                        console.log('🎵 Track settings:', JSON.stringify(track.getSettings(), null, 2));
                    });
                    audioAdded = true;
                    console.log('🎉 System audio capture successful!');
                    console.log('🔊 Now capturing YouTube, Spotify, system sounds directly');
                } else {
                    console.log('❌ No audio tracks in the stream - user did not select "Share Audio"');
                    console.log('💡 Please restart connection and click "Share Audio" in the dialog');
                }
                
                // Stop the temporary video tracks since we already have video
                const tempVideoTracks = fullStream.getVideoTracks();
                tempVideoTracks.forEach(track => {
                    track.stop();
                    console.log('🗑️ Stopped temporary video track:', track.label);
                });
                
            } catch (forcedError) {
                console.log('⚠️ Forced system audio failed:', forcedError.message);
                console.log('💡 Possible reasons:');
                console.log('   • User cancelled the permission dialog');
                console.log('   • User did not check "Share Audio"');
                console.log('   • macOS version too old (requires 13+ Ventura)');
                
                // Last resort: Try simple audio-only request
                try {
                    console.log('🔄 Last resort: Simple audio-only request...');
                    const audioOnlyStream = await navigator.mediaDevices.getDisplayMedia({
                        video: false,
                        audio: true
                    });
                    
                    const audioTracks = audioOnlyStream.getAudioTracks();
                    if (audioTracks.length > 0) {
                        audioTracks.forEach(track => {
                            const existingAudioTracks = localStream.getAudioTracks();
                            existingAudioTracks.forEach(existingTrack => {
                                localStream.removeTrack(existingTrack);
                                existingTrack.stop();
                            });
                            localStream.addTrack(track);
                            console.log('✅ Last resort audio track added:', track.label);
                        });
                        audioAdded = true;
                        console.log('🎉 Last resort audio capture successful!');
                    }
                } catch (lastResortError) {
                    console.log('⚠️ Last resort audio failed:', lastResortError.message);
                }
            }
        }

        // DO NOT add microphone fallback - system audio only!
        // We intentionally skip microphone capture since it's not what users want
        
        // Final status and user-friendly instructions
        if (audioAdded) {
            console.log('🎉 SUCCESS: Audio capture is working!');
            console.log('🎵 Audio will be streamed to the remote viewer');
            updateStatus('Screen sharing active with audio');
        } else {
            console.log('❌ System audio capture not available');
            console.log('');
            console.log('🎯 SYSTEM AUDIO OPTIONS:');
            console.log('');
            console.log('🥇 BUILT-IN (Recommended): macOS Screen Sharing Dialog');
            console.log('   ✅ No installation required');
            console.log('   ✅ Works on macOS 13+ (Ventura and newer)');
            console.log('   💡 User clicks "Share Audio" when prompted');
            console.log('   🎵 Captures YouTube, Spotify, system sounds directly');
            console.log('');
            console.log('🥈 PROFESSIONAL (Optional): BlackHole Virtual Driver');
            console.log('   🔧 One-time setup: brew install blackhole-2ch');
            console.log('   ⚙️ Configure: System Settings > Sound > Output > BlackHole 2ch');
            console.log('   🎯 Best for power users & consistent setup');
            console.log('');
            console.log('🥉 WINDOWS: Enable Stereo Mix in Sound settings');
            console.log('');
            console.log('⚠️ Continuing with video-only stream');
            console.log('🚫 Microphone audio intentionally disabled (system audio only)');
            console.log('💡 Restart connection to try audio permission dialog again');
        }
        
        console.log('✅ Screen capture started successfully');
        updateStatus('Screen sharing active');
        
        // Add stream to peer connection (avoid duplicates)
        const existingSenders = peerConnection.getSenders();
        localStream.getTracks().forEach(track => {
            console.log('➕ Adding track:', track.kind);
            
            // Check if a sender already exists for this track type
            const existingSender = existingSenders.find(sender => 
                sender.track && sender.track.kind === track.kind
            );
            
            if (existingSender) {
                console.log('🔄 Replacing existing track:', track.kind);
                existingSender.replaceTrack(track);
            } else {
                console.log('➕ Adding new track:', track.kind);
                peerConnection.addTrack(track, localStream);
            }
        });
        
        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
                console.log('🧊 Sending ICE candidate to viewer');
                ws.send(JSON.stringify({
                    type: 'webrtc-ice',
                    candidate: event.candidate,
                    sessionId: currentSessionId,
                    target: 'viewer'
                }));
            }
        };
        
        // Create and send offer
        console.log('📤 Creating WebRTC offer...');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'webrtc-offer',
                offer: offer,
                sessionId: currentSessionId,
                target: 'viewer'
            }));
            console.log('✅ WebRTC offer sent to viewer');
        }
        
    } catch (error) {
        console.error('❌ Failed to start screen sharing:', error);
        updateStatus('Failed to start screen sharing: ' + error.message);
    }
}

// Handle WebRTC answer from viewer
async function handleWebRTCAnswer(answer) {
    try {
        if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
            await peerConnection.setRemoteDescription(answer);
            console.log('✅ WebRTC answer processed successfully');
            updateStatus('WebRTC connection established');
        }
    } catch (error) {
        console.error('❌ Error handling WebRTC answer:', error);
    }
}

// Handle ICE candidates from viewer
async function handleICECandidate(candidate) {
    try {
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(candidate);
            console.log('✅ ICE candidate added successfully');
        }
    } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
    }
}

// Handle remote control input using nut.js
async function handleRemoteInput(data) {
    try {
        // Send remote control command to main process via IPC
        if (window.electronAPI && window.electronAPI.sendRemoteInput) {
            await window.electronAPI.sendRemoteInput(data);
        } else {
            console.warn('⚠️ Remote input API not available');
        }
    } catch (error) {
        console.error('❌ Error handling remote input:', error);
    }
}

// Stop screen sharing
function stopScreenShare() {
    console.log('🛑 Stopping screen share...');
    
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
            console.log('⏹️ Stopped track:', track.kind);
        });
        localStream = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    updateStatus('Screen sharing stopped');
}

// Update the showAgentRunning function to also start WebSocket
function showAgentRunning() {
    document.getElementById('register-device-btn').style.display = 'none';
    document.getElementById('agent-status').classList.remove('hidden');
    startHeartbeat();
    isAgentRunning = true;
    
    // Initialize WebSocket connection for remote control
    setTimeout(() => {
        initializeWebSocket();
    }, 1000); // Give a moment for device registration to complete
}

// Make functions globally available for onclick handlers
window.approveAccessRequest = approveAccessRequest;
window.denyAccessRequest = denyAccessRequest;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

console.log('✅ Permanent Access Renderer with WebSocket support loaded');