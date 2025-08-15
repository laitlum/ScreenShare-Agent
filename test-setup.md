# Testing ScreenShare on Same Machine

## Quick Test Setup

### 1. Start the Server
```bash
cd electron-remote
node http-server.js
```

### 2. Open Two Browser Windows
**Window 1 (Agent):**
- Open: `http://localhost:3000/renderer.html`
- This will be your "remote" computer

**Window 2 (Viewer):**
- Open: `http://localhost:3000/viewer.html`
- This will be your "viewer" computer

### 3. Test Flow
1. **In Agent Window:**
   - Click "Start Sharing"
   - Allow screen sharing permissions
   - Copy the session ID (e.g., `ABC123`)

2. **In Viewer Window:**
   - Paste the session ID
   - Click "Connect"
   - You should see your own screen!

3. **Test Full-Screen:**
   - Click "Full Screen" button
   - Or press F11
   - Test the clean interface

### 4. Test Remote Control
- Move mouse over the shared screen
- Click to test interactions
- Type to test keyboard input

## Alternative: Use Different Browsers

**Chrome (Agent):** `http://localhost:3000/renderer.html`
**Firefox (Viewer):** `http://localhost:3000/viewer.html`

## Alternative: Use Incognito/Private Mode

**Regular Chrome (Agent):** `http://localhost:3000/renderer.html`
**Incognito Chrome (Viewer):** `http://localhost:3000/viewer.html`

## Testing Full-Screen Mode

### Test 1: Button Navigation
1. Connect to session
2. Click "Full Screen" button
3. Verify redirect to `viewer-fullscreen.html`
4. Verify session ID is preserved

### Test 2: Keyboard Shortcut (F11)
1. Connect to session
2. Press F11
3. Verify full-screen mode
4. Press F11 again to exit

### Test 3: Direct URL Access
1. Get session ID from agent
2. Directly open: `http://localhost:3000/viewer-fullscreen.html?session=YOUR_SESSION_ID`
3. Verify connection works

### Test 4: Exit Full-Screen
1. In full-screen mode, click "Exit Fullscreen" button
2. Verify return to regular viewer
3. Verify session is maintained

## Common Issues & Solutions

### Issue: "No session ID provided"
**Solution:** Make sure you're connecting to an active session first

### Issue: Screen not showing
**Solution:** Check browser console for WebRTC errors, ensure permissions granted

### Issue: Full-screen not working
**Solution:** Verify both HTML and JS files are in the same directory

### Issue: Session lost on full-screen switch
**Solution:** Check that session ID is properly passed in URL

## Debug Mode

Add this to browser console for debugging:
```javascript
// Enable verbose logging
localStorage.setItem('debug', 'true');
// Reload page
location.reload();
```

## Performance Testing

1. **Test with different screen resolutions**
2. **Test with multiple monitors**
3. **Test with high-DPI displays**
4. **Test with different browsers**

## Security Testing

1. **Test with different session IDs**
2. **Test with invalid session IDs**
3. **Test with expired sessions**
4. **Test with multiple viewers**
