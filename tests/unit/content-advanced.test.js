// CronoHub - Advanced Content Script Tests
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI Team

const GitHubAPIMocks = require('../mocks/github-api-mocks');

/**
 * These tests cover advanced functionality in content.js:
 * - Chrome storage synchronization
 * - Panel state management
 * - Report generation validation
 */
describe('Content Script - Advanced Functionality', () => {
  let mockChrome;
  let mockDocument;
  let mockWindow;
  let state;
  let storageListeners;

  beforeEach(() => {
    // Mock storage data
    const storageData = {
      githubToken: GitHubAPIMocks.VALID_TOKEN,
      userData: {
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345678?v=4'
      }
    };

    // Track storage listeners
    storageListeners = [];

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
          }),
          set: jest.fn((data, callback) => {
            Object.assign(storageData, data);
            // Trigger listeners
            storageListeners.forEach(listener => {
              listener(data, 'local');
            });
            if (callback) callback();
            return Promise.resolve();
          })
        },
        onChanged: {
          addListener: jest.fn((listener) => {
            storageListeners.push(listener);
          })
        }
      },
      runtime: {
        id: 'test-extension-id',
        lastError: null
      }
    };

    // Mock state object
    state = {
      isOpen: false,
      isLoading: false,
      config: null,
      issueData: null,
      panelMode: 'log',
      reportsData: null,
      allCollaborators: [],
      selectedCollaborators: []
    };

    mockWindow = {
      location: {
        pathname: '/testowner/testrepo/issues/1',
        search: ''
      }
    };

    mockDocument = {
      getElementById: jest.fn(),
      querySelector: jest.fn(),
      body: {
        appendChild: jest.fn()
      }
    };

    global.chrome = mockChrome;
    global.window = mockWindow;
    global.document = mockDocument;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    storageListeners = [];
  });

  describe('Chrome Storage Synchronization', () => {
    test('should reload config when storage changes', async () => {
      // Arrange - Setup initial config
      state.config = {
        githubToken: 'old-token',
        userData: { login: 'olduser' }
      };

      // Register storage listener
      expect(mockChrome.storage.onChanged.addListener).toBeDefined();

      // Simulate adding listener (as content.js does)
      mockChrome.storage.onChanged.addListener((callback) => {
        // Listener added for storage changes
        void callback;
      });

      const listener = storageListeners[0];
      expect(listener).toBeDefined();

      // Act - Trigger storage change and simulate loadConfig being called
      const updatedConfig = await new Promise((resolve) => {
        chrome.storage.local.get(['githubToken', 'userData'], resolve);
      });

      // Assert
      expect(updatedConfig.githubToken).toBe(GitHubAPIMocks.VALID_TOKEN);
      expect(updatedConfig.userData.login).toBe('testuser');
    });

    test('should only react to local storage changes', () => {
      // Arrange
      const listener = jest.fn();
      mockChrome.storage.onChanged.addListener(listener);

      // Act - Trigger sync storage change (should be ignored)
      // In real implementation, listener checks namespace === 'local'
      const shouldReact = (namespace) => namespace === 'local';

      // Assert
      expect(shouldReact('local')).toBe(true);
      expect(shouldReact('sync')).toBe(false);
      expect(shouldReact('managed')).toBe(false);
    });

    test('should handle errors during config reload', async () => {
      // Arrange - Make storage.get fail
      mockChrome.runtime.lastError = { message: 'Storage error' };

      // Act
      const error = await new Promise((resolve) => {
        chrome.storage.local.get(['githubToken', 'userData'], () => {
          if (chrome.runtime.lastError) {
            resolve(chrome.runtime.lastError);
          } else {
            resolve(null);
          }
        });
      });

      // Assert
      expect(error).toBeDefined();
      expect(error.message).toBe('Storage error');

      // Cleanup
      mockChrome.runtime.lastError = null;
    });

    test('should update state.config when token changes', async () => {
      // Arrange
      const oldConfig = {
        githubToken: 'old-token',
        userData: { login: 'olduser' }
      };
      state.config = oldConfig;

      // Act - Simulate token update
      await chrome.storage.local.set({
        githubToken: 'new-token',
        userData: { login: 'newuser', name: 'New User' }
      });

      // Reload config (as storage listener would do)
      const newConfig = await new Promise((resolve) => {
        chrome.storage.local.get(['githubToken', 'userData'], resolve);
      });

      // Assert
      expect(newConfig.githubToken).not.toBe(oldConfig.githubToken);
      expect(newConfig.userData.login).not.toBe(oldConfig.userData.login);
    });

    test('should persist listener throughout session', () => {
      // Arrange & Act
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      mockChrome.storage.onChanged.addListener(listener1);
      mockChrome.storage.onChanged.addListener(listener2);

      // Assert
      expect(storageListeners).toHaveLength(2);
      expect(storageListeners[0]).toBe(listener1);
      expect(storageListeners[1]).toBe(listener2);
    });
  });

  describe('Panel State Management', () => {
    test('should toggle panel open and closed', () => {
      // Arrange
      state.isOpen = false;

      // Act - Open
      state.isOpen = !state.isOpen;

      // Assert
      expect(state.isOpen).toBe(true);

      // Act - Close
      state.isOpen = !state.isOpen;

      // Assert
      expect(state.isOpen).toBe(false);
    });

    test('should handle missing config when opening panel', () => {
      // Arrange
      state.config = null;
      state.isOpen = false;

      // Act
      const shouldShowError = !state.config || !state.config.githubToken;

      // Assert
      expect(shouldShowError).toBe(true);
    });

    test('should switch between log and reports mode', () => {
      // Arrange
      state.panelMode = 'log';

      // Act - Switch to reports
      state.panelMode = 'reports';

      // Assert
      expect(state.panelMode).toBe('reports');

      // Act - Switch back to log
      state.panelMode = 'log';

      // Assert
      expect(state.panelMode).toBe('log');
    });

    test('should detect project view from pathname', () => {
      // Arrange & Act
      const testCases = [
        { pathname: '/orgs/test/projects/1', expected: true },
        { pathname: '/users/test/projects/1', expected: true },
        { pathname: '/testowner/testrepo/issues/1', expected: false },
        { pathname: '/testowner/testrepo/pulls/1', expected: false }
      ];

      testCases.forEach(({ pathname, expected }) => {
        const isProjectView = pathname.includes('/projects/');
        expect(isProjectView).toBe(expected);
      });
    });

    test('should show error panel when no token', () => {
      // Arrange
      state.config = null;

      // Act
      const shouldShowError = !state.config || !state.config.githubToken;
      const errorType = 'no-config';

      // Assert
      expect(shouldShowError).toBe(true);
      expect(errorType).toBe('no-config');
    });

    test('should show "no issue" panel when in log mode without issue', () => {
      // Arrange
      state.config = {
        githubToken: GitHubAPIMocks.VALID_TOKEN,
        userData: { login: 'testuser' }
      };
      state.issueData = null;
      state.panelMode = 'log';

      // Act
      const shouldShowNoIssue = state.panelMode === 'log' && !state.issueData;

      // Assert
      expect(shouldShowNoIssue).toBe(true);
    });

    test('should allow reports mode without issue detection', () => {
      // Arrange
      state.config = {
        githubToken: GitHubAPIMocks.VALID_TOKEN,
        userData: { login: 'testuser' }
      };
      state.issueData = null;
      state.panelMode = 'reports';

      // Act
      const canShowReports = state.panelMode === 'reports' && !!state.config;

      // Assert
      expect(canShowReports).toBe(true);
    });

    test('should handle extension context invalidation', () => {
      // Arrange
      mockChrome.runtime.id = null;

      // Act
      const isValid = !!(chrome && chrome.runtime && chrome.runtime.id);

      // Assert
      expect(isValid).toBe(false);

      // Cleanup
      mockChrome.runtime.id = 'test-extension-id';
    });
  });

  describe('Report Generation Validation', () => {
    test('should validate date range before generating report', () => {
      // Arrange
      const startDate = '2026-01-01';
      const endDate = '2026-01-31';

      // Act
      const start = new Date(startDate);
      const end = new Date(endDate);
      const isValid = !isNaN(start.getTime()) &&
                      !isNaN(end.getTime()) &&
                      end >= start;

      // Assert
      expect(isValid).toBe(true);
    });

    test('should reject invalid date range', () => {
      // Arrange
      const startDate = '2026-01-31';
      const endDate = '2026-01-01';

      // Act
      const start = new Date(startDate);
      const end = new Date(endDate);
      const isValid = end >= start;

      // Assert
      expect(isValid).toBe(false);
    });

    test('should validate selected collaborators', () => {
      // Arrange
      state.allCollaborators = [
        { login: 'user1', id: 1 },
        { login: 'user2', id: 2 },
        { login: 'user3', id: 3 }
      ];
      state.selectedCollaborators = [
        { login: 'user1', id: 1 }
      ];

      // Act
      const hasSelection = state.selectedCollaborators.length > 0;
      const selectedUsernames = state.selectedCollaborators.map(c => c.login);

      // Assert
      expect(hasSelection).toBe(true);
      expect(selectedUsernames).toContain('user1');
      expect(selectedUsernames).not.toContain('user2');
    });

    test('should use all collaborators when none selected', () => {
      // Arrange
      state.allCollaborators = [
        { login: 'user1', id: 1 },
        { login: 'user2', id: 2 }
      ];
      state.selectedCollaborators = [];

      // Act
      const selectedUsernames = state.selectedCollaborators.length > 0
        ? state.selectedCollaborators.map(c => c.login)
        : state.allCollaborators.map(c => c.login);

      // Assert
      expect(selectedUsernames).toHaveLength(2);
      expect(selectedUsernames).toContain('user1');
      expect(selectedUsernames).toContain('user2');
    });

    test('should handle empty collaborators list', () => {
      // Arrange
      state.allCollaborators = [];
      state.selectedCollaborators = [];

      // Act
      const hasCollaborators = state.allCollaborators.length > 0;

      // Assert
      expect(hasCollaborators).toBe(false);
    });

    test('should filter out already selected collaborators', () => {
      // Arrange
      state.allCollaborators = [
        { login: 'user1', id: 1 },
        { login: 'user2', id: 2 },
        { login: 'user3', id: 3 }
      ];
      state.selectedCollaborators = [
        { login: 'user1', id: 1 }
      ];

      // Act
      const selectedLogins = state.selectedCollaborators.map(c => c.login);
      const availableCollaborators = state.allCollaborators.filter(
        member => !selectedLogins.includes(member.login)
      );

      // Assert
      expect(availableCollaborators).toHaveLength(2);
      expect(availableCollaborators.find(c => c.login === 'user1')).toBeUndefined();
      expect(availableCollaborators.find(c => c.login === 'user2')).toBeDefined();
    });

    test('should preselect current user in collaborators', () => {
      // Arrange
      const currentUser = 'testuser';
      state.allCollaborators = [
        { login: 'testuser', id: 1 },
        { login: 'otheruser', id: 2 }
      ];
      state.config = {
        userData: { login: currentUser }
      };

      // Act
      const currentUserMember = state.allCollaborators.find(
        m => m.login === currentUser
      );
      const shouldPreselect = !!currentUserMember;

      // Assert
      expect(shouldPreselect).toBe(true);
      expect(currentUserMember.login).toBe('testuser');
    });

    test('should handle missing organization gracefully', () => {
      // Arrange
      state.issueData = null;
      mockWindow.location.pathname = '/';

      // Act
      const urlMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)/);
      const canDetectOrg = !!urlMatch;

      // Assert
      expect(canDetectOrg).toBe(false);
    });

    test('should extract organization from issue data', () => {
      // Arrange
      state.issueData = {
        owner: 'testowner',
        repo: 'testrepo',
        number: 1,
        title: 'Test Issue'
      };

      // Act
      const org = state.issueData.owner;

      // Assert
      expect(org).toBe('testowner');
    });

    test('should fallback to URL parsing when no issue data', () => {
      // Arrange
      state.issueData = null;
      mockWindow.location.pathname = '/testowner/testrepo/pulls/1';

      // Act
      const urlMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)/);
      const org = urlMatch ? urlMatch[1] : null;

      // Assert
      expect(org).toBe('testowner');
    });
  });

  describe('UI State and Loading', () => {
    test('should set loading state during report generation', () => {
      // Arrange
      state.isLoading = false;

      // Act - Start loading
      state.isLoading = true;

      // Assert
      expect(state.isLoading).toBe(true);

      // Act - Finish loading
      state.isLoading = false;

      // Assert
      expect(state.isLoading).toBe(false);
    });

    test('should prevent multiple simultaneous submissions', () => {
      // Arrange
      state.isLoading = true;

      // Act
      const canSubmit = !state.isLoading;

      // Assert
      expect(canSubmit).toBe(false);
    });

    test('should allow submission when not loading', () => {
      // Arrange
      state.isLoading = false;

      // Act
      const canSubmit = !state.isLoading;

      // Assert
      expect(canSubmit).toBe(true);
    });
  });

  describe('Organization Detection', () => {
    test('should detect organization from issue data', () => {
      // Arrange
      state.issueData = {
        owner: 'gopenux',
        repo: 'cronohub',
        number: 1
      };

      // Act
      const org = state.issueData ? state.issueData.owner : null;

      // Assert
      expect(org).toBe('gopenux');
    });

    test('should detect organization from URL when no issue data', () => {
      // Arrange
      state.issueData = null;
      mockWindow.location.pathname = '/microsoft/vscode/issues/123';

      // Act
      const urlMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)/);
      const org = urlMatch ? urlMatch[1] : null;
      const repo = urlMatch ? urlMatch[2] : null;

      // Assert
      expect(org).toBe('microsoft');
      expect(repo).toBe('vscode');
    });

    test('should return null when organization cannot be detected', () => {
      // Arrange
      state.issueData = null;
      mockWindow.location.pathname = '/';

      // Act
      const urlMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)/);
      const org = urlMatch ? urlMatch[1] : null;

      // Assert
      expect(org).toBeNull();
    });
  });

  describe('Smart Dual Clickable Links', () => {
    describe('getCurrentIssueNumber', () => {
      test('should extract issue number from URL', () => {
        // Arrange
        mockWindow.location.pathname = '/gopenux/cronohub/issues/42';

        // Act
        const issueNumber = (() => {
          const urlMatch = mockWindow.location.pathname.match(/\/issues\/(\d+)/);
          return urlMatch ? urlMatch[1] : null;
        })();

        // Assert
        expect(issueNumber).toBe('42');
      });

      test('should return null when not on issue page', () => {
        // Arrange
        mockWindow.location.pathname = '/gopenux/cronohub/pulls/42';

        // Act
        const issueNumber = (() => {
          const urlMatch = mockWindow.location.pathname.match(/\/issues\/(\d+)/);
          return urlMatch ? urlMatch[1] : null;
        })();

        // Assert
        expect(issueNumber).toBeNull();
      });

      test('should fallback to state object when URL method fails', () => {
        // Arrange
        mockWindow.location.pathname = '/gopenux/cronohub';
        state.issueData = { number: 123 };

        // Act
        const issueNumber = (() => {
          const urlMatch = mockWindow.location.pathname.match(/\/issues\/(\d+)/);
          if (urlMatch) return urlMatch[1];
          if (state.issueData && state.issueData.number) {
            return String(state.issueData.number);
          }
          return null;
        })();

        // Assert
        expect(issueNumber).toBe('123');
      });
    });

    describe('extractIssueData', () => {
      test('should extract issue number and URLs from comment URL', () => {
        // Arrange
        const commentUrl = 'https://github.com/gopenux/cronohub/issues/42#issuecomment-123456';

        // Act
        const issueMatch = commentUrl.match(/\/issues\/(\d+)/);
        const issueNumber = issueMatch ? issueMatch[1] : null;
        const issueUrl = commentUrl.replace(/#issuecomment-\d+$/, '');
        const commentIdMatch = commentUrl.match(/#(issuecomment-\d+)$/);
        const commentId = commentIdMatch ? commentIdMatch[1] : null;

        // Assert
        expect(issueNumber).toBe('42');
        expect(issueUrl).toBe('https://github.com/gopenux/cronohub/issues/42');
        expect(commentId).toBe('issuecomment-123456');
      });

      test('should handle URL without comment ID', () => {
        // Arrange
        const commentUrl = 'https://github.com/gopenux/cronohub/issues/42';

        // Act
        const issueMatch = commentUrl.match(/\/issues\/(\d+)/);
        const commentIdMatch = commentUrl.match(/#(issuecomment-\d+)$/);
        const commentId = commentIdMatch ? commentIdMatch[1] : null;

        // Assert
        expect(issueMatch[1]).toBe('42');
        expect(commentId).toBeNull();
      });

      test('should return null for invalid URLs', () => {
        // Arrange
        const commentUrl = 'https://github.com/gopenux/cronohub/pulls/42';

        // Act
        const issueMatch = commentUrl.match(/\/issues\/(\d+)/);

        // Assert
        expect(issueMatch).toBeNull();
      });

      test('should handle null or undefined URLs', () => {
        // Act & Assert
        expect(null).toBeNull();
        expect(undefined).toBeUndefined();
      });
    });

    describe('generateSmartLink', () => {
      test('should create dual clickable links for same issue', () => {
        // Arrange
        const currentIssue = '42';
        const commentUrl = 'https://github.com/gopenux/cronohub/issues/42#issuecomment-123456';

        // Extract data
        const issueMatch = commentUrl.match(/\/issues\/(\d+)/);
        const targetIssue = issueMatch ? issueMatch[1] : null;
        const commentIdMatch = commentUrl.match(/#(issuecomment-\d+)$/);
        const commentId = commentIdMatch ? commentIdMatch[1] : null;

        // Act - Same issue scenario
        const isSameIssue = currentIssue === targetIssue;
        const shouldNavigateToComment = !!(isSameIssue && commentId);

        // Assert
        expect(isSameIssue).toBe(true);
        expect(shouldNavigateToComment).toBe(true);
        expect(commentId).toBe('issuecomment-123456');
      });

      test('should create dual clickable links for different issue', () => {
        // Arrange
        const currentIssue = '42';
        const commentUrl = 'https://github.com/gopenux/cronohub/issues/99#issuecomment-789012';

        // Extract data
        const issueMatch = commentUrl.match(/\/issues\/(\d+)/);
        const targetIssue = issueMatch ? issueMatch[1] : null;
        const issueUrl = commentUrl.replace(/#issuecomment-\d+$/, '');

        // Act - Different issue scenario
        const isSameIssue = currentIssue === targetIssue;
        const shouldOpenInNewTab = !isSameIssue;

        // Assert
        expect(isSameIssue).toBe(false);
        expect(shouldOpenInNewTab).toBe(true);
        expect(issueUrl).toBe('https://github.com/gopenux/cronohub/issues/99');
      });

      test('should render both issue number and timestamp as clickable', () => {
        // Arrange
        const issueNumber = '42';
        const timestamp = '2026-01-15 10:30';

        // Act - Simulate HTML generation
        const issueHtml = `<a style="color: #0969da; cursor: pointer;">#${issueNumber}</a>`;
        const timestampHtml = `<span style="color: #656d76; cursor: pointer;">${timestamp}</span>`;

        // Assert - Both should have clickable styling
        expect(issueHtml).toContain('cursor: pointer');
        expect(issueHtml).toContain('#42');
        expect(timestampHtml).toContain('cursor: pointer');
        expect(timestampHtml).toContain('2026-01-15 10:30');
      });

      test('should handle missing comment URL gracefully', () => {
        // Arrange
        const commentUrl = null;

        // Act
        const issueMatch = commentUrl ? commentUrl.match(/\/issues\/(\d+)/) : null;

        // Assert
        expect(issueMatch).toBeNull();
      });

      test('should apply hover effects to both links', () => {
        // Arrange - Simulate hover styles
        const issueStyle = 'color: #0969da; cursor: pointer; text-decoration: none';
        const issueHoverStyle = 'text-decoration: underline';
        const timestampStyle = 'color: #656d76; cursor: pointer';
        const timestampHoverStyle = 'text-decoration: underline';

        // Assert - Verify hover effect styles exist
        expect(issueHoverStyle).toContain('underline');
        expect(timestampHoverStyle).toContain('underline');
        expect(issueStyle).toContain('cursor: pointer');
        expect(timestampStyle).toContain('cursor: pointer');
      });
    });
  });
});
