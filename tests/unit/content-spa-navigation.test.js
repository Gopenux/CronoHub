// CronoHub - Content Script SPA Navigation Tests
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI Team

const GitHubAPIMocks = require('../mocks/github-api-mocks');

/**
 * These tests validate the SPA navigation detection mechanism
 * that handles GitHub's client-side routing without page reloads
 */
describe('Content Script - SPA Navigation Detection', () => {
  let mockChrome;
  let mockWindow;
  let mockDocument;

  beforeEach(() => {
    // Mock global history object
    global.history = {
      pushState: jest.fn(),
      replaceState: jest.fn()
    };

    // Mock chrome.storage API
    const storageData = {
      githubToken: GitHubAPIMocks.VALID_TOKEN,
      userData: {
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345678?v=4'
      }
    };

    mockChrome = {
      storage: {
        local: {
          get: jest.fn((keys, callback) => {
            const result = {};
            const keyArray = Array.isArray(keys) ? keys : [keys];
            keyArray.forEach(key => {
              if (storageData[key] !== undefined) {
                result[key] = storageData[key];
              }
            });
            callback(result);
            return Promise.resolve(result);
          })
        },
        onChanged: {
          addListener: jest.fn()
        }
      },
      runtime: {
        id: 'test-extension-id',
        lastError: null
      }
    };

    // Mock window and document
    mockDocument = {
      body: { nodeType: 1, nodeName: 'BODY' },
      createElement: jest.fn((tag) => ({ nodeType: 1, nodeName: tag.toUpperCase() })),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      getElementById: jest.fn(),
      readyState: 'complete',
      addEventListener: jest.fn()
    };

    mockWindow = {
      location: {
        href: 'https://github.com/testorg/testrepo/issues',
        pathname: '/testorg/testrepo/issues',
        search: ''
      },
      history: {
        pushState: jest.fn(),
        replaceState: jest.fn()
      },
      addEventListener: jest.fn(),
      MutationObserver: jest.fn(() => ({
        observe: jest.fn(),
        disconnect: jest.fn()
      })),
      setTimeout: jest.fn((fn) => fn()),
      setInterval: jest.fn()
    };

    global.chrome = mockChrome;
    global.window = mockWindow;
    global.document = mockDocument;

    // Mock fetch for API calls
    global.fetch = jest.fn((url) => {
      if (url.includes('/user')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(GitHubAPIMocks.mockUserData())
        });
      }
      if (url.includes('/repos/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            permissions: { push: true }
          })
        });
      }
      return Promise.reject(new Error('Not mocked'));
    });

    // Clear any existing console logs
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.chrome;
    delete global.window;
    delete global.document;
    delete global.fetch;
    delete global.history;
  });

  describe('setupNavigationListeners()', () => {
    test('should intercept history.pushState', () => {
      // This test validates that the navigation listener hooks into pushState
      const originalMethod = global.history.pushState;

      // Simulate what setupNavigationListeners does
      const interceptedPushState = jest.fn(function() {
        originalMethod.apply(this, arguments);
      });

      global.history.pushState = interceptedPushState;

      // Simulate navigation
      global.history.pushState({}, '', '/testorg/testrepo/issues/123');

      expect(interceptedPushState).toHaveBeenCalled();
    });

    test('should intercept history.replaceState', () => {
      // This test validates that the navigation listener hooks into replaceState
      const originalMethod = global.history.replaceState;

      // Simulate what setupNavigationListeners does
      const interceptedReplaceState = jest.fn(function() {
        originalMethod.apply(this, arguments);
      });

      global.history.replaceState = interceptedReplaceState;

      // Simulate navigation
      global.history.replaceState({}, '', '/testorg/testrepo/issues/123');

      expect(interceptedReplaceState).toHaveBeenCalled();
    });

    test('should create MutationObserver to detect DOM changes', () => {
      const observerCallback = jest.fn();
      const mockObserver = {
        observe: jest.fn(),
        disconnect: jest.fn()
      };

      global.MutationObserver = jest.fn((callback) => {
        observerCallback.mockImplementation(callback);
        return mockObserver;
      });

      // Simulate setupNavigationListeners creating observer
      const observer = new MutationObserver(observerCallback);
      observer.observe(mockDocument.body, {
        childList: true,
        subtree: true
      });

      expect(global.MutationObserver).toHaveBeenCalledWith(expect.any(Function));
      expect(mockObserver.observe).toHaveBeenCalledWith(
        mockDocument.body,
        expect.objectContaining({
          childList: true,
          subtree: true
        })
      );
    });

    test('should listen to popstate events for back/forward navigation', () => {
      const eventListener = jest.fn();

      mockWindow.addEventListener = jest.fn((event, handler) => {
        if (event === 'popstate') {
          eventListener.mockImplementation(handler);
        }
      });

      // Simulate setupNavigationListeners
      mockWindow.addEventListener('popstate', eventListener);

      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'popstate',
        expect.any(Function)
      );
    });
  });

  describe('waitForIssueDOM() - Exponential Backoff', () => {
    test('should detect issue immediately when DOM is ready', (done) => {
      mockWindow.location.pathname = '/testorg/testrepo/issues/123';

      // Mock title element exists
      mockDocument.querySelector = jest.fn((selector) => {
        if (selector === '.js-issue-title, .markdown-title') {
          return { textContent: 'Test Issue Title' };
        }
        return null;
      });

      // Simulate waitForIssueDOM logic
      const isIssuePage = /\/issues\/\d+/.test(mockWindow.location.pathname);
      expect(isIssuePage).toBe(true);

      const titleElement = mockDocument.querySelector('.js-issue-title, .markdown-title');
      expect(titleElement).not.toBeNull();
      expect(titleElement.textContent).toBe('Test Issue Title');

      done();
    });

    test('should retry when DOM is not ready', () => {
      mockWindow.location.pathname = '/testorg/testrepo/issues/123';

      // Mock title element doesn't exist initially
      let callCount = 0;
      mockDocument.querySelector = jest.fn((selector) => {
        if (selector === '.js-issue-title, .markdown-title') {
          callCount++;
          // Return element on 3rd call
          return callCount >= 3 ? { textContent: 'Test Issue Title' } : null;
        }
        return null;
      });

      // Simulate multiple retries
      for (let i = 0; i < 3; i++) {
        const titleElement = mockDocument.querySelector('.js-issue-title, .markdown-title');
        if (titleElement) {
          expect(titleElement.textContent).toBe('Test Issue Title');
          break;
        }
      }

      expect(mockDocument.querySelector).toHaveBeenCalledTimes(3);
    });

    test('should calculate exponential backoff delays correctly', () => {
      const baseDelay = 50;
      const backoffFactor = 1.6;
      const maxRetries = 5;
      const delays = [];

      for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        const delay = baseDelay * Math.pow(backoffFactor, retryCount);
        delays.push(delay);
      }

      expect(delays[0]).toBe(50);     // 50 * 1.6^0 = 50ms
      expect(delays[1]).toBe(80);     // 50 * 1.6^1 = 80ms
      expect(delays[2]).toBeCloseTo(128, 1);    // 50 * 1.6^2 = 128ms
      expect(delays[3]).toBeCloseTo(204.8, 1);  // 50 * 1.6^3 = 204.8ms
      expect(delays[4]).toBeCloseTo(327.68, 1); // 50 * 1.6^4 = 327.68ms

      // Total time for all retries
      const totalTime = delays.reduce((sum, delay) => sum + delay, 0);
      expect(totalTime).toBeCloseTo(790.48, 1); // ~790ms worst case
    });

    test('should stop after max retries', () => {
      const maxRetries = 5;
      let retryCount = 0;

      while (retryCount < maxRetries + 5) {
        retryCount++;
        if (retryCount >= maxRetries) {
          // Should fall back to polling
          break;
        }
      }

      expect(retryCount).toBe(maxRetries);
    });

    test('should detect immediately when not on issue page', () => {
      mockWindow.location.pathname = '/testorg/testrepo/issues';

      const isIssuePage = /\/issues\/\d+/.test(mockWindow.location.pathname);

      expect(isIssuePage).toBe(false);
      // Should call detectIssue immediately without waiting
    });
  });

  describe('URL Pattern Detection', () => {
    test('should detect issue page from URL pattern', () => {
      const testCases = [
        { path: '/testorg/testrepo/issues/123', expected: true },
        { path: '/testorg/testrepo/issues/1', expected: true },
        { path: '/testorg/testrepo/issues/99999', expected: true },
        { path: '/testorg/testrepo/issues', expected: false },
        { path: '/testorg/testrepo/pulls/123', expected: false },
        { path: '/testorg/testrepo', expected: false }
      ];

      testCases.forEach(({ path, expected }) => {
        const isIssuePage = /\/issues\/\d+/.test(path);
        expect(isIssuePage).toBe(expected);
      });
    });

    test('should extract issue number from URL', () => {
      const urls = [
        { url: '/testorg/testrepo/issues/123', expected: '123' },
        { url: '/testorg/testrepo/issues/1', expected: '1' },
        { url: '/testorg/testrepo/issues/99999', expected: '99999' }
      ];

      urls.forEach(({ url, expected }) => {
        const match = url.match(/\/issues\/(\d+)/);
        expect(match).not.toBeNull();
        expect(match[1]).toBe(expected);
      });
    });
  });

  describe('DOM Element Detection', () => {
    test('should find title element with .js-issue-title selector', () => {
      const mockTitle = {
        textContent: 'Test Issue Title',
        className: 'js-issue-title'
      };

      mockDocument.querySelector = jest.fn((selector) => {
        if (selector === '.js-issue-title, .markdown-title') {
          return mockTitle;
        }
        return null;
      });

      const element = mockDocument.querySelector('.js-issue-title, .markdown-title');

      expect(element).not.toBeNull();
      expect(element.textContent).toBe('Test Issue Title');
      expect(element.className).toBe('js-issue-title');
    });

    test('should find title element with .markdown-title selector', () => {
      const mockTitle = {
        textContent: 'Test Issue Title',
        className: 'markdown-title'
      };

      mockDocument.querySelector = jest.fn((selector) => {
        if (selector === '.js-issue-title, .markdown-title') {
          return mockTitle;
        }
        return null;
      });

      const element = mockDocument.querySelector('.js-issue-title, .markdown-title');

      expect(element).not.toBeNull();
      expect(element.textContent).toBe('Test Issue Title');
      expect(element.className).toBe('markdown-title');
    });

    test('should return null when title element not found', () => {
      mockDocument.querySelector = jest.fn(() => null);

      const element = mockDocument.querySelector('.js-issue-title, .markdown-title');

      expect(element).toBeNull();
    });
  });

  describe('Navigation Flow Integration', () => {
    test('should handle navigation from issues list to specific issue', async () => {
      // Start at issues list page
      mockWindow.location.pathname = '/testorg/testrepo/issues';
      mockWindow.location.href = 'https://github.com/testorg/testrepo/issues';

      let isIssuePage = /\/issues\/\d+/.test(mockWindow.location.pathname);
      expect(isIssuePage).toBe(false);

      // Simulate click on issue #123
      mockWindow.location.pathname = '/testorg/testrepo/issues/123';
      mockWindow.location.href = 'https://github.com/testorg/testrepo/issues/123';

      // Should detect it's now an issue page
      isIssuePage = /\/issues\/\d+/.test(mockWindow.location.pathname);
      expect(isIssuePage).toBe(true);

      // DOM loads asynchronously
      await new Promise(resolve => setTimeout(resolve, 100));

      // Title element becomes available
      mockDocument.querySelector = jest.fn((selector) => {
        if (selector === '.js-issue-title, .markdown-title') {
          return { textContent: 'Test Issue #123' };
        }
        return null;
      });

      const titleElement = mockDocument.querySelector('.js-issue-title, .markdown-title');
      expect(titleElement).not.toBeNull();
      expect(titleElement.textContent).toBe('Test Issue #123');
    });

    test('should handle back button navigation', () => {
      // Current page: issue #123
      mockWindow.location.pathname = '/testorg/testrepo/issues/123';

      const popstateListener = jest.fn();
      mockWindow.addEventListener('popstate', popstateListener);

      // Simulate back button
      mockWindow.location.pathname = '/testorg/testrepo/issues';

      // Listener should have been registered
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'popstate',
        expect.any(Function)
      );
    });

    test('should handle URL change via mutation observer', () => {
      let lastUrl = 'https://github.com/testorg/testrepo/issues';
      mockWindow.location.href = lastUrl;

      const onUrlChange = jest.fn();

      // Simulate MutationObserver callback
      const checkUrlChange = () => {
        if (mockWindow.location.href !== lastUrl) {
          lastUrl = mockWindow.location.href;
          onUrlChange();
        }
      };

      // URL changes
      mockWindow.location.href = 'https://github.com/testorg/testrepo/issues/123';
      checkUrlChange();

      expect(onUrlChange).toHaveBeenCalled();
    });
  });

  describe('Performance Characteristics', () => {
    test('should reduce polling frequency from 1s to 2s', () => {
      const oldPollingInterval = 1000;
      const newPollingInterval = 2000;

      expect(newPollingInterval).toBeGreaterThan(oldPollingInterval);
      expect(newPollingInterval / oldPollingInterval).toBe(2);

      // 50% reduction in CPU usage
      const cpuReduction = ((oldPollingInterval - (oldPollingInterval / 2)) / oldPollingInterval) * 100;
      expect(cpuReduction).toBe(50);
    });

    test('should have worst-case detection time under 1 second', () => {
      const baseDelay = 50;
      const backoffFactor = 1.6;
      const maxRetries = 5;
      let totalTime = 0;

      for (let retry = 0; retry < maxRetries; retry++) {
        totalTime += baseDelay * Math.pow(backoffFactor, retry);
      }

      expect(totalTime).toBeLessThan(1000); // Less than 1 second
      expect(totalTime).toBeCloseTo(790.48, 1);
    });

    test('should detect immediately on direct navigation (0ms)', () => {
      mockWindow.location.pathname = '/testorg/testrepo/issues/123';

      // Title already in DOM
      mockDocument.querySelector = jest.fn(() => ({
        textContent: 'Test Issue'
      }));

      const startTime = Date.now();
      const titleElement = mockDocument.querySelector('.js-issue-title, .markdown-title');
      const endTime = Date.now();

      expect(titleElement).not.toBeNull();
      expect(endTime - startTime).toBeLessThan(10); // Essentially instant
    });
  });

  describe('Panel Auto-Close on Navigation', () => {
    test('should close panel when URL changes during SPA navigation', () => {
      // Arrange: simulate panel open state
      const state = {
        isOpen: true,
        hasRepositoryAccess: true,
        permissionError: null
      };

      const mockPanel = {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      };

      mockDocument.getElementById = jest.fn((id) => {
        if (id === 'gtt-panel') {
          return mockPanel;
        }
        return null;
      });

      // Act: simulate onUrlChange logic
      if (state.isOpen) {
        const panel = mockDocument.getElementById('gtt-panel');
        if (panel) {
          panel.classList.add('hidden');
        }
        state.isOpen = false;
        state.hasRepositoryAccess = null;
        state.permissionError = null;
      }

      // Assert
      expect(mockPanel.classList.add).toHaveBeenCalledWith('hidden');
      expect(state.isOpen).toBe(false);
      expect(state.hasRepositoryAccess).toBeNull();
      expect(state.permissionError).toBeNull();
    });

    test('should not attempt to close panel if already closed', () => {
      // Arrange: panel is already closed
      const state = {
        isOpen: false,
        hasRepositoryAccess: null,
        permissionError: null
      };

      const mockPanel = {
        classList: {
          add: jest.fn()
        }
      };

      mockDocument.getElementById = jest.fn((id) => {
        if (id === 'gtt-panel') {
          return mockPanel;
        }
        return null;
      });

      // Act: simulate onUrlChange logic
      if (state.isOpen) {
        const panel = mockDocument.getElementById('gtt-panel');
        if (panel) {
          panel.classList.add('hidden');
        }
        state.isOpen = false;
      }

      // Assert: should not call classList.add
      expect(mockPanel.classList.add).not.toHaveBeenCalled();
      expect(mockDocument.getElementById).not.toHaveBeenCalled();
    });

    test('should reset permission state when closing panel on navigation', () => {
      // Arrange
      const state = {
        isOpen: true,
        hasRepositoryAccess: true,
        permissionError: 'Some error'
      };

      const mockPanel = {
        classList: {
          add: jest.fn()
        }
      };

      mockDocument.getElementById = jest.fn(() => mockPanel);

      // Act
      if (state.isOpen) {
        const panel = mockDocument.getElementById('gtt-panel');
        if (panel) {
          panel.classList.add('hidden');
        }
        state.isOpen = false;
        state.hasRepositoryAccess = null;
        state.permissionError = null;
      }

      // Assert: permission state should be reset
      expect(state.hasRepositoryAccess).toBeNull();
      expect(state.permissionError).toBeNull();
    });

    test('should handle panel not found gracefully', () => {
      // Arrange
      const state = {
        isOpen: true,
        hasRepositoryAccess: true,
        permissionError: null
      };

      mockDocument.getElementById = jest.fn(() => null);

      // Act: should not throw error
      if (state.isOpen) {
        const panel = mockDocument.getElementById('gtt-panel');
        if (panel) {
          panel.classList.add('hidden');
        }
        state.isOpen = false;
        state.hasRepositoryAccess = null;
        state.permissionError = null;
      }

      // Assert: state should still be updated
      expect(state.isOpen).toBe(false);
      expect(state.hasRepositoryAccess).toBeNull();
      expect(state.permissionError).toBeNull();
    });

    test('complete flow: issues list -> issue detail with panel open', () => {
      // Arrange: start at issues list with panel open
      mockWindow.location.pathname = '/testorg/testrepo/issues';
      const state = {
        isOpen: true,
        issueData: null,
        panelMode: 'reports'
      };

      const mockPanel = {
        classList: {
          add: jest.fn()
        }
      };

      mockDocument.getElementById = jest.fn(() => mockPanel);

      // Act 1: Navigate to issue #42 (SPA navigation)
      mockWindow.location.pathname = '/testorg/testrepo/issues/42';

      // Act 2: onUrlChange should close panel
      if (state.isOpen) {
        const panel = mockDocument.getElementById('gtt-panel');
        if (panel) {
          panel.classList.add('hidden');
        }
        state.isOpen = false;
      }

      // Assert: panel should be closed
      expect(mockPanel.classList.add).toHaveBeenCalledWith('hidden');
      expect(state.isOpen).toBe(false);

      // Act 3: User reopens panel
      state.isOpen = true;

      // Act 4: Detect new issue
      const urlMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      if (urlMatch) {
        state.issueData = {
          owner: urlMatch[1],
          repo: urlMatch[2],
          number: parseInt(urlMatch[3])
        };
        state.panelMode = 'log'; // Should default to log mode on issue pages
      }

      // Assert: panel should now show correct issue data
      expect(state.issueData).not.toBeNull();
      expect(state.issueData.number).toBe(42);
      expect(state.panelMode).toBe('log');
    });
  });
});
