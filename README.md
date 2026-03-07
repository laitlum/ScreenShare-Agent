# 🛡️ Defender Agent - Remote Screen Sharing & Control

A professional remote access agent built with Electron, WebRTC, and WebSocket signaling, featuring zero-lag remote control capabilities for enterprise use.

## 🏗️ Architecture

```
ScreenShare-Agent/
├─ main.js                 # Electron main process
├─ preload.js              # Preload for security-safe IPC
├─ renderer-permanent.js   # Main UI logic and WebRTC handling
├─ renderer.html           # Web UI interface
├─ remoteControl.js        # nut.js mouse/keyboard handling (optimized)
├─ signaling-server.js     # Node WebSocket signaling server
├─ config.js               # Environment-based configuration
├─ env.production          # Production environment variables
├─ package.json
└─ README.md
```

## 🚀 Features

- **High-Performance Screen Sharing**: Real-time screen capture via WebRTC
- **Zero-Lag Remote Control**: Optimized mouse/keyboard control with 2000px/sec speed
- **Touchpad Support**: Enhanced scroll handling for touchpad input
- **Production Ready**: Configured for `https://laitlum.lipiq.in` backend
- **Cross-Platform**: Windows, macOS, and Linux support
- **Enterprise Security**: Context isolation and secure IPC communication

## 📋 Requirements

- **Node.js**: 18+ (recommended)
- **Operating System**: Windows 10+, macOS 10.15+, or Linux
- **Permissions**: 
  - macOS: Screen Recording + Accessibility permissions
  - Windows: Run as Administrator for optimal performance

## 🛠️ First-Time Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd ScreenShare-Agent

# Install dependencies
npm install
```

### 2. Platform-Specific Setup

**For macOS:**
```bash
# Install additional dependencies (if needed)
brew install libpng
```

**For Windows:**
- No additional setup required
- Run Command Prompt as Administrator for best results

## 🎯 Running the Agent Locally

### Option 1: Production Mode (Recommended)
Connect to the live production backend at `https://laitlum.lipiq.in`:

**Windows:**
```cmd
npm run prod
```

**macOS/Linux:**
```bash
env -u ELECTRON_RUN_AS_NODE npm run prod
```

### Option 2: Development Mode
Connect to local development backend:

```bash
# Run both agent and local signaling server
npm run dev:all
```

### Option 3: Custom Backend
If you need to test with a different backend:

**Windows:**
```cmd
npm run prod
```

**macOS/Linux:**
```bash
NODE_ENV=production npm run prod
```

## 🔧 Configuration

The agent automatically detects the environment and uses appropriate URLs:

**Production URLs** (default):
- Backend: `https://laitlum.lipiq.in`
- WebSocket: `wss://laitlum.lipiq.in/ws`

**Development URLs**:
- Backend: `http://localhost:8000`
- WebSocket: `ws://localhost:8081/ws`

Configuration is managed in `config.js` and `env.production` files.

## 🎮 Remote Control Features

- **Mouse Movement**: Ultra-smooth cursor control with coordinate scaling
- **Mouse Clicks**: Left, right, and middle click support
- **Keyboard Input**: Full character typing and special key support
- **Touchpad Scrolling**: Enhanced scroll handling for precise touchpad control
- **Drag & Drop**: Mouse drag operations for text selection
- **Browser Shortcuts**: Cmd/Ctrl+T, Cmd/Ctrl+W, Cmd/Ctrl+R, etc.

## 📱 How It Works

1. **Agent (This App)**:
   - Creates a session via WebSocket connection to backend
   - Captures screen using Electron's desktopCapturer API
   - Establishes WebRTC connection with remote viewer
   - Receives and executes remote control commands with zero latency

2. **Remote Viewer**:
   - Connects to the same backend session
   - Receives screen stream via WebRTC
   - Sends mouse/keyboard events to the agent
   - Views remote screen in real-time

3. **Backend Server**:
   - Manages WebSocket connections and session lifecycle
   - Relays WebRTC signaling (offers/answers/ICE candidates)
   - Forwards input events from viewer to agent
   - Handles authentication and device management

## 🔒 Security Features

- **Context Isolation**: Enabled for maximum security
- **Preload Script**: Secure IPC communication between processes
- **Input Validation**: All remote control events are validated and sanitized
- **Production Backend**: Connects to secure HTTPS/WSS endpoints
- **No Local Network Exposure**: All communication goes through production backend

## 🐛 Troubleshooting

### Common Issues

1. **Agent Won't Start**:
   ```bash
   # Clear any cached files and try again
   rm -rf node_modules package-lock.json
   npm install
   npm run prod
   ```

   **Windows:**
   ```cmd
   rmdir /s node_modules
   del package-lock.json
   npm install
   npm run prod
   ```

2. **Screen Capture Permission Denied** (macOS):
   - Go to System Preferences > Security & Privacy > Privacy > Screen Recording
   - Add the Electron app to allowed applications

3. **Accessibility Permission Required** (macOS):
   - Go to System Preferences > Security & Privacy > Privacy > Accessibility
   - Add the Electron app to allowed applications

4. **Connection Issues**:
   - Verify internet connection
   - Check if `https://laitlum.lipiq.in` is accessible
   - Try running with development mode: `npm run dev:all`

### Debug Mode

Enable detailed logging:

**Windows:**
```cmd
npm run dev
```

**macOS/Linux:**
```bash
NODE_ENV=development npm run dev
```

Check console logs for detailed debugging information.

## 🏭 Building for Production

### Windows EXE
```bash
npm run build:win
```
Creates: `dist/Defender Agent Setup 1.0.0.exe`

### macOS DMG
```bash
npm run build:mac
```
Creates: `dist/Defender Agent-1.0.0.dmg`

### Cross-Platform
```bash
npm run build
```
Creates installers for all platforms.

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Support

For technical support:
- Check the troubleshooting section above
- Review console logs for error messages
- Verify backend connectivity at `https://laitlum.lipiq.in`
- Contact the development team for enterprise support
