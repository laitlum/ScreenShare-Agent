const { mouse, left, right, Point, keyboard, Key } = require("@nut-tree-fork/nut-js");
const os = require('os');

// Optimize mouse movement speed for low latency
mouse.config.mouseSpeed = 2000; // px/sec - faster for better responsiveness

// Platform detection helper
function getPlatform() {
  return os.platform(); // 'darwin', 'win32', 'linux'
}

function isMac() {
  return os.platform() === 'darwin';
}

function isWindows() {
  return os.platform() === 'win32';
}

function isLinux() {
  return os.platform() === 'linux';
}

// Map incoming key codes from client to nut.js keys
const keyMap = {
  // Arrow keys
  "ArrowUp": Key.Up,
  "ArrowDown": Key.Down,
  "ArrowLeft": Key.Left,
  "ArrowRight": Key.Right,
  
  // Special keys
  "Enter": Key.Enter,
  "Escape": Key.Escape,
  "Backspace": Key.Backspace,
  "Delete": Key.Delete,
  "Tab": Key.Tab,
  "Space": Key.Space,
  " ": Key.Space, // Space character
  
  // Modifiers
  "Control": Key.LeftControl,
  "ControlLeft": Key.LeftControl,
  "ControlRight": Key.RightControl,
  "Alt": Key.LeftAlt,
  "AltLeft": Key.LeftAlt,
  "AltRight": Key.RightAlt,
  "Shift": Key.LeftShift,
  "ShiftLeft": Key.LeftShift,
  "ShiftRight": Key.RightShift,
  "Meta": Key.LeftMeta,
  "MetaLeft": Key.LeftMeta,
  "MetaRight": Key.RightMeta,
  
  // Letters (uppercase keys)
  "A": Key.A, "B": Key.B, "C": Key.C, "D": Key.D, "E": Key.E,
  "F": Key.F, "G": Key.G, "H": Key.H, "I": Key.I, "J": Key.J,
  "K": Key.K, "L": Key.L, "M": Key.M, "N": Key.N, "O": Key.O,
  "P": Key.P, "Q": Key.Q, "R": Key.R, "S": Key.S, "T": Key.T,
  "U": Key.U, "V": Key.V, "W": Key.W, "X": Key.X, "Y": Key.Y,
  "Z": Key.Z,
  
  // Letters (lowercase)
  "a": Key.A, "b": Key.B, "c": Key.C, "d": Key.D, "e": Key.E,
  "f": Key.F, "g": Key.G, "h": Key.H, "i": Key.I, "j": Key.J,
  "k": Key.K, "l": Key.L, "m": Key.M, "n": Key.N, "o": Key.O,
  "p": Key.P, "q": Key.Q, "r": Key.R, "s": Key.S, "t": Key.T,
  "u": Key.U, "v": Key.V, "w": Key.W, "x": Key.X, "y": Key.Y,
  "z": Key.Z,
  
  // Numbers
  "0": Key.Num0, "1": Key.Num1, "2": Key.Num2, "3": Key.Num3, "4": Key.Num4,
  "5": Key.Num5, "6": Key.Num6, "7": Key.Num7, "8": Key.Num8, "9": Key.Num9,
  
  // Function keys
  "F1": Key.F1, "F2": Key.F2, "F3": Key.F3, "F4": Key.F4,
  "F5": Key.F5, "F6": Key.F6, "F7": Key.F7, "F8": Key.F8,
  "F9": Key.F9, "F10": Key.F10, "F11": Key.F11, "F12": Key.F12,
  
  // Special characters
  "-": Key.Minus, "=": Key.Equal, "[": Key.LeftBracket, "]": Key.RightBracket,
  ";": Key.Semicolon, "'": Key.Quote, ",": Key.Comma, ".": Key.Period,
  "/": Key.Slash, "\\": Key.Backslash, "`": Key.Grave,
  
  // Numpad
  "NumPad0": Key.NumPad0, "NumPad1": Key.NumPad1, "NumPad2": Key.NumPad2,
  "NumPad3": Key.NumPad3, "NumPad4": Key.NumPad4, "NumPad5": Key.NumPad5,
  "NumPad6": Key.NumPad6, "NumPad7": Key.NumPad7, "NumPad8": Key.NumPad8,
  "NumPad9": Key.NumPad9,
  
  // Other
  "Home": Key.Home,
  "End": Key.End,
  "PageUp": Key.PageUp,
  "PageDown": Key.PageDown,
  "Insert": Key.Insert,
  "CapsLock": Key.CapsLock,
};

// Move mouse to coordinates with proper scaling - OPTIMIZED FOR SPEED
async function moveMouse(x, y, screenWidth, screenHeight, remoteWidth, remoteHeight, event = null) {
  const logs = []; // Collect logs to return to main process
  
  try {
    // Detect Windows display scaling and adjust coordinates accordingly
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor;
    
    // For Windows display scaling, we need to use physical coordinates
    // instead of logical coordinates for accurate mouse positioning
    let finalX, finalY;
    
    if (process.platform === 'win32' && scaleFactor > 1) {
      // On Windows with display scaling, use physical coordinates
      const physicalWidth = screenWidth * scaleFactor;
      const physicalHeight = screenHeight * scaleFactor;
      
      // Scale from remote dimensions to physical screen dimensions
      const scaleX = physicalWidth / remoteWidth;
      const scaleY = physicalHeight / remoteHeight;
      
      finalX = Math.round(x * scaleX);
      finalY = Math.round(y * scaleY);
    } else {
      // For other platforms or no scaling, use logical coordinates
      const scaleX = screenWidth / remoteWidth;
      const scaleY = screenHeight / remoteHeight;
      
      finalX = Math.round(x * scaleX);
      finalY = Math.round(y * scaleY);
    }
    
    // Clamp to appropriate bounds based on scaling
    let maxX, maxY;
    if (process.platform === 'win32' && scaleFactor > 1) {
      // Use physical bounds for Windows with scaling
      maxX = screenWidth * scaleFactor - 1;
      maxY = screenHeight * scaleFactor - 1;
    } else {
      // Use logical bounds for other cases
      maxX = screenWidth - 1;
      maxY = screenHeight - 1;
    }
    
    const clampedX = Math.max(0, Math.min(maxX, finalX));
    const clampedY = Math.max(0, Math.min(maxY, finalY));
    
    // Move the mouse to the calculated position - OPTIMIZED
    const targetPoint = new Point(clampedX, clampedY);
    await mouse.move([targetPoint]);
    
    // Minimal logging for performance
    logs.push(`🖱️ Mouse moved to (${clampedX}, ${clampedY})`);
    
    return { success: true, logs };
  } catch (error) {
    console.error(`❌ Mouse move failed: ${error.message}`);
    
    logs.push(`❌ Mouse move failed: ${error.message}`);
    
    return { success: false, error: error.message, logs: logs };
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
async function pressKey(key, modifiers = [], code = null) {
  try {
    // Try to use code first (more reliable for special keys like KeyR, KeyE, etc.)
    let keyToUse = code || key;
    
    // Convert KeyR, KeyE, etc. to just the letter
    if (keyToUse && keyToUse.startsWith('Key') && keyToUse.length === 4) {
      keyToUse = keyToUse.charAt(3).toLowerCase(); // KeyR -> r
    }
    
    // Check if it's a modifier key being held
    const isModifier = ['Meta', 'MetaLeft', 'MetaRight', 'Control', 'ControlLeft', 'ControlRight', 
                       'Shift', 'ShiftLeft', 'ShiftRight', 'Alt', 'AltLeft', 'AltRight'].includes(key);
    
    if (isModifier) {
      return { success: true }; // Skip modifier keys
    }

    // Check if we have this key in our keyMap
    if (keyMap[keyToUse]) {
      // Use keyboard.pressKey + releaseKey for a complete key tap
      await keyboard.pressKey(keyMap[keyToUse]);
      await keyboard.releaseKey(keyMap[keyToUse]);
    } else if (keyToUse && keyToUse.length === 1) {
      // Single character - just type it
      await keyboard.type(keyToUse);
    } else {
      // Fallback: try to type the original key
      await keyboard.type(key);
    }

    return { success: true };
  } catch (error) {
    console.error(`❌ Key press failed for key="${key}":`, error.message);
    return { success: false, error: error.message };
  }
}

// Select text from start to end position and delete it with backspace
async function selectAndDeleteText(startX, startY, endX, endY) {
  try {
    const platform = getPlatform();
    console.log(`📝 Selecting text from (${startX}, ${startY}) to (${endX}, ${endY}) on ${platform}`);
    
    // Move to start position and start selection
    await mouse.move([new Point(startX, startY)]);
    await mouse.leftClick();
    
    // Wait a moment for click to register
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Hold shift and drag to end position
    await keyboard.pressKey(Key.LeftShift);
    await mouse.move([new Point(endX, endY)]);
    await mouse.leftClick();
    
    // Release shift
    await keyboard.releaseKey(Key.LeftShift);
    
    // Wait a moment for selection to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Press backspace to delete selected text
    await keyboard.pressKey(Key.Backspace);
    
    console.log(`✅ Text selection and deletion completed on ${platform}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Text selection and deletion failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Delete selected text (assumes text is already selected)
async function deleteSelectedText() {
  try {
    console.log(`🗑️ Deleting selected text`);
    await keyboard.pressKey(Key.Backspace);
    console.log(`✅ Selected text deleted`);
    return { success: true };
  } catch (error) {
    console.error('❌ Text deletion failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Select all text (Ctrl+A on Windows/Linux, Cmd+A on Mac)
async function selectAllText() {
  try {
    const platform = getPlatform();
    
    if (isMac()) {
      console.log(`📄 Selecting all text (Mac: Cmd+A)`);
      await keyboard.pressKey(Key.LeftMeta);  // Cmd key on Mac
      await keyboard.pressKey(Key.A);
      await keyboard.releaseKey(Key.A);
      await keyboard.releaseKey(Key.LeftMeta);
    } else {
      console.log(`📄 Selecting all text (${platform}: Ctrl+A)`);
      await keyboard.pressKey(Key.LeftControl);  // Ctrl key on Windows/Linux
      await keyboard.pressKey(Key.A);
      await keyboard.releaseKey(Key.A);
      await keyboard.releaseKey(Key.LeftControl);
    }
    
    console.log(`✅ All text selected on ${platform}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Select all failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Mouse wheel scroll functionality
async function scrollWheel(x, y, deltaX, deltaY, screenWidth, screenHeight, remoteWidth, remoteHeight) {
  const logs = [];
  
  try {
    // Detect Windows display scaling and adjust coordinates accordingly
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor;
    
    // Calculate scroll position using the same scaling logic as mouse movement
    let finalX, finalY;
    
    if (process.platform === 'win32' && scaleFactor > 1) {
      // On Windows with display scaling, use physical coordinates
      const physicalWidth = screenWidth * scaleFactor;
      const physicalHeight = screenHeight * scaleFactor;
      
      const scaleX = physicalWidth / remoteWidth;
      const scaleY = physicalHeight / remoteHeight;
      
      finalX = Math.round(x * scaleX);
      finalY = Math.round(y * scaleY);
    } else {
      // For other platforms or no scaling, use logical coordinates
      const scaleX = screenWidth / remoteWidth;
      const scaleY = screenHeight / remoteHeight;
      
      finalX = Math.round(x * scaleX);
      finalY = Math.round(y * scaleY);
    }
    
    // Clamp to appropriate bounds based on scaling
    let maxX, maxY;
    if (process.platform === 'win32' && scaleFactor > 1) {
      maxX = screenWidth * scaleFactor - 1;
      maxY = screenHeight * scaleFactor - 1;
    } else {
      maxX = screenWidth - 1;
      maxY = screenHeight - 1;
    }
    
    const clampedX = Math.max(0, Math.min(maxX, finalX));
    const clampedY = Math.max(0, Math.min(maxY, finalY));
    
    // Move mouse to scroll position first - OPTIMIZED
    await mouse.move([new Point(clampedX, clampedY)]);
    
    // Perform scroll with delta values - OPTIMIZED FOR TOUCHPAD
    // Touchpad sends very small delta values (1, 2, 3), need to multiply for visible scroll
    let scrollAmount = Math.abs(deltaY);
    
    // Handle touchpad small delta values
    if (scrollAmount <= 3) {
      scrollAmount = Math.max(3, scrollAmount * 3); // Multiply small deltas for visibility
    }
    
    // Ensure minimum scroll amount for visibility
    scrollAmount = Math.max(scrollAmount, 3);
    
    console.log(`🖱️ Scroll processing: deltaY=${deltaY}, scrollAmount=${scrollAmount}`);
    
    // ✅ FIXED: Inverted scroll direction
    // When user scrolls DOWN (deltaY positive), page should scroll DOWN
    // When user scrolls UP (deltaY negative), page should scroll UP
    if (deltaY > 0) {
      await mouse.scrollDown(scrollAmount);
      console.log(`⬇️ Scrolling DOWN with amount: ${scrollAmount}`);
    } else if (deltaY < 0) {
      await mouse.scrollUp(scrollAmount);
      console.log(`⬆️ Scrolling UP with amount: ${scrollAmount}`);
    }
    
    logs.push(`🖱️ Scrolled at (${clampedX}, ${clampedY}) with deltaY: ${deltaY}`);
    
    return { success: true, x: clampedX, y: clampedY, logs: logs };
  } catch (error) {
    const errorLog = `❌ Mouse scroll failed: ${error.message}`;
    console.error(errorLog);
    logs.push(errorLog);
    
    return { success: false, error: error.message, logs: logs };
  }
}

// Mouse drag selection functionality
async function mouseDragSelection(startX, startY, endX, endY, screenWidth, screenHeight, remoteWidth, remoteHeight) {
  const logs = [];
  
  try {
    const logMessage = `🖱️ mouseDragSelection called with: ${JSON.stringify({ startX, startY, endX, endY, screenWidth, screenHeight, remoteWidth, remoteHeight })}`;
    console.log(logMessage);
    logs.push(logMessage);
    
    // Detect Windows display scaling and adjust coordinates accordingly
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor;
    
    console.log(`📐 Display scale factor: ${scaleFactor}`);
    logs.push(`📐 Display scale factor: ${scaleFactor}`);
    
    // Calculate positions using the same scaling logic as mouse movement
    let finalStartX, finalStartY, finalEndX, finalEndY;
    
    if (process.platform === 'win32' && scaleFactor > 1) {
      // On Windows with display scaling, use physical coordinates
      const physicalWidth = screenWidth * scaleFactor;
      const physicalHeight = screenHeight * scaleFactor;
      
      const scaleX = physicalWidth / remoteWidth;
      const scaleY = physicalHeight / remoteHeight;
      
      finalStartX = Math.round(startX * scaleX);
      finalStartY = Math.round(startY * scaleY);
      finalEndX = Math.round(endX * scaleX);
      finalEndY = Math.round(endY * scaleY);
    } else {
      // For other platforms or no scaling, use logical coordinates
      const scaleX = screenWidth / remoteWidth;
      const scaleY = screenHeight / remoteHeight;
      
      finalStartX = Math.round(startX * scaleX);
      finalStartY = Math.round(startY * scaleY);
      finalEndX = Math.round(endX * scaleX);
      finalEndY = Math.round(endY * scaleY);
    }
    
    // Clamp to appropriate bounds based on scaling
    let maxX, maxY;
    if (process.platform === 'win32' && scaleFactor > 1) {
      maxX = screenWidth * scaleFactor - 1;
      maxY = screenHeight * scaleFactor - 1;
    } else {
      maxX = screenWidth - 1;
      maxY = screenHeight - 1;
    }
    
    const clampedStartX = Math.max(0, Math.min(maxX, finalStartX));
    const clampedStartY = Math.max(0, Math.min(maxY, finalStartY));
    const clampedEndX = Math.max(0, Math.min(maxX, finalEndX));
    const clampedEndY = Math.max(0, Math.min(maxY, finalEndY));
    
    // Perform drag selection
    console.log(`📝 Starting drag selection from (${clampedStartX}, ${clampedStartY}) to (${clampedEndX}, ${clampedEndY})`);
    logs.push(`📝 Starting drag selection from (${clampedStartX}, ${clampedStartY}) to (${clampedEndX}, ${clampedEndY})`);
    
    // Move to start position
    await mouse.move([new Point(clampedStartX, clampedStartY)]);
    
    // Wait a moment for mouse to reach position
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Start drag by holding left mouse button
    await mouse.leftClick();
    
    // Wait a moment for click to register
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Drag to end position while holding button
    await mouse.move([new Point(clampedEndX, clampedEndY)]);
    
    // Wait a moment for drag to complete
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Release mouse button to complete selection
    await mouse.leftClick();
    
    console.log(`✅ Mouse drag selection completed`);
    logs.push(`✅ Mouse drag selection completed`);
    
    return { success: true, logs: logs };
  } catch (error) {
    const errorLog = `❌ Mouse drag selection failed: ${error.message}`;
    console.error(errorLog);
    logs.push(errorLog);
    
    return { success: false, error: error.message, logs: logs };
  }
}

module.exports = { 
  moveMouse, 
  moveMouseAbsolute, 
  clickMouse, 
  typeChar, 
  pressKey,
  selectAndDeleteText,
  deleteSelectedText,
  selectAllText,
  scrollWheel,
  mouseDragSelection
};
