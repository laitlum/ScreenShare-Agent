console.log("🛡️ LAITLUM ANTIVIRUS AGENT LOADED");

let peerConnection = null;
let localStream = null;
let isAgentRunning = false;
let remoteAnswerApplied = false;
let applyingRemoteAnswer = false;
let pendingIceCandidates = [];
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
let agentStartTime = Date.now();
let dashboardInterval = null;

// Configuration - Environment-based
// In Electron renderer, we need to use window.electronAPI or direct environment detection
let BACKEND_URL, BACKEND_WS_URL, WS_SERVER_URL;

// Detect environment and set URLs accordingly
if (
  typeof process !== "undefined" &&
  process.env &&
  process.env.NODE_ENV === "production"
) {
  // Production URLs
  BACKEND_URL =
    process.env.BACKEND_URL || "https://your-heroku-backend.herokuapp.com";
  BACKEND_WS_URL =
    process.env.BACKEND_WS_URL || "wss://your-heroku-backend.herokuapp.com";
  WS_SERVER_URL =
    process.env.WS_SERVER_URL || "wss://your-heroku-backend.herokuapp.com";
  console.log("🔧 Production Environment - Backend:", BACKEND_URL);
} else {
    // Development URLs (default)
    BACKEND_URL = 'http://localhost:8000';
    BACKEND_WS_URL = 'ws://localhost:8000/ws';
    WS_SERVER_URL = 'ws://localhost:8081/ws';
    console.log('🔧 Development Environment - Backend:', BACKEND_URL);
}

// Initialize the application
function init() {
  console.log("🚀 Initializing Laitlum Antivirus Agent...");
  loadDeviceInfo();
  setupEventListeners();
  checkPersistentSession();
  updateStatus("Dashboard loaded");

  // Start dashboard updates
  updateDashboardStats();
  dashboardInterval = setInterval(updateDashboardStats, 30000); // Update every 30 seconds
}

// Check for persistent session
async function checkPersistentSession() {
  const savedDeviceId = localStorage.getItem("laitlum_device_id");
  const savedEmail = localStorage.getItem("laitlum_user_email");
  const savedName = localStorage.getItem("laitlum_device_name");
  const savedPlatform = localStorage.getItem("laitlum_device_platform");

  if (!savedDeviceId && savedEmail) {
    // Backward-compat: fall back to generated device_id
    const fallback = localStorage.getItem("device_id");
    if (fallback) {
      localStorage.setItem("laitlum_device_id", fallback);
    }
  }

  if (savedDeviceId && savedEmail) {
    console.log(
      "🔄 Restoring persistent session for:",
      savedEmail,
      "device:",
      savedDeviceId
    );

    // Rehydrate minimal deviceInfo and UI
    deviceInfo = {
      name: savedName || (deviceInfo && deviceInfo.name) || "Unknown Device",
      deviceId: savedDeviceId,
      platform:
        savedPlatform || (deviceInfo && deviceInfo.platform) || "unknown",
      ipAddress: (deviceInfo && deviceInfo.ipAddress) || "Unknown",
      macAddress: (deviceInfo && deviceInfo.macAddress) || "Unknown",
      registered: true,
    };
    userEmail = savedEmail;
    isAuthenticated = true;
    isSignedIn = true;

    updateUserStatus();
    updateDeviceDisplay();
    connectToBackend();
    startHeartbeat();
    updateStatus("Agent running - Ready for connections");
    return;
  }
}

// Update user status in top bar
function updateUserStatus() {
  const userDisplay = document.getElementById("user-display");

  if (userDisplay) {
    if (isSignedIn && userEmail) {
      userDisplay.innerHTML = `👤 ${userEmail}`;
    } else {
      userDisplay.innerHTML = "� Not Connected";
    }
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
          name: systemInfo.hostname || navigator.platform || "Unknown Device",
          deviceId: generateDeviceId(),
          platform: systemInfo.platform || navigator.platform || "unknown",
          ipAddress: systemInfo.ipAddress || "Unknown",
          macAddress: systemInfo.macAddress || "Unknown",
        };
        console.log("📱 Device info loaded from system:", deviceInfo);
      } catch (error) {
        console.warn("⚠️ Could not get system info, using fallback:", error);
        // Fallback if system info fails
        deviceInfo = {
          name: navigator.platform || "Unknown Device",
          deviceId: generateDeviceId(),
          platform: navigator.platform || "unknown",
          ipAddress: "Unknown",
          macAddress: "Unknown",
        };
      }
    } else {
      // Fallback device info since we may not have OS module in renderer
      deviceInfo = {
        name: navigator.platform || "Unknown Device",
        deviceId: generateDeviceId(),
        platform: navigator.platform || "unknown",
        ipAddress: "Unknown",
        macAddress: "Unknown",
      };
    }

    updateDeviceDisplay();
  } catch (error) {
    console.error("❌ Failed to load device info:", error);
    updateDeviceDisplay();
  }
}

// Generate a persistent device ID (stored in localStorage)
function generateDeviceId() {
  let deviceId = localStorage.getItem("device_id");
  if (!deviceId) {
    // Create a new persistent device ID based on machine characteristics
    const machineId =
      navigator.platform + "_" + (navigator.hardwareConcurrency || 4);
    deviceId =
      "device_" +
      btoa(machineId)
        .replace(/[^a-zA-Z0-9]/g, "")
        .substr(0, 16) +
      "_" +
      Date.now().toString(36);
    localStorage.setItem("device_id", deviceId);
    console.log("📱 Generated new persistent device ID:", deviceId);
  } else {
    console.log("📱 Using existing device ID:", deviceId);
  }
  return deviceId;
}

// Update device information display
function updateDeviceDisplay() {
  if (!deviceInfo) return;

  const deviceNameEl = document.getElementById("device-name");
  const deviceIdEl = document.getElementById("device-id");
  const devicePlatformEl = document.getElementById("device-platform");

  if (deviceNameEl) deviceNameEl.textContent = deviceInfo.name || "Unknown";
  if (deviceIdEl)
    deviceIdEl.textContent = deviceInfo.deviceId || "Not generated";
  if (devicePlatformEl)
    devicePlatformEl.textContent = deviceInfo.platform || "Unknown";
}

// Setup event listeners
function setupEventListeners() {
  console.log("🎛️ Setting up event listeners...");

  // View menu functionality
  const viewMenuBtn = document.getElementById("view-menu-btn");
  const viewDropdown = document.getElementById("view-dropdown");
  const toolsMenuBtn = document.getElementById("tools-menu-btn");
  const toolsDropdown = document.getElementById("tools-dropdown");
  const helpMenuBtn = document.getElementById("help-menu-btn");
  const helpDropdown = document.getElementById("help-dropdown");
  const addScreenMenu = document.getElementById("add-screen-menu");

  // Close all dropdowns function
  function closeAllDropdowns() {
    if (viewDropdown) viewDropdown.classList.add("hidden");
    if (toolsDropdown) toolsDropdown.classList.add("hidden");
    if (helpDropdown) helpDropdown.classList.add("hidden");
  }

  // View menu toggle
  if (viewMenuBtn && viewDropdown) {
    viewMenuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      closeAllDropdowns();
      viewDropdown.classList.toggle("hidden");
    });
  }

  // Tools menu toggle
  if (toolsMenuBtn && toolsDropdown) {
    toolsMenuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      closeAllDropdowns();
      toolsDropdown.classList.toggle("hidden");
    });
  }

  // Help menu toggle
  if (helpMenuBtn && helpDropdown) {
    helpMenuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      closeAllDropdowns();
      helpDropdown.classList.toggle("hidden");
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener("click", function (e) {
    if (
      !document.getElementById("view-menu")?.contains(e.target) &&
      !document.getElementById("tools-menu")?.contains(e.target) &&
      !document.getElementById("help-menu")?.contains(e.target)
    ) {
      closeAllDropdowns();
    }
  });

  // Add Screen menu item
  if (addScreenMenu) {
    addScreenMenu.addEventListener("click", function (e) {
      e.preventDefault();
      viewDropdown.classList.add("hidden"); // Close dropdown
      if (isSignedIn && userEmail) {
        // Show user menu or logout option
        showUserMenu();
      } else {
        // Show login modal
        showLoginModal();
      }
    });
  }

  // Minimize to background menu item
  const minimizeToBackgroundBtn = document.getElementById(
    "minimize-to-background"
  );
  if (minimizeToBackgroundBtn) {
    minimizeToBackgroundBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      closeAllDropdowns(); // Close dropdown

      try {
        console.log("🔒 Minimizing to background...");
        const result = await window.electronAPI.minimizeToBackground();
        if (result.success) {
          console.log("✅ Successfully minimized to background");
        } else {
          console.error("❌ Failed to minimize to background:", result.error);
        }
      } catch (error) {
        console.error("❌ Error minimizing to background:", error);
      }
    });
  }

  // Close modal button
  const closeModalBtn = document.getElementById("close-modal-btn");
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", hideLoginModal);
  }

  // Setup button in modal
  const setupBtn = document.getElementById("setup-btn");
  if (setupBtn) {
    console.log("✅ Found setup-btn, adding event listener");
    setupBtn.addEventListener("click", function (e) {
      console.log("🖱️ Setup button clicked!");
      e.preventDefault();
      handleDeviceSetup();
    });
  }

  // Scan buttons
  const quickScanBtn = document.getElementById("quick-scan-btn");
  if (quickScanBtn) {
    quickScanBtn.addEventListener("click", () => startScan("quick"));
  }

  const fullScanBtn = document.getElementById("full-scan-btn");
  if (fullScanBtn) {
    fullScanBtn.addEventListener("click", () => startScan("full"));
  }

    // Setup IPC event listeners if available
    if (window.electronAPI) {
        setupIPCEventListeners();
    }
    
    // Setup settings menu dropdown
    setupSettingsMenu();

  // Click outside modal to close
  const loginModal = document.getElementById("login-modal");
  if (loginModal) {
    loginModal.addEventListener("click", function (e) {
      if (e.target === loginModal) {
        hideLoginModal();
      }
    });
  }
}

// Show login modal
function showLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) {
    modal.classList.remove("hidden");
    // Focus on email input
    const emailInput = document.getElementById("user-email");
    if (emailInput) {
      setTimeout(() => emailInput.focus(), 100);
    }
  }
}

// Hide login modal
function hideLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

// Show user menu (placeholder for future expansion)
function showUserMenu() {
  // For now, just show a simple logout confirmation
  if (confirm(`Logout from ${userEmail}?`)) {
    handleLogout();
  }
}

// Setup IPC event listeners
function setupIPCEventListeners() {
  // Access request events
  if (window.electronAPI.onAccessRequestReceived) {
    window.electronAPI.onAccessRequestReceived((event, data) => {
      console.log("📨 Access request received:", data);
      handleAccessRequest(data);
    });
  }

  // Session events for permanent access
  if (window.electronAPI.onPermanentSessionStart) {
    window.electronAPI.onPermanentSessionStart((event, data) => {
      console.log("🔐 Permanent session starting:", data);
      handlePermanentSession(data);
    });
  }
}

// Handle device setup
async function handleDeviceSetup() {
  console.log("🚀 handleDeviceSetup called!");
  console.log("🔧 BACKEND_URL:", BACKEND_URL);
  console.log("🔧 BACKEND_WS_URL:", BACKEND_WS_URL);

  const emailInput = document.getElementById("user-email");
  const newEmail = emailInput.value.trim();
  console.log("📧 Email input value:", newEmail);

  if (!newEmail) {
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    return;
  }

  try {
    updateStatus("Setting up security protection...");

    // Check if email has changed and device is already registered
    const emailChanged = userEmail && userEmail !== newEmail;
    if (emailChanged && deviceInfo && deviceInfo.registered) {
      console.log("📧 Email changed from", userEmail, "to", newEmail);
      console.log("🔄 Re-registering device with new owner...");

      // Stop current heartbeat
      stopHeartbeat();

      // Reset device registration status
      deviceInfo.registered = false;
      deviceInfo.registered_device_id = null;
      deviceInfo.id = null;
    }

    // Update user email
    userEmail = newEmail;

    // Check if the user exists (try to find/create them)
    await findOrCreateUser(userEmail);

    // Ensure deviceInfo is initialized before registration
    if (!deviceInfo) {
      console.log("🔄 Initializing deviceInfo...");
      await initializeDeviceInfo();
    }

    // Check if device is already registered with this email
    const savedDeviceId = localStorage.getItem("laitlum_device_id");
    if (savedDeviceId && !emailChanged) {
      console.log(
        "🔍 Checking if device is already registered with this email..."
      );
      try {
        const response = await fetch(
          `${BACKEND_URL}/public/devices/${savedDeviceId}/session`
        );
        const data = await response.json();

        if (
          data.has_active_session &&
          data.owner &&
          data.owner.email === newEmail
        ) {
          console.log(
            "✅ Device already registered with this email, restoring session"
          );

          // Restore the session without re-registering
          userEmail = newEmail;
          deviceInfo = {
            name:
              localStorage.getItem("laitlum_device_name") || "Unknown Device",
            deviceId: savedDeviceId,
            platform:
              localStorage.getItem("laitlum_device_platform") || "unknown",
            ipAddress: "Unknown",
            macAddress: "Unknown",
            registered: true,
          };

          // Save the email to localStorage
          localStorage.setItem("laitlum_user_email", newEmail);

          isSignedIn = true;
          hideLoginModal();
          updateUserStatus();
          connectToBackend();
          startHeartbeat();
          updateStatus("Agent running - Ready for connections");
          console.log("✅ Session restored successfully!");
          return;
        }
      } catch (error) {
        console.log("⚠️ Could not check existing session:", error.message);
      }
    }

    // Save persistent session
    savePersistentSession();

    // Hide modal and update UI
    hideLoginModal();
    isSignedIn = true;
    updateUserStatus();

    // Register device with backend
    console.log("🔄 About to call registerDevice()...");
    await registerDevice();
    console.log("✅ registerDevice() completed");

    connectToBackend();
    startHeartbeat();
  } catch (error) {
    console.error("❌ Device setup failed:", error);
    updateStatus("Setup failed");
  }
}

// Show sign in form
function showSignInForm() {
  showLoginModal();
}

// Show main antivirus interface
function showMainInterface() {
  // Main interface is always visible now - this function is kept for compatibility
  console.log("✅ Main interface is always visible in new design");
}

// Update status displays
function updateStatusDisplays() {
  // Update device info if available
  if (deviceInfo) {
    const deviceNameEl = document.getElementById("device-name");
    const devicePlatformEl = document.getElementById("device-platform");
    const deviceConnectionEl = document.getElementById(
      "device-connection-status"
    );

    if (deviceNameEl) deviceNameEl.textContent = deviceInfo.name || "Unknown";
    if (devicePlatformEl)
      devicePlatformEl.textContent = deviceInfo.platform || "Unknown";
    if (deviceConnectionEl) {
      deviceConnectionEl.textContent =
        isAgentRunning && backendWS && backendWS.readyState === WebSocket.OPEN
          ? "Online"
          : "Offline";
    }
  }

  // Update dashboard stats
  updateDashboardStats();
}

// Setup settings menu dropdown
function setupSettingsMenu() {
    const settingsMenuBtn = document.getElementById('settings-menu-btn');
    const settingsDropdown = document.getElementById('settings-dropdown');
    const logoutBtn = document.getElementById('logout-btn');

    if (settingsMenuBtn && settingsDropdown) {
        settingsMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsDropdown.classList.toggle('hidden');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!settingsMenuBtn.contains(e.target) && !settingsDropdown.contains(e.target)) {
                settingsDropdown.classList.add('hidden');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsDropdown.classList.add('hidden');
            handleLogout();
        });
    }
}

// Handle logout
async function handleLogout() {
  console.log("🚪 Logging out...");

  try {
    // Call backend logout endpoint if we have user info
    if (userEmail && deviceInfo) {
      console.log("📡 Calling backend logout endpoint...");

      const response = await fetch(`${BACKEND_URL}/public/agent/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: deviceInfo.clerkId || userEmail, // Use clerk_id if available, otherwise email
          device_id: deviceInfo.deviceId, // Include device_id for specific device logout
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Backend logout successful:", result);
      } else {
        console.log(
          "⚠️ Backend logout failed, but continuing with local logout"
        );
      }
    }
  } catch (error) {
    console.log(
      "⚠️ Backend logout error, but continuing with local logout:",
      error
    );
  }

  // Clear persistent session
  localStorage.removeItem("laitlum_user_email");
  localStorage.removeItem("laitlum_device_id");
  localStorage.removeItem("laitlum_device_name");
  localStorage.removeItem("laitlum_device_platform");

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

  // Update UI
  updateUserStatus();

  // Clear email input
  const emailInput = document.getElementById("user-email");
  if (emailInput) {
    emailInput.value = "";
  }

  console.log("✅ Logout completed successfully");
}

// Save persistent session
function savePersistentSession() {
  if (userEmail && deviceInfo) {
    localStorage.setItem("laitlum_user_email", userEmail);
    localStorage.setItem("laitlum_device_id", deviceInfo.deviceId);
    localStorage.setItem("laitlum_device_name", deviceInfo.name);
    localStorage.setItem("laitlum_device_platform", deviceInfo.platform);
    console.log("💾 Persistent session saved for:", userEmail);
  }
}

// Start fake antivirus scan
function startScan(scanType = "full") {
  if (scanInProgress) return;

  console.log(`🔍 Starting ${scanType} antivirus scan...`);
  scanInProgress = true;
  scanProgress = 0;

  // Update scan button text and disable it
  const quickScanBtn = document.getElementById("quick-scan-btn");
  const fullScanBtn = document.getElementById("full-scan-btn");

  if (quickScanBtn) {
    quickScanBtn.textContent = "Scanning...";
    quickScanBtn.disabled = true;
    quickScanBtn.classList.add("opacity-50");
  }

  if (fullScanBtn) {
    fullScanBtn.textContent = "Scanning...";
    fullScanBtn.disabled = true;
    fullScanBtn.classList.add("opacity-50");
  }

  // Show progress
  const progressSection = document.getElementById("scan-progress");
  if (progressSection) {
    progressSection.classList.remove("hidden");
  }

  // Update scan status
  updateScanStatus("Initializing advanced threat detection...", 0);

  // Start progress simulation - quicker for demo (30 seconds for quick, 2 minutes for full)
  const totalDuration = scanType === "quick" ? 30000 : 120000; // 30s or 2 minutes
  const updateInterval = 1000; // 1 second
  const progressIncrement = (updateInterval / totalDuration) * 100;

  scanInterval = setInterval(() => {
    scanProgress += progressIncrement;

    if (scanProgress >= 100) {
      scanProgress = 100;
      completeScan();
      return;
    }

    // Update progress bar
    const progressBar = document.getElementById("scan-bar");
    const percentage = document.getElementById("scan-percentage");
    const status = document.getElementById("scan-status");

    if (progressBar) progressBar.style.width = scanProgress + "%";
    if (percentage) percentage.textContent = Math.round(scanProgress) + "%";

    // Update status messages
    const statusMessages = [
      "Analyzing system files...",
      "Scanning memory processes...",
      "Checking registry entries...",
      "Analyzing network connections...",
      "Scanning startup programs...",
      "Checking browser extensions...",
      "Deep system inspection...",
      "Validating file signatures...",
      "Finalizing threat analysis...",
    ];

    const messageIndex = Math.floor(
      (scanProgress / 100) * statusMessages.length
    );
    if (status && messageIndex < statusMessages.length) {
      status.textContent = statusMessages[messageIndex];
    }
  }, updateInterval);
}

// Complete scan
function completeScan() {
  console.log("✅ Antivirus scan completed");
  scanInProgress = false;

  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }

  // Hide progress and show completion
  const progressSection = document.getElementById("scan-progress");
  const completeSection = document.getElementById("scan-complete");

  if (progressSection) progressSection.classList.add("hidden");
  if (completeSection) completeSection.classList.remove("hidden");

  // Reset scan buttons after showing completion
  setTimeout(() => {
    const quickScanBtn = document.getElementById("quick-scan-btn");
    const fullScanBtn = document.getElementById("full-scan-btn");

    if (quickScanBtn) {
      quickScanBtn.textContent = "Quick Scan";
      quickScanBtn.disabled = false;
      quickScanBtn.classList.remove("opacity-50");
    }

    if (fullScanBtn) {
      fullScanBtn.textContent = "Full System Scan";
      fullScanBtn.disabled = false;
      fullScanBtn.classList.remove("opacity-50");
    }

    // Hide completion message
    if (completeSection) completeSection.classList.add("hidden");
  }, 3000);

  // Update last scan time
  const now = new Date();
  lastScanTime = now;
  const timeString = now.toLocaleTimeString();
  const lastScanEl = document.getElementById("last-scan");
  if (lastScanEl) {
    lastScanEl.textContent = timeString;
  }

  // Show completion notification
  console.log("🎉 Scan completed successfully - System is secure");

  // Update dashboard stats to reflect scan completion
  updateDashboardStats();
}

// Update scan status
function updateScanStatus(message, progress) {
  const status = document.getElementById("scan-status");
  const percentage = document.getElementById("scan-percentage");
  const progressBar = document.getElementById("scan-bar");

  if (status) status.textContent = message;
  if (percentage) percentage.textContent = progress + "%";
  if (progressBar) progressBar.style.width = progress + "%";
}

// Find or create user by email
async function findOrCreateUser(email) {
  try {
    // For now, we'll just store the email locally
    // In a real system, you might sync with the backend
    console.log(`📧 Setting up protection for: ${email}`);
    userEmail = email;
    isAuthenticated = true; // Mark as "authenticated" for local use
    return { email: email };
  } catch (error) {
    throw new Error(`Failed to setup user: ${error.message}`);
  }
}

// Initialize device info (same logic as in initializeApp)
async function initializeDeviceInfo() {
  try {
    if (window.electronAPI && window.electronAPI.getDeviceInfo) {
      const systemInfo = await window.electronAPI.getDeviceInfo();
      deviceInfo = {
        name: systemInfo.hostname || navigator.platform || "Unknown Device",
        deviceId: generateDeviceId(),
        platform: systemInfo.platform || navigator.platform || "unknown",
        ipAddress: systemInfo.ipAddress || "Unknown",
        macAddress: systemInfo.macAddress || "Unknown",
      };
      console.log("📱 Device info loaded from system:", deviceInfo);
    } else {
      console.warn("⚠️ Could not get system info, using fallback");
      // Fallback device info
      deviceInfo = {
        name: navigator.platform || "Unknown Device",
        deviceId: generateDeviceId(),
        platform: navigator.platform || "unknown",
        ipAddress: "Unknown",
        macAddress: "Unknown",
      };
    }
    console.log("✅ deviceInfo initialized:", deviceInfo);
  } catch (error) {
    console.warn("⚠️ Could not initialize device info:", error);
    // Fallback device info since we may not have OS module in renderer
    deviceInfo = {
      name: navigator.platform || "Unknown Device",
      deviceId: generateDeviceId(),
      platform: navigator.platform || "unknown",
      ipAddress: "Unknown",
      macAddress: "Unknown",
    };
    console.log("📱 Fallback device info:", deviceInfo);
  }
}

// Show device setup UI
function showDeviceSetupUI() {
  document.getElementById("auth-setup").style.display = "none";
  document.getElementById("device-setup").style.display = "block";

  // Update device status
  const deviceStatus = document.getElementById("device-status");
  deviceStatus.textContent = `Device Access: Enabled for ${userEmail}`;
}

// Connect to backend
async function connectToBackend() {
  console.log("🔌 connectToBackend called with BACKEND_URL:", BACKEND_URL);
  try {
    // Test HTTP connection first
    console.log("🔍 Testing backend connection to:", `${BACKEND_URL}/health`);
    const response = await fetch(`${BACKEND_URL}/health`);
    console.log("📡 Backend response status:", response.status);
    if (response.ok) {
      console.log("✅ Backend HTTP connection successful");
      updateStatus("Connected to backend");

      // Connect WebSocket
      connectWebSocket();
    } else {
      throw new Error("Backend not responding");
    }
  } catch (error) {
    console.error("❌ Failed to connect to backend:", error);
    updateStatus(
      "Backend offline - Check if Go backend is running on port 3001"
    );

    // Retry connection after delay
    setTimeout(connectToBackend, 5000);
  }
}

// Connect WebSocket to backend
function connectWebSocket() {
  if (backendWS && backendWS.readyState === WebSocket.OPEN) {
    return;
  }

  // Ensure deviceInfo is available before connecting
  if (!deviceInfo) {
    console.log("⚠️ Device info not available, waiting...");
    setTimeout(connectWebSocket, 1000);
    return;
  }

  try {
    const deviceId = deviceInfo?.registered_device_id || deviceInfo?.deviceId;
    if (!deviceId) {
      console.log("⚠️ Device ID not available, waiting...");
      setTimeout(connectWebSocket, 1000);
      return;
    }

    const wsUrl = `${BACKEND_WS_URL}?device_id=${deviceId}`;
    console.log("🔌 Connecting to backend WebSocket:", wsUrl);
    console.log("🔍 Device info:", deviceInfo);
    backendWS = new WebSocket(wsUrl);

    backendWS.onopen = () => {
      console.log("✅ Backend WebSocket connected");
      updateStatus("Connected to backend - Session created automatically");

      // Update status displays
      updateStatusDisplays();

      // Register device if not already done
      if (deviceInfo && !deviceInfo.registered) {
        registerDeviceAutomatically();
      } else if (deviceInfo && deviceInfo.registered) {
        // Device already registered, initialize signaling WebSocket
        console.log(
          "🔌 Device already registered, initializing signaling WebSocket..."
        );
        initializeWebSocket();
      }
    };

    backendWS.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleBackendMessage(data);
      } catch (error) {
        console.error("❌ Failed to parse backend message:", error);
      }
    };

    backendWS.onclose = () => {
      console.log("🔌 Backend WebSocket disconnected");
      updateStatus("Disconnected from backend");

      // Update status displays
      updateStatusDisplays();

      // Retry connection
      setTimeout(connectWebSocket, 3000);
    };

    backendWS.onerror = (error) => {
      console.error("❌ Backend WebSocket error:", error);

      // Update status displays
      updateStatusDisplays();
    };
  } catch (error) {
    console.error("❌ Failed to connect WebSocket:", error);
    updateStatus("WebSocket connection failed");
  }
}

// Handle messages from backend
async function handleBackendMessage(data) {
  console.log("📨 Backend message:", data);

  switch (data.type) {
    case "access_request":
      handleAccessRequest(data.data);
      break;
    case "session_start":
      handlePermanentSession(data.data);
      break;
    case "device_status":
      updateDeviceStatus(data.data);
      break;
    case "viewer-joined":
      console.log(
        "🎉 Viewer joined via backend WebSocket - starting screen sharing"
      );
      updateStatus("Viewer connected - Starting screen share...");
      // Forward to signaling WebSocket handler
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "viewer-joined",
            data: data.data,
          })
        );
      }
      break;
    case "webrtc-offer":
      console.log("📝 Received WebRTC offer from backend");
      // Forward to signaling WebSocket handler
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "webrtc-offer",
            data: {
              offer: data.offer,
              sessionId: data.sessionId,
              target: "agent",
            },
          })
        );
      }
      break;
    case "webrtc-answer":
      console.log("📝 Received WebRTC answer from backend");
      // Forward to signaling WebSocket handler
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "webrtc-answer",
            data: {
              answer: data.answer,
              sessionId: data.sessionId,
              target: "agent",
            },
          })
        );
      }
      break;
    case "webrtc-ice":
      console.log("🧊 Received ICE candidate from backend");
      try {
        const payload =
          data && typeof data.data === "object" && data.data !== null
            ? data.data
            : data;
        const candidate = payload?.candidate || payload;
        if (candidate && peerConnection && peerConnection.remoteDescription) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("✅ ICE candidate added from backend->viewer path");
        } else {
          // Fallback to routing through ws as before if needed
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "webrtc-ice",
                data: { candidate, sessionId: payload?.sessionId },
              })
            );
          }
        }
      } catch (e) {
        console.error("❌ Error handling ICE from backend:", e, data);
      }
      break;
    case "viewer-input":
      console.log("🖱️ Received viewer input from backend");
      // Forward to signaling WebSocket handler
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "viewer-input",
            data: {
              action: data.input?.action,
              x: data.input?.x,
              y: data.input?.y,
              button: data.input?.button,
              key: data.input?.key,
              char: data.input?.char,
              modifiers: data.input?.modifiers,
              remoteWidth: data.input?.remoteWidth,
              remoteHeight: data.input?.remoteHeight,
              sessionId: data.sessionId,
            },
          })
        );
      }
      break;
    case "session-error":
      console.error(
        "❌ Session error from backend:",
        data.data?.error || "Unknown session error"
      );
      updateStatus("Session error - Check connection");
      break;
    default:
      console.log("📝 Unknown backend message type:", data.type);
  }
}

// Register device with backend
async function registerDevice() {
  console.log("🚀 registerDevice() called");
  console.log("📧 userEmail:", userEmail);
  console.log("📱 deviceInfo:", deviceInfo);

  if (!userEmail) {
    console.log("❌ No userEmail, returning early");
    return;
  }

  if (!deviceInfo) {
    console.log("❌ No deviceInfo, returning early");
    return;
  }

  try {
    updateStatus("Registering device...");

    const registrationData = {
      name: deviceInfo.name,
      device_id: deviceInfo.deviceId,
      platform: deviceInfo.platform,
      ip_address: deviceInfo.ipAddress,
      mac_address: deviceInfo.macAddress,
      agent_version: "1.0.0",
      owner_email: userEmail,
    };

    console.log("📤 Sending registration data:", registrationData);

    const response = await fetch(`${BACKEND_URL}/public/agent/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registrationData),
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Device registration result:", result);

      deviceInfo.registered = true;
      // Store the database device ID for session creation
      if (result.device && result.device.id) {
        deviceInfo.registered_device_id = result.device.id;
        console.log(
          "💾 Stored database device ID:",
          deviceInfo.registered_device_id
        );
      }
      deviceInfo.id = result.device.id;

      // Save device info to localStorage for persistence
      localStorage.setItem("laitlum_device_id", deviceInfo.deviceId);
      localStorage.setItem("laitlum_device_name", deviceInfo.name);
      localStorage.setItem("laitlum_device_platform", deviceInfo.platform);
      localStorage.setItem("laitlum_user_email", userEmail);

      updateStatus("Agent running - Ready for connections");
      console.log(
        "✅ Device registered successfully! Ready for remote connections."
      );
      showAgentRunning();
      updateUI();

      // Initialize WebSocket connection for signaling
      console.log("🔌 Initializing WebSocket connection for signaling...");
      initializeWebSocket();
    } else {
      const error = await response.text();
      throw new Error(`Registration failed: ${error}`);
    }
  } catch (error) {
    console.error("❌ Device registration failed:", error);
    console.error("❌ Registration failed:", error.message);
    updateStatus("Registration failed");
  }
}

// Auto-register device (called when WebSocket connects)
async function registerDeviceAutomatically() {
  console.log("🔄 Auto-registering device...");
  await registerDevice();
}

// Start the agent
// Show agent running status
function showAgentRunning() {
  // Hide register button and show status
  const registerBtn = document.getElementById("register-device-btn");
  const agentStatus = document.getElementById("agent-status");

  if (registerBtn) registerBtn.style.display = "none";
  if (agentStatus) agentStatus.classList.remove("hidden");

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
        diskUsage: null,
      };

      await fetch(
        `${BACKEND_URL}/public/devices/${deviceInfo.deviceId}/heartbeat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(heartbeatData),
        }
      );

      // Update connection status
      document.getElementById("device-connection-status").textContent =
        "Online";
    } catch (error) {
      console.error("❌ Heartbeat failed:", error);
      document.getElementById("device-connection-status").textContent =
        "Offline";
    }
  }, 30000); // Every 30 seconds
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Also stop dashboard updates
  if (dashboardInterval) {
    clearInterval(dashboardInterval);
    dashboardInterval = null;
  }

  const deviceConnectionEl = document.getElementById(
    "device-connection-status"
  );
  if (deviceConnectionEl) {
    deviceConnectionEl.textContent = "Offline";
  }
}

// Handle access requests
function handleAccessRequest(requestData) {
  console.log("📨 Handling access request:", requestData);

  // Show access request in UI
  const requestsSection = document.getElementById("access-requests");
  const requestsList = document.getElementById("requests-list");

  const requestElement = document.createElement("div");
  requestElement.className =
    "bg-white border border-blue-300 rounded p-2 text-sm";
  requestElement.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <div class="font-semibold">${
                  requestData.email || "Unknown User"
                }</div>
                <div class="text-xs text-gray-500">${new Date(
                  requestData.requestedAt
                ).toLocaleString()}</div>
            </div>
            <div class="space-x-2">
                <button onclick="approveAccessRequest('${
                  requestData.id
                }')" class="bg-green-500 text-white px-2 py-1 rounded text-xs">Approve</button>
                <button onclick="denyAccessRequest('${
                  requestData.id
                }')" class="bg-red-500 text-white px-2 py-1 rounded text-xs">Deny</button>
            </div>
        </div>
    `;

  requestsList.appendChild(requestElement);
  requestsSection.classList.remove("hidden");

  // Show notification
  console.log(`📨 Access request from ${requestData.email}`);
}

// Approve access request
async function approveAccessRequest(requestId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/access/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId }),
    });

    if (response.ok) {
      console.log("✅ Access request approved");
      // Remove request from UI would go here
    } else {
      throw new Error("Failed to approve request");
    }
  } catch (error) {
    console.error("❌ Failed to approve access request:", error);
    console.error("❌ Failed to approve:", error.message);
  }
}

// Deny access request
async function denyAccessRequest(requestId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/access/deny`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId }),
    });

    if (response.ok) {
      console.log("❌ Access request denied");
    } else {
      throw new Error("Failed to deny request");
    }
  } catch (error) {
    console.error("❌ Failed to deny access request:", error);
    console.error("❌ Failed to deny:", error.message);
  }
}

// Handle permanent session start
async function handlePermanentSession(sessionData) {
  console.log("🔐 Starting permanent session:", sessionData);

  try {
    // Use existing Electron API for screen sharing if available
    if (window.electronAPI && window.electronAPI.getDisplaySources) {
      await initializeScreenShareElectron();
    } else {
      await initializeScreenShare();
    }

    console.log("✅ Remote session started");
  } catch (error) {
    console.error("❌ Failed to start permanent session:", error);
    console.error("❌ Session failed:", error.message);
  }
}

// Initialize screen sharing using Electron API
async function initializeScreenShareElectron() {
  try {
    const sources = await window.electronAPI.getDisplaySources();
    console.log("📺 Available sources:", sources);

    // Use the first available source (entire screen)
    const source = sources[0];

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: source.id,
          maxWidth: 1920,
          maxHeight: 1080,
          maxFrameRate: 30,
        },
      },
    });

    localStream = stream;
    console.log("✅ Screen capture initialized");
  } catch (error) {
    console.error("❌ Failed to initialize screen share:", error);
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
        frameRate: { ideal: 30 },
      },
      audio: false,
    });

    localStream = stream;
    console.log("✅ Screen capture initialized");
  } catch (error) {
    console.error("❌ Failed to initialize screen share:", error);
    throw error;
  }
}

// Update UI based on current state
function updateUI() {
  // Update user status in navigation
  updateUserStatus();

  // Update device displays
  updateDeviceDisplay();

  // Update status displays
  updateStatusDisplays();
}

// Update status display
function updateStatus(status) {
  // Only log status updates, don't show error messages to user
  console.log(`📊 Status: ${status}`);
}

// Update device status from backend
function updateDeviceStatus(statusData) {
  console.log("📊 Device status update:", statusData);

  if (statusData.isOnline !== undefined) {
    const statusText = statusData.isOnline ? "Online" : "Offline";
    const statusElement = document.getElementById("device-connection-status");
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
    console.log("🔄 Device not registered yet, skipping WebSocket connection");
    return;
  }

  console.log("🔌 Initializing WebSocket connection for signaling...");
  connectToSignalingServer();
}

// Connect to signaling WebSocket server
function connectToSignalingServer() {
  if (!deviceInfo || !deviceInfo.registered) {
    console.log(
      "🔄 Device not registered yet, skipping signaling WebSocket connection"
    );
    return;
  }

  const deviceId = deviceInfo?.deviceId; // Use public device_id, not DB id
  if (!deviceId) {
    console.log("⚠️ Device ID not available for signaling, waiting...");
    setTimeout(connectToSignalingServer, 1000);
    return;
  }

  try {
    const wsUrl = `${WS_SERVER_URL}?device_id=${deviceId}&role=agent`;
    console.log("🔌 Connecting to signaling WebSocket:", wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("✅ Signaling WebSocket connected successfully");
      isWebSocketConnected = true;

      // Create session for this device
      const sessionId = `device-${deviceId}`;
      ws.send(
        JSON.stringify({
          type: "create-session",
          sessionId: sessionId,
        })
      );

      updateStatus("Signaling WebSocket connected - Ready for remote access");
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📨 Signaling WebSocket message:", data.type, data);

        switch (data.type) {
          case "session-created":
            console.log("✅ Agent session created successfully");
            console.log("🔍 Session data received:", data);
            currentSessionId = data.sessionId || data.data?.sessionId;
            sessionConnected = true;
            console.log("💾 Session variables set:", {
              currentSessionId,
              sessionConnected,
            });
            updateStatus("Remote session ready");
            break;

          case "viewer-joined":
            console.log("🎉 Viewer connected - starting screen sharing");
            updateStatus("Viewer connected - Starting screen share...");
            await startScreenShare(currentSessionId);
            break;

          case "webrtc-answer":
            console.log("📝 Received WebRTC answer from viewer");
            try {
              if (remoteAnswerApplied || applyingRemoteAnswer) {
                console.log(
                  "ℹ️ Skipping duplicate answer: already applied or in-flight"
                );
                break;
              }
              applyingRemoteAnswer = true;
              const payload =
                data && typeof data.data === "object" && data.data !== null
                  ? data.data
                  : data;
              const answer = payload?.answer || payload;
              await handleWebRTCAnswer(answer);
              remoteAnswerApplied = true;
            } catch (e) {
              console.error(
                "❌ Error handling webrtc-answer payload:",
                e,
                data
              );
            } finally {
              applyingRemoteAnswer = false;
            }
            break;

          case "webrtc-ice":
            console.log("🧊 Received ICE candidate from viewer");
            try {
              const payload =
                data && typeof data.data === "object" && data.data !== null
                  ? data.data
                  : data;
              await handleICECandidate(payload.candidate || payload);
            } catch (e) {
              console.error("❌ Error handling viewer ICE payload:", e, data);
            }
            break;

          case "viewer-input":
            console.log("🖱️ Remote control input received:", data);
            console.log("🖱️ Input action:", data.action, "type:", data.type);
            // Some senders wrap the payload as { inputData: {...}, sessionId, ... }
            handleRemoteInput(data.inputData || data);
            break;

          case "input-event":
            // Backend forwards viewer input as 'input-event' with optional data wrapper
            try {
              const payload =
                data && typeof data.data === "object" && data.data !== null
                  ? data.data
                  : data;
              const input = payload.inputData || payload; // normalize shape
              console.log("🖱️ Input-event received:", input);
              handleRemoteInput(input);
            } catch (e) {
              console.error("❌ Error handling input-event payload:", e, data);
            }
            break;

          case "viewer-disconnected":
            console.log("👋 Viewer disconnected");
            updateStatus("Viewer disconnected");
            stopScreenShare();
            break;
        }
      } catch (error) {
        console.error("❌ Error parsing signaling WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("❌ Signaling WebSocket error:", error);
      isWebSocketConnected = false;
      updateStatus("Signaling WebSocket connection error");
    };

    ws.onclose = () => {
      console.log("🔌 Signaling WebSocket connection closed");
      isWebSocketConnected = false;
      updateStatus("Signaling WebSocket disconnected");

      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (!isWebSocketConnected && deviceInfo && deviceInfo.registered) {
          console.log("🔄 Attempting to reconnect signaling WebSocket...");
          connectToSignalingServer();
        }
      }, 5000);
    };
  } catch (error) {
    console.error("❌ Failed to create signaling WebSocket connection:", error);
    updateStatus("Failed to connect to signaling WebSocket server");
  }
}

// Start screen sharing with WebRTC
async function startScreenShare(sessionId) {
  try {
    console.log("🚀 DEBUG: startScreenShare called with sessionId:", sessionId);
    console.log("🚀 DEBUG: peerConnection exists:", !!peerConnection);
    console.log("🚀 DEBUG: localStream exists:", !!localStream);
    // Reset signaling flags for a fresh negotiation
    remoteAnswerApplied = false;
    applyingRemoteAnswer = false;
    pendingIceCandidates = [];
    console.log("🖥️ Starting screen capture...");

    // Create peer connection
    peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    // Get screen stream using Electron's desktopCapturer API
    console.log("🔍 Getting desktop sources...");
    const sources = await window.electronAPI.getDesktopSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
    });

    if (sources.length === 0) {
      throw new Error("No screen sources available");
    }

    const primaryScreen = sources[0]; // Use the first (primary) screen
    console.log("🖥️ Using screen source:", primaryScreen.name);

    // First, try video-only capture to avoid crashes
    console.log("🎬 Starting video capture...");
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: false, // Start without audio to avoid crashes
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: primaryScreen.id,
          minWidth: 1280,
          maxWidth: 1920,
          minHeight: 720,
          maxHeight: 1080,
        },
      },
    });

    // Professional system audio capture implementation
    console.log("🔊 Starting professional system audio capture...");

    let audioAdded = false;

    // Method 1: BlackHole Virtual Audio Driver (macOS - Professional Solution)
    if (!audioAdded) {
      try {
        console.log("🎵 Checking for BlackHole virtual audio device...");
        const audioDevices = await navigator.mediaDevices.enumerateDevices();
        console.log(
          "🎧 Available audio devices:",
          audioDevices
            .filter((d) => d.kind === "audioinput")
            .map((d) => d.label)
        );

        const blackHoleDevice = audioDevices.find(
          (device) =>
            device.kind === "audioinput" &&
            (device.label.toLowerCase().includes("blackhole") ||
              device.label.toLowerCase().includes("soundflower") ||
              device.label.toLowerCase().includes("virtual") ||
              device.label.toLowerCase().includes("loopback"))
        );

        if (blackHoleDevice) {
          console.log("✅ Found BlackHole device:", blackHoleDevice.label);
          const blackHoleStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: blackHoleDevice.deviceId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              suppressLocalAudioPlayback: true,
              sampleRate: 48000,
              channelCount: 2,
            },
          });

          blackHoleStream.getAudioTracks().forEach((track) => {
            // Remove any existing audio tracks to avoid conflicts
            const existingAudioTracks = localStream.getAudioTracks();
            existingAudioTracks.forEach((existingTrack) => {
              localStream.removeTrack(existingTrack);
              existingTrack.stop();
              console.log(
                "🗑️ Removed existing audio track:",
                existingTrack.label
              );
            });

            localStream.addTrack(track);
            console.log("✅ BlackHole audio track added:", track.label);
          });
          audioAdded = true;
          console.log("🎉 BlackHole system audio capture successful!");
          console.log(
            "💡 Configure macOS: System Preferences > Sound > Output > BlackHole 2ch"
          );
        } else {
          console.log(
            "⚠️ BlackHole not found. Install with: brew install blackhole-2ch"
          );
        }
      } catch (blackHoleError) {
        console.log("⚠️ BlackHole capture failed:", blackHoleError.message);
      }
    }

    // Method 2: Windows Stereo Mix (Windows - Built-in Solution)
    if (!audioAdded && navigator.platform.toLowerCase().includes("win")) {
      try {
        console.log("🎵 Checking for Windows Stereo Mix...");
        const audioDevices = await navigator.mediaDevices.enumerateDevices();
        const stereoMixDevice = audioDevices.find(
          (device) =>
            device.kind === "audioinput" &&
            (device.label.toLowerCase().includes("stereo mix") ||
              device.label.toLowerCase().includes("what u hear") ||
              device.label.toLowerCase().includes("wave out mix"))
        );

        if (stereoMixDevice) {
          console.log("✅ Found Stereo Mix:", stereoMixDevice.label);
          const stereoMixStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: stereoMixDevice.deviceId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });

          stereoMixStream.getAudioTracks().forEach((track) => {
            // Remove any existing audio tracks to avoid conflicts
            const existingAudioTracks = localStream.getAudioTracks();
            existingAudioTracks.forEach((existingTrack) => {
              localStream.removeTrack(existingTrack);
              existingTrack.stop();
              console.log(
                "🗑️ Removed existing audio track:",
                existingTrack.label
              );
            });

            localStream.addTrack(track);
            console.log("✅ Stereo Mix track added:", track.label);
          });
          audioAdded = true;
          console.log("🎉 Windows Stereo Mix capture successful!");
        } else {
          console.log("⚠️ Stereo Mix not available. Enable in Sound settings.");
        }
      } catch (stereoMixError) {
        console.log("⚠️ Stereo Mix failed:", stereoMixError.message);
      }
    }

    // Method 3: Forced macOS System Audio (Most Reliable)
    if (!audioAdded) {
      try {
        console.log(
          "🎵 Method 3: Forcing macOS system audio permission dialog..."
        );
        console.log(
          '🚨 IMPORTANT: Click "Share Audio" in the upcoming dialog!'
        );

        // Force the permission dialog by requesting video+audio together
        console.log(
          '🔄 Requesting screen sharing with audio (MUST click "Share Audio")...'
        );
        const fullStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            mediaSource: "screen",
            width: { max: 1920 },
            height: { max: 1080 },
            frameRate: { max: 30 },
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            suppressLocalAudioPlayback: true,
            systemAudio: "include",
          },
        });

        console.log(
          "📋 Received stream tracks:",
          fullStream.getTracks().map((t) => `${t.kind}: ${t.label}`)
        );

        // Extract audio tracks
        const audioTracks = fullStream.getAudioTracks();
        if (audioTracks.length > 0) {
          console.log(
            "🎉 SUCCESS! Got system audio tracks:",
            audioTracks.length
          );

          audioTracks.forEach((track) => {
            // Remove any existing audio tracks to avoid conflicts
            const existingAudioTracks = localStream.getAudioTracks();
            existingAudioTracks.forEach((existingTrack) => {
              localStream.removeTrack(existingTrack);
              existingTrack.stop();
              console.log(
                "🗑️ Removed existing audio track:",
                existingTrack.label
              );
            });

            // Add the new audio track
            localStream.addTrack(track);
            console.log("✅ System audio track added:", track.label);
            console.log(
              "🎵 Track settings:",
              JSON.stringify(track.getSettings(), null, 2)
            );
          });
          audioAdded = true;
          console.log("🎉 System audio capture successful!");
          console.log(
            "🔊 Now capturing YouTube, Spotify, system sounds directly"
          );
        } else {
          console.log(
            '❌ No audio tracks in the stream - user did not select "Share Audio"'
          );
          console.log(
            '💡 Please restart connection and click "Share Audio" in the dialog'
          );
        }

        // Stop the temporary video tracks since we already have video
        const tempVideoTracks = fullStream.getVideoTracks();
        tempVideoTracks.forEach((track) => {
          track.stop();
          console.log("🗑️ Stopped temporary video track:", track.label);
        });
      } catch (forcedError) {
        console.log("⚠️ Forced system audio failed:", forcedError.message);
        console.log("💡 Possible reasons:");
        console.log("   • User cancelled the permission dialog");
        console.log('   • User did not check "Share Audio"');
        console.log("   • macOS version too old (requires 13+ Ventura)");

        // Last resort: Try simple audio-only request
        try {
          console.log("🔄 Last resort: Simple audio-only request...");
          const audioOnlyStream = await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: true,
          });

          const audioTracks = audioOnlyStream.getAudioTracks();
          if (audioTracks.length > 0) {
            audioTracks.forEach((track) => {
              const existingAudioTracks = localStream.getAudioTracks();
              existingAudioTracks.forEach((existingTrack) => {
                localStream.removeTrack(existingTrack);
                existingTrack.stop();
              });
              localStream.addTrack(track);
              console.log("✅ Last resort audio track added:", track.label);
            });
            audioAdded = true;
            console.log("🎉 Last resort audio capture successful!");
          }
        } catch (lastResortError) {
          console.log("⚠️ Last resort audio failed:", lastResortError.message);
        }
      }
    }

    // DO NOT add microphone fallback - system audio only!
    // We intentionally skip microphone capture since it's not what users want

    // Final status and user-friendly instructions
    if (audioAdded) {
      console.log("🎉 SUCCESS: Audio capture is working!");
      console.log("🎵 Audio will be streamed to the remote viewer");
      updateStatus("Screen sharing active with audio");
    } else {
      console.log("❌ System audio capture not available");
      console.log("");
      console.log("🎯 SYSTEM AUDIO OPTIONS:");
      console.log("");
      console.log("🥇 BUILT-IN (Recommended): macOS Screen Sharing Dialog");
      console.log("   ✅ No installation required");
      console.log("   ✅ Works on macOS 13+ (Ventura and newer)");
      console.log('   💡 User clicks "Share Audio" when prompted');
      console.log("   🎵 Captures YouTube, Spotify, system sounds directly");
      console.log("");
      console.log("🥈 PROFESSIONAL (Optional): BlackHole Virtual Driver");
      console.log("   🔧 One-time setup: brew install blackhole-2ch");
      console.log(
        "   ⚙️ Configure: System Settings > Sound > Output > BlackHole 2ch"
      );
      console.log("   🎯 Best for power users & consistent setup");
      console.log("");
      console.log("🥉 WINDOWS: Enable Stereo Mix in Sound settings");
      console.log("");
      console.log("⚠️ Continuing with video-only stream");
      console.log(
        "🚫 Microphone audio intentionally disabled (system audio only)"
      );
      console.log("💡 Restart connection to try audio permission dialog again");
    }

    console.log("✅ Screen capture started successfully");
    updateStatus("Screen sharing active");

    // Add stream to peer connection (avoid duplicates)
    const existingSenders = peerConnection.getSenders();
    localStream.getTracks().forEach((track) => {
      console.log("➕ Adding track:", track.kind);

      // Check if a sender already exists for this track type
      const existingSender = existingSenders.find(
        (sender) => sender.track && sender.track.kind === track.kind
      );

      if (existingSender) {
        console.log("🔄 Replacing existing track:", track.kind);
        existingSender.replaceTrack(track);
      } else {
        console.log("➕ Adding new track:", track.kind);
        peerConnection.addTrack(track, localStream);
      }
    });

    // Verify tracks were added
    console.log("🔍 Verifying tracks added to peer connection...");
    const senders = peerConnection.getSenders();
    console.log("📊 Total senders:", senders.length);
    senders.forEach((sender, index) => {
      console.log(`📊 Sender ${index}:`, sender.track?.kind || "no track");
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        // Check if we have a valid session ID
        if (!currentSessionId) {
          console.error(
            "❌ Cannot send ICE candidate: currentSessionId is not set"
          );
          return;
        }

        // Validate ICE candidate data
        if (
          !event.candidate.candidate ||
          event.candidate.candidate.trim() === ""
        ) {
          console.error(
            "❌ Cannot send ICE candidate: candidate data is empty"
          );
          return;
        }

        console.log("🧊 Sending ICE candidate to viewer");
        // Convert RTCIceCandidate to plain object for JSON serialization
        const candidateData = {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          usernameFragment: event.candidate.usernameFragment,
        };

        // Validate candidate data before sending
        if (!candidateData.candidate || candidateData.candidate.trim() === "") {
          console.error(
            "❌ Cannot send ICE candidate: processed candidate data is empty"
          );
          return;
        }

        ws.send(
          JSON.stringify({
            type: "webrtc-ice",
            candidate: candidateData,
            sessionId: currentSessionId,
            target: "viewer",
          })
        );
      }
    };

    // Wait a moment for tracks to be processed
    console.log("⏳ Waiting for tracks to be processed...");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Create and send offer
    console.log("📤 Creating WebRTC offer...");
    const offer = await peerConnection.createOffer();
    console.log("📋 Offer created:", offer);
    console.log("📋 Offer type:", typeof offer);
    console.log("📋 Offer SDP length:", offer?.sdp?.length || 0);
    console.log("📋 Offer SDP preview:", offer?.sdp?.substring(0, 100) + "...");

    if (!offer || !offer.sdp) {
      console.error(
        "❌ Failed to create WebRTC offer - offer is null/undefined or has no SDP"
      );
      console.error("❌ Offer object:", offer);
      return;
    }

    // Validate SDP content
    if (offer.sdp.trim() === "" || offer.sdp.length < 100) {
      console.error(
        "❌ Failed to create WebRTC offer - SDP is too short or empty"
      );
      console.error("❌ SDP length:", offer.sdp.length);
      return;
    }

    await peerConnection.setLocalDescription(offer);
    console.log("📋 Local description set successfully");

    if (ws && ws.readyState === WebSocket.OPEN) {
      // Check if we have a valid session ID
      if (!currentSessionId) {
        console.error("❌ Cannot send offer: currentSessionId is not set");
        return;
      }

      // Convert RTCSessionDescription to plain object for JSON serialization
      const offerData = {
        type: offer.type,
        sdp: offer.sdp,
      };

      // Final validation before sending
      if (!offerData.sdp || offerData.sdp.trim() === "") {
        console.error("❌ Cannot send offer: processed SDP is empty");
        return;
      }

      const message = {
        type: "webrtc-offer",
        offer: offerData,
        sessionId: currentSessionId,
        target: "viewer",
      };
      console.log("📤 Sending offer message:", message);
      console.log("📤 Offer data type:", offerData.type);
      console.log("📤 Offer SDP length:", offerData.sdp.length);

      // CRITICAL: Log the actual JSON string being sent
      const jsonString = JSON.stringify(message);
      console.log("🔍 JSON string length:", jsonString.length);
      console.log(
        "🔍 JSON string preview:",
        jsonString.substring(0, 200) + "..."
      );

      ws.send(jsonString);
      console.log("✅ WebRTC offer sent to viewer");
    }
  } catch (error) {
    console.error("❌ Failed to start screen sharing:", error);
    updateStatus("Failed to start screen sharing: " + error.message);
  }
}

// Handle WebRTC answer from viewer
async function handleWebRTCAnswer(answer) {
  try {
    if (!peerConnection) {
      console.error(
        "❌ No peerConnection available when setting remote answer"
      );
      return;
    }

    // Unwrap and coerce to a proper RTCSessionDescriptionInit
    const normalized =
      answer && answer.sdp
        ? answer
        : answer?.data?.answer || answer?.answer || answer?.data || answer;
    if (!normalized || !normalized.sdp) {
      console.error("❌ Invalid answer payload (missing sdp):", answer);
      return;
    }

    // Guard against duplicate/late answers
    const state = peerConnection.signalingState;
    const alreadySet = !!peerConnection.currentRemoteDescription;
    console.log(
      "🔎 handleWebRTCAnswer state:",
      state,
      "alreadySet:",
      alreadySet
    );
    if (alreadySet || state === "stable") {
      console.log("ℹ️ Skipping remote answer: already set or in stable state");
      return;
    }
    if (state !== "have-local-offer" && state !== "have-local-pranswer") {
      console.warn(
        "⚠️ Skipping remote answer: unexpected signalingState",
        state
      );
      return;
    }

    const desc = new RTCSessionDescription({
      type: "answer",
      sdp: normalized.sdp,
    });
    await peerConnection.setRemoteDescription(desc);
    console.log("✅ WebRTC answer processed successfully");
    updateStatus("WebRTC connection established");

    // Flush any ICE candidates received before the answer was set
    if (pendingIceCandidates && pendingIceCandidates.length > 0) {
      console.log(
        `🧊 Flushing ${pendingIceCandidates.length} queued ICE candidates`
      );
      for (const queued of pendingIceCandidates.splice(0)) {
        try {
          await handleICECandidate(queued);
        } catch (e) {
          console.warn("⚠️ Failed to apply queued ICE candidate:", e);
        }
      }
    }
  } catch (error) {
    // Ignore late/duplicate answers that hit stable state
    const msg = String(error && (error.message || error.name || error));
    if (msg.includes("stable") || msg.includes("InvalidState")) {
      console.warn("ℹ️ Ignoring duplicate/late answer after stable state");
      return;
    }
    console.error("❌ Error handling WebRTC answer:", error);
  }
}

// Handle ICE candidates from viewer
async function handleICECandidate(candidate) {
  try {
    if (!peerConnection) {
      console.warn("⚠️ ICE ignored: no peerConnection");
      return;
    }
    if (!peerConnection.remoteDescription) {
      // Queue until remote answer is applied
      pendingIceCandidates.push(candidate);
      console.warn("⚠️ ICE queued: remoteDescription not set yet");
      return;
    }

    // Normalize candidate to RTCIceCandidateInit
    const raw = candidate && candidate.candidate ? candidate : { candidate };
    const init = {
      candidate: raw.candidate,
      sdpMid: raw.sdpMid ?? null,
      sdpMLineIndex: raw.sdpMLineIndex ?? null,
      usernameFragment: raw.usernameFragment ?? undefined,
    };

    // If both sdpMid and sdpMLineIndex are missing, try to infer sensible defaults
    if (init.sdpMid == null && init.sdpMLineIndex == null) {
      // Prefer video m-line if present
      const senders = peerConnection.getSenders();
      const hasVideo = senders.some((s) => s.track && s.track.kind === "video");
      init.sdpMid = hasVideo ? "video" : "audio";
      init.sdpMLineIndex = hasVideo ? 0 : 0; // fallback to first m-line
    }

    await peerConnection.addIceCandidate(new RTCIceCandidate(init));
    console.log("✅ ICE candidate added successfully");
  } catch (error) {
    console.error("❌ Error adding ICE candidate:", error, candidate);
  }
}

// Handle remote control input using nut.js
async function handleRemoteInput(data) {
  try {
    // Send remote control command to main process via IPC
    if (window.electronAPI && window.electronAPI.sendRemoteInput) {
      await window.electronAPI.sendRemoteInput(data);
    } else {
      console.warn("⚠️ Remote input API not available");
    }
  } catch (error) {
    console.error("❌ Error handling remote input:", error);
  }
}

// Stop screen sharing
function stopScreenShare() {
  console.log("🛑 Stopping screen share...");

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      track.stop();
      console.log("⏹️ Stopped track:", track.kind);
    });
    localStream = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  updateStatus("Screen sharing stopped");
}

// Update the showAgentRunning function to also start WebSocket
function showAgentRunning() {
  const registerBtn = document.getElementById("register-device-btn");
  const agentStatus = document.getElementById("agent-status");

  if (registerBtn) registerBtn.style.display = "none";
  if (agentStatus) agentStatus.classList.remove("hidden");

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

// Background service monitoring
let serviceStartTime = Date.now();
let uptimeInterval;

function startServiceMonitoring() {
  console.log("🖥️ Starting background service monitoring...");

  // Update uptime every second
  uptimeInterval = setInterval(updateServiceUptime, 1000);

  // Check background status periodically
  setInterval(checkBackgroundStatus, 30000); // Every 30 seconds

  // Initial status check
  setTimeout(checkBackgroundStatus, 1000);
}

function updateServiceUptime() {
  const uptimeMs = Date.now() - serviceStartTime;
  const hours = Math.floor(uptimeMs / 3600000);
  const minutes = Math.floor((uptimeMs % 3600000) / 60000);
  const seconds = Math.floor((uptimeMs % 60000) / 1000);

  const uptimeString = `${hours}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  const uptimeDisplay = document.getElementById("uptime-display");
  if (uptimeDisplay) {
    uptimeDisplay.textContent = uptimeString;
  }
}

async function checkBackgroundStatus() {
  try {
    if (window.electronAPI && window.electronAPI.getBackgroundStatus) {
      const status = await window.electronAPI.getBackgroundStatus();

      if (status.success) {
        updateBackgroundStatusUI(status);
      } else {
        console.error("❌ Failed to get background status:", status.error);
      }
    }
  } catch (error) {
    console.error("❌ Error checking background status:", error);
  }
}

function updateBackgroundStatusUI(status) {
  const statusElement = document.getElementById("background-service-status");
  const indicator = document.getElementById("background-status-indicator");

  if (statusElement && indicator) {
    if (status.isVisible) {
      statusElement.textContent = "Active (Visible)";
      statusElement.className = "text-sm text-secondary";
      indicator.className = "w-3 h-3 bg-secondary rounded-full pulse-glow";
    } else if (status.isRunningInBackground) {
      statusElement.textContent = "Running in Background";
      statusElement.className = "text-sm text-blue-400";
      indicator.className = "w-3 h-3 bg-blue-400 rounded-full pulse-glow";
    } else {
      statusElement.textContent = "Unknown Status";
      statusElement.className = "text-sm text-gray-400";
      indicator.className = "w-3 h-3 bg-gray-400 rounded-full";
    }
  }
}

// Update dashboard statistics
function updateDashboardStats() {
    try {
        // Update system uptime
        const uptimeElement = document.querySelector('[data-stat="uptime"]');
        if (uptimeElement && typeof agentStartTime !== 'undefined') {
            const uptime = Date.now() - agentStartTime;
            const hours = Math.floor(uptime / 3600000);
            const minutes = Math.floor((uptime % 3600000) / 60000);
            const seconds = Math.floor((uptime % 60000) / 1000);
            uptimeElement.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        // Update file scan count (mock incremental updates)
        const filesScannedElement = document.querySelector('[data-stat="files-scanned"]');
        if (filesScannedElement) {
            const currentCount = parseInt(filesScannedElement.textContent.replace(/,/g, '')) || 1247892;
            const newCount = currentCount + Math.floor(Math.random() * 100);
            filesScannedElement.textContent = newCount.toLocaleString();
        }

        // Update system boost percentage
        const boostElement = document.querySelector('[data-stat="boost-percentage"]');
        if (boostElement) {
            const currentBoost = parseInt(boostElement.textContent.replace(/[^\d]/g, '')) || 24;
            const newBoost = Math.min(currentBoost + Math.floor(Math.random() * 3) - 1, 35);
            boostElement.textContent = `+${newBoost}%`;
        }

        console.log('📊 Dashboard stats updated');
    } catch (error) {
        console.warn('⚠️ Error updating dashboard stats:', error);
    }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", init);

// Start service monitoring when the page loads
document.addEventListener("DOMContentLoaded", startServiceMonitoring);

console.log("✅ Permanent Access Renderer with WebSocket support loaded");
