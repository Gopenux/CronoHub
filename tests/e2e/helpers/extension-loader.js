// CronoHub - Extension Loader Helper
// Author: Gopenux AI
// Copyright (c) 2026 Gopenux AI

const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

/**
 * Conditional logger that respects CI environment
 * Only logs in local development or when DEBUG=true
 * @param  {...any} args - Arguments to log
 */
function log(...args) {
  const isCI = process.env.CI === 'true';
  const isDebug = process.env.DEBUG === 'true';

  // Only log if not in CI, or if DEBUG is explicitly enabled
  if (!isCI || isDebug) {
    console.log(...args);
  }
}

/**
 * Verifies that all required extension files exist
 * @param {string} extensionPath - Path to the extension
 * @returns {Object} - Verification result
 */
function verifyExtensionFiles(extensionPath) {
  const requiredFiles = [
    'manifest.json',
    'background.js',
    'content.js',
    'popup.html',
    'popup.js'
  ];

  const results = {
    allExist: true,
    missing: [],
    existing: []
  };

  log('📋 Verifying extension files...');

  for (const file of requiredFiles) {
    const filePath = path.join(extensionPath, file);
    const exists = fs.existsSync(filePath);

    if (exists) {
      const stats = fs.statSync(filePath);
      log(`   ✓ ${file} (${stats.size} bytes)`);
      results.existing.push(file);
    } else {
      console.error(`   ✗ ${file} - NOT FOUND`);
      results.missing.push(file);
      results.allExist = false;
    }
  }

  // Verify manifest.json is valid JSON
  try {
    const manifestPath = path.join(extensionPath, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      log(`   ℹ️  Manifest version: ${manifest.manifest_version}`);
      log(`   ℹ️  Extension name: ${manifest.name} v${manifest.version}`);

      if (manifest.background?.service_worker) {
        log(`   ℹ️  Service worker: ${manifest.background.service_worker}`);
      }
    }
  } catch (err) {
    console.error('   ⚠️  Warning: Could not parse manifest.json:', err.message);
  }

  return results;
}

/**
 * Launches a Chromium instance with the CronoHub extension loaded
 * @param {Object} options - Additional options for Puppeteer
 * @returns {Promise<{browser: Browser, page: Page, extensionId: string}>}
 */
async function launchBrowserWithExtension(options = {}) {
  const extensionPath = path.join(__dirname, '../../../');

  log('🔧 Launching browser with extension from:', extensionPath);

  // Verify extension files
  const verification = verifyExtensionFiles(extensionPath);
  if (!verification.allExist) {
    console.error('❌ Extension files are missing:', verification.missing);
    throw new Error(`Missing extension files: ${verification.missing.join(', ')}`);
  }

  // Detect Chrome executable path
  // IMPORTANT: In CI environments (GitHub Actions), always use bundled Chromium
  // to avoid service worker registration issues with system Chrome
  let executablePath;

  if (process.env.CI === 'true') {
    // Force bundled Chromium in CI - ignore all system Chrome paths
    log('🔧 CI environment detected - forcing bundled Chromium');
    executablePath = undefined;
  } else {
    // In local development, allow using system Chrome if specified
    executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
                     process.env.CHROME_BIN ||
                     options.executablePath;
  }

  if (executablePath) {
    log('🌐 Using Chrome from:', executablePath);

    // Verify Chrome executable exists
    if (!fs.existsSync(executablePath)) {
      console.error(`❌ Chrome executable not found at: ${executablePath}`);
      throw new Error(`Chrome executable not found: ${executablePath}`);
    }
  } else {
    log('🌐 Using bundled Chromium from Puppeteer');
  }

  // Use new headless mode in CI for better compatibility with service workers
  // The new headless mode supports extensions and works better in virtual displays
  const headlessMode = process.env.CI === 'true' ? 'new' : false;

  const launchOptions = {
    headless: headlessMode, // 'new' headless in CI, false (headed) locally
    executablePath,
    dumpio: true, // Enable browser process stdio
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      // Service worker specific flags
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-ipc-flooding-protection',
      // Extension compatibility flags
      '--enable-automation',
      '--disable-default-apps',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-report-upload',
      '--test-type',
      // Security flags needed for extension loading
      '--allow-insecure-localhost',
      '--ignore-certificate-errors',
      '--disable-extensions-file-access-check',
      '--disable-web-security',
      '--allow-file-access-from-files',
      // Suppress unnecessary warnings in CI
      '--disable-dbus', // Suppress DBus connection errors
      '--log-level=3', // Only show fatal errors (0=INFO, 1=WARNING, 2=ERROR, 3=FATAL)
      ...(options.args || [])
    ],
    ...options
  };

  // Remove executablePath if undefined to let Puppeteer use default
  if (!launchOptions.executablePath) {
    delete launchOptions.executablePath;
  }

  log('🚀 Launching browser with options:');
  log('   - Headless:', launchOptions.headless);
  log('   - Extension path:', extensionPath);
  log('   - Total args:', launchOptions.args.length);

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
    log('✅ Browser launched successfully');

    // Get browser version
    const version = await browser.version();
    log('   ℹ️  Browser version:', version);
  } catch (err) {
    console.error('❌ Failed to launch browser:', err.message);
    console.error('   Stack:', err.stack);
    throw err;
  }

  log('⏳ Waiting for extension to load...');

  // Give Chrome time to initialize the extension
  log('   ⏱️  Waiting 3 seconds for Chrome to process extension...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Listen for browser console messages
  browser.on('targetcreated', async (target) => {
    const type = target.type();
    const url = target.url();
    log(`   🎯 New target created: ${type} - ${url}`);

    // Try to capture console logs from service worker
    if (type === 'service_worker') {
      try {
        const worker = await target.worker();
        if (worker) {
          worker.on('console', msg => {
            log(`   [SW Console] ${msg.type()}: ${msg.text()}`);
          });
          log('   📝 Attached console listener to service worker');
        }
      } catch (err) {
        log(`   ⚠️  Could not attach to service worker: ${err.message}`);
      }
    }
  });

  // Get extension ID with retries
  let extensionId = null;
  const maxRetries = 15; // Balanced for compatibility and speed
  const retryDelay = 2500; // Longer delay between attempts

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log(`🔍 Attempt ${attempt}/${maxRetries}: Looking for extension ID...`);

    const targets = await browser.targets();
    log(`   Found ${targets.length} total targets`);

    // Group and count targets by type
    const targetsByType = {};
    targets.forEach(target => {
      const type = target.type();
      targetsByType[type] = (targetsByType[type] || 0) + 1;
    });
    log('   Target types:', JSON.stringify(targetsByType, null, 2));

    // Log all targets for debugging
    targets.forEach((target, index) => {
      const type = target.type();
      const url = target.url();
      log(`   [${index}] Type: ${type}, URL: ${url.substring(0, 100)}${url.length > 100 ? '...' : ''}`);
    });

    // Find service worker (background script)
    const serviceWorkerTarget = targets.find(
      target => target.type() === 'service_worker'
    );

    if (serviceWorkerTarget) {
      const url = serviceWorkerTarget.url();
      log('   ✓ Service worker found:', url);
      const match = url.match(/chrome-extension:\/\/([a-z]{32})/);
      if (match) {
        extensionId = match[1];
        log('✅ Extension ID found via service worker:', extensionId);
        break;
      }
    } else {
      log('   ⚠️  No service worker target found');
    }

    // Fallback: search all targets for chrome-extension URLs
    if (!extensionId) {
      log('   🔄 Trying fallback: searching all targets for chrome-extension URLs...');
      for (const target of targets) {
        const url = target.url();
        if (url.startsWith('chrome-extension://')) {
          log('   Found chrome-extension URL:', url);
          const match = url.match(/chrome-extension:\/\/([a-z]{32})/);
          if (match) {
            extensionId = match[1];
            log('✅ Extension ID found via fallback:', extensionId);
            break;
          }
        }
      }
    }

    // Chrome workaround: Try to wake up service worker by navigating to chrome://extensions
    if (!extensionId && attempt === 3) {
      log('   🔧 Chrome workaround: Attempting to trigger service worker...');
      try {
        const wakeUpPage = await browser.newPage();
        // Navigate to a chrome:// page to potentially wake up the extension system
        await wakeUpPage.goto('chrome://version/', { waitUntil: 'domcontentloaded', timeout: 3000 }).catch(() => {});
        await wakeUpPage.close();
        log('   ✅ Wake-up page closed, continuing detection...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (err) {
        log('   ⚠️  Wake-up attempt failed:', err.message);
      }
    }

    if (extensionId) {
      break;
    }

    if (attempt < maxRetries) {
      log(`   ⏱️  Waiting ${retryDelay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  if (!extensionId) {
    const browserVersion = await browser.version();
    const isBeta = browserVersion.includes('beta') || executablePath?.includes('beta');

    console.error('❌ Failed to detect extension ID after', maxRetries, 'attempts');
    console.error('   This usually means the extension failed to load.');
    console.error('   Possible causes:');
    console.error('   1. manifest.json or background.js has syntax errors');
    console.error('   2. Chrome version incompatibility (especially with Beta versions)');
    console.error('   3. Extension loading is blocked by Chrome');
    console.error('   4. Service worker not registering in headed mode (known Chrome Beta issue)');
    console.error('');
    console.error('   Diagnostic info:');
    console.error('   - Extension path:', extensionPath);
    console.error('   - Files verified:', verification.existing.join(', '));
    console.error('   - Browser version:', browserVersion);
    console.error('   - Is Beta:', isBeta);

    // Try to get chrome logs if available
    try {
      const pages = await browser.pages();
      if (pages.length > 0) {
        console.error('   - Browser pages:', pages.length);
        for (const page of pages) {
          console.error('     Page URL:', await page.url());
        }
      }
    } catch (err) {
      console.error('   Could not get browser pages:', err.message);
    }

    // For Chrome Beta, this is a known issue - add more context
    if (isBeta) {
      console.warn('');
      console.warn('⚠️  CHROME BETA COMPATIBILITY NOTICE:');
      console.warn('   Chrome Beta (especially v145+) has known issues with MV3 service workers');
      console.warn('   in Puppeteer headed mode. This may be a Chrome bug, not an extension issue.');
      console.warn('   The extension likely works correctly in normal Chrome usage.');
      console.warn('');
      console.warn('   Recommended actions:');
      console.warn('   1. Monitor Chrome Beta release notes for service worker fixes');
      console.warn('   2. Consider marking Beta tests as "continue-on-error" in CI');
      console.warn('   3. Verify the extension manually loads in Chrome Beta browser');
    }
  }

  const page = await browser.newPage();

  // Set standard viewport
  await page.setViewport({ width: 1280, height: 720 });

  // Attach console listener to capture browser console output
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    log(`   [Page Console ${prefix}] ${type}: ${text}`);
  });

  // Attach error listener
  page.on('pageerror', error => {
    console.error('   [Page Error] ❌', error.message);
  });

  // Attach request failed listener
  page.on('requestfailed', request => {
    log(`   [Request Failed] ⚠️  ${request.url()} - ${request.failure().errorText}`);
  });

  log('✅ Page created and configured with logging');

  return { browser, page, extensionId };
}

/**
 * Sets the GitHub token in extension storage
 * @param {Page} page - Puppeteer page
 * @param {string} token - GitHub token
 * @param {string} extensionId - Extension ID
 */
async function setGitHubToken(page, token, extensionId) {
  // Navigate to extension popup to access chrome.storage API
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  await page.goto(popupUrl, { waitUntil: 'networkidle0' }).catch(() => {
    // If popup doesn't exist, create a blank extension page
  });

  // Now set the token in storage from extension context
  await page.evaluate((tokenValue) => {
    return new Promise((resolve) => {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          githubToken: tokenValue,
          userData: {
            login: 'testuser',
            name: 'Test User',
            avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4'
          }
        }, resolve);
      } else {
        resolve();
      }
    });
  }, token);
}

/**
 * Clears extension storage
 * @param {Page} page - Puppeteer page
 * @param {string} extensionId - Extension ID
 */
async function clearExtensionStorage(page, extensionId) {
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  await page.goto(popupUrl, { waitUntil: 'networkidle0' }).catch(() => {});

  await page.evaluate(() => {
    return new Promise((resolve) => {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.clear(resolve);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Gets current extension storage
 * @param {Page} page - Puppeteer page
 * @param {string} extensionId - Extension ID
 * @returns {Promise<Object>}
 */
async function getExtensionStorage(page, extensionId) {
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  await page.goto(popupUrl, { waitUntil: 'networkidle0' }).catch(() => {});

  return await page.evaluate(() => {
    return new Promise((resolve) => {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(null, resolve);
      } else {
        resolve({});
      }
    });
  });
}

/**
 * Waits for the CronoHub button to appear on the page
 * @param {Page} page - Puppeteer page
 * @param {number} timeout - Timeout in ms
 */
async function waitForCronoHubButton(page, timeout = 10000) {
  await page.waitForSelector('#gtt-toggle-btn', {
    visible: true,
    timeout
  });
}

/**
 * Clicks the CronoHub button to open the panel
 * @param {Page} page - Puppeteer page
 */
async function openCronoHubPanel(page) {
  await page.click('#gtt-toggle-btn');
  await page.waitForSelector('#gtt-panel:not(.hidden)', { timeout: 5000 });
}

/**
 * Takes a screenshot with timestamp
 * @param {Page} page - Puppeteer page
 * @param {string} name - Descriptive name for the screenshot
 */
async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = path.join(__dirname, `../../screenshots/${name}-${timestamp}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

/**
 * Navigates to a GitHub issue test page
 * @param {Page} page - Puppeteer page
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} issueNumber - Issue number
 */
async function navigateToGitHubIssue(page, owner = 'facebook', repo = 'react', issueNumber = 1) {
  const url = `https://github.com/${owner}/${repo}/issues/${issueNumber}`;
  await page.goto(url, { waitUntil: 'networkidle0' });
}

module.exports = {
  launchBrowserWithExtension,
  setGitHubToken,
  clearExtensionStorage,
  getExtensionStorage,
  waitForCronoHubButton,
  openCronoHubPanel,
  takeScreenshot,
  navigateToGitHubIssue
};
