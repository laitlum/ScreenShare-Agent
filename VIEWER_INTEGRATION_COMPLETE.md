a# Complete Viewer Integration Guide

## 🎯 Overview

This guide shows how to integrate the viewer with the agent to support all GetScreen.me-like functionality including mouse wheel scrolling and text selection with mouse drag.

---

## 🖱️ Mouse Wheel Scrolling

### What the Viewer Should Send

```javascript
// Mouse wheel scroll event
{
  action: "wheel",           // or "scroll"
  x: 500,                    // Mouse X position where scroll happened
  y: 300,                    // Mouse Y position where scroll happened
  deltaX: 0,                 // Horizontal scroll (usually 0)
  deltaY: -100,              // Vertical scroll: positive = up, negative = down
  remoteWidth: 1920,         // Agent's screen width
  remoteHeight: 1080         // Agent's screen height
}
```

### Frontend Implementation

```javascript
// Add wheel event listener to video element
videoElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  
  // Get mouse position relative to video element
  const rect = videoElement.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Calculate coordinates in agent screen space
  const agentX = Math.round((x / rect.width) * agentScreenWidth);
  const agentY = Math.round((y / rect.height) * agentScreenHeight);
  
  // Send scroll event to agent
  sendInput({
    action: "wheel",
    x: agentX,
    y: agentY,
    deltaX: e.deltaX,
    deltaY: e.deltaY,
    remoteWidth: agentScreenWidth,
    remoteHeight: agentScreenHeight
  });
});
```

---

## 📝 Mouse Drag Text Selection

### What the Viewer Should Send

```javascript
// Mouse drag selection event
{
  action: "dragSelection",
  startX: 100,               // Start position X
  startY: 200,               // Start position Y
  endX: 300,                 // End position X
  endY: 220,                 // End position Y
  remoteWidth: 1920,         // Agent's screen width
  remoteHeight: 1080         // Agent's screen height
}
```

### Frontend Implementation

```javascript
let isDragging = false;
let dragStart = null;

// Mouse down - start selection
videoElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) { // Left mouse button
    isDragging = true;
    
    const rect = videoElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    dragStart = {
      x: Math.round((x / rect.width) * agentScreenWidth),
      y: Math.round((y / rect.height) * agentScreenHeight)
    };
  }
});

// Mouse up - complete selection
videoElement.addEventListener('mouseup', (e) => {
  if (isDragging && dragStart && e.button === 0) {
    const rect = videoElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const dragEnd = {
      x: Math.round((x / rect.width) * agentScreenWidth),
      y: Math.round((y / rect.height) * agentScreenHeight)
    };
    
    // Send drag selection to agent
    sendInput({
      action: "dragSelection",
      startX: dragStart.x,
      startY: dragStart.y,
      endX: dragEnd.x,
      endY: dragEnd.y,
      remoteWidth: agentScreenWidth,
      remoteHeight: agentScreenHeight
    });
    
    isDragging = false;
    dragStart = null;
  }
});

// Optional: Visual feedback during drag
videoElement.addEventListener('mousemove', (e) => {
  if (isDragging && dragStart) {
    // You can add visual feedback here (selection rectangle overlay)
    // This is optional but improves user experience
  }
});
```

---

## ⌨️ Keyboard Scroll Shortcuts

### What the Viewer Should Send

```javascript
// Scroll up with keyboard
{
  action: "scrollUp"
}

// Scroll down with keyboard
{
  action: "scrollDown"
}
```

### Frontend Implementation

```javascript
// Add keyboard scroll shortcuts
document.addEventListener('keydown', (e) => {
  // Scroll up
  if (e.key === 'PageUp') {
    e.preventDefault();
    sendInput({ action: "scrollUp" });
  }
  
  // Scroll down
  if (e.key === 'PageDown') {
    e.preventDefault();
    sendInput({ action: "scrollDown" });
  }
  
  // Optional: Arrow key scrolling
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    sendInput({ action: "scrollUp" });
  }
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    sendInput({ action: "scrollDown" });
  }
});
```

---

## 🔄 Complete Event Integration

### Full Frontend Implementation Example

```javascript
class ScreenShareViewer {
  constructor(videoElement, agentScreenWidth, agentScreenHeight) {
    this.videoElement = videoElement;
    this.agentScreenWidth = agentScreenWidth;
    this.agentScreenHeight = agentScreenHeight;
    
    this.isDragging = false;
    this.dragStart = null;
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Mouse movement
    this.videoElement.addEventListener('mousemove', (e) => {
      this.handleMouseMove(e);
    });
    
    // Mouse clicks
    this.videoElement.addEventListener('mousedown', (e) => {
      this.handleMouseDown(e);
    });
    
    this.videoElement.addEventListener('mouseup', (e) => {
      this.handleMouseUp(e);
    });
    
    // Mouse wheel scrolling
    this.videoElement.addEventListener('wheel', (e) => {
      this.handleMouseWheel(e);
    });
    
    // Keyboard events
    document.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });
  }
  
  handleMouseMove(e) {
    const coords = this.getAgentCoordinates(e);
    
    sendInput({
      action: "move",
      x: coords.x,
      y: coords.y,
      remoteWidth: this.agentScreenWidth,
      remoteHeight: this.agentScreenHeight
    });
  }
  
  handleMouseDown(e) {
    if (e.button === 0) { // Left mouse button
      this.isDragging = true;
      this.dragStart = this.getAgentCoordinates(e);
    }
    
    // Send click event
    const coords = this.getAgentCoordinates(e);
    sendInput({
      action: "click",
      x: coords.x,
      y: coords.y,
      button: e.button,
      remoteWidth: this.agentScreenWidth,
      remoteHeight: this.agentScreenHeight
    });
  }
  
  handleMouseUp(e) {
    if (this.isDragging && this.dragStart && e.button === 0) {
      const dragEnd = this.getAgentCoordinates(e);
      
      // Send drag selection
      sendInput({
        action: "dragSelection",
        startX: this.dragStart.x,
        startY: this.dragStart.y,
        endX: dragEnd.x,
        endY: dragEnd.y,
        remoteWidth: this.agentScreenWidth,
        remoteHeight: this.agentScreenHeight
      });
      
      this.isDragging = false;
      this.dragStart = null;
    }
  }
  
  handleMouseWheel(e) {
    e.preventDefault();
    
    const coords = this.getAgentCoordinates(e);
    
    sendInput({
      action: "wheel",
      x: coords.x,
      y: coords.y,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      remoteWidth: this.agentScreenWidth,
      remoteHeight: this.agentScreenHeight
    });
  }
  
  handleKeyDown(e) {
    // Text selection shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      sendInput({ action: "selectAll" });
      return;
    }
    
    // Delete selected text
    if (e.key === 'Backspace') {
      e.preventDefault();
      sendInput({ action: "deleteSelected" });
      return;
    }
    
    // Scroll shortcuts
    if (e.key === 'PageUp') {
      e.preventDefault();
      sendInput({ action: "scrollUp" });
      return;
    }
    
    if (e.key === 'PageDown') {
      e.preventDefault();
      sendInput({ action: "scrollDown" });
      return;
    }
    
    // Regular keyboard input
    sendInput({
      action: "keydown",
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey
    });
  }
  
  getAgentCoordinates(event) {
    const rect = this.videoElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    return {
      x: Math.round((x / rect.width) * this.agentScreenWidth),
      y: Math.round((y / rect.height) * this.agentScreenHeight)
    };
  }
}

// Usage
const viewer = new ScreenShareViewer(videoElement, 1920, 1080);
```

---

## 📋 Complete Action Reference

### All Supported Actions

| Action | Purpose | Required Fields |
|--------|---------|----------------|
| `move` | Mouse movement | `x`, `y`, `remoteWidth`, `remoteHeight` |
| `click` | Mouse click | `x`, `y`, `button`, `remoteWidth`, `remoteHeight` |
| `wheel` | Mouse wheel scroll | `x`, `y`, `deltaX`, `deltaY`, `remoteWidth`, `remoteHeight` |
| `dragSelection` | Mouse drag selection | `startX`, `startY`, `endX`, `endY`, `remoteWidth`, `remoteHeight` |
| `keydown` | Keyboard input | `key`, `code`, modifiers |
| `selectAll` | Select all text | None |
| `deleteSelected` | Delete selected text | None |
| `selectAndDelete` | Select and delete text | `startX`, `startY`, `endX`, `endY` |
| `scrollUp` | Scroll up | None |
| `scrollDown` | Scroll down | None |

---

## 🎯 GetScreen.me Feature Parity

### ✅ Implemented Features

1. **Mouse Movement** - Accurate positioning with Windows scaling fix
2. **Mouse Clicks** - Left, right, middle mouse buttons
3. **Mouse Wheel Scrolling** - Vertical and horizontal scrolling
4. **Text Selection** - Mouse drag selection
5. **Keyboard Input** - All keys and modifiers
6. **Cross-Platform Shortcuts** - Cmd+A (Mac), Ctrl+A (Windows/Linux)
7. **Audio Streaming** - System audio capture
8. **Production URLs** - Railway endpoints

### 🔧 Technical Features

- **Windows Display Scaling** - Automatic detection and correction
- **Coordinate Scaling** - Smart scaling between viewer and agent
- **Cross-Platform Support** - Mac, Windows, Linux
- **Real-time Logging** - Complete debugging information
- **Error Handling** - Robust error recovery

---

## 🚀 Ready for Production

Once the viewer implements these events, you'll have full GetScreen.me-like functionality:

- ✅ **Mouse wheel scrolling** in any direction
- ✅ **Text selection** with mouse drag
- ✅ **Keyboard shortcuts** for all operations
- ✅ **Accurate mouse positioning** across all screen resolutions
- ✅ **Cross-platform compatibility**

The agent is ready to handle all these events with proper Windows display scaling support!

