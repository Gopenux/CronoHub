// CronoHub - Extension Structure E2E Tests
// Author: Gopenux AI
// Copyright (c) 2026 Gopenux AI

const {
  launchBrowserWithExtension
} = require('./helpers/extension-loader');

describe('Extension Structure E2E Tests', () => {
  let browser;
  let page;
  let extensionId;

  jest.setTimeout(60000); // Increased to allow extension loading time

  beforeAll(async () => {
    const launch = await launchBrowserWithExtension();
    browser = launch.browser;
    page = launch.page;
    extensionId = launch.extensionId;
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('extension loads with valid ID', () => {
    expect(extensionId).toBeDefined();
    expect(extensionId).toMatch(/^[a-z]{32}$/);
  });

  test('extension service worker is active', async () => {
    const targets = await browser.targets();
    const serviceWorker = targets.find(t => t.type() === 'service_worker');

    expect(serviceWorker).toBeDefined();
    expect(serviceWorker.url()).toContain('chrome-extension://');
    expect(serviceWorker.url()).toContain('/background.js');
  });

  test('extension popup page exists', async () => {
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;

    await page.goto(popupUrl, { waitUntil: 'networkidle0' });

    const title = await page.title();
    expect(title).toBeDefined();

    // Check for key elements
    const hasAuthSection = await page.$('#auth-section');
    const hasConnectionStatus = await page.$('#connection-status');

    expect(hasAuthSection).toBeTruthy();
    expect(hasConnectionStatus).toBeTruthy();
  });

  test('popup shows not authenticated state initially', async () => {
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    await page.goto(popupUrl, { waitUntil: 'networkidle0' });

    const statusText = await page.$eval('#connection-status', el => el.textContent);
    expect(statusText).toContain('Not authenticated');
  });

  test('popup has github token input field', async () => {
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    await page.goto(popupUrl, { waitUntil: 'networkidle0' });

    const tokenInput = await page.$('#github-token');
    expect(tokenInput).toBeTruthy();

    const inputType = await page.$eval('#github-token', el => el.type);
    expect(inputType).toBe('password');
  });

  test('popup has save configuration button', async () => {
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    await page.goto(popupUrl, { waitUntil: 'networkidle0' });

    const saveButton = await page.$('#save-config');
    expect(saveButton).toBeTruthy();

    const buttonText = await page.$eval('#save-config', el => el.textContent.trim());
    expect(buttonText.toLowerCase()).toMatch(/save configuration/i);
  });

  test('popup styles are loaded', async () => {
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    await page.goto(popupUrl, { waitUntil: 'networkidle0' });

    // Check if styles are applied
    const bodyBg = await page.$eval('body', el => window.getComputedStyle(el).backgroundColor);
    expect(bodyBg).toBeDefined();
    expect(bodyBg).not.toBe('rgba(0, 0, 0, 0)'); // Not transparent
  });

  test('extension can access chrome storage API', async () => {
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    await page.goto(popupUrl, { waitUntil: 'networkidle0' });

    const hasChromeStorage = await page.evaluate(() => {
      return typeof chrome !== 'undefined' &&
             typeof chrome.storage !== 'undefined' &&
             typeof chrome.storage.local !== 'undefined';
    });

    expect(hasChromeStorage).toBe(true);
  });

  test('extension manifest is accessible', async () => {
    const manifestUrl = `chrome-extension://${extensionId}/manifest.json`;

    const response = await page.goto(manifestUrl);
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toBe('CronoHub');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.manifest_version).toBe(3);
  });

  test('extension icons are accessible', async () => {
    const iconSizes = ['16', '48', '128'];

    for (const size of iconSizes) {
      const iconUrl = `chrome-extension://${extensionId}/icons/icon${size}.png`;

      try {
        const response = await page.goto(iconUrl);
        expect(response.status()).toBe(200);

        const contentType = response.headers()['content-type'];
        expect(contentType).toMatch(/image/);
      } catch {
        // If navigation fails, check if file exists via fetch
        const exists = await page.evaluate(async (url) => {
          try {
            const res = await fetch(url);
            return res.ok;
          } catch {
            return false;
          }
        }, iconUrl);

        expect(exists).toBe(true);
      }
    }
  });
});
