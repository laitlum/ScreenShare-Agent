# Cross-Platform Support Guide

## 🖥️ Platform Detection

The agent now automatically detects the operating system and uses the correct keyboard shortcuts for each platform:

### Windows
- **Select All:** `Ctrl+A`
- **Copy:** `Ctrl+C` 
- **Paste:** `Ctrl+V`
- **Cut:** `Ctrl+X`

### Mac
- **Select All:** `Cmd+A`
- **Copy:** `Cmd+C`
- **Paste:** `Cmd+V` 
- **Cut:** `Cmd+X`

### Linux
- **Select All:** `Ctrl+A`
- **Copy:** `Ctrl+C`
- **Paste:** `Ctrl+V`
- **Cut:** `Ctrl+X`

## 🔧 How It Works

The agent uses Node.js's `os.platform()` to detect the operating system:

```javascript
const os = require('os');

function isMac() {
  return os.platform() === 'darwin';
}

function isWindows() {
  return os.platform() === 'win32';
}

function isLinux() {
  return os.platform() === 'linux';
}
```

## 📝 Text Selection Functions

### 1. Select All Text
```javascript
// Automatically uses Cmd+A on Mac, Ctrl+A on Windows/Linux
{
  action: "selectAll"
}
```

**Console Output:**
- Mac: `📄 Selecting all text (Mac: Cmd+A)`
- Windows: `📄 Selecting all text (win32: Ctrl+A)`
- Linux: `📄 Selecting all text (linux: Ctrl+A)`

### 2. Select and Delete Text
```javascript
// Works the same on all platforms (uses Shift+Click)
{
  action: "selectAndDelete",
  startX: 100, startY: 200,
  endX: 300, endY: 220
}
```

**Console Output:**
- `📝 Selecting text from (100, 200) to (300, 220) on darwin`
- `📝 Selecting text from (100, 200) to (300, 220) on win32`
- `📝 Selecting text from (100, 200) to (300, 220) on linux`

### 3. Delete Selected Text
```javascript
// Backspace works the same on all platforms
{
  action: "deleteSelected"
}
```

## 🧪 Testing on Different Platforms

### Mac Testing
1. Install the agent on a Mac
2. Test text selection - should use `Cmd+A`
3. Check console logs for `darwin` platform detection

### Windows Testing  
1. Install the agent on Windows
2. Test text selection - should use `Ctrl+A`
3. Check console logs for `win32` platform detection

### Linux Testing
1. Install the agent on Linux
2. Test text selection - should use `Ctrl+A`
3. Check console logs for `linux` platform detection

## 🔍 Console Log Examples

### Mac Console Output
```
📄 Selecting all text (Mac: Cmd+A)
✅ All text selected on darwin
```

### Windows Console Output
```
📄 Selecting all text (win32: Ctrl+A)
✅ All text selected on win32
```

### Linux Console Output
```
📄 Selecting all text (linux: Ctrl+A)
✅ All text selected on linux
```

## 🚀 Benefits

1. **Automatic Detection:** No need to manually specify platform
2. **Native Behavior:** Uses the correct shortcuts users expect
3. **Consistent Experience:** Same functionality across all platforms
4. **Future-Proof:** Easy to add more platform-specific features

## 🔧 Adding More Platform-Specific Features

To add more platform-specific functionality:

```javascript
async function copyText() {
  const platform = getPlatform();
  
  if (isMac()) {
    await keyboard.pressKey(Key.LeftMeta);  // Cmd+C
    await keyboard.pressKey(Key.C);
    await keyboard.releaseKey(Key.C);
    await keyboard.releaseKey(Key.LeftMeta);
  } else {
    await keyboard.pressKey(Key.LeftControl);  // Ctrl+C
    await keyboard.pressKey(Key.C);
    await keyboard.releaseKey(Key.C);
    await keyboard.releaseKey(Key.LeftControl);
  }
}
```

## 📋 Platform Detection Summary

| Platform | os.platform() | Select All | Copy | Paste | Cut |
|----------|---------------|------------|------|-------|-----|
| macOS | `'darwin'` | `Cmd+A` | `Cmd+C` | `Cmd+V` | `Cmd+X` |
| Windows | `'win32'` | `Ctrl+A` | `Ctrl+C` | `Ctrl+V` | `Ctrl+X` |
| Linux | `'linux'` | `Ctrl+A` | `Ctrl+C` | `Ctrl+V` | `Ctrl+X` |

The agent now works seamlessly across all platforms! 🎉

