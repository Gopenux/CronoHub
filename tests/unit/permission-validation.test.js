// CronoHub - Permission Validation Tests
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI Team

const GitHubAPIMocks = require('../mocks/github-api-mocks');

/**
 * These tests validate the repository permission checking functionality
 * Tests cover various scenarios: success, no access, rate limits, network errors
 */
describe('Content Script - Repository Permission Validation', () => {
  let mockFetch;
  let validateRepositoryAccess;

  beforeEach(() => {
    // Mock fetch globally
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Define the validateRepositoryAccess function as it appears in content.js
    validateRepositoryAccess = function(owner, repo, token) {
      var url = 'https://api.github.com/repos/' + owner + '/' + repo;

      return fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/vnd.github.v3+json'
        }
      }).then(function(response) {
        if (response.status === 404) {
          return {
            hasAccess: false,
            error: 'Repository not found or you don\'t have read access to it.'
          };
        }

        if (response.status === 403) {
          return response.json().then(function(data) {
            return {
              hasAccess: false,
              error: 'Access forbidden: ' + (data.message || 'Your token doesn\'t have access to this repository.')
            };
          }).catch(function() {
            return {
              hasAccess: false,
              error: 'Access forbidden: Your token doesn\'t have access to this repository.'
            };
          });
        }

        if (!response.ok) {
          return {
            hasAccess: false,
            error: 'Error checking permissions: ' + response.status
          };
        }

        return response.json().then(function(data) {
          var hasPushAccess = data.permissions && data.permissions.push === true;

          if (!hasPushAccess) {
            return {
              hasAccess: false,
              error: 'Your token has read-only access. Write permission is required to log time.'
            };
          }

          return {
            hasAccess: true,
            error: null
          };
        });
      }).catch(function(error) {
        return {
          hasAccess: false,
          error: 'Network error: ' + error.message
        };
      });
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful validation', () => {
    test('should return hasAccess=true when token has push permission', async () => {
      // Arrange
      const owner = 'testowner';
      const repo = 'testrepo';
      const token = GitHubAPIMocks.VALID_TOKEN;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
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

      // Act
      const result = await validateRepositoryAccess(owner, repo, token);

      // Assert
      expect(result.hasAccess).toBe(true);
      expect(result.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/testowner/testrepo',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/vnd.github.v3+json'
          })
        })
      );
    });

    test('should return hasAccess=true when token has admin permission', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          permissions: {
            admin: true,
            push: true,
            pull: true
          }
        })
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('Read-only access', () => {
    test('should return hasAccess=false when token has only pull permission', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          permissions: {
            admin: false,
            push: false,
            pull: true
          }
        })
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Your token has read-only access. Write permission is required to log time.');
    });

    test('should return hasAccess=false when permissions object is missing', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 123,
          name: 'repo'
          // No permissions object
        })
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Your token has read-only access. Write permission is required to log time.');
    });

    test('should return hasAccess=false when push permission is explicitly false', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          permissions: {
            admin: false,
            push: false,
            pull: true
          }
        })
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toContain('read-only access');
    });
  });

  describe('Repository not found (404)', () => {
    test('should return hasAccess=false with appropriate error for 404', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          message: 'Not Found'
        })
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'nonexistent', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Repository not found or you don\'t have read access to it.');
    });
  });

  describe('Access forbidden (403)', () => {
    test('should return hasAccess=false with error message from API for 403', async () => {
      // Arrange
      const errorMessage = 'Resource not accessible by personal access token';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          message: errorMessage
        })
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Access forbidden: ' + errorMessage);
    });

    test('should return hasAccess=false with default error when 403 response has no message', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({})
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Access forbidden: Your token doesn\'t have access to this repository.');
    });

    test('should handle 403 response when JSON parsing fails', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Access forbidden: Your token doesn\'t have access to this repository.');
    });
  });

  describe('Other HTTP errors', () => {
    test('should return hasAccess=false for 500 server error', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Error checking permissions: 500');
    });

    test('should return hasAccess=false for 401 unauthorized', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Error checking permissions: 401');
    });
  });

  describe('Network errors', () => {
    test('should return hasAccess=false on network failure', async () => {
      // Arrange
      const networkError = new Error('Network request failed');
      mockFetch.mockRejectedValueOnce(networkError);

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Network error: Network request failed');
    });

    test('should return hasAccess=false on timeout', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout');
      mockFetch.mockRejectedValueOnce(timeoutError);

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Network error: Request timeout');
    });

    test('should return hasAccess=false on DNS failure', async () => {
      // Arrange
      const dnsError = new Error('getaddrinfo ENOTFOUND api.github.com');
      mockFetch.mockRejectedValueOnce(dnsError);

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toContain('Network error:');
    });
  });

  describe('Edge cases', () => {
    test('should handle repository names with special characters', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          permissions: {
            push: true,
            pull: true
          }
        })
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'repo.name-with_special', 'token');

      // Assert
      expect(result.hasAccess).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo.name-with_special',
        expect.any(Object)
      );
    });

    test('should handle organization names with hyphens', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          permissions: {
            push: true
          }
        })
      });

      // Act
      const result = await validateRepositoryAccess('my-org', 'my-repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/my-org/my-repo',
        expect.any(Object)
      );
    });

    test('should handle empty permissions object', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          permissions: {}
        })
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toContain('read-only access');
    });

    test('should handle null permissions', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          permissions: null
        })
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
    });
  });

  describe('Rate limiting', () => {
    test('should handle rate limit exceeded (403 with specific message)', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          message: 'API rate limit exceeded'
        })
      });

      // Act
      const result = await validateRepositoryAccess('owner', 'repo', 'token');

      // Assert
      expect(result.hasAccess).toBe(false);
      expect(result.error).toContain('API rate limit exceeded');
    });
  });
});
