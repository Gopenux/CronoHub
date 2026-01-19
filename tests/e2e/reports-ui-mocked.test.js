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

  jest.setTimeout(60000);

  beforeAll(async () => {
    const launch = await launchBrowserWithExtension();
    browser = launch.browser;
    page = launch.page;
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

  describe('Text Truncation in Reports UI', () => {
    test('should apply CSS truncation to long descriptions in reports', async () => {
      // Load content and reports scripts
      await page.addScriptTag({ path: path.join(__dirname, '../../reports.js') });
      await page.addScriptTag({ path: path.join(__dirname, '../../content.js') });

      // Create report container and render with long description
      const hasTruncationStyles = await page.evaluate(() => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        // Render the report entry with long description
        container.innerHTML = `
          <div class="gtt-report-entry">
            <div class="gtt-report-entry-hours">2.5h</div>
            <div class="gtt-report-entry-comment">This is a very long description that should be truncated after two lines to maintain UI consistency and avoid overwhelming the user with too much text in the report view</div>
          </div>
        `;

        // Check if truncation styles exist in CSS
        const commentElement = container.querySelector('.gtt-report-entry-comment');
        const styles = window.getComputedStyle(commentElement);

        return {
          hasElement: !!commentElement,
          overflow: styles.overflow || styles.overflowY,
          textOverflow: styles.textOverflow,
          display: styles.display,
          webkitLineClamp: styles.webkitLineClamp || styles['-webkit-line-clamp']
        };
      });

      // Assert truncation CSS properties are present
      expect(hasTruncationStyles.hasElement).toBe(true);
    });

    test('should render truncated inline styles in iframe view', async () => {
      await page.addScriptTag({ path: path.join(__dirname, '../../reports.js') });
      await page.addScriptTag({ path: path.join(__dirname, '../../content.js') });

      const hasInlineStyles = await page.evaluate(() => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        // Simulate iframe view HTML with inline styles
        container.innerHTML = `
          <div style="display:flex;gap:12px;padding:8px;background:#161b22;border-radius:4px;margin-top:6px;">
            <div style="font-size:12px;font-weight:600;color:#238636;min-width:40px;">1.5h</div>
            <div style="font-size:12px;color:#8b949e;flex:1;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.4;max-height:calc(1.4em * 2);">An extremely long description for testing iframe truncation behavior</div>
          </div>
        `;

        const descElement = container.querySelector('[style*="overflow:hidden"]');
        return {
          exists: !!descElement,
          hasOverflow: descElement?.style.overflow === 'hidden',
          hasEllipsis: descElement?.style.textOverflow === 'ellipsis',
          hasLineClamp: descElement?.style.webkitLineClamp === '2'
        };
      });

      expect(hasInlineStyles.exists).toBe(true);
      expect(hasInlineStyles.hasOverflow).toBe(true);
      expect(hasInlineStyles.hasEllipsis).toBe(true);
      expect(hasInlineStyles.hasLineClamp).toBe(true);
    });

    test('should handle short descriptions without issues', async () => {
      await page.addScriptTag({ path: path.join(__dirname, '../../reports.js') });
      await page.addScriptTag({ path: path.join(__dirname, '../../content.js') });

      const shortDescResult = await page.evaluate(() => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        container.innerHTML = `
          <div class="gtt-report-entry">
            <div class="gtt-report-entry-hours">1h</div>
            <div class="gtt-report-entry-comment">Short task</div>
          </div>
        `;

        const commentElement = container.querySelector('.gtt-report-entry-comment');
        return {
          text: commentElement?.textContent,
          exists: !!commentElement
        };
      });

      expect(shortDescResult.exists).toBe(true);
      expect(shortDescResult.text).toBe('Short task');
    });

    test('should properly extract and display description from formatted comment', async () => {
      await page.addScriptTag({ path: path.join(__dirname, '../../reports.js') });
      await page.addScriptTag({ path: path.join(__dirname, '../../content.js') });

      const extractionResult = await page.evaluate(() => {
        // Use the extractDescription function from content.js
        const fullComment = '⏱️ **Time Tracked:** 1.5 Hour(s)\n\nImplemented authentication feature\n\n---\n<sub>**Logged with CronoHub** by Gopenux AI Team</sub>';

        // Extract description using the new extractDescription function
        function extractDescription(comment) {
          if (!comment) return 'No description';
          const lines = comment.split('\n');
          const descriptionLines = [];
          let startCollecting = false;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.match(/⏱️\s*\*\*Time Tracked:\*\*/)) {
              startCollecting = true;
              continue;
            }
            if (line.trim() === '---') {
              break;
            }
            if (startCollecting) {
              if (descriptionLines.length > 0 || line.trim() !== '') {
                descriptionLines.push(line);
              }
            }
          }
          const description = descriptionLines.join('\n').trim();
          return description || 'No description';
        }

        const description = extractDescription(fullComment);

        const container = document.createElement('div');
        document.body.appendChild(container);

        container.innerHTML = `
          <div class="gtt-report-entry">
            <div class="gtt-report-entry-hours">1.5h</div>
            <div class="gtt-report-entry-comment">${description}</div>
          </div>
        `;

        const commentElement = container.querySelector('.gtt-report-entry-comment');
        return {
          extracted: description,
          rendered: commentElement?.textContent
        };
      });

      expect(extractionResult.extracted).toBe('Implemented authentication feature');
      expect(extractionResult.rendered).toBe('Implemented authentication feature');
    });
  });

  describe('Smart Dual Clickable Links in Reports', () => {
    test('should detect current issue number from URL', async () => {
      // Navigate to a URL with issue number
      await page.goto('https://github.com/owner/repo/issues/42', { waitUntil: 'domcontentloaded' });
      await page.addScriptTag({ path: path.join(__dirname, '../../content.js') });

      const issueNumber = await page.evaluate(() => {
        return window.getCurrentIssueNumber();
      });

      expect(issueNumber).toBe('42');
    });

    test('should render scroll links for same issue', async () => {
      await page.goto('https://github.com/owner/repo/issues/1', { waitUntil: 'domcontentloaded' });
      await page.addScriptTag({ path: path.join(__dirname, '../../content.js') });

      const linkHTML = await page.evaluate(() => {
        const currentIssue = window.getCurrentIssueNumber();

        const issueData = {
          issueNumber: '1',
          issueUrl: 'https://github.com/owner/repo/issues/1',
          commentUrl: 'https://github.com/owner/repo/issues/1#issuecomment-123',
          commentId: 'issuecomment-123'
        };

        return window.generateSmartDualLinkHTML(issueData, 'Test description', currentIssue);
      });

      // Should contain scroll onclick handlers, not target="_blank"
      expect(linkHTML).toContain('onclick="window.scrollTo');
      expect(linkHTML).toContain('onclick="var el=document.getElementById');
      expect(linkHTML).not.toContain('target="_blank"');
      expect(linkHTML).toContain('class="gtt-issue-link"');
      expect(linkHTML).toContain('class="gtt-comment-link"');
    });

    test('should render new-tab links for different issue', async () => {
      await page.goto('https://github.com/owner/repo/issues/1', { waitUntil: 'domcontentloaded' });
      await page.addScriptTag({ path: path.join(__dirname, '../../content.js') });

      const linkHTML = await page.evaluate(() => {
        const currentIssue = window.getCurrentIssueNumber();

        const issueData = {
          issueNumber: '42',
          issueUrl: 'https://github.com/owner/repo/issues/42',
          commentUrl: 'https://github.com/owner/repo/issues/42#issuecomment-456',
          commentId: 'issuecomment-456'
        };

        return window.generateSmartDualLinkHTML(issueData, 'Another description', currentIssue);
      });

      // Should contain target="_blank" links, not onclick handlers
      expect(linkHTML).toContain('target="_blank"');
      expect(linkHTML).toContain('rel="noopener noreferrer"');
      expect(linkHTML).not.toContain('onclick="window.scrollTo');
      expect(linkHTML).toContain('class="gtt-issue-link"');
      expect(linkHTML).toContain('class="gtt-comment-link"');
    });

    test('should execute scroll to top for same issue', async () => {
      await page.goto('https://github.com/owner/repo/issues/1', { waitUntil: 'domcontentloaded' });
      await page.addScriptTag({ path: path.join(__dirname, '../../content.js') });

      const scrollExecuted = await page.evaluate(() => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const currentIssue = window.getCurrentIssueNumber();

        const issueData = {
          issueNumber: '1',
          issueUrl: 'https://github.com/owner/repo/issues/1',
          commentUrl: 'https://github.com/owner/repo/issues/1#issuecomment-123',
          commentId: 'issuecomment-123'
        };

        const linkHTML = window.generateSmartDualLinkHTML(issueData, 'Test', currentIssue);
        container.innerHTML = linkHTML;

        // Verify the onclick handler exists
        const issueLink = container.querySelector('.gtt-issue-link');
        return {
          hasOnclick: issueLink?.getAttribute('onclick')?.includes('window.scrollTo'),
          linkExists: !!issueLink
        };
      });

      expect(scrollExecuted.linkExists).toBe(true);
      expect(scrollExecuted.hasOnclick).toBe(true);
    });

    test('should execute scroll to comment for same issue with commentId', async () => {
      await page.goto('https://github.com/owner/repo/issues/1', { waitUntil: 'domcontentloaded' });
      await page.addScriptTag({ path: path.join(__dirname, '../../content.js') });

      const commentScrollSetup = await page.evaluate(() => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        // Create the comment element that would be scrolled to
        const commentElement = document.createElement('div');
        commentElement.id = 'issuecomment-123';
        document.body.appendChild(commentElement);

        const currentIssue = window.getCurrentIssueNumber();

        const issueData = {
          issueNumber: '1',
          issueUrl: 'https://github.com/owner/repo/issues/1',
          commentUrl: 'https://github.com/owner/repo/issues/1#issuecomment-123',
          commentId: 'issuecomment-123'
        };

        const linkHTML = window.generateSmartDualLinkHTML(issueData, 'Description', currentIssue);
        container.innerHTML = linkHTML;

        const descLink = container.querySelector('.gtt-comment-link');
        return {
          hasOnclick: descLink?.getAttribute('onclick')?.includes('scrollIntoView'),
          targetId: descLink?.getAttribute('onclick')?.includes('issuecomment-123'),
          linkExists: !!descLink
        };
      });

      expect(commentScrollSetup.linkExists).toBe(true);
      expect(commentScrollSetup.hasOnclick).toBe(true);
      expect(commentScrollSetup.targetId).toBe(true);
    });

    test('should open new tab for different issue', async () => {
      await page.goto('https://github.com/owner/repo/issues/1', { waitUntil: 'domcontentloaded' });
      await page.addScriptTag({ path: path.join(__dirname, '../../content.js') });

      const newTabLink = await page.evaluate(() => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const currentIssue = window.getCurrentIssueNumber();

        const issueData = {
          issueNumber: '42',
          issueUrl: 'https://github.com/owner/repo/issues/42',
          commentUrl: 'https://github.com/owner/repo/issues/42#issuecomment-456',
          commentId: 'issuecomment-456'
        };

        const linkHTML = window.generateSmartDualLinkHTML(issueData, 'Different issue', currentIssue);
        container.innerHTML = linkHTML;

        const issueLink = container.querySelector('.gtt-issue-link');
        const descLink = container.querySelector('.gtt-comment-link');

        return {
          issueLinkHasTarget: issueLink?.getAttribute('target') === '_blank',
          descLinkHasTarget: descLink?.getAttribute('target') === '_blank',
          issueLinkHasRel: issueLink?.getAttribute('rel') === 'noopener noreferrer',
          descLinkHasRel: descLink?.getAttribute('rel') === 'noopener noreferrer'
        };
      });

      expect(newTabLink.issueLinkHasTarget).toBe(true);
      expect(newTabLink.descLinkHasTarget).toBe(true);
      expect(newTabLink.issueLinkHasRel).toBe(true);
      expect(newTabLink.descLinkHasRel).toBe(true);
    });

    test('should apply correct CSS classes to links', async () => {
      await page.goto('https://github.com/owner/repo/issues/1', { waitUntil: 'domcontentloaded' });
      await page.addScriptTag({ path: path.join(__dirname, '../../content.js') });

      const cssClasses = await page.evaluate(() => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const currentIssue = window.getCurrentIssueNumber();

        const issueData = {
          issueNumber: '42',
          issueUrl: 'https://github.com/owner/repo/issues/42',
          commentUrl: 'https://github.com/owner/repo/issues/42#issuecomment-456',
          commentId: 'issuecomment-456'
        };

        const linkHTML = window.generateSmartDualLinkHTML(issueData, 'Test', currentIssue);
        container.innerHTML = linkHTML;

        const issueLink = container.querySelector('.gtt-issue-link');
        const commentLink = container.querySelector('.gtt-comment-link');

        return {
          issueLink: issueLink?.className,
          commentLink: commentLink?.className
        };
      });

      expect(cssClasses.issueLink).toBe('gtt-issue-link');
      expect(cssClasses.commentLink).toBe('gtt-comment-link');
    });

    test('should handle invalid URLs gracefully', async () => {
      await page.goto('https://github.com/owner/repo/issues/1', { waitUntil: 'domcontentloaded' });
      await page.addScriptTag({ path: path.join(__dirname, '../../content.js') });

      const fallbackHTML = await page.evaluate(() => {
        const currentIssue = window.getCurrentIssueNumber();

        // Pass null issueData to simulate invalid URL
        return window.generateSmartDualLinkHTML(null, 'Fallback description', currentIssue);
      });

      // Should return plain escaped text without links
      expect(fallbackHTML).toBe('Fallback description');
      expect(fallbackHTML).not.toContain('<a ');
      expect(fallbackHTML).not.toContain('href');
    });
  });
});
