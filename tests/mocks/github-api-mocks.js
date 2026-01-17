// CronoHub - GitHub API Mocks for Testing
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI Team

/**
 * Centralized mocks for GitHub API responses
 * This module provides realistic API responses for testing without making real API calls
 */

const GitHubAPIMocks = {
  // Valid GitHub token (simulated)
  VALID_TOKEN: 'ghp_test1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop',

  // Invalid GitHub token (simulated)
  INVALID_TOKEN: 'invalid_token_123',

  // Expired token (simulated)
  EXPIRED_TOKEN: 'ghp_expired_token_OLD',

  /**
   * Mock successful user authentication response
   */
  user: {
    success: {
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        login: 'testuser',
        id: 12345678,
        node_id: 'MDQ6VXNlcjEyMzQ1Njc4',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345678?v=4',
        gravatar_id: '',
        url: 'https://api.github.com/users/testuser',
        html_url: 'https://github.com/testuser',
        type: 'User',
        site_admin: false,
        name: 'Test User',
        company: 'Gopenux AI',
        blog: 'https://gopenux.com',
        location: 'Test City',
        email: 'test@example.com',
        hireable: true,
        bio: 'Software developer and tester',
        public_repos: 50,
        public_gists: 10,
        followers: 100,
        following: 50,
        created_at: '2020-01-01T00:00:00Z',
        updated_at: '2026-01-15T10:30:00Z'
      })
    },

    /**
     * Mock unauthorized response (invalid token)
     */
    unauthorized: {
      ok: false,
      status: 401,
      json: () => Promise.resolve({
        message: 'Bad credentials',
        documentation_url: 'https://docs.github.com/rest'
      })
    },

    /**
     * Mock forbidden response (token without required scopes)
     */
    forbidden: {
      ok: false,
      status: 403,
      json: () => Promise.resolve({
        message: 'Resource not accessible by personal access token',
        documentation_url: 'https://docs.github.com/rest/overview/troubleshooting'
      })
    }
  },

  /**
   * Mock successful comment post response
   */
  comments: {
    success: {
      ok: true,
      status: 201,
      json: () => Promise.resolve({
        id: 987654321,
        node_id: 'IC_kwDOABcD1234567890',
        url: 'https://api.github.com/repos/testowner/testrepo/issues/comments/987654321',
        html_url: 'https://github.com/testowner/testrepo/issues/1#issuecomment-987654321',
        body: '⏱️ **Time Tracked:** 2.5 Hours\n\nWorked on feature\n\n---\n<sub>**Logged with CronoHub** by Gopenux AI Team</sub>',
        user: {
          login: 'testuser',
          id: 12345678,
          avatar_url: 'https://avatars.githubusercontent.com/u/12345678?v=4',
          type: 'User'
        },
        created_at: '2026-01-17T12:00:00Z',
        updated_at: '2026-01-17T12:00:00Z',
        author_association: 'CONTRIBUTOR'
      })
    },

    /**
     * Mock not found response (issue doesn't exist)
     */
    notFound: {
      ok: false,
      status: 404,
      json: () => Promise.resolve({
        message: 'Not Found',
        documentation_url: 'https://docs.github.com/rest/issues/comments#create-an-issue-comment'
      })
    },

    /**
     * Mock forbidden response (no write access)
     */
    forbidden: {
      ok: false,
      status: 403,
      json: () => Promise.resolve({
        message: 'You do not have permission to create a comment on this issue',
        documentation_url: 'https://docs.github.com/rest'
      })
    },

    /**
     * Mock validation error (invalid data)
     */
    validationError: {
      ok: false,
      status: 422,
      json: () => Promise.resolve({
        message: 'Validation Failed',
        errors: [
          {
            resource: 'IssueComment',
            field: 'body',
            code: 'missing_field'
          }
        ],
        documentation_url: 'https://docs.github.com/rest/issues/comments#create-an-issue-comment'
      })
    }
  },

  /**
   * Mock organization members response
   */
  orgMembers: {
    success: {
      ok: true,
      status: 200,
      json: () => Promise.resolve([
        {
          login: 'developer1',
          id: 111111,
          avatar_url: 'https://avatars.githubusercontent.com/u/111111?v=4',
          type: 'User'
        },
        {
          login: 'developer2',
          id: 222222,
          avatar_url: 'https://avatars.githubusercontent.com/u/222222?v=4',
          type: 'User'
        },
        {
          login: 'developer3',
          id: 333333,
          avatar_url: 'https://avatars.githubusercontent.com/u/333333?v=4',
          type: 'User'
        }
      ])
    },

    /**
     * Mock rate limit exceeded
     */
    rateLimit: {
      ok: false,
      status: 403,
      json: () => Promise.resolve({
        message: 'API rate limit exceeded for user ID 12345678.',
        documentation_url: 'https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting'
      })
    }
  },

  /**
   * Mock issue search response
   */
  searchIssues: {
    success: {
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        total_count: 2,
        incomplete_results: false,
        items: [
          {
            url: 'https://api.github.com/repos/testowner/testrepo/issues/1',
            repository_url: 'https://api.github.com/repos/testowner/testrepo',
            html_url: 'https://github.com/testowner/testrepo/issues/1',
            id: 1001,
            node_id: 'I_kwDOABcD1001',
            number: 1,
            title: 'Test Issue 1',
            state: 'open',
            created_at: '2026-01-10T09:00:00Z',
            updated_at: '2026-01-15T14:30:00Z',
            comments_url: 'https://api.github.com/repos/testowner/testrepo/issues/1/comments'
          },
          {
            url: 'https://api.github.com/repos/testowner/testrepo/issues/2',
            repository_url: 'https://api.github.com/repos/testowner/testrepo',
            html_url: 'https://github.com/testowner/testrepo/issues/2',
            id: 1002,
            node_id: 'I_kwDOABcD1002',
            number: 2,
            title: 'Test Issue 2',
            state: 'open',
            created_at: '2026-01-12T10:00:00Z',
            updated_at: '2026-01-16T16:00:00Z',
            comments_url: 'https://api.github.com/repos/testowner/testrepo/issues/2/comments'
          }
        ]
      })
    }
  },

  /**
   * Mock issue comments response
   */
  issueComments: {
    success: {
      ok: true,
      status: 200,
      json: () => Promise.resolve([
        {
          id: 1,
          user: { login: 'developer1' },
          created_at: '2026-01-15T10:00:00Z',
          updated_at: '2026-01-15T10:00:00Z',
          body: '⏱️ **Time Tracked:** 2.5 Hours\n\nImplemented user authentication\n\n---\n<sub>**Logged with CronoHub** by Gopenux AI Team</sub>',
          html_url: 'https://github.com/testowner/testrepo/issues/1#issuecomment-1'
        },
        {
          id: 2,
          user: { login: 'developer1' },
          created_at: '2026-01-16T14:00:00Z',
          updated_at: '2026-01-16T14:00:00Z',
          body: '⏱️ **Time Tracked:** 3 Hours\n\nFixed authentication bugs\n\n---\n<sub>**Logged with CronoHub** by Gopenux AI Team</sub>',
          html_url: 'https://github.com/testowner/testrepo/issues/1#issuecomment-2'
        },
        {
          id: 3,
          user: { login: 'developer2' },
          created_at: '2026-01-16T16:00:00Z',
          updated_at: '2026-01-16T16:00:00Z',
          body: '⏱️ **Time Tracked:** 1.5 Hours\n\nCode review\n\n---\n<sub>**Logged with CronoHub** by Gopenux AI Team</sub>',
          html_url: 'https://github.com/testowner/testrepo/issues/1#issuecomment-3'
        }
      ])
    }
  },

  /**
   * Helper function to create a fetch mock
   * @param {Object} responses - Map of URL patterns to response objects
   * @returns {Function} Mock fetch function
   */
  createFetchMock: function(responses) {
    return function(url, options) {
      console.log('[Mock Fetch]', options?.method || 'GET', url);

      // Check each pattern
      for (const [pattern, response] of Object.entries(responses)) {
        if (url.includes(pattern) || url.match(new RegExp(pattern))) {
          console.log('[Mock Fetch] Matched pattern:', pattern);
          return Promise.resolve(response);
        }
      }

      // Default error response
      console.warn('[Mock Fetch] No mock defined for:', url);
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({
          message: 'Mock not found for URL: ' + url
        })
      });
    };
  }
};

// Export for Node.js (Jest)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GitHubAPIMocks;
}

// Export for browser (Puppeteer)
if (typeof window !== 'undefined') {
  window.GitHubAPIMocks = GitHubAPIMocks;
}
