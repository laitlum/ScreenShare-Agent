# Viewer Integration Guide for Mouse Coordinates

## The Problem

The viewer is receiving the agent's screen as a video stream, which may have different dimensions than the actual agent screen.

**Example:**
- Agent screen: 1470x956 (actual physical screen)
- Video track: 1920x1080 (or some scaled version)
- Viewer display: Any size (could be 800x600, 1920x1080, etc.)

## The Solution

The agent now sends its **actual screen dimensions** in the WebRTC offer:

```javascript
{
  type: "webrtc-offer",
  offer: { ... },
  screenWidth: 1470,   // ← Agent's actual screen width
  screenHeight: 956,   // ← Agent's actual screen height
  sessionId: "..."
}
```

## How Viewer Should Send Mouse Coordinates

### Option 1: Send Relative Position (0.0 to 1.0) - RECOMMENDED ✅

```javascript
// When user clicks at pixel (400, 200) in the video element
const videoRect = videoElement.getBoundingClientRect();
const relativeX = event.clientX / videoRect.width;   // 0.0 to 1.0
const relativeY = event.clientY / videoRect.height;  // 0.0 to 1.0

// Send to agent
sendMouseInput({
  action: 'click',
  x: relativeX * agentScreenWidth,  // Use agent's screen dimensions!
  y: relativeY * agentScreenHeight,
  remoteWidth: agentScreenWidth,    // Use agent's screen dimensions!
  remoteHeight: agentScreenHeight
});
```

### Option 2: Send Video-Space Coordinates

```javascript
// Get video track dimensions (from video element or track settings)
const videoTrack = videoElement.srcObject.getVideoTracks()[0];
const { width: videoWidth, height: videoHeight } = videoTrack.getSettings();

// Calculate position in video space
const videoRect = videoElement.getBoundingClientRect();
const scaleX = videoWidth / videoRect.width;
const scaleY = videoHeight / videoRect.height;

const videoX = (event.clientX - videoRect.left) * scaleX;
const videoY = (event.clientY - videoRect.top) * scaleY;

// Send to agent
sendMouseInput({
  action: 'click',
  x: videoX,
  y: videoY,
  remoteWidth: agentScreenWidth,    // Use agent's actual screen dimensions
  remoteHeight: agentScreenHeight   // NOT video dimensions!
});
```

## Current Issue

Looking at the logs, the viewer is sending:
```
x: 1616, remoteWidth: 1700, remoteHeight: 956
```

But the agent screen is actually 1470x956, not 1700x956.

**This causes:**
- At x=850 (50% of 1700): Agent gets 850 * (1470/1700) = 735 pixels → Slightly left ✅ (works)
- At x=1616 (95% of 1700): Agent gets 1616 * (1470/1700) = 1397 pixels → Too far left! ❌

The viewer is using the VIDEO TRACK dimensions (1700), not the AGENT SCREEN dimensions (1470).

## Fix for Viewer

### Step 1: Store agent screen dimensions from the offer

```javascript
peerConnection.addEventListener('track', (event) => {
  // Handle video track
});

// When receiving the offer, extract screen dimensions
let agentScreenWidth, agentScreenHeight;

webSocket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'webrtc-offer') {
    agentScreenWidth = data.screenWidth;    // Store this!
    agentScreenHeight = data.screenHeight;  // Store this!
    
    // Process the offer
    await peerConnection.setRemoteDescription(data.offer);
  }
});
```

### Step 2: Use agent screen dimensions when sending mouse events

```javascript
function handleMouseMove(event) {
  const videoRect = videoElement.getBoundingClientRect();
  
  // Calculate relative position (0.0 to 1.0)
  const relX = (event.clientX - videoRect.left) / videoRect.width;
  const relY = (event.clientY - videoRect.top) / videoRect.height;
  
  // Map to agent's actual screen space
  const x = Math.round(relX * agentScreenWidth);
  const y = Math.round(relY * agentScreenHeight);
  
  sendInput({
    type: 'viewer-input',
    action: 'move',
    x: x,
    y: y,
    remoteWidth: agentScreenWidth,    // ← Use agent's screen dimensions!
    remoteHeight: agentScreenHeight   // ← Use agent's screen dimensions!
  });
}
```

## Why This Works

1. User clicks at 95% across the video element
2. Viewer calculates: `relX = 0.95`
3. Viewer sends: `x = 0.95 * 1470 = 1396`, `remoteWidth = 1470`
4. Agent receives: `x = 1396`, `remoteWidth = 1470`
5. Agent scales: `1396 * (1470/1470) = 1396` ✅ Correct!

This works **regardless of**:
- Video resolution (1920x1080, 1280x720, etc.)
- Viewer window size
- Display scaling
- Any resolution mismatch

## Testing

After implementing the fix in the viewer, you should see coordinates that match across the entire screen, from 0% to 100%.

Console logs on agent should show:
```
🖱️ Input: (1396, 956) | Remote: 1470x956
🖱️ Scale: (1.000, 1.000) | Screen: 1470x956
🖱️ Output: (1396, 956) → Clamped: (1396, 956)
```

Notice how `remoteWidth` now matches `screenWidth`!



