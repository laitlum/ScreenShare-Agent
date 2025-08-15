# 📱 Mobile Testing Guide for ScreenShare

This guide explains how to test the ScreenShare application using your mobile device as a viewer while your computer acts as the agent.

## 🚀 Quick Setup

### Step 1: Find Your Computer's Local IP Address

**On macOS:**
```bash
# Method 1: Using ipconfig (recommended)
ipconfig getifaddr en0

# Method 2: Using ifconfig
ifconfig | grep "inet " | grep -v 127.0.0.1

# Method 3: System Preferences
# System Preferences → Network → Wi-Fi → Advanced → TCP/IP → IP Address
```

**On Windows:**
```bash
ipconfig | findstr "IPv4"
```

**On Linux:**
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
```

Look for an IP like `192.168.1.xxx`, `10.0.0.xxx`, or `172.16.xxx.xxx`

### Step 2: Start the Server

```bash
cd electron-remote
node signaling-server.js
```

You should see:
```
🚀 Combined HTTP + WebSocket server running on port 3000
📱 Local access: http://localhost:3000
📱 Network access: http://YOUR_LOCAL_IP:3000
```

### Step 3: Test Network Connectivity

**From your computer:**
```bash
# Test if the server is accessible from network
curl http://YOUR_LOCAL_IP:3000

# Or use the test script
node test-server.js
```

## 📱 Mobile Device Setup

### Prerequisites
- **Same WiFi Network**: Both devices must be on the same WiFi network
- **Modern Browser**: Use Chrome, Safari, or Firefox (latest versions)
- **Permissions**: Allow camera/microphone access when prompted

### Step 1: Open Mobile Browser
Navigate to: `http://YOUR_LOCAL_IP:3000/viewer.html`

**Example:**
- If your computer IP is `192.168.1.100`
- Use: `http://192.168.1.100:3000/viewer.html`

### Step 2: Test Full-Screen Mode
Navigate to: `http://YOUR_LOCAL_IP:3000/viewer-fullscreen.html`

**Example:**
- `http://192.168.1.100:3000/viewer-fullscreen.html`

## 🔄 Testing Flow

### 1. Computer (Agent)
1. Open: `http://localhost:3000/renderer.html`
2. Click "Start Sharing"
3. Allow screen sharing permissions
4. Copy the session ID (e.g., `ABC123`)

### 2. Mobile (Viewer)
1. Open: `http://YOUR_LOCAL_IP:3000/viewer.html`
2. Paste the session ID
3. Click "Connect"
4. You should see your computer's screen!

### 3. Test Full-Screen
1. Click "Full Screen" button
2. Or directly open: `http://YOUR_LOCAL_IP:3000/viewer-fullscreen.html?session=ABC123`

## 🧪 Testing Scenarios

### Scenario 1: Basic Connection
- [ ] Mobile can connect to computer
- [ ] Screen is visible on mobile
- [ ] Connection status shows "Connected"

### Scenario 2: Full-Screen Mode
- [ ] Full-screen button works
- [ ] No UI elements visible
- [ ] Remote screen fills entire mobile screen
- [ ] Exit button is accessible

### Scenario 3: Remote Control
- [ ] Touch events are sent to computer
- [ ] Mouse movements are tracked
- [ ] Keyboard input works (if mobile keyboard is used)

### Scenario 4: Network Performance
- [ ] Video quality is acceptable
- [ ] Latency is reasonable
- [ ] Connection is stable

## 🔧 Troubleshooting

### Issue: "Cannot connect to server"
**Solutions:**
1. Verify both devices are on same WiFi network
2. Check firewall settings on computer
3. Ensure server is running on `0.0.0.0:3000`
4. Test with `ping YOUR_LOCAL_IP` from mobile

### Issue: "Screen not showing"
**Solutions:**
1. Check browser console for WebRTC errors
2. Verify WebRTC permissions are granted
3. Check if STUN server is accessible
4. Try refreshing the page

### Issue: "Connection lost"
**Solutions:**
1. Check WiFi signal strength
2. Verify computer doesn't go to sleep
3. Check for network interference
4. Restart the server

### Issue: "Poor video quality"
**Solutions:**
1. Check WiFi bandwidth
2. Reduce screen resolution on computer
3. Close unnecessary applications
4. Move closer to WiFi router

## 📊 Performance Testing

### Network Metrics
- **Latency**: Should be < 100ms
- **Bandwidth**: Should be > 5 Mbps
- **Packet Loss**: Should be < 1%

### Mobile-Specific Tests
1. **Different Orientations**: Portrait vs Landscape
2. **Screen Resolutions**: Test on different mobile devices
3. **Browser Types**: Chrome, Safari, Firefox
4. **Network Conditions**: WiFi vs Mobile data (if possible)

## 🎯 Advanced Testing

### Test 1: Multiple Viewers
1. Connect mobile viewer
2. Connect another computer viewer
3. Verify both can see the same screen

### Test 2: Session Persistence
1. Connect mobile viewer
2. Refresh mobile browser
3. Verify session reconnects automatically

### Test 3: Network Switching
1. Connect mobile viewer
2. Switch mobile to different WiFi network
3. Verify connection drops gracefully

### Test 4: Battery Impact
1. Monitor mobile battery usage
2. Test with different screen brightness
3. Check for memory leaks

## 📱 Mobile-Specific Features

### Touch Controls
- **Single Tap**: Left click
- **Long Press**: Right click
- **Pinch/Zoom**: May interfere with remote control

### Browser Limitations
- **Safari**: Best WebRTC support on iOS
- **Chrome**: Best WebRTC support on Android
- **Firefox**: Good cross-platform support

### Performance Tips
1. **Close other apps** on mobile
2. **Use WiFi** instead of mobile data
3. **Reduce screen brightness** to save battery
4. **Keep mobile plugged in** during testing

## 🚨 Security Considerations

### Network Security
- **Local Network Only**: Server only accessible on local network
- **No Authentication**: Anyone on network can connect
- **Session IDs**: Random but not cryptographically secure

### Recommendations
1. **Use VPN** for remote testing
2. **Implement authentication** for production use
3. **Monitor network traffic** for unusual activity
4. **Regular security updates** for dependencies

## 📋 Testing Checklist

- [ ] Server starts on all network interfaces
- [ ] Mobile can access server via local IP
- [ ] Connection establishes successfully
- [ ] Screen sharing works
- [ ] Full-screen mode functions
- [ ] Remote control works
- [ ] Performance is acceptable
- [ ] Connection is stable
- [ ] Error handling works
- [ ] Mobile browser compatibility verified

## 🎉 Success Indicators

✅ **Mobile can see computer screen**
✅ **Full-screen mode works without UI elements**
✅ **Remote control functions properly**
✅ **Connection remains stable**
✅ **Performance is acceptable on mobile**

## 🔗 Quick Test URLs

**Replace `YOUR_LOCAL_IP` with your actual IP address:**

- **Regular Viewer**: `http://YOUR_LOCAL_IP:3000/viewer.html`
- **Full-Screen Viewer**: `http://YOUR_LOCAL_IP:3000/viewer-fullscreen.html`
- **Agent**: `http://localhost:3000/renderer.html` (on computer)

## 💡 Pro Tips

1. **Use your phone's hotspot** to test with different networks
2. **Test with different mobile devices** (iOS, Android)
3. **Monitor network usage** during testing
4. **Keep a log** of any issues encountered
5. **Test in different environments** (home, office, coffee shop)
