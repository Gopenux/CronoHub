// CronoHub - Reports UI Tests with Mocked API
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI Team

const {
  launchBrowserWithExtension
} = require('./helpers/extension-loader');
const fs = require('fs');
const path = require('path');

describe('Reports UI Tests (Mocked API)', () => {
  let browser;
  let page;
  let extensionId;

  jest.setTimeout(60000);

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

  beforeEach(async () => {
    // Set up a test page that simulates GitHub
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test GitHub Issue</title></head>
        <body>
          <div class="js-issue-title">Test Issue #1</div>
        </body>
      </html>
    `);

    // Mock chrome.storage first
    await page.evaluate(() => {
      window.chrome = {
        storage: {
          local: {
            get: (keys, callback) => {
              callback({
                githubToken: 'mock-token-123',
                userData: { login: 'user1', avatar_url: 'https://avatar.url' }
              });
            },
            set: (data, callback) => {
              if (callback) callback();
            }
          }
        }
      };
    });

    // Mock fetch API
    await page.evaluate(() => {
      // Store original fetch
      window._originalFetch = window.fetch;

      // Mock fetch
      window.fetch = function(url, options) {
        // Mock organization members endpoint
        if (url.includes('/orgs/') && url.includes('/members')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve([
              { login: 'user1', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
              { login: 'user2', avatar_url: 'https://avatars.githubusercontent.com/u/2' },
              { login: 'user3', avatar_url: 'https://avatars.githubusercontent.com/u/3' }
            ])
          });
        }

        // Mock issue search endpoint
        if (url.includes('/search/issues')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              items: [
                {
                  number: 1,
                  title: 'Test Issue',
                  comments_url: 'https://api.github.com/repos/test/repo/issues/1/comments'
                }
              ]
            })
          });
        }

        // Mock issue comments endpoint
        if (url.includes('/issues/') && url.includes('/comments')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve([
              {
                user: { login: 'user1' },
                created_at: '2026-01-15T10:00:00Z',
                body: '⏱️ **Time Tracked:** 2.5 Hours\n\nWorked on feature',
                html_url: 'https://github.com/test/repo/issues/1#comment-1'
              },
              {
                user: { login: 'user1' },
                created_at: '2026-01-16T14:00:00Z',
                body: '⏱️ **Time Tracked:** 3 Hours\n\nBug fixes',
                html_url: 'https://github.com/test/repo/issues/1#comment-2'
              }
            ])
          });
        }

        // Fallback to original fetch for other requests
        return window._originalFetch(url, options);
      };
    });

    // Inject reports.js after mocks are set up
    const reportsPath = path.join(__dirname, '../../reports.js');
    const reportsCode = fs.readFileSync(reportsPath, 'utf8');
    await page.evaluate(reportsCode);
  });

  describe('Organization Members Loading', () => {
    test('should load mocked organization members', async () => {
      const members = await page.evaluate(async () => {
        return await window.CronoHubReports.fetchOrgMembers('test-org', 'mock-token');
      });

      expect(members).toHaveLength(3);
      expect(members[0].login).toBe('user1');
      expect(members[1].login).toBe('user2');
      expect(members[2].login).toBe('user3');
    });
  });

  describe('Comments Fetching', () => {
    test('should fetch mocked user comments', async () => {
      const comments = await page.evaluate(async () => {
        return await window.CronoHubReports.fetchUserCommentsInRange(
          'user1',
          'test-org',
          '2026-01-01',
          '2026-01-31',
          'mock-token'
        );
      });

      expect(comments.length).toBeGreaterThan(0);
      expect(comments[0].hours).toBe(2.5);
      expect(comments[1].hours).toBe(3);
    });
  });

  describe('Error Handling', () => {
    test('should handle API rate limits', async () => {
      // Override fetch to return rate limit error
      await page.evaluate(() => {
        window.fetch = function(url) {
          if (url.includes('/orgs/')) {
            return Promise.resolve({
              ok: false,
              status: 403,
              json: () => Promise.resolve({
                message: 'API rate limit exceeded for mock-token. (But here\'s the good news: Authenticated requests get a higher rate limit.)'
              })
            });
          }
        };
      });

      const error = await page.evaluate(async () => {
        try {
          await window.CronoHubReports.fetchOrgMembers('test-org', 'mock-token');
          return null;
        } catch (e) {
          return e.message;
        }
      });

      expect(error).toContain('rate limit');
    });

    test('should handle access denied errors', async () => {
      await page.evaluate(() => {
        window.fetch = function(url) {
          if (url.includes('/orgs/')) {
            return Promise.resolve({
              ok: false,
              status: 403,
              json: () => Promise.resolve({
                message: 'Access denied to organization members'
              })
            });
          }
        };
      });

      const error = await page.evaluate(async () => {
        try {
          await window.CronoHubReports.fetchOrgMembers('test-org', 'mock-token');
          return null;
        } catch (e) {
          return e.message;
        }
      });

      expect(error).toContain('Access denied');
    });
  });

  describe('Data Aggregation with Real API Structure', () => {
    test('should aggregate hours from mocked API responses', async () => {
      const result = await page.evaluate(async () => {
        const comments = await window.CronoHubReports.fetchUserCommentsInRange(
          'user1',
          'test-org',
          '2026-01-01',
          '2026-01-31',
          'mock-token'
        );

        const grouped = window.CronoHubReports.aggregateHoursByDate(comments);
        const total = window.CronoHubReports.calculateTotalHours(grouped);

        return {
          commentCount: comments.length,
          dateCount: Object.keys(grouped).length,
          totalHours: total
        };
      });

      expect(result.commentCount).toBe(2);
      expect(result.dateCount).toBe(2); // Two different dates
      expect(result.totalHours).toBe(5.5); // 2.5 + 3
    });
  });

  describe('Empty Results Handling', () => {
    test('should handle no comments found', async () => {
      await page.evaluate(() => {
        window.fetch = function(url) {
          if (url.includes('/search/issues')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({ items: [] })
            });
          }
        };
      });

      const comments = await page.evaluate(async () => {
        return await window.CronoHubReports.fetchUserCommentsInRange(
          'user1',
          'test-org',
          '2026-01-01',
          '2026-01-31',
          'mock-token'
        );
      });

      expect(comments).toHaveLength(0);
    });
  });

  describe('Date Filtering', () => {
    test('should call API with correct date range', async () => {
      const fetchCalls = await page.evaluate(async () => {
        const calls = [];
        const originalFetch = window.fetch;

        window.fetch = function(url, options) {
          if (url.includes('/search/issues')) {
            calls.push({ url, options });
            // Return same mocked data
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({
                items: [
                  {
                    number: 1,
                    title: 'Test Issue',
                    comments_url: 'https://api.github.com/repos/test/repo/issues/1/comments'
                  }
                ]
              })
            });
          }
          if (url.includes('/issues/') && url.includes('/comments')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve([
                {
                  user: { login: 'user1' },
                  created_at: '2026-01-15T10:00:00Z',
                  body: '⏱️ **Time Tracked:** 2.5 Hours\\n\\nWorked on feature',
                  html_url: 'https://github.com/test/repo/issues/1#comment-1'
                }
              ])
            });
          }
          return originalFetch(url, options);
        };

        // Make the call
        await window.CronoHubReports.fetchUserCommentsInRange(
          'user1',
          'test-org',
          '2026-01-15',
          '2026-01-15',
          'mock-token'
        );

        return calls;
      });

      // Verify the API was called with correct date range in query
      expect(fetchCalls.length).toBeGreaterThan(0);
      expect(fetchCalls[0].url).toContain('2026-01-15');
    });
  });
});
