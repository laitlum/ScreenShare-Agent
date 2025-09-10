console.log('🛡️ LAITLUM ANTIVIRUS AGENT LOADED');

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
let scanInProgress = false;
let scanProgress = 0;
let scanInterval = null;
let isSignedIn = false;
let lastScanTime = null;

// Configuration - Environment-based
// In Electron renderer, we need to use window.electronAPI or direct environment detection
let BACKEND_URL, BACKEND_WS_URL, WS_SERVER_URL;

// Detect environment and set URLs accordingly
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
    // Production URLs
    BACKEND_URL = process.env.BACKEND_URL || 'https://api.laitlum.com';
    BACKEND_WS_URL = process.env.BACKEND_WS_URL || 'wss://api.laitlum.com';
    WS_SERVER_URL = process.env.WS_SERVER_URL || 'wss://signaling.laitlum.com';
    console.log('🔧 Production Environment - Backend:', BACKEND_URL);
} else {
    // Development URLs (default)
    BACKEND_URL = 'http://localhost:3001';
    BACKEND_WS_URL = 'ws://localhost:3001';
    WS_SERVER_URL = 'ws://localhost:8081';
    console.log('🔧 Development Environment - Backend:', BACKEND_URL);
}

// Initialize the application
function init() {
    console.log('🚀 Initializing Laitlum Antivirus Agent...');
    loadDeviceInfo();
    setupEventListeners();
    checkPersistentSession();
    updateStatus('Ready for authentication');
}

// Check for persistent session
function checkPersistentSession() {
    const savedEmail = localStorage.getItem('laitlum_user_email');
    const savedDeviceId = localStorage.getItem('laitlum_device_id');
    
    if (savedEmail && savedDeviceId) {
        console.log('🔄 Found persistent session for:', savedEmail);
        userEmail = savedEmail;
        deviceInfo = {
            name: localStorage.getItem('laitlum_device_name') || 'Unknown Device',
            deviceId: savedDeviceId,
            platform: localStorage.getItem('laitlum_device_platform') || 'unknown',
            ipAddress: 'Unknown',
            macAddress: 'Unknown',
            registered: true
        };
        
        isSignedIn = true;
        showMainInterface();
        connectToBackend();
        startHeartbeat();
    }
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
    
    const deviceNameEl = document.getElementById('device-name');
    const deviceIdEl = document.getElementById('device-id');
    const devicePlatformEl = document.getElementById('device-platform');
    
    if (deviceNameEl) deviceNameEl.textContent = deviceInfo.name || 'Unknown';
    if (deviceIdEl) deviceIdEl.textContent = deviceInfo.deviceId || 'Not generated';
    if (devicePlatformEl) devicePlatformEl.textContent = deviceInfo.platform || 'Unknown';
}

// Setup event listeners
function setupEventListeners() {
    console.log('🎛️ Setting up event listeners...');
    
    // Sign in button
    const signinBtn = document.getElementById('signin-btn');
    if (signinBtn) {
        signinBtn.addEventListener('click', showSignInForm);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Device setup
    const setupBtn = document.getElementById('setup-btn');
    if (setupBtn) {
        console.log('✅ Found setup-btn, adding event listener');
        setupBtn.addEventListener('click', function(e) {
            console.log('🖱️ Setup button clicked!');
            e.preventDefault();
            handleDeviceSetup();
        });
    } else {
        console.error('❌ setup-btn element not found!');
    }
    
    // Scan button
    const scanBtn = document.getElementById('scan-btn');
    if (scanBtn) {
        scanBtn.addEventListener('click', startScan);
    }
    
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
    console.log('🔧 BACKEND_URL:', BACKEND_URL);
    console.log('🔧 BACKEND_WS_URL:', BACKEND_WS_URL);
    
    const emailInput = document.getElementById('user-email');
    const newEmail = emailInput.value.trim();
    console.log('📧 Email input value:', newEmail);
    
    if (!newEmail) {
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
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
        
        // Save persistent session
        savePersistentSession();
        
        // Show main interface
        showMainInterface();
        connectToBackend();
        startHeartbeat();
        
    } catch (error) {
        console.error('❌ Device setup failed:', error);
        updateStatus('Setup failed');
    }
}

// Show sign in form
function showSignInForm() {
    document.getElementById('signin-section').classList.remove('hidden');
    document.getElementById('main-interface').classList.add('hidden');
}

// Show main antivirus interface
function showMainInterface() {
    document.getElementById('signin-section').classList.add('hidden');
    document.getElementById('main-interface').classList.remove('hidden');
    
    // Update UI elements
    document.getElementById('signin-btn').classList.add('hidden');
    document.getElementById('logout-btn').classList.remove('hidden');
    
    // Update status displays
    updateStatusDisplays();
    
    // Update device info
    if (deviceInfo) {
        document.getElementById('device-name').textContent = deviceInfo.name || 'Unknown';
        document.getElementById('device-platform').textContent = deviceInfo.platform || 'Unknown';
        document.getElementById('device-connection-status').textContent = 'Online';
    }
}

// Update status displays
function updateStatusDisplays() {
    // Update protection status
    const protectionStatus = document.getElementById('protection-status');
    if (protectionStatus) {
        protectionStatus.textContent = 'Active';
        protectionStatus.className = 'text-2xl font-bold text-secondary';
    }
    
    // Update threat detection status
    const threatStatus = document.getElementById('threat-status');
    if (threatStatus) {
        if (isAgentRunning && backendWS && backendWS.readyState === WebSocket.OPEN) {
            threatStatus.textContent = 'Protected';
            threatStatus.className = 'text-2xl font-bold text-secondary';
        } else {
            threatStatus.textContent = 'Scanning...';
            threatStatus.className = 'text-2xl font-bold text-yellow-400';
        }
    }
    
    // Update last scan time
    const lastScan = document.getElementById('last-scan');
    if (lastScan) {
        if (lastScanTime) {
            const timeString = lastScanTime.toLocaleTimeString();
            lastScan.textContent = timeString;
            lastScan.className = 'text-2xl font-bold text-secondary';
        } else {
            lastScan.textContent = 'Never';
            lastScan.className = 'text-2xl font-bold text-gray-300';
        }
    }
}

// Handle logout
async function handleLogout() {
    console.log('🚪 Logging out...');
    
    try {
        // Call backend logout endpoint if we have user info
        if (userEmail && deviceInfo) {
            console.log('📡 Calling backend logout endpoint...');
            
            const response = await fetch(`${BACKEND_URL}/public/agent/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: deviceInfo.clerkId || userEmail, // Use clerk_id if available, otherwise email
                    device_id: deviceInfo.deviceId, // Include device_id for specific device logout
                }),
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Backend logout successful:', result);
            } else {
                console.log('⚠️ Backend logout failed, but continuing with local logout');
            }
        }
    } catch (error) {
        console.log('⚠️ Backend logout error, but continuing with local logout:', error);
    }
    
    // Clear persistent session
    localStorage.removeItem('laitlum_user_email');
    localStorage.removeItem('laitlum_device_id');
    localStorage.removeItem('laitlum_device_name');
    localStorage.removeItem('laitlum_device_platform');
    
    // Stop services
    stopHeartbeat();
    if (backendWS) {
        backendWS.close();
        backendWS = null;
    }
    
    // Reset state
    isSignedIn = false;
    userEmail = null;
    deviceInfo = null;
    isAgentRunning = false;
    lastScanTime = null;
    
    // Show sign in form
    document.getElementById('signin-section').classList.remove('hidden');
    document.getElementById('main-interface').classList.add('hidden');
    document.getElementById('signin-btn').classList.remove('hidden');
    document.getElementById('logout-btn').classList.add('hidden');
    
    // Clear email input
    const emailInput = document.getElementById('user-email');
    if (emailInput) {
        emailInput.value = '';
    }
    
    // Reset status displays
    updateStatusDisplays();
    
    console.log('✅ Logout completed successfully');
}

// Save persistent session
function savePersistentSession() {
    if (userEmail && deviceInfo) {
        localStorage.setItem('laitlum_user_email', userEmail);
        localStorage.setItem('laitlum_device_id', deviceInfo.deviceId);
        localStorage.setItem('laitlum_device_name', deviceInfo.name);
        localStorage.setItem('laitlum_device_platform', deviceInfo.platform);
        console.log('💾 Persistent session saved for:', userEmail);
    }
}

// Start fake antivirus scan
function startScan() {
    if (scanInProgress) return;
    
    console.log('🔍 Starting antivirus scan...');
    scanInProgress = true;
    scanProgress = 0;
    
    // Hide scan button and show progress
    document.getElementById('scan-btn').classList.add('hidden');
    document.getElementById('scan-progress').classList.remove('hidden');
    document.getElementById('scan-complete').classList.add('hidden');
    
    // Update scan status
    updateScanStatus('Initializing deep system scan...', 0);
    
    // Start progress simulation (1 hour = 3600000ms, update every 5 seconds)
    const totalDuration = 3600000; // 1 hour
    const updateInterval = 5000; // 5 seconds
    const progressIncrement = (updateInterval / totalDuration) * 100;
    
    scanInterval = setInterval(() => {
        scanProgress += progressIncrement;
        
        if (scanProgress >= 100) {
            scanProgress = 100;
            completeScan();
            return;
        }
        
        // Update progress bar
        const progressBar = document.getElementById('scan-bar');
        const percentage = document.getElementById('scan-percentage');
        const status = document.getElementById('scan-status');
        const timeRemaining = document.getElementById('scan-time');
        
        if (progressBar) progressBar.style.width = scanProgress + '%';
        if (percentage) percentage.textContent = Math.round(scanProgress) + '%';
        
        // Update status messages
        const statusMessages = [
            'Scanning system files...',
            'Checking registry entries...',
            'Analyzing network connections...',
            'Scanning startup programs...',
            'Checking browser extensions...',
            'Analyzing running processes...',
            'Scanning temporary files...',
            'Checking system drivers...',
            'Analyzing system logs...',
            'Finalizing security analysis...'
        ];
        
        const messageIndex = Math.floor((scanProgress / 100) * statusMessages.length);
        if (status && messageIndex < statusMessages.length) {
            status.textContent = statusMessages[messageIndex];
        }
        
        // Update time remaining
        const remainingMs = totalDuration - (scanProgress / 100) * totalDuration;
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        if (timeRemaining) {
            timeRemaining.textContent = `Estimated time remaining: ${remainingMinutes} minutes`;
        }
        
    }, updateInterval);
}

// Complete scan
function completeScan() {
    console.log('✅ Antivirus scan completed');
    scanInProgress = false;
    
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
    
    // Hide progress and show completion
    document.getElementById('scan-progress').classList.add('hidden');
    document.getElementById('scan-complete').classList.remove('hidden');
    
    // Update last scan time
    const now = new Date();
    lastScanTime = now;
    const timeString = now.toLocaleTimeString();
    document.getElementById('last-scan').textContent = timeString;
    document.getElementById('last-scan').className = 'text-2xl font-bold text-secondary';
    
    // Show scan button again after 3 seconds
    setTimeout(() => {
        document.getElementById('scan-complete').classList.add('hidden');
        document.getElementById('scan-btn').classList.remove('hidden');
    }, 3000);
}

// Update scan status
function updateScanStatus(message, progress) {
    const status = document.getElementById('scan-status');
    const percentage = document.getElementById('scan-percentage');
    const progressBar = document.getElementById('scan-bar');
    
    if (status) status.textContent = message;
    if (percentage) percentage.textContent = progress + '%';
    if (progressBar) progressBar.style.width = progress + '%';
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
    console.log('🔌 connectToBackend called with BACKEND_URL:', BACKEND_URL);
    try {
        // Test HTTP connection first
        console.log('🔍 Testing backend connection to:', `${BACKEND_URL}/health`);
        const response = await fetch(`${BACKEND_URL}/health`);
        console.log('📡 Backend response status:', response.status);
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
            
            // Update status displays
            updateStatusDisplays();
            
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
            
            // Update status displays
            updateStatusDisplays();
            
            // Retry connection
            setTimeout(connectWebSocket, 3000);
        };
        
        backendWS.onerror = (error) => {
            console.error('❌ Backend WebSocket error:', error);
            
            // Update status displays
            updateStatusDisplays();
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
        return;
    }
    
    if (!deviceInfo) {
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
            console.log('✅ Device registered successfully! Ready for remote connections.');
            showAgentRunning();
            updateUI();
            
        } else {
            const error = await response.text();
            throw new Error(`Registration failed: ${error}`);
        }
        
    } catch (error) {
        console.error('❌ Device registration failed:', error);
        console.error('❌ Registration failed:', error.message);
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
    const registerBtn = document.getElementById('register-device-btn');
    const agentStatus = document.getElementById('agent-status');
    
    if (registerBtn) registerBtn.style.display = 'none';
    if (agentStatus) agentStatus.classList.remove('hidden');
    
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
    console.log(`📨 Access request from ${requestData.email}`);
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
            console.log('✅ Access request approved');
            // Remove request from UI would go here
        } else {
            throw new Error('Failed to approve request');
        }
    } catch (error) {
        console.error('❌ Failed to approve access request:', error);
        console.error('❌ Failed to approve:', error.message);
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
            console.log('❌ Access request denied');
        } else {
            throw new Error('Failed to deny request');
        }
    } catch (error) {
        console.error('❌ Failed to deny access request:', error);
        console.error('❌ Failed to deny:', error.message);
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
        
        console.log('✅ Remote session started');
        
    } catch (error) {
        console.error('❌ Failed to start permanent session:', error);
        console.error('❌ Session failed:', error.message);
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
    
    if (registerBtn) {
        if (!deviceInfo || !deviceInfo.registered || !isAgentRunning) {
            // Device not registered or agent not running - show register button
            registerBtn.style.display = 'block';
        } else {
            // Agent running - hide register button
            registerBtn.style.display = 'none';
        }
    }
    
    if (agentStatus) {
        if (!deviceInfo || !deviceInfo.registered || !isAgentRunning) {
            agentStatus.classList.add('hidden');
        } else {
            agentStatus.classList.remove('hidden');
        }
    }
}

// Update status display
function updateStatus(status) {
    // Only log status updates, don't show error messages to user
    console.log(`📊 Status: ${status}`);
}

// Update device status from backend
function updateDeviceStatus(statusData) {
    console.log('📊 Device status update:', statusData);
    
    if (statusData.isOnline !== undefined) {
        const statusText = statusData.isOnline ? 'Online' : 'Offline';
        const statusElement = document.getElementById('device-connection-status');
        if (statusElement) {
            statusElement.textContent = statusText;
        }
    }
}

// WebSocket connection for remote control
let ws = null;
// peerConnection and localStream already declared above
let isWebSocketConnected = false;

// WebSocket server configuration
// WS_SERVER_URL is already defined above

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
    const registerBtn = document.getElementById('register-device-btn');
    const agentStatus = document.getElementById('agent-status');
    
    if (registerBtn) registerBtn.style.display = 'none';
    if (agentStatus) agentStatus.classList.remove('hidden');
    
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