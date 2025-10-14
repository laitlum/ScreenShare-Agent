# Viewer Fix Implementation Guide

## 🚨 **Critical Issues Found:**

### 1. **Scrolling Issue:**
- Viewer sends `deltaY: 1` or `deltaY: 2` in logs
- Agent receives `Scroll delta: (0, 0)`
- **Problem:** `deltaX` and `deltaY` are not being passed correctly

### 2. **Drag Selection Issue:**
- No `mousedown` events being sent
- No `dragSelection` action being triggered
- **Problem:** Missing drag detection logic

---

## 🔧 **Fixed Viewer Implementation:**

### **1. Fix Mouse Wheel Scrolling**

```javascript
// Replace your current wheel handler with this:
videoElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  
  const rect = videoElement.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Calculate coordinates in agent screen space
  const agentX = Math.round((x / rect.width) * agentScreenWidth);
  const agentY = Math.round((y / rect.height) * agentScreenHeight);
  
  // CRITICAL FIX: Pass deltaX and deltaY correctly
  const inputData = {
    action: "wheel",
    x: agentX,
    y: agentY,
    deltaX: e.deltaX,  // ← Make sure this is passed
    deltaY: e.deltaY,  // ← Make sure this is passed
    remoteWidth: agentScreenWidth,
    remoteHeight: agentScreenHeight
  };
  
  console.log("Wheel scroll sent:", inputData);
  sendInput(inputData);
});
```

### **2. Fix Mouse Drag Selection**

```javascript
let isDragging = false;
let dragStart = null;

// Add mousedown handler for drag start
videoElement.addEventListener('mousedown', (e) => {
  if (e.button === 0) { // Left mouse button only
    isDragging = true;
    
    const rect = videoElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    dragStart = {
      x: Math.round((x / rect.width) * agentScreenWidth),
      y: Math.round((y / rect.height) * agentScreenHeight)
    };
    
    console.log("Drag started at:", dragStart);
    
    // Send the mousedown event
    const inputData = {
      action: "click",
      x: dragStart.x,
      y: dragStart.y,
      button: e.button,
      remoteWidth: agentScreenWidth,
      remoteHeight: agentScreenHeight
    };
    
    console.log("Mouse down sent:", inputData);
    sendInput(inputData);
  }
});

// Modify mouseup handler for drag completion
videoElement.addEventListener('mouseup', (e) => {
  if (e.button === 0 && isDragging && dragStart) {
    const rect = videoElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const dragEnd = {
      x: Math.round((x / rect.width) * agentScreenWidth),
      y: Math.round((y / rect.height) * agentScreenHeight)
    };
    
    // Calculate distance to determine if it's a drag or click
    const distance = Math.sqrt(
      Math.pow(dragEnd.x - dragStart.x, 2) + 
      Math.pow(dragEnd.y - dragStart.y, 2)
    );
    
    if (distance > 5) { // If moved more than 5 pixels, it's a drag
      console.log("Drag selection:", dragStart, "to", dragEnd);
      
      const inputData = {
        action: "dragSelection",
        startX: dragStart.x,
        startY: dragStart.y,
        endX: dragEnd.x,
        endY: dragEnd.y,
        remoteWidth: agentScreenWidth,
        remoteHeight: agentScreenHeight
      };
      
      console.log("Drag selection sent:", inputData);
      sendInput(inputData);
    } else {
      // It's just a click, send normal click event
      const inputData = {
        action: "click",
        x: dragStart.x,
        y: dragStart.y,
        button: e.button,
        remoteWidth: agentScreenWidth,
        remoteHeight: agentScreenHeight
      };
      
      console.log("Single click sent:", inputData);
      sendInput(inputData);
    }
    
    isDragging = false;
    dragStart = null;
  }
});
```

### **3. Complete Working Implementation**

```javascript
class FixedScreenShareViewer {
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
    
    // Mouse down for drag start
    this.videoElement.addEventListener('mousedown', (e) => {
      this.handleMouseDown(e);
    });
    
    // Mouse up for drag end or click
    this.videoElement.addEventListener('mouseup', (e) => {
      this.handleMouseUp(e);
    });
    
    // Mouse wheel scrolling - FIXED
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
      
      console.log("🖱️ Drag started at:", this.dragStart);
      
      // Send mousedown event
      sendInput({
        action: "click",
        x: this.dragStart.x,
        y: this.dragStart.y,
        button: e.button,
        remoteWidth: this.agentScreenWidth,
        remoteHeight: this.agentScreenHeight
      });
    }
  }
  
  handleMouseUp(e) {
    if (this.isDragging && this.dragStart && e.button === 0) {
      const dragEnd = this.getAgentCoordinates(e);
      
      // Calculate drag distance
      const distance = Math.sqrt(
        Math.pow(dragEnd.x - this.dragStart.x, 2) + 
        Math.pow(dragEnd.y - this.dragStart.y, 2)
      );
      
      if (distance > 5) { // It's a drag selection
        console.log("📝 Drag selection:", this.dragStart, "→", dragEnd);
        
        sendInput({
          action: "dragSelection",
          startX: this.dragStart.x,
          startY: this.dragStart.y,
          endX: dragEnd.x,
          endY: dragEnd.y,
          remoteWidth: this.agentScreenWidth,
          remoteHeight: this.agentScreenHeight
        });
      } else { // It's just a click
        console.log("🖱️ Single click at:", this.dragStart);
        
        sendInput({
          action: "click",
          x: this.dragStart.x,
          y: this.dragStart.y,
          button: e.button,
          remoteWidth: this.agentScreenWidth,
          remoteHeight: this.agentScreenHeight
        });
      }
      
      this.isDragging = false;
      this.dragStart = null;
    }
  }
  
  handleMouseWheel(e) {
    e.preventDefault();
    
    const coords = this.getAgentCoordinates(e);
    
    // CRITICAL: Pass deltaX and deltaY correctly
    const inputData = {
      action: "wheel",
      x: coords.x,
      y: coords.y,
      deltaX: e.deltaX,  // ← This was missing!
      deltaY: e.deltaY,  // ← This was missing!
      remoteWidth: this.agentScreenWidth,
      remoteHeight: this.agentScreenHeight
    };
    
    console.log("🖱️ Wheel scroll sent:", inputData);
    sendInput(inputData);
  }
  
  handleKeyDown(e) {
    // Prevent default for scroll keys
    if (['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
    }
    
    // Scroll shortcuts
    if (e.key === 'PageUp') {
      console.log("⬆️ PageUp scroll");
      sendInput({ action: "scrollUp" });
      return;
    }
    
    if (e.key === 'PageDown') {
      console.log("⬇️ PageDown scroll");
      sendInput({ action: "scrollDown" });
      return;
    }
    
    if (e.key === 'ArrowUp') {
      console.log("⬆️ ArrowUp scroll");
      sendInput({ action: "scrollUp" });
      return;
    }
    
    if (e.key === 'ArrowDown') {
      console.log("⬇️ ArrowDown scroll");
      sendInput({ action: "scrollDown" });
      return;
    }
    
    // Text selection shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      console.log("📄 Select All");
      sendInput({ action: "selectAll" });
      return;
    }
    
    // Delete selected text
    if (e.key === 'Backspace') {
      e.preventDefault();
      console.log("🗑️ Delete selected");
      sendInput({ action: "deleteSelected" });
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
const viewer = new FixedScreenShareViewer(videoElement, 1920, 1080);
```

---

## 🎯 **Key Fixes:**

1. **Scrolling:** Ensure `deltaX` and `deltaY` are passed in the `wheel` event
2. **Drag Selection:** Add `mousedown` handler and proper drag detection logic
3. **Distance Calculation:** Only trigger drag selection if mouse moved > 5 pixels
4. **Event Prevention:** Prevent default browser behavior for scroll keys

## 📋 **Expected Console Logs After Fix:**

```
🖱️ Wheel scroll sent: {action: "wheel", x: 805, y: 521, deltaX: 0, deltaY: -100, ...}
📝 Drag selection: {x: 100, y: 200} → {x: 300, y: 220}
🖱️ Drag started at: {x: 100, y: 200}
```

This should fix both scrolling and drag selection issues!

