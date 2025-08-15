# ScreenShare Full-Screen Viewer

This document explains how to use the new full-screen viewer mode for ScreenShare.

## Overview

The full-screen viewer provides a clean, distraction-free way to view and control remote screens without any UI elements cluttering the display.

## How to Use

### Method 1: Full Screen Button
1. Connect to a session using the regular viewer (`viewer.html`)
2. Once connected, click the **"Full Screen"** button in the top-right corner
3. You'll be redirected to the full-screen viewer (`viewer-fullscreen.html`)

### Method 2: Keyboard Shortcut
1. Connect to a session using the regular viewer
2. Press **F11** to enter full-screen mode
3. Press **F11** again to exit full-screen mode

### Method 3: Direct URL
You can directly access the full-screen viewer by changing the URL:
- Regular viewer: `http://localhost:3000/viewer.html?session=YOUR_SESSION_ID`
- Full-screen viewer: `http://localhost:3000/viewer-fullscreen.html?session=YOUR_SESSION_ID`

## Features

- **Clean Interface**: No headers, buttons, or UI elements
- **Full Screen**: Remote screen takes up the entire browser window
- **Remote Control**: Full mouse and keyboard control support
- **Connection Status**: Minimal status indicator in top-right corner
- **Exit Button**: Small exit button in top-left corner

## Controls

- **Mouse**: Move and click to control the remote computer
- **Keyboard**: Type to send keystrokes to the remote computer
- **F11**: Toggle full-screen mode
- **Exit Button**: Return to regular viewer

## Files

- `viewer-fullscreen.html` - Full-screen viewer interface
- `viewer-fullscreen.js` - Full-screen viewer logic
- `viewer.html` - Updated regular viewer with full-screen button
- `viewer.js` - Updated regular viewer with full-screen functionality

## Browser Compatibility

The full-screen viewer works best in modern browsers that support:
- WebRTC
- Fullscreen API
- ES6+ JavaScript features

## Tips

- Use F11 for quick switching between modes
- The full-screen mode is perfect for presentations or when you need maximum screen real estate
- You can still access the exit button by hovering over the top-left corner
- Connection status is always visible in the top-right corner
