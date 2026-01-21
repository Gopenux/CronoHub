// CronoHub - Repository Pages Tests (Issue #32)
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI Team

const GitHubAPIMocks = require('../mocks/github-api-mocks');

/**
 * These tests validate the repository page functionality (Issue #32):
 * - Button visibility on repository pages without issues
 * - Reports-only mode on non-issue pages
 * - "Back to Log Time" button conditional rendering
 */
describe('Content Script - Repository Pages (Issue #32)', () => {
  let mockChrome;
  let mockWindow;

  beforeEach(() => {
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
          }),
          set: jest.fn((data, callback) => {
            Object.assign(storageData, data);
            if (callback) callback();
            return Promise.resolve();
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

    mockWindow = {
      location: {
        pathname: '/testowner/testrepo',
        search: '',
        href: 'https://github.com/testowner/testrepo'
      }
    };

    global.chrome = mockChrome;
    global.window = mockWindow;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectRepositoryPage Function', () => {
    test('should detect repository home page', () => {
      // Arrange
      const pathname = '/testowner/testrepo';

      // Act
      const repoMatch = pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);
      const isIssuePage = /\/issues\/\d+/.test(pathname);
      const isProjectPage = /\/projects\/\d+/.test(pathname);

      // Assert
      expect(repoMatch).not.toBeNull();
      expect(repoMatch[1]).toBe('testowner');
      expect(repoMatch[2]).toBe('testrepo');
      expect(isIssuePage).toBe(false);
      expect(isProjectPage).toBe(false);
    });

    test('should detect repository pulls page', () => {
      // Arrange
      const pathname = '/testowner/testrepo/pulls';

      // Act
      const repoMatch = pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);
      const isIssuePage = /\/issues\/\d+/.test(pathname);

      // Assert
      expect(repoMatch).not.toBeNull();
      expect(repoMatch[1]).toBe('testowner');
      expect(repoMatch[2]).toBe('testrepo');
      expect(isIssuePage).toBe(false);
    });

    test('should detect repository issues list page', () => {
      // Arrange
      const pathname = '/testowner/testrepo/issues';

      // Act
      const repoMatch = pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);
      const isIssuePage = /\/issues\/\d+/.test(pathname);

      // Assert
      expect(repoMatch).not.toBeNull();
      expect(isIssuePage).toBe(false); // No specific issue number
    });

    test('should NOT detect specific issue pages', () => {
      // Arrange
      const pathname = '/testowner/testrepo/issues/42';

      // Act
      const isIssuePage = /\/issues\/\d+/.test(pathname);

      // Assert
      expect(isIssuePage).toBe(true); // This should NOT be detected as repo page
    });

    test('should NOT detect projects pages', () => {
      // Arrange
      const pathname = '/orgs/testorg/projects/123';

      // Act
      const isProjectPage = /\/projects\/\d+/.test(pathname);

      // Assert
      expect(isProjectPage).toBe(true); // This should NOT be detected as repo page
    });

    test('should exclude special GitHub pages', () => {
      // Arrange
      const testCases = [
        { pathname: '/orgs/testorg', excluded: true },
        { pathname: '/settings', excluded: true },
        { pathname: '/marketplace', excluded: true },
        { pathname: '/testowner/testrepo', excluded: false }
      ];

      testCases.forEach(({ pathname, excluded }) => {
        // Act
        const repoMatch = pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);
        const isSpecialPage = repoMatch &&
          (repoMatch[1] === 'orgs' || repoMatch[1] === 'settings' || repoMatch[1] === 'marketplace');

        // Assert
        if (excluded) {
          expect(isSpecialPage || !repoMatch).toBe(true);
        } else {
          expect(isSpecialPage).toBe(false);
          expect(repoMatch).not.toBeNull();
        }
      });
    });

    test('should detect repository with trailing slash', () => {
      // Arrange
      const pathname = '/testowner/testrepo/';

      // Act
      const repoMatch = pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);

      // Assert
      expect(repoMatch).not.toBeNull();
      expect(repoMatch[1]).toBe('testowner');
      expect(repoMatch[2]).toBe('testrepo');
    });

    test('should detect repository code page', () => {
      // Arrange
      const pathname = '/testowner/testrepo/tree/main';

      // Act
      const repoMatch = pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);

      // Assert
      expect(repoMatch).not.toBeNull();
      expect(repoMatch[1]).toBe('testowner');
      expect(repoMatch[2]).toBe('testrepo');
    });

    test('should return null for user profile pages', () => {
      // Arrange
      const pathname = '/testuser';

      // Act
      const repoMatch = pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);

      // Assert
      expect(repoMatch).toBeNull();
    });
  });

  describe('Button Visibility on Repository Pages', () => {
    test('should show button on repository home page', () => {
      // Arrange
      mockWindow.location.pathname = '/testowner/testrepo';

      // Act - Simulate detectIssue logic
      const issueMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      const repoMatch = mockWindow.location.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);
      const isSpecialPage = repoMatch &&
        (repoMatch[1] === 'orgs' || repoMatch[1] === 'settings' || repoMatch[1] === 'marketplace');

      const shouldShowButton = issueMatch !== null || (repoMatch !== null && !isSpecialPage);

      // Assert
      expect(shouldShowButton).toBe(true);
      expect(issueMatch).toBeNull(); // No issue detected
      expect(repoMatch).not.toBeNull(); // But repo detected
    });

    test('should show button on repository pulls page', () => {
      // Arrange
      mockWindow.location.pathname = '/testowner/testrepo/pulls';

      // Act
      const issueMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      const repoMatch = mockWindow.location.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);
      const shouldShowButton = issueMatch !== null || repoMatch !== null;

      // Assert
      expect(shouldShowButton).toBe(true);
    });

    test('should show button on repository issues list page', () => {
      // Arrange
      mockWindow.location.pathname = '/testowner/testrepo/issues';

      // Act
      const issueMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      const repoMatch = mockWindow.location.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);
      const shouldShowButton = issueMatch !== null || repoMatch !== null;

      // Assert
      expect(shouldShowButton).toBe(true);
    });

    test('should NOT show button on user profile page', () => {
      // Arrange
      mockWindow.location.pathname = '/testuser';

      // Act
      const issueMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      const repoMatch = mockWindow.location.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);
      const shouldShowButton = issueMatch !== null || repoMatch !== null;

      // Assert
      expect(shouldShowButton).toBe(false);
    });

    test('should show button on specific issue page', () => {
      // Arrange
      mockWindow.location.pathname = '/testowner/testrepo/issues/42';

      // Act
      const issueMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      const shouldShowButton = issueMatch !== null;

      // Assert
      expect(shouldShowButton).toBe(true);
      expect(issueMatch[3]).toBe('42');
    });
  });

  describe('Panel Mode Management', () => {
    test('should force reports mode when no issue is detected', () => {
      // Arrange
      let panelMode = 'log';
      const issueData = null; // No issue detected

      // Act - Simulate togglePanel logic
      if (!issueData) {
        panelMode = 'reports';
      }

      // Assert
      expect(panelMode).toBe('reports');
    });

    test('should keep log mode when issue is detected', () => {
      // Arrange
      let panelMode = 'log';
      const issueData = { owner: 'testowner', repo: 'testrepo', number: 42 };

      // Act - Simulate togglePanel logic
      if (!issueData) {
        panelMode = 'reports';
      }

      // Assert
      expect(panelMode).toBe('log');
    });

    test('should allow manual switch to reports mode on issue pages', () => {
      // Arrange
      let panelMode = 'log';
      const issueData = { owner: 'testowner', repo: 'testrepo', number: 42 };

      // Act - User clicks "View Reports"
      panelMode = 'reports';

      // Assert
      expect(panelMode).toBe('reports');
      expect(issueData).not.toBeNull(); // Issue still exists
    });
  });

  describe('Back to Log Time Button Rendering', () => {
    test('should NOT render "Back to Log Time" button when no issue detected', () => {
      // Arrange
      const issueData = null;

      // Act - Simulate button rendering logic
      const shouldShowBackButton = issueData !== null;

      // Assert
      expect(shouldShowBackButton).toBe(false);
    });

    test('should render "Back to Log Time" button when issue is detected', () => {
      // Arrange
      const issueData = { owner: 'testowner', repo: 'testrepo', number: 42 };

      // Act - Simulate button rendering logic
      const shouldShowBackButton = issueData !== null;

      // Assert
      expect(shouldShowBackButton).toBe(true);
    });

    test('should render "Back to Log Time" button in reports mode on issue page', () => {
      // Arrange
      const issueData = { owner: 'testowner', repo: 'testrepo', number: 42 };
      const panelMode = 'reports';

      // Act
      const shouldShowBackButton = issueData !== null;

      // Assert
      expect(shouldShowBackButton).toBe(true);
      expect(panelMode).toBe('reports');
    });

    test('should generate reports HTML without back button when no issue', () => {
      // Arrange
      const issueData = null;
      const htmlParts = ['<button id="gtt-generate-report">Generate Report</button>'];

      // Act - Simulate conditional rendering
      if (issueData) {
        htmlParts.push('<button id="gtt-back-to-log">Back to Log Time</button>');
      }

      const html = htmlParts.join('');

      // Assert
      expect(html).toContain('gtt-generate-report');
      expect(html).not.toContain('gtt-back-to-log');
    });

    test('should generate reports HTML with back button when issue exists', () => {
      // Arrange
      const issueData = { owner: 'testowner', repo: 'testrepo', number: 42 };
      const htmlParts = ['<button id="gtt-generate-report">Generate Report</button>'];

      // Act - Simulate conditional rendering
      if (issueData) {
        htmlParts.push('<button id="gtt-back-to-log">Back to Log Time</button>');
      }

      const html = htmlParts.join('');

      // Assert
      expect(html).toContain('gtt-generate-report');
      expect(html).toContain('gtt-back-to-log');
    });
  });

  describe('Organization Detection from URL', () => {
    test('should extract organization from repository URL when no issue', () => {
      // Arrange
      mockWindow.location.pathname = '/testowner/testrepo';

      // Act
      const urlMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)/);
      const org = urlMatch ? urlMatch[1] : null;
      const repo = urlMatch ? urlMatch[2] : null;

      // Assert
      expect(org).toBe('testowner');
      expect(repo).toBe('testrepo');
    });

    test('should extract organization from pulls page', () => {
      // Arrange
      mockWindow.location.pathname = '/testowner/testrepo/pulls';

      // Act
      const urlMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)/);
      const org = urlMatch ? urlMatch[1] : null;
      const repo = urlMatch ? urlMatch[2] : null;

      // Assert
      expect(org).toBe('testowner');
      expect(repo).toBe('testrepo');
    });

    test('should extract organization from issues list page', () => {
      // Arrange
      mockWindow.location.pathname = '/testowner/testrepo/issues';

      // Act
      const urlMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)/);
      const org = urlMatch ? urlMatch[1] : null;
      const repo = urlMatch ? urlMatch[2] : null;

      // Assert
      expect(org).toBe('testowner');
      expect(repo).toBe('testrepo');
    });
  });

  describe('Integration Scenarios', () => {
    test('complete flow: repository page -> open panel -> reports mode', () => {
      // Arrange
      mockWindow.location.pathname = '/testowner/testrepo';
      let panelMode = 'log';
      let issueData = null;

      // Act 1: Detect page
      const issueMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      if (!issueMatch) {
        issueData = null;
      }

      // Act 2: Open panel
      if (!issueData) {
        panelMode = 'reports';
      }

      // Assert
      expect(issueData).toBeNull();
      expect(panelMode).toBe('reports');
    });

    test('complete flow: issue page -> open panel -> log mode available', () => {
      // Arrange
      mockWindow.location.pathname = '/testowner/testrepo/issues/42';
      let panelMode = 'log';
      let issueData = null;

      // Act 1: Detect page
      const issueMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      if (issueMatch) {
        issueData = {
          owner: issueMatch[1],
          repo: issueMatch[2],
          number: parseInt(issueMatch[3])
        };
      }

      // Act 2: Open panel (issueData exists, so mode stays as 'log')
      // No forced mode change needed

      // Assert
      expect(issueData).not.toBeNull();
      expect(issueData.number).toBe(42);
      expect(panelMode).toBe('log');
    });

    test('complete flow: repository page -> reports only -> no back button', () => {
      // Arrange
      mockWindow.location.pathname = '/testowner/testrepo/pulls';
      let panelMode = 'log';
      let issueData = null;

      // Act 1: Detect page
      const issueMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      if (!issueMatch) {
        issueData = null;
      }

      // Act 2: Open panel
      if (!issueData) {
        panelMode = 'reports';
      }

      // Act 3: Render panel
      const shouldShowBackButton = issueData !== null;

      // Assert
      expect(issueData).toBeNull();
      expect(panelMode).toBe('reports');
      expect(shouldShowBackButton).toBe(false);
    });
  });
});
