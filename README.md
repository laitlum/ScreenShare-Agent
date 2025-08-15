# 🖥️ Electron Remote - Screen Sharing with Remote Control

A modern screen sharing application built with Electron, WebRTC, and WebSocket signaling, featuring remote control capabilities using nut.js.

## 🏗️ Architecture

```
electron-remote/
├─ main.js            # Electron main process
├─ preload.js         # Preload for security-safe IPC
├─ renderer.html      # Web UI with Tailwind CSS
├─ renderer.js        # Web UI logic and WebRTC handling
├─ remoteControl.js   # nut.js mouse/keyboard handling
├─ signaling-server.js# Node WebSocket signaling server
├─ package.json
└─ README.md
```

## 🚀 Features

- **Screen Sharing**: Capture and share your screen via WebRTC
- **Remote Control**: Full mouse and keyboard control from viewer
- **Modern UI**: Beautiful interface built with Tailwind CSS
- **WebSocket Signaling**: Fast, lightweight signaling server
- **Cross-Platform**: Works on Windows, macOS, and Linux

## 📋 Requirements

- Node.js 16+
- Electron 28+
- macOS: Accessibility permissions for remote control

## 🛠️ Installation

1. **Install dependencies:**
   ```bash
   cd electron-remote
   npm install
   ```

2. **Install nut.js dependencies (macOS):**
   ```bash
   # For macOS, you may need additional dependencies
   brew install libpng
   ```

## 🎯 Usage

### Development Mode

1. **Start the signaling server:**
   ```bash
   npm run signaling
   ```

2. **Start the Electron app:**
   ```bash
   npm run dev
   ```

3. **Or run both simultaneously:**
   ```bash
   npm run dev:all
   ```

### Production Mode

1. **Start the signaling server:**
   ```bash
   npm run signaling
   ```

2. **Start the Electron app:**
   ```bash
   npm start
   ```

## 🔧 Configuration

### Signaling Server
- **Port**: 3000 (configurable in `signaling-server.js`)
- **Protocol**: WebSocket
- **Features**: Session management, WebRTC relay, input event forwarding

### Remote Control
- **Library**: nut.js (fork version for better compatibility)
- **Mouse Speed**: 800 px/sec (configurable in `remoteControl.js`)
- **Supported Keys**: Arrow keys, Enter, Escape, Backspace, Cmd/Ctrl shortcuts

## 📱 How It Works

1. **Agent (Electron App)**:
   - Creates a session via WebSocket
   - Captures screen using Electron's desktopCapturer
   - Establishes WebRTC connection with viewer
   - Receives and executes remote control commands

2. **Viewer (Web Browser)**:
   - Joins session using session ID
   - Receives screen stream via WebRTC
   - Sends mouse/keyboard events to agent
   - Views remote screen in real-time

3. **Signaling Server**:
   - Manages WebSocket connections
   - Relays WebRTC offers/answers/ICE candidates
   - Forwards input events from viewer to agent
   - Handles session lifecycle

## 🎮 Remote Control Features

- **Mouse Movement**: Smooth cursor control with coordinate scaling
- **Mouse Clicks**: Left and right click support
- **Keyboard Input**: Character typing and special key support
- **Browser Shortcuts**: Cmd+T (new tab), Cmd+W (close tab), Cmd+R (refresh), Cmd+L (address bar)

## 🔒 Security

- **Context Isolation**: Enabled for security
- **Preload Script**: Secure IPC communication
- **Web Security**: Disabled for screen capture (development only)
- **Input Validation**: All remote control events are validated

## 🐛 Troubleshooting

### Common Issues

1. **Screen Capture Permission Denied**:
   - Ensure the app has screen recording permissions
   - On macOS, check System Preferences > Security & Privacy > Privacy > Screen Recording

2. **Accessibility Permission Required**:
   - On macOS, enable accessibility for the app in System Preferences
   - Required for remote control functionality

3. **WebRTC Connection Failed**:
   - Check if signaling server is running on port 3000
   - Verify firewall settings
   - Check browser console for errors

### Debug Mode

Enable debug logging by setting `NODE_ENV=development`:
```bash
NODE_ENV=development npm run dev
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review the console logs
- Open an issue on GitHub
