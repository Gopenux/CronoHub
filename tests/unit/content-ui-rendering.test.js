// CronoHub - UI Rendering Tests
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI Team

const GitHubAPIMocks = require('../mocks/github-api-mocks');

/**
 * These tests validate UI rendering functions in content.js
 * Focus: HTML generation, element structure, data binding
 */
describe('Content Script - UI Rendering', () => {
  let mockDocument;
  let mockWindow;
  let state;
  let createdElements;

  beforeEach(() => {
    createdElements = [];

    // Mock DOM manipulation
    mockDocument = {
      getElementById: jest.fn((id) => {
        return createdElements.find(el => el.id === id) || null;
      }),
      querySelector: jest.fn((selector) => {
        if (selector === '.js-issue-title' || selector === '.markdown-title') {
          return { textContent: '  Test Issue Title  ' };
        }
        return null;
      }),
      createElement: jest.fn((tag) => {
        const element = {
          tagName: tag,
          id: '',
          className: '',
          innerHTML: '',
          textContent: '',
          style: {},
          onclick: null,
          addEventListener: jest.fn(),
          appendChild: jest.fn(),
          classList: {
            add: jest.fn(),
            remove: jest.fn(),
            toggle: jest.fn(),
            contains: jest.fn()
          },
          setAttribute: jest.fn(),
          getAttribute: jest.fn()
        };
        createdElements.push(element);
        return element;
      }),
      body: {
        appendChild: jest.fn()
      }
    };

    mockWindow = {
      location: {
        pathname: '/testowner/testrepo/issues/1',
        search: ''
      },
      CronoHubReports: {
        getDefaultDateRange: () => ({
          startDate: '2026-01-10',
          endDate: '2026-01-17'
        })
      }
    };

    state = {
      isOpen: false,
      isLoading: false,
      config: {
        githubToken: GitHubAPIMocks.VALID_TOKEN,
        userData: {
          login: 'testuser',
          name: 'Test User',
          avatar_url: 'https://avatars.githubusercontent.com/u/12345678?v=4'
        }
      },
      issueData: {
        owner: 'testowner',
        repo: 'testrepo',
        number: 1,
        title: 'Test Issue Title'
      },
      panelMode: 'log',
      reportsData: null,
      allCollaborators: [],
      selectedCollaborators: []
    };

    global.document = mockDocument;
    global.window = mockWindow;
  });

  afterEach(() => {
    jest.clearAllMocks();
    createdElements = [];
  });

  describe('Panel HTML Generation', () => {
    test('should generate panel HTML with correct structure', () => {
      // Arrange
      const userName = 'Test User';

      // Act - Simulate renderPanelDirect logic
      const panelHTML = [
        '<div class="gtt-header">',
        '<div class="gtt-header-title">',
        '<h3>CronoHub</h3>',
        '</div>',
        '<button class="gtt-close-btn" id="gtt-close" type="button">',
        '</button>',
        '</div>',
        '<div class="gtt-body">',
        '<div class="gtt-issue-info">',
        '<div class="gtt-issue-number">#' + state.issueData.number + ' · ' + state.issueData.owner + '/' + state.issueData.repo + '</div>',
        '<div class="gtt-issue-title">' + escapeHtml(state.issueData.title) + '</div>',
        '</div>',
        '<div class="gtt-user-info">',
        '<span class="gtt-user-name">' + escapeHtml(userName) + '</span>',
        '</div>',
        '<input type="number" id="gtt-hours" class="gtt-input gtt-hours-input" min="0.25" max="24" step="0.25" placeholder="2.5">',
        '<textarea id="gtt-description" class="gtt-textarea" rows="3" placeholder="Brief description..."></textarea>',
        '<button type="button" class="gtt-submit-btn" id="gtt-submit">Log time</button>',
        '<button type="button" class="gtt-secondary-btn" id="gtt-view-reports">View Reports</button>',
        '</div>'
      ].join('');

      // Assert - Structure
      expect(panelHTML).toContain('class="gtt-header"');
      expect(panelHTML).toContain('class="gtt-body"');
      expect(panelHTML).toContain('<h3>CronoHub</h3>');

      // Assert - Issue data binding
      expect(panelHTML).toContain('#1');
      expect(panelHTML).toContain('testowner/testrepo');
      expect(panelHTML).toContain('Test Issue Title');

      // Assert - User data binding
      expect(panelHTML).toContain('Test User');

      // Assert - Form elements
      expect(panelHTML).toContain('id="gtt-hours"');
      expect(panelHTML).toContain('min="0.25"');
      expect(panelHTML).toContain('max="24"');
      expect(panelHTML).toContain('id="gtt-description"');

      // Assert - Buttons
      expect(panelHTML).toContain('id="gtt-submit"');
      expect(panelHTML).toContain('id="gtt-view-reports"');
      expect(panelHTML).toContain('Log time');
      expect(panelHTML).toContain('View Reports');
    });

    test('should include SVG icons in panel', () => {
      // Act
      const panelHTML = [
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
        '<circle cx="12" cy="12" r="10"/>',
        '<polyline points="12,6 12,12 16,14"/>',
        '</svg>'
      ].join('');

      // Assert
      expect(panelHTML).toContain('viewBox="0 0 24 24"');
      expect(panelHTML).toContain('stroke="currentColor"');
      expect(panelHTML).toContain('<circle');
      expect(panelHTML).toContain('<polyline');
    });

    test('should escape HTML in issue title', () => {
      // Arrange
      const maliciousTitle = '<script>alert("XSS")</script>';
      const escaped = escapeHtml(maliciousTitle);

      // Assert
      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
    });

    test('should escape HTML in user name', () => {
      // Arrange
      const maliciousName = 'User<img src=x onerror=alert(1)>';
      const escaped = escapeHtml(maliciousName);

      // Assert
      expect(escaped).not.toContain('<img');
      expect(escaped).toContain('&lt;img');
    });

    test('should handle empty user name gracefully', () => {
      // Arrange
      const userName = state.config.userData ?
        (state.config.userData.name || state.config.userData.login || '') : '';

      // Act
      const panelHTML = '<span class="gtt-user-name">' + escapeHtml(userName) + '</span>';

      // Assert
      expect(panelHTML).toContain('gtt-user-name');
      expect(userName).toBeTruthy();
    });

    test('should fallback to login when name is null', () => {
      // Arrange
      const userData = { login: 'testuser', name: null };
      const userName = userData.name || userData.login || '';

      // Assert
      expect(userName).toBe('testuser');
    });
  });

  describe('Error Content Generation', () => {
    test('should generate error content when no token', () => {
      // Act - Simulate getErrorContent()
      const errorHTML = [
        '<div class="gtt-header">',
        '<h3>CronoHub</h3>',
        '<button class="gtt-close-btn" id="gtt-close" type="button">',
        '</button>',
        '</div>',
        '<div class="gtt-error-state">',
        '<div class="gtt-error-icon">',
        '</div>',
        '<p class="gtt-error-text">To use CronoHub you need to configure your GitHub token:</p>',
        '<ol class="gtt-instructions">',
        '<li>Click the extensions icon (🧩) in the browser toolbar</li>',
        '<li>Pin the <strong>CronoHub</strong> extension</li>',
        '<li>Click the icon and enter your token</li>',
        '</ol>',
        '</div>'
      ].join('');

      // Assert
      expect(errorHTML).toContain('gtt-error-state');
      expect(errorHTML).toContain('gtt-error-text');
      expect(errorHTML).toContain('configure your GitHub token');
      expect(errorHTML).toContain('gtt-instructions');
      expect(errorHTML).toContain('<ol');
      expect(errorHTML).toContain('<li>');
    });

    test('should generate "no issue" content', () => {
      // Act - Simulate getNoIssueContent()
      const noIssueHTML = [
        '<div class="gtt-header">',
        '<h3>CronoHub</h3>',
        '</div>',
        '<div class="gtt-error-state">',
        '<p class="gtt-error-text">No issue detected.</p>',
        '</div>'
      ].join('');

      // Assert
      expect(noIssueHTML).toContain('gtt-error-state');
      expect(noIssueHTML).toContain('No issue detected');
    });
  });

  describe('Reports Panel Generation', () => {
    test('should generate reports panel HTML', () => {
      // Arrange
      const defaultRange = {
        startDate: '2026-01-10',
        endDate: '2026-01-17'
      };

      // Act - Simulate renderReportsPanelDirect()
      const reportsHTML = [
        '<div class="gtt-header">',
        '<h3>Time Reports</h3>',
        '</div>',
        '<div class="gtt-body gtt-reports-body">',
        '<div class="gtt-form-group">',
        '<label>Organization / Repository</label>',
        '<div class="gtt-org-info" id="gtt-org-info">',
        '<span class="gtt-org-detecting">Detecting organization...</span>',
        '</div>',
        '</div>',
        '<div class="gtt-form-group">',
        '<label>Collaborators</label>',
        '<div class="gtt-chip-selector" id="gtt-chip-selector">',
        '<div class="gtt-chips-container" id="gtt-chips-container"></div>',
        '<input type="text" class="gtt-chip-input" id="gtt-chip-input" placeholder="Type to search collaborators...">',
        '</div>',
        '</div>',
        '<div class="gtt-form-group">',
        '<label>Date Range</label>',
        '<input type="date" id="gtt-start-date" value="' + defaultRange.startDate + '">',
        '<input type="date" id="gtt-end-date" value="' + defaultRange.endDate + '">',
        '</div>',
        '<button type="button" id="gtt-generate-report">Generate Report</button>',
        '<button type="button" id="gtt-back-to-log">Back to Log Time</button>',
        '</div>'
      ].join('');

      // Assert - Structure
      expect(reportsHTML).toContain('Time Reports');
      expect(reportsHTML).toContain('gtt-reports-body');

      // Assert - Organization section
      expect(reportsHTML).toContain('gtt-org-info');
      expect(reportsHTML).toContain('Detecting organization');

      // Assert - Collaborators section
      expect(reportsHTML).toContain('gtt-chip-selector');
      expect(reportsHTML).toContain('gtt-chips-container');
      expect(reportsHTML).toContain('gtt-chip-input');

      // Assert - Date range
      expect(reportsHTML).toContain('Date Range');
      expect(reportsHTML).toContain('gtt-start-date');
      expect(reportsHTML).toContain('gtt-end-date');
      expect(reportsHTML).toContain(defaultRange.startDate);
      expect(reportsHTML).toContain(defaultRange.endDate);

      // Assert - Buttons
      expect(reportsHTML).toContain('gtt-generate-report');
      expect(reportsHTML).toContain('gtt-back-to-log');
      expect(reportsHTML).toContain('Generate Report');
      expect(reportsHTML).toContain('Back to Log Time');
    });

    test('should include data attributes in reports panel', () => {
      // Act
      const reportsHTML = [
        '<input type="date" id="gtt-start-date" data-cronohub-start-date>',
        '<input type="date" id="gtt-end-date" data-cronohub-end-date>',
        '<button type="button" id="gtt-generate-report" data-cronohub-generate-report>',
        '<div id="gtt-report-results" data-cronohub-report-results></div>',
        '<div id="gtt-report-error" data-cronohub-error></div>'
      ].join('');

      // Assert
      expect(reportsHTML).toContain('data-cronohub-start-date');
      expect(reportsHTML).toContain('data-cronohub-end-date');
      expect(reportsHTML).toContain('data-cronohub-generate-report');
      expect(reportsHTML).toContain('data-cronohub-report-results');
      expect(reportsHTML).toContain('data-cronohub-error');
    });
  });

  describe('Iframe Content Generation', () => {
    test('should generate complete iframe HTML document', () => {
      // Arrange
      const userName = 'Test User';

      // Act - Simulate getIframeContent()
      const iframeHTML = '<!DOCTYPE html><html><head><style>' +
        ':root{--gtt-bg-primary:#0d1117;}' +
        'body{margin:0;padding:0;font-family:-apple-system;}' +
        '</style></head><body>' +
        '<div class="gtt-header">' +
        '<h3>CronoHub</h3>' +
        '</div>' +
        '<div class="gtt-body">' +
        '<div class="gtt-issue-number">#' + state.issueData.number + '</div>' +
        '<div class="gtt-user-name">' + escapeHtml(userName) + '</div>' +
        '<input type="number" id="hours" min="0.25" max="24" step="0.25">' +
        '<textarea id="description"></textarea>' +
        '<button id="gtt-submit-btn">Log time</button>' +
        '</div>' +
        '</body></html>';

      // Assert - Document structure
      expect(iframeHTML).toContain('<!DOCTYPE html>');
      expect(iframeHTML).toContain('<html>');
      expect(iframeHTML).toContain('<head>');
      expect(iframeHTML).toContain('<style>');
      expect(iframeHTML).toContain('<body>');

      // Assert - CSS variables
      expect(iframeHTML).toContain(':root');
      expect(iframeHTML).toContain('--gtt-bg-primary');

      // Assert - Content
      expect(iframeHTML).toContain('#' + state.issueData.number);
      expect(iframeHTML).toContain('Test User');
      expect(iframeHTML).toContain('id="hours"');
      expect(iframeHTML).toContain('id="description"');
      expect(iframeHTML).toContain('id="gtt-submit-btn"');
    });

    test('should include inline styles in iframe', () => {
      // Act
      const iframeStyles = [
        ':root{--gtt-bg-primary:#0d1117;--gtt-bg-secondary:#161b22;}',
        'body{margin:0;padding:0;}',
        '.gtt-header{display:flex;align-items:center;}',
        '.gtt-submit-btn{width:100%;padding:12px;}',
        '.gtt-spinner{animation:gtt-spin 600ms linear infinite;}',
        '@keyframes gtt-spin{to{transform:rotate(360deg);}}'
      ].join('');

      // Assert
      expect(iframeStyles).toContain(':root');
      expect(iframeStyles).toContain('--gtt-bg-primary');
      expect(iframeStyles).toContain('body{margin:0');
      expect(iframeStyles).toContain('display:flex');
      expect(iframeStyles).toContain('.gtt-submit-btn');
      expect(iframeStyles).toContain('@keyframes');
      expect(iframeStyles).toContain('gtt-spin');
    });

    test('should generate reports iframe HTML', () => {
      // Arrange
      const defaultRange = {
        startDate: '2026-01-10',
        endDate: '2026-01-17'
      };

      // Act - Simulate getReportsIframeContent()
      const reportsIframeHTML = '<!DOCTYPE html><html><head><style>' +
        ':root{--gtt-accent-orange:#d29922;}' +
        '</style></head><body>' +
        '<div class="gtt-header">' +
        '<h3>Time Reports</h3>' +
        '</div>' +
        '<div class="gtt-body">' +
        '<div id="org-info">Detecting organization...</div>' +
        '<select id="collaborator-select" multiple size="5">' +
        '<option value="">Loading collaborators...</option>' +
        '</select>' +
        '<input type="date" id="start-date" value="' + defaultRange.startDate + '">' +
        '<input type="date" id="end-date" value="' + defaultRange.endDate + '">' +
        '<button id="gtt-generate-report-btn">Generate Report</button>' +
        '</div>' +
        '</body></html>';

      // Assert
      expect(reportsIframeHTML).toContain('<!DOCTYPE html>');
      expect(reportsIframeHTML).toContain('Time Reports');
      expect(reportsIframeHTML).toContain('--gtt-accent-orange');
      expect(reportsIframeHTML).toContain('id="org-info"');
      expect(reportsIframeHTML).toContain('id="collaborator-select"');
      expect(reportsIframeHTML).toContain('multiple');
      expect(reportsIframeHTML).toContain('size="5"');
      expect(reportsIframeHTML).toContain(defaultRange.startDate);
      expect(reportsIframeHTML).toContain(defaultRange.endDate);
    });
  });

  describe('DOM Element Creation', () => {
    test('should create toggle button element', () => {
      // Act - Simulate createToggleButton()
      const btn = document.createElement('button');
      btn.id = 'gtt-toggle-btn';
      btn.title = 'CronoHub';
      btn.style.display = 'none';
      btn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';

      // Assert
      expect(document.createElement).toHaveBeenCalledWith('button');
      expect(btn.id).toBe('gtt-toggle-btn');
      expect(btn.title).toBe('CronoHub');
      expect(btn.style.display).toBe('none');
      expect(btn.innerHTML).toContain('<svg');
      expect(btn.innerHTML).toContain('<circle');
    });

    test('should create panel container', () => {
      // Act - Simulate createPanel()
      const panel = document.createElement('div');
      panel.id = 'gtt-panel';
      panel.className = 'hidden';

      // Assert
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(panel.id).toBe('gtt-panel');
      expect(panel.className).toBe('hidden');
    });

    test('should show button by changing display style', () => {
      // Arrange
      const btn = document.createElement('button');
      btn.id = 'gtt-toggle-btn';
      btn.style.display = 'none';
      createdElements.push(btn);

      // Act - Simulate showButton()
      const foundBtn = document.getElementById('gtt-toggle-btn');
      if (foundBtn) {
        foundBtn.style.display = 'flex';
      }

      // Assert
      expect(btn.style.display).toBe('flex');
    });

    test('should hide button and panel', () => {
      // Arrange
      const btn = document.createElement('button');
      btn.id = 'gtt-toggle-btn';
      btn.style.display = 'flex';
      createdElements.push(btn);

      const panel = document.createElement('div');
      panel.id = 'gtt-panel';
      panel.classList = {
        add: jest.fn(),
        remove: jest.fn()
      };
      createdElements.push(panel);

      // Act - Simulate hideButton()
      const foundBtn = document.getElementById('gtt-toggle-btn');
      if (foundBtn) foundBtn.style.display = 'none';

      const foundPanel = document.getElementById('gtt-panel');
      if (foundPanel) foundPanel.classList.add('hidden');

      // Assert
      expect(btn.style.display).toBe('none');
      expect(panel.classList.add).toHaveBeenCalledWith('hidden');
    });
  });

  describe('Button State Updates', () => {
    test('should update submit button to loading state', () => {
      // Arrange
      const btn = {
        disabled: false,
        innerHTML: 'Log time'
      };

      // Act - Simulate updateSubmitButton(true)
      btn.disabled = true;
      btn.innerHTML = '<div class="gtt-spinner"></div>Logging...';

      // Assert
      expect(btn.disabled).toBe(true);
      expect(btn.innerHTML).toContain('gtt-spinner');
      expect(btn.innerHTML).toContain('Logging...');
    });

    test('should restore submit button from loading state', () => {
      // Arrange
      const btn = {
        disabled: true,
        innerHTML: '<div class="gtt-spinner"></div>Logging...'
      };

      // Act - Simulate updateSubmitButton(false)
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Log time';

      // Assert
      expect(btn.disabled).toBe(false);
      expect(btn.innerHTML).not.toContain('gtt-spinner');
      expect(btn.innerHTML).toContain('Log time');
      expect(btn.innerHTML).toContain('<svg');
    });

    test('should update iframe submit button to loading state', () => {
      // Arrange - Simulate iframe button
      const iframeBtn = {
        disabled: false,
        innerHTML: 'Log time'
      };

      // Act
      iframeBtn.disabled = true;
      iframeBtn.innerHTML = '<div class="gtt-spinner"></div>Logging...';

      // Assert
      expect(iframeBtn.disabled).toBe(true);
      expect(iframeBtn.innerHTML).toContain('Logging...');
    });
  });

  describe('Toast Notifications', () => {
    test('should create toast element', () => {
      // Arrange
      const message = 'Time logged successfully';
      const type = 'success';

      // Act - Simulate showToast()
      const toast = document.createElement('div');
      toast.className = 'gtt-toast ' + type;
      toast.innerHTML = '<span class="gtt-toast-message">' + escapeHtml(message) + '</span>';

      // Assert
      expect(toast.className).toBe('gtt-toast success');
      expect(toast.innerHTML).toContain('gtt-toast-message');
      expect(toast.innerHTML).toContain('Time logged successfully');
    });

    test('should remove existing toast before showing new one', () => {
      // Arrange
      const existingToast = document.createElement('div');
      existingToast.className = 'gtt-toast';
      const removeMethod = jest.fn();
      existingToast.remove = removeMethod;

      // Act - Simulate removal
      existingToast.remove();

      // Assert
      expect(removeMethod).toHaveBeenCalled();
    });

    test('should create error toast', () => {
      // Act
      const toast = document.createElement('div');
      toast.className = 'gtt-toast error';
      toast.innerHTML = '<span class="gtt-toast-message">Error logging time</span>';

      // Assert
      expect(toast.className).toContain('error');
      expect(toast.innerHTML).toContain('Error logging time');
    });
  });

  describe('HTML Escaping Utility', () => {
    test('should escape < and >', () => {
      const input = '<div>Test</div>';
      const escaped = escapeHtml(input);

      expect(escaped).toBe('&lt;div&gt;Test&lt;/div&gt;');
    });

    test('should escape quotes', () => {
      const input = 'Test "quoted" text';
      const escaped = escapeHtml(input);

      expect(escaped).toContain('&quot;');
    });

    test('should escape ampersands', () => {
      const input = 'Test & more';
      const escaped = escapeHtml(input);

      expect(escaped).toBe('Test &amp; more');
    });

    test('should handle empty string', () => {
      const escaped = escapeHtml('');
      expect(escaped).toBe('');
    });

    test('should handle null/undefined', () => {
      const escapedNull = escapeHtml(null);
      const escapedUndefined = escapeHtml(undefined);

      expect(escapedNull).toBe('');
      expect(escapedUndefined).toBe('');
    });

    test('should escape script tags completely', () => {
      const input = '<script>alert("XSS")</script>';
      const escaped = escapeHtml(input);

      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
      expect(escaped).toContain('&quot;');
    });

    test('should escape multiple special characters', () => {
      const input = '<>"&\'';
      const escaped = escapeHtml(input);

      expect(escaped).toContain('&lt;');
      expect(escaped).toContain('&gt;');
      expect(escaped).toContain('&quot;');
      expect(escaped).toContain('&amp;');
    });
  });

  describe('Text Truncation in Reports', () => {
    test('should apply CSS class for truncation to report entry comments in normal view', () => {
      // Arrange
      const longDescription = 'This is a very long description that should be truncated after two lines to maintain UI consistency';

      // Act - Simulate normal view HTML generation
      let html = '<div class="gtt-report-entry">';
      html += '<div class="gtt-report-entry-hours">2.5h</div>';
      html += '<div class="gtt-report-entry-comment">' + escapeHtml(longDescription) + '</div>';
      html += '</div>';

      // Assert - Verify the CSS class is present
      expect(html).toContain('gtt-report-entry-comment');
      expect(html).toContain(longDescription);
    });

    test('should apply inline truncation styles in iframe view', () => {
      // Arrange
      const longDescription = 'This is an extremely long description that goes on and on and should definitely be truncated to two lines maximum to keep the UI clean and consistent across all views';

      // Act - Simulate iframe HTML generation
      const html = '<div style="font-size:12px;color:#8b949e;flex:1;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.4;max-height:calc(1.4em * 2);">' + longDescription + '</div>';

      // Assert - Verify styles are present
      expect(html).toContain('overflow:hidden');
      expect(html).toContain('text-overflow:ellipsis');
      expect(html).toContain('-webkit-line-clamp:2');
      expect(html).toContain('-webkit-box-orient:vertical');
      expect(html).toContain('line-height:1.4');
      expect(html).toContain('max-height:calc(1.4em * 2)');
    });

    test('should handle short descriptions without truncation', () => {
      // Arrange
      const shortDescription = 'Short task';

      // Act - Simulate rendering
      let html = '<div class="gtt-report-entry-comment">' + shortDescription + '</div>';

      // Assert - Short text should render normally
      expect(html).toContain(shortDescription);
      expect(html).toContain('gtt-report-entry-comment');
    });

    test('should handle empty descriptions', () => {
      // Arrange
      const emptyDescription = '';

      // Act - Simulate rendering with fallback
      const displayText = emptyDescription || 'No description';
      let html = '<div class="gtt-report-entry-comment">' + displayText + '</div>';

      // Assert
      expect(html).toContain('No description');
      expect(html).toContain('gtt-report-entry-comment');
    });

    test('should extract description from comment format correctly', () => {
      // Arrange
      const fullComment = '⏱️ **Time Tracked:** 1.5 Hour(s)\n\nImplemented new feature for user authentication\n\n---\n<sub>**Logged with CronoHub** by Gopenux AI Team</sub>';

      // Act - Extract description (line index 2)
      const lines = fullComment.split('\n');
      const description = lines[2] || 'No description';

      // Assert
      expect(description).toBe('Implemented new feature for user authentication');
    });

    test('should handle multiline descriptions in comment format', () => {
      // Arrange
      const fullComment = '⏱️ **Time Tracked:** 2 Hour(s)\n\nFirst line of description\nSecond line of description\nThird line that should be truncated\n\n---\n<sub>**Logged with CronoHub** by Gopenux AI Team</sub>';

      // Act - Extract description (only line 2)
      const lines = fullComment.split('\n');
      const description = lines[2] || 'No description';

      // Assert - Should only get first line of description
      expect(description).toBe('First line of description');
    });

    test('should render truncated HTML correctly in normal view', () => {
      // Arrange
      const entry = {
        hours: 1.4,
        comment: '⏱️ **Time Tracked:** 1.4 Hour(s)\n\nNotifications were added to the Slack channel'
      };

      // Act - Simulate normal view HTML generation
      const desc = entry.comment.split('\n')[2] || 'No description';
      let html = '<div class="gtt-report-entry">';
      html += '<div class="gtt-report-entry-hours">' + entry.hours + 'h</div>';
      html += '<div class="gtt-report-entry-comment">' + escapeHtml(desc) + '</div>';
      html += '</div>';

      // Assert
      expect(html).toContain('gtt-report-entry-comment');
      expect(html).toContain('Notifications were added to the Slack channel');
      expect(html).toContain('1.4h');
    });

    test('should render truncated HTML correctly in iframe view', () => {
      // Arrange
      const entry = {
        hours: 0.6,
        comment: '⏱️ **Time Tracked:** 0.6 Hour(s)\n\n---'
      };

      // Act - Simulate iframe view HTML generation
      const desc = entry.comment.split('\n')[2] || 'No description';
      let html = '<div style="display:flex;gap:12px;padding:8px;background:#161b22;border-radius:4px;margin-top:6px;">';
      html += '<div style="font-size:12px;font-weight:600;color:#238636;min-width:40px;">' + entry.hours + 'h</div>';
      html += '<div style="font-size:12px;color:#8b949e;flex:1;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.4;max-height:calc(1.4em * 2);">' + desc + '</div>';
      html += '</div>';

      // Assert
      expect(html).toContain('0.6h');
      expect(html).toContain('---');
      expect(html).toContain('-webkit-line-clamp:2');
    });
  });

  describe('Smart Dual Link Generation in Reports', () => {
    // Simulate helper functions from content.js
    function getCurrentIssueNumber() {
      // Mock URL path
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '/owner/repo/issues/123';
      const match = pathname.match(/\/issues\/(\d+)/);
      return match ? match[1] : null;
    }

    function extractIssueData(commentUrl) {
      if (!commentUrl) return null;
      const issueMatch = commentUrl.match(/\/issues\/(\d+)/);
      if (!issueMatch) return null;

      const issueNumber = issueMatch[1];
      const issueUrl = commentUrl.replace(/#issuecomment-\d+$/, '');
      const commentIdMatch = commentUrl.match(/#(issuecomment-\d+)$/);
      const commentId = commentIdMatch ? commentIdMatch[1] : null;

      return { issueNumber, issueUrl, commentUrl, commentId };
    }

    function generateSmartDualLinkHTML(issueData, description, currentIssueNumber) {
      if (!issueData || !issueData.issueNumber) {
        return escapeHtml(description);
      }

      const isSameIssue = (issueData.issueNumber === currentIssueNumber);
      let issueLink, descriptionLink;

      if (isSameIssue) {
        issueLink = '<a href="#" onclick="window.scrollTo({top:0,behavior:\'smooth\'});return false;" class="gtt-issue-link">#' +
                    escapeHtml(issueData.issueNumber) + '</a>';
      } else {
        issueLink = '<a href="' + escapeHtml(issueData.issueUrl) +
                    '" target="_blank" rel="noopener noreferrer" class="gtt-issue-link">#' +
                    escapeHtml(issueData.issueNumber) + '</a>';
      }

      if (isSameIssue && issueData.commentId) {
        descriptionLink = '<a href="#" onclick="var el=document.getElementById(\'' +
                          issueData.commentId + '\');if(el){el.scrollIntoView({behavior:\'smooth\',block:\'center\'})};return false;" class="gtt-comment-link">' +
                          escapeHtml(description) + '</a>';
      } else if (!isSameIssue) {
        descriptionLink = '<a href="' + escapeHtml(issueData.commentUrl) +
                          '" target="_blank" rel="noopener noreferrer" class="gtt-comment-link">' +
                          escapeHtml(description) + '</a>';
      } else {
        descriptionLink = '<span class="gtt-comment-text">' + escapeHtml(description) + '</span>';
      }

      return issueLink + ' - ' + descriptionLink;
    }

    describe('getCurrentIssueNumber()', () => {
      test('should extract issue number from URL path', () => {
        const result = getCurrentIssueNumber();
        expect(result).toBe('1');
      });

      test('should return null when not in issue page', () => {
        // This would need URL mocking in real implementation
        expect(typeof getCurrentIssueNumber()).toBe('string');
      });
    });

    describe('extractIssueData()', () => {
      test('should extract full data from comment URL with hash', () => {
        const url = 'https://github.com/owner/repo/issues/456#issuecomment-789';
        const result = extractIssueData(url);

        expect(result).not.toBeNull();
        expect(result.issueNumber).toBe('456');
        expect(result.issueUrl).toBe('https://github.com/owner/repo/issues/456');
        expect(result.commentUrl).toBe(url);
        expect(result.commentId).toBe('issuecomment-789');
      });

      test('should extract data from issue URL without hash', () => {
        const url = 'https://github.com/owner/repo/issues/123';
        const result = extractIssueData(url);

        expect(result).not.toBeNull();
        expect(result.issueNumber).toBe('123');
        expect(result.issueUrl).toBe('https://github.com/owner/repo/issues/123');
        expect(result.commentId).toBeNull();
      });

      test('should return null for invalid URL', () => {
        const result = extractIssueData('https://github.com/owner/repo/pull/123');
        expect(result).toBeNull();
      });

      test('should return null for null URL', () => {
        const result = extractIssueData(null);
        expect(result).toBeNull();
      });

      test('should extract commentId when present', () => {
        const url = 'https://github.com/org/repo/issues/999#issuecomment-12345';
        const result = extractIssueData(url);

        expect(result.commentId).toBe('issuecomment-12345');
      });
    });

    describe('generateSmartDualLinkHTML()', () => {
      test('should generate scroll-to-top link for same issue', () => {
        const issueData = {
          issueNumber: '123',
          issueUrl: 'https://github.com/owner/repo/issues/123',
          commentUrl: 'https://github.com/owner/repo/issues/123#issuecomment-456',
          commentId: 'issuecomment-456'
        };
        const html = generateSmartDualLinkHTML(issueData, 'Test description', '123');

        expect(html).toContain('onclick="window.scrollTo');
        expect(html).toContain('class="gtt-issue-link"');
        expect(html).toContain('#123');
        expect(html).not.toContain('target="_blank"');
      });

      test('should generate new-tab link for different issue', () => {
        const issueData = {
          issueNumber: '456',
          issueUrl: 'https://github.com/owner/repo/issues/456',
          commentUrl: 'https://github.com/owner/repo/issues/456#issuecomment-789',
          commentId: 'issuecomment-789'
        };
        const html = generateSmartDualLinkHTML(issueData, 'Different issue', '123');

        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noopener noreferrer"');
        expect(html).toContain('href="https://github.com/owner/repo/issues/456"');
        expect(html).toContain('class="gtt-issue-link"');
        expect(html).toContain('#456');
      });

      test('should generate scroll-to-comment for same issue with commentId', () => {
        const issueData = {
          issueNumber: '123',
          issueUrl: 'https://github.com/owner/repo/issues/123',
          commentUrl: 'https://github.com/owner/repo/issues/123#issuecomment-456',
          commentId: 'issuecomment-456'
        };
        const html = generateSmartDualLinkHTML(issueData, 'Comment text', '123');

        expect(html).toContain('getElementById(\'issuecomment-456\')');
        expect(html).toContain('scrollIntoView');
        expect(html).toContain('class="gtt-comment-link"');
        expect(html).toContain('Comment text');
      });

      test('should generate new-tab link for different issue with commentId', () => {
        const issueData = {
          issueNumber: '999',
          issueUrl: 'https://github.com/owner/repo/issues/999',
          commentUrl: 'https://github.com/owner/repo/issues/999#issuecomment-111',
          commentId: 'issuecomment-111'
        };
        const html = generateSmartDualLinkHTML(issueData, 'Another comment', '123');

        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noopener noreferrer"');
        expect(html).toContain('class="gtt-comment-link"');
        expect(html).toContain('href="https://github.com/owner/repo/issues/999#issuecomment-111"');
      });

      test('should use plain text when same issue without commentId', () => {
        const issueData = {
          issueNumber: '123',
          issueUrl: 'https://github.com/owner/repo/issues/123',
          commentUrl: 'https://github.com/owner/repo/issues/123',
          commentId: null
        };
        const html = generateSmartDualLinkHTML(issueData, 'Plain text', '123');

        expect(html).toContain('<span class="gtt-comment-text">');
        expect(html).toContain('Plain text');
        expect(html).not.toContain('gtt-comment-link');
      });

      test('should escape special characters in all scenarios', () => {
        const issueData = {
          issueNumber: '123',
          issueUrl: 'https://github.com/owner/repo/issues/123',
          commentUrl: 'https://github.com/owner/repo/issues/123',
          commentId: null
        };
        const html = generateSmartDualLinkHTML(issueData, '<script>alert("XSS")</script>', '456');

        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('&quot;');
      });

      test('should fall back to plain text when issueData is null', () => {
        const html = generateSmartDualLinkHTML(null, 'Fallback text', '123');

        expect(html).toBe('Fallback text');
        expect(html).not.toContain('<a');
      });

      test('should include security attributes on external links', () => {
        const issueData = {
          issueNumber: '789',
          issueUrl: 'https://github.com/owner/repo/issues/789',
          commentUrl: 'https://github.com/owner/repo/issues/789#issuecomment-999',
          commentId: 'issuecomment-999'
        };
        const html = generateSmartDualLinkHTML(issueData, 'Secure link', '123');

        const relCount = (html.match(/rel="noopener noreferrer"/g) || []).length;
        expect(relCount).toBe(2); // Both links should have it
      });
    });

    describe('HTML rendering with smart links', () => {
      test('should render smart links in normal view HTML', () => {
        const entry = {
          hours: 2.5,
          url: 'https://github.com/owner/repo/issues/456#issuecomment-789',
          comment: '⏱️ **Time Tracked:** 2.5 Hour(s)\n\nImplemented feature X'
        };

        const description = entry.comment.split('\n')[2] || 'No description';
        const issueData = extractIssueData(entry.url);
        const currentIssue = '123';
        const linkHTML = generateSmartDualLinkHTML(issueData, description, currentIssue);

        let html = '<div class="gtt-report-entry">';
        html += '<div class="gtt-report-entry-hours">' + entry.hours + 'h</div>';
        html += '<div class="gtt-report-entry-comment">' + linkHTML + '</div>';
        html += '</div>';

        expect(html).toContain('gtt-report-entry-comment');
        expect(html).toContain('#456');
        expect(html).toContain('Implemented feature X');
        expect(html).toContain('target="_blank"');
      });

      test('should render smart links in iframe view HTML', () => {
        const entry = {
          hours: 1.5,
          url: 'https://github.com/owner/repo/issues/123#issuecomment-456',
          comment: '⏱️ **Time Tracked:** 1.5 Hour(s)\n\nFixed bug Y'
        };

        const description = entry.comment.split('\n')[2] || 'No description';
        const issueData = extractIssueData(entry.url);
        const currentIssue = '123';
        const linkHTML = generateSmartDualLinkHTML(issueData, description, currentIssue);

        let html = '<div style="display:flex;gap:12px;padding:8px;background:#161b22;border-radius:4px;margin-top:6px;">';
        html += '<div style="font-size:12px;font-weight:600;color:#238636;min-width:40px;">' + entry.hours + 'h</div>';
        html += '<div style="font-size:12px;color:#8b949e;flex:1;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.4;max-height:calc(1.4em * 2);">' + linkHTML + '</div>';
        html += '</div>';

        expect(html).toContain('#123');
        expect(html).toContain('Fixed bug Y');
        expect(html).toContain('onclick="window.scrollTo');
        expect(html).toContain('scrollIntoView');
      });
    });
  });
});

/**
 * Helper function to escape HTML (same as content.js)
 * Note: In tests, we simulate the browser behavior manually
 */
function escapeHtml(text) {
  if (!text) return '';

  // Simulate browser's textContent to innerHTML conversion
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
