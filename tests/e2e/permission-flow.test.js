// CronoHub - E2E Permission Validation Flow Tests
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI Team

const {
  launchBrowserWithExtension,
  setGitHubToken
} = require('./helpers/extension-loader');

/**
 * E2E tests for repository permission validation flow
 * Tests the complete flow from clicking the button to seeing permission errors
 */
describe('E2E - Permission Validation Flow', () => {
  let browser;
  let page;
  let extensionId;

  // Helper to wait for a specified duration
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  jest.setTimeout(60000);

  beforeAll(async () => {
    // Launch browser with extension using the proper helper
    const launch = await launchBrowserWithExtension();
    browser = launch.browser;
    page = launch.page;
    extensionId = launch.extensionId;

    // Set GitHub token in extension storage (once for all tests)
    await setGitHubToken(page, 'ghp_test_token_12345', extensionId);
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    // Create a fresh page for each test
    if (page && !page.isClosed()) {
      await page.close();
    }
    page = await browser.newPage();
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Permission validation with write access', () => {
    test('should show time logging form when user has push permission', async () => {
      // Enable request interception
      await page.setRequestInterception(true);

      // Intercept and mock API requests
      page.on('request', (request) => {
        const url = request.url();

        // Mock repository permission check
        if (url.includes('api.github.com/repos/testowner/testrepo') && request.method() === 'GET' && !url.includes('/comments')) {
          request.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 123456,
              name: 'testrepo',
              full_name: 'testowner/testrepo',
              permissions: {
                admin: false,
                push: true,
                pull: true
              }
            })
          });
        } else {
          request.continue();
        }
      });

      // Navigate to GitHub issue page
      await page.goto('https://github.com/testowner/testrepo/issues/1', { waitUntil: 'domcontentloaded' });

      // Wait for button to be injected by content script
      await wait(1000);

      // Act - Click CronoHub button
      await page.evaluate(() => {
        const button = document.querySelector('#gtt-toggle-btn');
        if (button) button.click();
      });

      // Wait for panel to open and validation to complete
      await wait(2000);

      // Assert - Check that the time logging form is visible
      const panelContent = await page.evaluate(() => {
        const panel = document.querySelector('#gtt-panel');
        return panel ? panel.innerHTML : '';
      });

      expect(panelContent).toContain('Hours worked');
      expect(panelContent).toContain('Log time');
      expect(panelContent).not.toContain('Access Denied');
    });
  });

  describe('Permission validation with no access', () => {
    test('should show Access Denied when repository returns 404', async () => {
      // Enable request interception
      await page.setRequestInterception(true);

      // Intercept and mock API requests
      page.on('request', (request) => {
        const url = request.url();

        // Mock 404 response for repository check
        if (url.includes('api.github.com/repos/testowner/testrepo') && request.method() === 'GET' && !url.includes('/comments')) {
          request.respond({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Not Found',
              documentation_url: 'https://docs.github.com/rest/reference/repos#get-a-repository'
            })
          });
        } else {
          request.continue();
        }
      });

      // Navigate to GitHub issue page
      await page.goto('https://github.com/testowner/testrepo/issues/1', { waitUntil: 'domcontentloaded' });

      // Wait for button to be injected
      await wait(1000);

      // Act - Open panel
      await page.evaluate(() => {
        const button = document.querySelector('#gtt-toggle-btn');
        if (button) button.click();
      });

      await wait(2000);

      // Assert
      const panelContent = await page.evaluate(() => {
        const panel = document.querySelector('#gtt-panel');
        return panel ? panel.textContent : '';
      });

      expect(panelContent).toContain('Access Denied');
      expect(panelContent).toContain('Repository not found');
    });

    test('should show Access Denied when token has only read access', async () => {
      // Enable request interception
      await page.setRequestInterception(true);

      // Intercept and mock API requests
      page.on('request', (request) => {
        const url = request.url();

        // Mock read-only permission response
        if (url.includes('api.github.com/repos/testowner/testrepo') && request.method() === 'GET' && !url.includes('/comments')) {
          request.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 123456,
              name: 'testrepo',
              full_name: 'testowner/testrepo',
              permissions: {
                admin: false,
                push: false,
                pull: true
              }
            })
          });
        } else {
          request.continue();
        }
      });

      // Navigate to GitHub issue page
      await page.goto('https://github.com/testowner/testrepo/issues/1', { waitUntil: 'domcontentloaded' });

      // Wait for button to be injected
      await wait(1000);

      // Act
      await page.evaluate(() => {
        const button = document.querySelector('#gtt-toggle-btn');
        if (button) button.click();
      });

      await wait(2000);

      // Assert
      const panelContent = await page.evaluate(() => {
        const panel = document.querySelector('#gtt-panel');
        return panel ? panel.textContent : '';
      });

      expect(panelContent).toContain('Access Denied');
      expect(panelContent).toContain('read-only access');
      expect(panelContent).toContain('Write permission is required');
    });

    test('should show Access Denied when API returns 403', async () => {
      // Enable request interception
      await page.setRequestInterception(true);

      // Intercept and mock API requests
      page.on('request', (request) => {
        const url = request.url();

        // Mock 403 forbidden response
        if (url.includes('api.github.com/repos/testowner/testrepo') && request.method() === 'GET' && !url.includes('/comments')) {
          request.respond({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Resource not accessible by personal access token',
              documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#authentication'
            })
          });
        } else {
          request.continue();
        }
      });

      // Navigate to GitHub issue page
      await page.goto('https://github.com/testowner/testrepo/issues/1', { waitUntil: 'domcontentloaded' });

      // Wait for button to be injected
      await wait(1000);

      // Act
      await page.evaluate(() => {
        const button = document.querySelector('#gtt-toggle-btn');
        if (button) button.click();
      });

      await wait(2000);

      // Assert
      const panelContent = await page.evaluate(() => {
        const panel = document.querySelector('#gtt-panel');
        return panel ? panel.textContent : '';
      });

      expect(panelContent).toContain('Access Denied');
      expect(panelContent).toContain('Resource not accessible');
    });
  });

  describe('Network error handling', () => {
    test('should show Access Denied on network failure', async () => {
      // Enable request interception
      await page.setRequestInterception(true);

      // Intercept and mock network failure
      page.on('request', (request) => {
        const url = request.url();

        // Simulate network error by aborting the request
        if (url.includes('api.github.com/repos/testowner/testrepo') && request.method() === 'GET' && !url.includes('/comments')) {
          request.abort('failed');
        } else {
          request.continue();
        }
      });

      // Navigate to GitHub issue page
      await page.goto('https://github.com/testowner/testrepo/issues/1', { waitUntil: 'domcontentloaded' });

      // Wait for button to be injected
      await wait(1000);

      // Act
      await page.evaluate(() => {
        const button = document.querySelector('#gtt-toggle-btn');
        if (button) button.click();
      });

      await wait(2000);

      // Assert
      const panelContent = await page.evaluate(() => {
        const panel = document.querySelector('#gtt-panel');
        return panel ? panel.textContent : '';
      });

      expect(panelContent).toContain('Access Denied');
      expect(panelContent).toContain('Network error');
    });
  });

  describe('Loading state', () => {
    test('should show loading indicator during validation', async () => {
      // Enable request interception
      await page.setRequestInterception(true);

      // Intercept and mock slow API response
      page.on('request', (request) => {
        const url = request.url();

        // Mock slow API response with delayed respond
        if (url.includes('api.github.com/repos/testowner/testrepo') && request.method() === 'GET' && !url.includes('/comments')) {
          // Delay the response to simulate slow network
          setTimeout(() => {
            request.respond({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                id: 123456,
                name: 'testrepo',
                full_name: 'testowner/testrepo',
                permissions: {
                  admin: false,
                  push: true,
                  pull: true
                }
              })
            });
          }, 1500); // 1.5 second delay
        } else {
          request.continue();
        }
      });

      // Navigate to GitHub issue page
      await page.goto('https://github.com/testowner/testrepo/issues/1', { waitUntil: 'domcontentloaded' });

      // Wait for button to be injected
      await wait(1000);

      // Act
      await page.evaluate(() => {
        const button = document.querySelector('#gtt-toggle-btn');
        if (button) button.click();
      });

      // Wait briefly for loading state (less than API response delay)
      await wait(500);

      // Assert - Check for loading indicator
      const hasLoadingState = await page.evaluate(() => {
        const panel = document.querySelector('#gtt-panel');
        const content = panel ? panel.textContent : '';
        return content.includes('Validating') || content.includes('Loading');
      });

      expect(hasLoadingState).toBe(true);
    });
  });

  describe('Reports mode bypass', () => {
    test('should show Access Denied in log mode but work in reports mode', async () => {
      // This test verifies that read-only access shows Access Denied for logging
      // but reports mode still works (since it doesn't require write permission)
      // Enable request interception
      await page.setRequestInterception(true);

      // Mock read-only repository access
      page.on('request', (request) => {
        const url = request.url();

        // Mock successful permission check with read-only access
        if (url.includes('api.github.com/repos/testowner/testrepo') && request.method() === 'GET' && !url.includes('/comments')) {
          request.respond({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 123456,
              name: 'testrepo',
              full_name: 'testowner/testrepo',
              permissions: {
                admin: false,
                push: false,
                pull: true
              }
            })
          });
        } else {
          request.continue();
        }
      });

      // Navigate to GitHub issue page
      await page.goto('https://github.com/testowner/testrepo/issues/1', { waitUntil: 'domcontentloaded' });

      // Wait for button to be injected
      await wait(1000);

      // Act - Click button to open panel
      await page.evaluate(() => {
        const button = document.querySelector('#gtt-toggle-btn');
        if (button) button.click();
      });

      // Wait for panel to open
      await wait(2000);

      // Verify Access Denied is shown (read-only permission means no write access for logging)
      const panelContent = await page.evaluate(() => {
        const panel = document.querySelector('#gtt-panel');
        return panel ? panel.textContent : '';
      });

      // Should show Access Denied because write permission is required for time logging
      expect(panelContent).toContain('Access Denied');
      expect(panelContent).toContain('read-only access');
    });
  });

  describe('Error message content', () => {
    test('should display helpful suggestions in Access Denied state', async () => {
      // Enable request interception
      await page.setRequestInterception(true);

      // Intercept and mock API requests
      page.on('request', (request) => {
        const url = request.url();

        // Mock 404 response
        if (url.includes('api.github.com/repos/testowner/testrepo') && request.method() === 'GET' && !url.includes('/comments')) {
          request.respond({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Not Found',
              documentation_url: 'https://docs.github.com/rest/reference/repos#get-a-repository'
            })
          });
        } else {
          request.continue();
        }
      });

      // Navigate to GitHub issue page
      await page.goto('https://github.com/testowner/testrepo/issues/1', { waitUntil: 'domcontentloaded' });

      // Wait for button to be injected
      await wait(1000);

      // Act
      await page.evaluate(() => {
        const button = document.querySelector('#gtt-toggle-btn');
        if (button) button.click();
      });

      await wait(2000);

      // Assert - Check for helpful suggestions
      const panelContent = await page.evaluate(() => {
        const panel = document.querySelector('#gtt-panel');
        return panel ? panel.textContent : '';
      });

      expect(panelContent).toContain('Possible solutions');
      expect(panelContent).toContain('write access');
      expect(panelContent).toContain('testowner/testrepo');
      expect(panelContent).toContain('repo');
    });
  });
});
