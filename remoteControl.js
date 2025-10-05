const { mouse, left, right, Point, keyboard, Key } = require("@nut-tree-fork/nut-js");
const os = require('os');

// Optional: adjust mouse movement speed
mouse.config.mouseSpeed = 800; // px/sec

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

// Move mouse to coordinates with proper scaling
async function moveMouse(x, y, screenWidth, screenHeight, remoteWidth, remoteHeight, event = null) {
  const logs = []; // Collect logs to return to main process
  
  try {
    const logMessage = `🚀 moveMouse function called with: ${JSON.stringify({ x, y, screenWidth, screenHeight, remoteWidth, remoteHeight })}`;
    console.log(logMessage);
    logs.push(logMessage);
    
    // Detect Windows display scaling and adjust coordinates accordingly
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor;
    
    console.log(`📐 Display scale factor: ${scaleFactor}`);
    logs.push(`📐 Display scale factor: ${scaleFactor}`);
    
    // For Windows display scaling, we need to use physical coordinates
    // instead of logical coordinates for accurate mouse positioning
    let finalX, finalY;
    
    if (process.platform === 'win32' && scaleFactor > 1) {
      // On Windows with display scaling, use physical coordinates
      const physicalWidth = screenWidth * scaleFactor;
      const physicalHeight = screenHeight * scaleFactor;
      
      console.log(`📐 Physical screen dimensions: ${physicalWidth}x${physicalHeight}`);
      logs.push(`📐 Physical screen dimensions: ${physicalWidth}x${physicalHeight}`);
      
      // Scale from remote dimensions to physical screen dimensions
      const scaleX = physicalWidth / remoteWidth;
      const scaleY = physicalHeight / remoteHeight;
      
      finalX = Math.round(x * scaleX);
      finalY = Math.round(y * scaleY);
      
      console.log(`📐 Using physical coordinates for Windows scaling`);
      logs.push(`📐 Using physical coordinates for Windows scaling`);
    } else {
      // For other platforms or no scaling, use logical coordinates
      const scaleX = screenWidth / remoteWidth;
      const scaleY = screenHeight / remoteHeight;
      
      finalX = Math.round(x * scaleX);
      finalY = Math.round(y * scaleY);
      
      console.log(`📐 Using logical coordinates (no scaling)`);
      logs.push(`📐 Using logical coordinates (no scaling)`);
    }
    
    // Use the calculated coordinates
    const absX = finalX;
    const absY = finalY;
    
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
    
    const clampedX = Math.max(0, Math.min(maxX, absX));
    const clampedY = Math.max(0, Math.min(maxY, absY));
    
    // Calculate the actual scale factors used for logging
    let logScaleX, logScaleY;
    if (process.platform === 'win32' && scaleFactor > 1) {
      logScaleX = (screenWidth * scaleFactor) / remoteWidth;
      logScaleY = (screenHeight * scaleFactor) / remoteHeight;
    } else {
      logScaleX = screenWidth / remoteWidth;
      logScaleY = screenHeight / remoteHeight;
    }
    
    const movementLogs = [
      `🖱️ Mouse Movement:`,
      `   Input: (${x}, ${y}) from remote ${remoteWidth}x${remoteHeight}`,
      `   Scale: (${logScaleX.toFixed(3)}, ${logScaleY.toFixed(3)})`,
      `   Calculated: (${absX}, ${absY})`,
      `   Final: (${clampedX}, ${clampedY}) on screen ${screenWidth}x${screenHeight}`
    ];
    
    movementLogs.forEach(log => {
      console.log(log);
      logs.push(log);
    });
    
    // Move the mouse to the calculated position
    // Try multiple approaches to ensure accurate positioning
    const targetPoint = new Point(clampedX, clampedY);
    
    // First, try the standard move
    await mouse.move([targetPoint]);
    
    // Add a small delay to ensure the move is processed
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Get current mouse position for verification
    try {
      const currentPos = await mouse.getPosition();
      const posLog = `📍 Current mouse position after move: (${currentPos.x}, ${currentPos.y})`;
      console.log(posLog);
      logs.push(posLog);
      
      // Check if we're close to the target (within 5 pixels)
      const distance = Math.sqrt(Math.pow(currentPos.x - clampedX, 2) + Math.pow(currentPos.y - clampedY, 2));
      if (distance > 5) {
        const mismatchLog = `⚠️ Mouse position mismatch! Target: (${clampedX}, ${clampedY}), Actual: (${currentPos.x}, ${currentPos.y}), Distance: ${distance.toFixed(1)}px`;
        console.log(mismatchLog);
        logs.push(mismatchLog);
        
        // Try a second move to correct the position
        await mouse.move([targetPoint]);
        const newPos = await mouse.getPosition();
        const secondMoveLog = `🔄 Second move result: (${newPos.x}, ${newPos.y})`;
        console.log(secondMoveLog);
        logs.push(secondMoveLog);
      } else {
        const accurateLog = `✅ Mouse position accurate! Distance: ${distance.toFixed(1)}px`;
        console.log(accurateLog);
        logs.push(accurateLog);
      }
    } catch (posError) {
      const errorLog = `⚠️ Could not verify mouse position: ${posError.message}`;
      console.log(errorLog);
      logs.push(errorLog);
    }
    
    const completionLog = `✅ Mouse move completed to (${clampedX}, ${clampedY})`;
    console.log(completionLog);
    logs.push(completionLog);
    
    return { success: true, x: clampedX, y: clampedY, logs: logs };
  } catch (error) {
    const errorLog = `❌ Mouse move failed: ${error.message}`;
    const errorDetailsLog = `❌ Error details: ${JSON.stringify({
      message: error.message,
      stack: error.stack,
      name: error.name
    })}`;
    
    console.error(errorLog);
    console.error(errorDetailsLog);
    
    logs.push(errorLog);
    logs.push(errorDetailsLog);
    
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
    console.log(`⌨️ pressKey called with: key="${key}", code="${code}", modifiers=${JSON.stringify(modifiers)}`);
    
    // Try to use code first (more reliable for special keys like KeyR, KeyE, etc.)
    let keyToUse = code || key;
    
    // Convert KeyR, KeyE, etc. to just the letter
    if (keyToUse && keyToUse.startsWith('Key') && keyToUse.length === 4) {
      keyToUse = keyToUse.charAt(3).toLowerCase(); // KeyR -> r
      console.log(`🔄 Converted ${code} to ${keyToUse}`);
    }
    
    // Check if it's a modifier key being held
    const isModifier = ['Meta', 'MetaLeft', 'MetaRight', 'Control', 'ControlLeft', 'ControlRight', 
                       'Shift', 'ShiftLeft', 'ShiftRight', 'Alt', 'AltLeft', 'AltRight'].includes(key);
    
    if (isModifier) {
      console.log(`⏸️ Skipping modifier key: ${key} (modifiers should be held, not pressed alone)`);
      return { success: true };
    }

    // Check if we have this key in our keyMap
    if (keyMap[keyToUse]) {
      // Use keyboard.pressKey for mapped keys
      await keyboard.pressKey(keyMap[keyToUse]);
      console.log(`✅ Key pressed from map: ${keyToUse}`);
    } else if (keyToUse && keyToUse.length === 1) {
      // Single character - just type it
      await keyboard.type(keyToUse);
      console.log(`✅ Character typed: ${keyToUse}`);
    } else {
      // Fallback: try to type the original key
      await keyboard.type(key);
      console.log(`✅ Key typed (fallback): ${key}`);
    }

    return { success: true };
  } catch (error) {
    console.error(`❌ Key press failed for key="${key}", code="${code}":`, error.message);
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

module.exports = { 
  moveMouse, 
  moveMouseAbsolute, 
  clickMouse, 
  typeChar, 
  pressKey,
  selectAndDeleteText,
  deleteSelectedText,
  selectAllText
};
