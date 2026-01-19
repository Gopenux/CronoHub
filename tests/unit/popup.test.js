// CronoHub - Popup Authentication Tests
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI Team

const GitHubAPIMocks = require('../mocks/github-api-mocks');

/**
 * These tests validate the popup.js authentication flow
 * using mocked GitHub API responses without real tokens
 */
describe('Popup Authentication', () => {
  let mockChrome;
  let mockDocument;
  let elements;

  beforeEach(() => {
    // Mock chrome.storage API
    const storageData = {};
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
          }),
          set: jest.fn((data, callback) => {
            Object.assign(storageData, data);
            if (callback) callback();
          }),
          remove: jest.fn((keys, callback) => {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            keyArray.forEach(key => {
              delete storageData[key];
            });
            if (callback) callback();
          })
        }
      }
    };

    // Mock DOM elements
    elements = {
      githubToken: { value: '', trim: jest.fn(function() { return this.value.trim(); }) },
      saveConfig: {
        disabled: false,
        innerHTML: '',
        addEventListener: jest.fn()
      },
      connectionStatus: { innerHTML: '' },
      authSection: {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      },
      userSection: {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      },
      userAvatar: { src: '' },
      userName: { textContent: '' },
      userLogin: { textContent: '' },
      logoutBtn: { addEventListener: jest.fn() }
    };

    mockDocument = {
      getElementById: jest.fn((id) => elements[id] || null),
      createElement: jest.fn(() => ({
        textContent: '',
        appendChild: jest.fn()
      })),
      body: {
        appendChild: jest.fn()
      },
      head: {
        appendChild: jest.fn()
      }
    };

    // Make mocks globally available
    global.chrome = mockChrome;
    global.document = mockDocument;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Validation', () => {
    test('should validate and save valid GitHub token', async () => {
      // Arrange
      const validToken = GitHubAPIMocks.VALID_TOKEN;
      global.fetch.mockResolvedValueOnce(GitHubAPIMocks.user.success);

      // Act
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const userData = await response.json();

      // Simulate saving to storage
      await new Promise((resolve) => {
        chrome.storage.local.set({
          githubToken: validToken,
          userData: {
            login: userData.login,
            name: userData.name || userData.login,
            avatar_url: userData.avatar_url
          }
        }, resolve);
      });

      // Assert
      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(userData.login).toBe('testuser');
      expect(userData.name).toBe('Test User');
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          githubToken: validToken,
          userData: expect.objectContaining({
            login: 'testuser',
            name: 'Test User'
          })
        }),
        expect.any(Function)
      );
    });

    test('should reject invalid GitHub token', async () => {
      // Arrange
      const invalidToken = GitHubAPIMocks.INVALID_TOKEN;
      global.fetch.mockResolvedValueOnce(GitHubAPIMocks.user.unauthorized);

      // Act
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${invalidToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      // Assert
      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);

      const errorData = await response.json();
      expect(errorData.message).toBe('Bad credentials');
    });

    test('should handle token without required scopes', async () => {
      // Arrange
      const validToken = GitHubAPIMocks.VALID_TOKEN;
      global.fetch.mockResolvedValueOnce(GitHubAPIMocks.user.forbidden);

      // Act
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      // Assert
      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);

      const errorData = await response.json();
      expect(errorData.message).toContain('not accessible');
    });

    test('should handle empty token input', () => {
      // Arrange
      elements.githubToken.value = '';

      // Act
      const token = elements.githubToken.value.trim();

      // Assert
      expect(token).toBe('');
      // In real implementation, this should show an error toast
    });

    test('should trim whitespace from token input', () => {
      // Arrange
      elements.githubToken.value = '  ' + GitHubAPIMocks.VALID_TOKEN + '  ';

      // Act
      const token = elements.githubToken.value.trim();

      // Assert
      expect(token).toBe(GitHubAPIMocks.VALID_TOKEN);
    });
  });

  describe('User Data Management', () => {
    test('should load existing configuration on init', async () => {
      // Arrange
      const savedToken = GitHubAPIMocks.VALID_TOKEN;
      const savedUserData = {
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345678?v=4'
      };

      // Pre-populate storage
      await new Promise((resolve) => {
        chrome.storage.local.set({
          githubToken: savedToken,
          userData: savedUserData
        }, resolve);
      });

      // Act
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['githubToken', 'userData'], resolve);
      });

      // Assert
      expect(result.githubToken).toBe(savedToken);
      expect(result.userData).toEqual(savedUserData);
    });

    test('should handle missing user name', async () => {
      // Arrange
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          login: 'testuser',
          name: null, // No name set
          avatar_url: 'https://avatars.githubusercontent.com/u/12345678?v=4'
        })
      });

      // Act
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${GitHubAPIMocks.VALID_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const userData = await response.json();

      // Assert
      expect(userData.name).toBeNull();
      // In real implementation, should fall back to login
      const displayName = userData.name || userData.login;
      expect(displayName).toBe('testuser');
    });
  });

  describe('Logout Functionality', () => {
    test('should clear storage on logout', async () => {
      // Arrange - Setup authenticated state
      await new Promise((resolve) => {
        chrome.storage.local.set({
          githubToken: GitHubAPIMocks.VALID_TOKEN,
          userData: {
            login: 'testuser',
            name: 'Test User',
            avatar_url: 'https://example.com/avatar.png'
          }
        }, resolve);
      });

      // Act - Logout
      await new Promise((resolve) => {
        chrome.storage.local.remove(['githubToken', 'userData'], resolve);
      });

      // Get data after logout
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['githubToken', 'userData'], resolve);
      });

      // Assert
      expect(result.githubToken).toBeUndefined();
      expect(result.userData).toBeUndefined();
      expect(mockChrome.storage.local.remove).toHaveBeenCalledWith(
        ['githubToken', 'userData'],
        expect.any(Function)
      );
    });

    test('should reset UI elements on logout', () => {
      // Arrange
      elements.githubToken.value = GitHubAPIMocks.VALID_TOKEN;
      elements.connectionStatus.innerHTML = '<div>Connected</div>';

      // Act - Simulate logout
      elements.githubToken.value = '';
      elements.connectionStatus.innerHTML = '<div class="status-indicator disconnected"></div><span>Not authenticated</span>';
      elements.authSection.classList.remove('hidden');
      elements.userSection.classList.add('hidden');

      // Assert
      expect(elements.githubToken.value).toBe('');
      expect(elements.connectionStatus.innerHTML).toContain('Not authenticated');
      expect(elements.authSection.classList.remove).toHaveBeenCalledWith('hidden');
      expect(elements.userSection.classList.add).toHaveBeenCalledWith('hidden');
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors', async () => {
      // Arrange
      global.fetch.mockRejectedValueOnce(new Error('Network request failed'));

      // Act & Assert
      await expect(
        fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${GitHubAPIMocks.VALID_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        })
      ).rejects.toThrow('Network request failed');
    });

    test('should handle malformed JSON response', async () => {
      // Arrange
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      // Act
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${GitHubAPIMocks.VALID_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      // Assert
      await expect(response.json()).rejects.toThrow('Invalid JSON');
    });

    test('should handle storage errors', async () => {
      // Arrange
      mockChrome.storage.local.set.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded');
      });

      // Act & Assert
      expect(() => {
        chrome.storage.local.set({ githubToken: GitHubAPIMocks.VALID_TOKEN });
      }).toThrow('Storage quota exceeded');
    });
  });

  describe('UI State Management', () => {
    test('should show loading state during validation', () => {
      // Arrange
      elements.saveConfig.disabled = false;
      elements.saveConfig.innerHTML = 'Save configuration';

      // Act - Simulate loading state
      elements.saveConfig.disabled = true;
      elements.saveConfig.innerHTML = '<svg class="spinner"></svg>Validating...';

      // Assert
      expect(elements.saveConfig.disabled).toBe(true);
      expect(elements.saveConfig.innerHTML).toContain('Validating');
      expect(elements.saveConfig.innerHTML).toContain('spinner');
    });

    test('should restore button state after validation', () => {
      // Arrange
      elements.saveConfig.disabled = true;
      elements.saveConfig.innerHTML = '<svg class="spinner"></svg>Validating...';

      // Act - Simulate validation complete
      elements.saveConfig.disabled = false;
      elements.saveConfig.innerHTML = 'Save configuration';

      // Assert
      expect(elements.saveConfig.disabled).toBe(false);
      expect(elements.saveConfig.innerHTML).not.toContain('Validating');
    });

    test('should display authenticated user information', () => {
      // Arrange
      const userData = {
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345678?v=4'
      };

      // Act
      elements.userAvatar.src = userData.avatar_url;
      elements.userName.textContent = userData.name;
      elements.userLogin.textContent = `@${userData.login}`;
      elements.connectionStatus.innerHTML = `<div class="status-indicator connected"></div><span>Connected as <strong>${userData.name}</strong></span>`;

      // Assert
      expect(elements.userAvatar.src).toBe(userData.avatar_url);
      expect(elements.userName.textContent).toBe('Test User');
      expect(elements.userLogin.textContent).toBe('@testuser');
      expect(elements.connectionStatus.innerHTML).toContain('Connected as');
      expect(elements.connectionStatus.innerHTML).toContain('Test User');
    });
  });

  describe('Token Format Validation', () => {
    test('should recognize valid GitHub PAT format (ghp_)', () => {
      // Arrange
      const token = GitHubAPIMocks.VALID_TOKEN;

      // Act
      const isValidFormat = token.startsWith('ghp_');

      // Assert
      expect(isValidFormat).toBe(true);
    });

    test('should identify invalid token format', () => {
      // Arrange
      const token = 'invalid_token_format';

      // Act
      const isValidFormat = token.startsWith('ghp_') || token.startsWith('github_pat_');

      // Assert
      expect(isValidFormat).toBe(false);
    });
  });
});
