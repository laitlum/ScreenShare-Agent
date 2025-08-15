const { mouse, left, right, Point, keyboard, Key } = require("@nut-tree-fork/nut-js");

// Optional: adjust mouse movement speed
mouse.config.mouseSpeed = 800; // px/sec

// Map incoming key codes from client to nut.js keys
const keyMap = {
  "ArrowUp": Key.Up,
  "ArrowDown": Key.Down,
  "ArrowLeft": Key.Left,
  "ArrowRight": Key.Right,
  "Enter": Key.Enter,
  "Escape": Key.Escape,
  "Backspace": Key.Backspace,
  "Control": Key.LeftControl,
  "Alt": Key.LeftAlt,
  "Shift": Key.LeftShift,
  "Meta": Key.LeftMeta, // Added Meta key for Cmd on Mac
  "Tab": Key.Tab,
  "t": Key.T,
  "w": Key.W,
  "r": Key.R,
  "l": Key.L,
};

// Move mouse to coordinates with proper scaling
async function moveMouse(x, y, screenWidth, screenHeight, remoteWidth, remoteHeight) {
  try {
    const scaleX = screenWidth / remoteWidth;
    const scaleY = screenHeight / remoteHeight;
    const absX = Math.round(x * scaleX);
    const absY = Math.round(y * scaleY);
    
    console.log(`🖱️ Moving mouse: (${x}, ${y}) -> (${absX}, ${absY})`);
    console.log(`🖱️ Scale: ${scaleX.toFixed(2)}x, ${scaleY.toFixed(2)}y`);
    
    await mouse.move([new Point(absX, absY)]);
    return { success: true, x: absX, y: absY };
  } catch (error) {
    console.error('❌ Mouse move failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Move mouse to absolute screen coordinates (already scaled)
async function moveMouseAbsolute(absX, absY) {
  try {
    const clampedX = Math.max(0, Math.round(absX));
    const clampedY = Math.max(0, Math.round(absY));
    await mouse.move([new Point(clampedX, clampedY)]);
    return { success: true };
  } catch (error) {
    console.error('❌ Absolute mouse move failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Click mouse at current position
async function clickMouse(button = "left") {
  try {
    if (button === "right") {
      await mouse.rightClick();
    } else {
      await mouse.leftClick();
    }
    console.log(`✅ Mouse click executed: ${button} button`);
    return { success: true };
  } catch (error) {
    console.error('❌ Mouse click failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Type a character
async function typeChar(char) {
  try {
    await keyboard.type(char);
    console.log(`✅ Character typed: ${char}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Character typing failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Handle special key presses
async function pressKey(key, modifiers = []) {
  try {
    let keyToPress = key;

    // Handle special cases
    if (key === 't' && modifiers.includes('meta')) {
      // New tab (Cmd+T on Mac)
      await keyboard.pressKey(Key.T, ['meta']);
      console.log('✅ New tab shortcut executed (Cmd+T)');
    } else if (key === 'w' && modifiers.includes('meta')) {
      // Close tab (Cmd+W on Mac)
      await keyboard.pressKey(Key.W, ['meta']);
      console.log('✅ Close tab shortcut executed (Cmd+W)');
    } else if (key === 'r' && modifiers.includes('meta')) {
      // Refresh (Cmd+R on Mac)
      await keyboard.pressKey(Key.R, ['meta']);
      console.log('✅ Refresh shortcut executed (Cmd+R)');
    } else if (key === 'l' && modifiers.includes('meta')) {
      // Focus address bar (Cmd+L on Mac)
      await keyboard.pressKey(Key.L, ['meta']);
      console.log('✅ Address bar focus shortcut executed (Cmd+L)');
    } else if (keyMap[key]) {
      // Standard key
      await keyboard.pressKey(keyMap[key]);
      console.log(`✅ Key pressed: ${key}`);
    } else {
      // Regular character
      await keyboard.type(key);
      console.log(`✅ Key typed: ${key}`);
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Key press failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { moveMouse, moveMouseAbsolute, clickMouse, typeChar, pressKey };
