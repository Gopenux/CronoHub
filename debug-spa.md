# Debug SPA Navigation Detection

## Testing Steps

1. **Load the extension** in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `/home/gopenux/Projects/CronoHub` folder

2. **Open GitHub issues list**:
   - Navigate to: `https://github.com/Gopenux/Mark/issues`

3. **Open Chrome DevTools** (F12):
   - Go to the "Console" tab
   - Filter by "CronoHub" to see only extension logs

4. **Click on an issue** from the list (e.g., #103)

## Expected Console Logs

When SPA navigation works correctly, you should see:

```
CronoHub: Content script loaded
CronoHub: Initialized
CronoHub: Issue detected {owner: "Gopenux", repo: "Mark", number: ..., title: "..."}

[When clicking on an issue from the list]
CronoHub: pushState detected                    ← History API intercepted
CronoHub: URL changed to https://github.com/Gopenux/Mark/issues/103
CronoHub: Waiting for DOM... retry 1 in 50ms
CronoHub: Issue DOM ready, detecting...
CronoHub: Issue detected {owner: "Gopenux", repo: "Mark", number: 103, ...}
```

OR (if using Turbo/PJAX):

```
CronoHub: turbo:load event detected             ← GitHub's Turbo framework
CronoHub: URL changed to https://github.com/Gopenux/Mark/issues/103
CronoHub: Issue DOM ready, detecting...
CronoHub: Issue detected {owner: "Gopenux", repo: "Mark", number: 103, ...}
```

OR (if using MutationObserver):

```
CronoHub: URL change detected via MutationObserver
CronoHub: URL changed to https://github.com/Gopenux/Mark/issues/103
CronoHub: Waiting for DOM... retry 1 in 50ms
CronoHub: Waiting for DOM... retry 2 in 80ms
CronoHub: Issue DOM ready, detecting...
CronoHub: Issue detected {owner: "Gopenux", repo: "Mark", number: 103, ...}
```

## What to Check

### ✅ Working Correctly
- You see **one or more** detection methods trigger
- The button appears **within 1 second** of clicking
- Console shows "Issue detected" with correct issue number

### ❌ Not Working
If you see:
```
CronoHub: Initialized
[Nothing happens when clicking issue]
```

Then:
1. Check if any detection method triggered
2. Verify the URL actually changed in the browser
3. Look for errors in console

### Debug Information to Provide

If it's still not working, please share:

1. **Full console output** when clicking an issue
2. **GitHub URL** you're testing on
3. **Browser version**: Chrome version number
4. **Any errors** in the console (red messages)

## Manual Testing

You can also test the detection manually in the console:

```javascript
// Check if hooks are installed
console.log('Original pushState:', history.pushState.toString().includes('CronoHub'));

// Manually trigger detection
window.location.pathname = '/Gopenux/Mark/issues/103';

// Check if button exists
document.getElementById('gtt-toggle-btn');
```

## Fallback Mechanism

Even if SPA detection fails, the **polling fallback** (every 2 seconds) should eventually detect the issue. If the button doesn't appear after 2-3 seconds, there's a deeper issue.

## Additional Logging

To enable more verbose logging, you can run in console:

```javascript
// Override console.log to show all CronoHub messages
window.cronohubDebug = true;
```

Then reload the page and try again.
