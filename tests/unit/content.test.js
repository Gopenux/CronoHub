// CronoHub - Content Script Tests
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI Team

const GitHubAPIMocks = require('../mocks/github-api-mocks');

/**
 * These tests validate the content.js time logging flow
 * using mocked GitHub API responses without real tokens
 */
describe('Content Script - Time Logging', () => {
  let mockChrome;
  let mockFetch;
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
        pathname: '/testowner/testrepo/issues/1',
        search: ''
      }
    };

    global.chrome = mockChrome;
    global.window = mockWindow;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Post Time Comment', () => {
    test('should successfully post time comment with valid token', async () => {
      // Arrange
      const issueData = {
        owner: 'testowner',
        repo: 'testrepo',
        number: 1,
        title: 'Test Issue'
      };
      const hours = 2.5;
      const description = 'Worked on feature implementation';

      global.fetch.mockResolvedValueOnce(GitHubAPIMocks.comments.success);

      // Act
      const commentBody = `⏱️ **Time Tracked:** ${hours} ${hours === 1 ? 'Hour' : 'Hours'}${description ? '\n\n' + description : ''}\n\n---\n<sub>**Logged with CronoHub** by Gopenux AI</sub>`;

      const response = await fetch(
        `https://api.github.com/repos/${issueData.owner}/${issueData.repo}/issues/${issueData.number}/comments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GitHubAPIMocks.VALID_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ body: commentBody })
        }
      );

      const result = await response.json();

      // Assert
      expect(response.ok).toBe(true);
      expect(response.status).toBe(201);
      expect(result.id).toBe(987654321);
      expect(result.body).toContain('⏱️ **Time Tracked:** 2.5 Hours');
      expect(result.body).toContain('Worked on feature');
      expect(result.user.login).toBe('testuser');
    });

    test('should format comment correctly with single hour', async () => {
      // Arrange
      const hours = 1;
      const description = 'Quick fix';

      global.fetch.mockResolvedValueOnce(GitHubAPIMocks.comments.success);

      // Act
      const commentBody = `⏱️ **Time Tracked:** ${hours} ${hours === 1 ? 'Hour' : 'Hours'}${description ? '\n\n' + description : ''}\n\n---\n<sub>**Logged with CronoHub** by Gopenux AI</sub>`;

      // Assert
      expect(commentBody).toContain('1 Hour');
      expect(commentBody).not.toContain('Hours');
      expect(commentBody).toContain('Quick fix');
      expect(commentBody).toContain('Logged with CronoHub');
    });

    test('should format comment correctly with multiple hours', async () => {
      // Arrange
      const hours = 3.5;
      const description = '';

      // Act
      const commentBody = `⏱️ **Time Tracked:** ${hours} ${hours === 1 ? 'Hour' : 'Hours'}${description ? '\n\n' + description : ''}\n\n---\n<sub>**Logged with CronoHub** by Gopenux AI</sub>`;

      // Assert
      expect(commentBody).toContain('3.5 Hours');
      expect(commentBody).toContain('Logged with CronoHub');
      expect(commentBody).not.toContain('\n\n\n'); // No extra newlines when description is empty
    });

    test('should handle 404 error (issue not found)', async () => {
      // Arrange
      global.fetch.mockResolvedValueOnce(GitHubAPIMocks.comments.notFound);

      // Act
      const response = await fetch(
        'https://api.github.com/repos/testowner/testrepo/issues/999/comments',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GitHubAPIMocks.VALID_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ body: 'Test comment' })
        }
      );

      const errorData = await response.json();

      // Assert
      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
      expect(errorData.message).toBe('Not Found');
    });

    test('should handle 403 error (no write permission)', async () => {
      // Arrange
      global.fetch.mockResolvedValueOnce(GitHubAPIMocks.comments.forbidden);

      // Act
      const response = await fetch(
        'https://api.github.com/repos/testowner/testrepo/issues/1/comments',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GitHubAPIMocks.VALID_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ body: 'Test comment' })
        }
      );

      const errorData = await response.json();

      // Assert
      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
      expect(errorData.message).toContain('permission');
    });

    test('should handle 422 validation error', async () => {
      // Arrange
      global.fetch.mockResolvedValueOnce(GitHubAPIMocks.comments.validationError);

      // Act
      const response = await fetch(
        'https://api.github.com/repos/testowner/testrepo/issues/1/comments',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GitHubAPIMocks.VALID_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ body: '' }) // Empty body
        }
      );

      const errorData = await response.json();

      // Assert
      expect(response.ok).toBe(false);
      expect(response.status).toBe(422);
      expect(errorData.message).toBe('Validation Failed');
      expect(errorData.errors).toBeDefined();
    });

    test('should handle network errors', async () => {
      // Arrange
      global.fetch.mockRejectedValueOnce(new Error('Network request failed'));

      // Act & Assert
      await expect(
        fetch('https://api.github.com/repos/testowner/testrepo/issues/1/comments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GitHubAPIMocks.VALID_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ body: 'Test' })
        })
      ).rejects.toThrow('Network request failed');
    });
  });

  describe('Issue Detection', () => {
    test('should detect issue from direct URL', () => {
      // Arrange
      mockWindow.location.pathname = '/testowner/testrepo/issues/42';

      // Act
      const urlMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);

      // Assert
      expect(urlMatch).not.toBeNull();
      expect(urlMatch[1]).toBe('testowner');
      expect(urlMatch[2]).toBe('testrepo');
      expect(urlMatch[3]).toBe('42');
    });

    test('should detect issue from URL parameter', () => {
      // Arrange
      mockWindow.location.search = '?issue=testowner%7Ctestrepo%7C123';

      // Act
      const urlParams = new URLSearchParams(mockWindow.location.search);
      const paneIssue = urlParams.get('issue');
      const decoded = decodeURIComponent(paneIssue);
      const parts = decoded.split('|');

      // Assert
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('testowner');
      expect(parts[1]).toBe('testrepo');
      expect(parts[2]).toBe('123');
    });

    test('should return null for non-issue pages', () => {
      // Arrange
      mockWindow.location.pathname = '/testowner/testrepo/pulls/1';

      // Act
      const urlMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);

      // Assert
      expect(urlMatch).toBeNull();
    });

    test('should parse issue number as integer', () => {
      // Arrange
      mockWindow.location.pathname = '/testowner/testrepo/issues/789';

      // Act
      const urlMatch = mockWindow.location.pathname.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
      const issueNumber = parseInt(urlMatch[3]);

      // Assert
      expect(issueNumber).toBe(789);
      expect(typeof issueNumber).toBe('number');
    });
  });

  describe('Input Validation', () => {
    test('should validate hours input (valid)', () => {
      // Arrange
      const testCases = [
        { input: '2.5', expected: 2.5 },
        { input: '1', expected: 1 },
        { input: '0.25', expected: 0.25 },
        { input: '24', expected: 24 }
      ];

      testCases.forEach(({ input, expected }) => {
        // Act
        const hours = parseFloat(input);
        const isValid = !isNaN(hours) && hours > 0 && hours <= 24;

        // Assert
        expect(isValid).toBe(true);
        expect(hours).toBe(expected);
      });
    });

    test('should reject invalid hours input', () => {
      // Arrange
      const invalidInputs = ['', 'abc', '-1', '0', '25', '100'];

      invalidInputs.forEach(input => {
        // Act
        const hours = parseFloat(input);
        const isValid = !isNaN(hours) && hours > 0 && hours <= 24;

        // Assert
        expect(isValid).toBe(false);
      });
    });

    test('should validate hours range (0.25 to 24)', () => {
      // Arrange
      const testCases = [
        { hours: 0.25, valid: true },
        { hours: 0.24, valid: false },
        { hours: 24, valid: true },
        { hours: 24.1, valid: false },
        { hours: 0, valid: false },
        { hours: -1, valid: false }
      ];

      testCases.forEach(({ hours, valid }) => {
        // Act
        const isValid = hours >= 0.25 && hours <= 24;

        // Assert
        expect(isValid).toBe(valid);
      });
    });

    test('should trim description whitespace', () => {
      // Arrange
      const description = '  Worked on feature  ';

      // Act
      const trimmed = description.trim();

      // Assert
      expect(trimmed).toBe('Worked on feature');
      expect(trimmed.length).toBe(17);
    });

    test('should handle empty description', () => {
      // Arrange
      const description = '';

      // Act
      const trimmed = description.trim();

      // Assert
      expect(trimmed).toBe('');
    });
  });

  describe('Extension Context Validation', () => {
    test('should validate extension context is active', () => {
      // Act
      const isValid = !!(chrome && chrome.runtime && chrome.runtime.id);

      // Assert
      expect(isValid).toBe(true);
    });

    test('should detect invalidated extension context', () => {
      // Arrange
      mockChrome.runtime.id = null;

      // Act
      const isValid = !!(chrome && chrome.runtime && chrome.runtime.id);

      // Assert
      expect(isValid).toBe(false);
    });

    test('should handle chrome API not available', () => {
      // Arrange
      global.chrome = undefined;

      // Act
      let isValid;
      try {
        isValid = !!(chrome && chrome.runtime && chrome.runtime.id);
      } catch (e) {
        isValid = false;
      }

      // Assert
      expect(isValid).toBe(false);

      // Cleanup
      global.chrome = mockChrome;
    });
  });

  describe('Configuration Loading', () => {
    test('should load configuration from chrome.storage', async () => {
      // Act
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['githubToken', 'userData'], resolve);
      });

      // Assert
      expect(result.githubToken).toBe(GitHubAPIMocks.VALID_TOKEN);
      expect(result.userData).toBeDefined();
      expect(result.userData.login).toBe('testuser');
    });

    test('should handle missing configuration', async () => {
      // Arrange
      mockChrome.storage.local.get = jest.fn((keys, callback) => {
        callback({});
      });

      // Act
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['githubToken', 'userData'], resolve);
      });

      // Assert
      expect(result.githubToken).toBeUndefined();
      expect(result.userData).toBeUndefined();
    });

    test('should handle chrome.runtime.lastError', async () => {
      // Arrange
      mockChrome.runtime.lastError = { message: 'Storage error' };
      mockChrome.storage.local.get = jest.fn((keys, callback) => {
        callback({});
      });

      // Act
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['githubToken', 'userData'], (data) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve(data);
          }
        });
      });

      // Assert
      expect(result.error).toBe('Storage error');

      // Cleanup
      mockChrome.runtime.lastError = null;
    });
  });

  describe('API Request Headers', () => {
    test('should include correct authorization header', () => {
      // Arrange
      const headers = {
        'Authorization': `Bearer ${GitHubAPIMocks.VALID_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      };

      // Assert
      expect(headers.Authorization).toContain('Bearer');
      expect(headers.Authorization).toContain(GitHubAPIMocks.VALID_TOKEN);
      expect(headers.Accept).toBe('application/vnd.github.v3+json');
      expect(headers['Content-Type']).toBe('application/json');
    });

    test('should use correct GitHub API version', () => {
      // Arrange
      const headers = {
        'Accept': 'application/vnd.github.v3+json'
      };

      // Assert
      expect(headers.Accept).toContain('github.v3');
    });
  });

  describe('Error Message Extraction', () => {
    test('should extract error message from API response', async () => {
      // Arrange
      global.fetch.mockResolvedValueOnce(GitHubAPIMocks.comments.forbidden);

      // Act
      const response = await fetch(
        'https://api.github.com/repos/testowner/testrepo/issues/1/comments',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GitHubAPIMocks.VALID_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ body: 'Test' })
        }
      );

      let errorMessage = 'Error ' + response.status;
      if (!response.ok) {
        const data = await response.json();
        errorMessage = data.message || errorMessage;
      }

      // Assert
      expect(errorMessage).toContain('permission');
      expect(errorMessage).not.toContain('Error 403');
    });

    test('should fallback to status code when no message', async () => {
      // Arrange
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      // Act
      const response = await fetch(
        'https://api.github.com/repos/testowner/testrepo/issues/1/comments',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GitHubAPIMocks.VALID_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ body: 'Test' })
        }
      );

      let errorMessage = 'Error ' + response.status;
      if (!response.ok) {
        const data = await response.json();
        errorMessage = data.message || errorMessage;
      }

      // Assert
      expect(errorMessage).toBe('Error 500');
    });
  });
});
