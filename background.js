// CronoHub - Background Service Worker
// Author: Gopenux AI
// Copyright (c) 2026 Gopenux AI

// Minimal service worker for extension detection by Puppeteer
// This script is intentionally minimal and only logs initialization

console.log('CronoHub: Service worker initialized');

// Keep service worker alive by responding to messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ping') {
    sendResponse({ status: 'alive' });
  }
  return true;
});

// Log when extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  console.log('CronoHub: Extension installed/updated', details.reason);
});

// Immediately signal that service worker is active
// This helps with detection in Puppeteer/testing environments
try {
  console.log('CronoHub: Service worker active and ready');
  console.log('CronoHub: Extension ID:', chrome.runtime.id);
} catch (e) {
  console.error('CronoHub: Failed to log extension ID:', e.message);
}
