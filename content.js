// CronoHub - Content Script
// Author: Gopenux AI Team
// Copyright (c) 2026 Gopenux AI

console.log('CronoHub: Content script loaded');

(function() {
  'use strict';

  // Check if extension context is valid
  function isExtensionContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  var state = {
    isOpen: false,
    isLoading: false,
    config: null,
    issueData: null,
    panelMode: 'log', // 'log' or 'reports'
    reportsData: null,
    allCollaborators: [],
    selectedCollaborators: []
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    loadConfig().then(function(config) {
      state.config = config;

      createToggleButton();
      createPanel();
      detectIssue();

      setInterval(function() {
        detectIssue();
      }, 1000);

      console.log('CronoHub: Initialized');
    }).catch(function(error) {
      console.error('CronoHub: Failed to initialize', error);
      // Don't show toast on init error, as the page might be loading
    });
  }

  function detectIssue() {
    var newIssueData = getIssueData();
    
    if (newIssueData) {
      if (!state.issueData || state.issueData.number !== newIssueData.number) {
        console.log('CronoHub: Issue detected', newIssueData);
      }
      state.issueData = newIssueData;
      showButton();
    } else {
      state.issueData = null;
      hideButton();
    }
  }

  function getIssueData() {
    // Direct issue URL
    var urlMatch = window.location.pathname.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    if (urlMatch) {
      var titleElement = document.querySelector('.js-issue-title, .markdown-title');
      return {
        owner: urlMatch[1],
        repo: urlMatch[2],
        number: parseInt(urlMatch[3]),
        title: titleElement ? titleElement.textContent.trim() : 'No title'
      };
    }

    // Issue panel in projects
    var sidePanel = document.querySelector('[data-testid="side-panel-content"]');
    if (sidePanel) {
      var issueLink = sidePanel.querySelector('a[href*="/issues/"]');
      if (issueLink && issueLink.href) {
        var linkMatch = issueLink.href.match(/\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
        if (linkMatch) {
          var titleEl = sidePanel.querySelector('.markdown-title');
          return {
            owner: linkMatch[1],
            repo: linkMatch[2],
            number: parseInt(linkMatch[3]),
            title: titleEl ? titleEl.textContent.trim() : 'No title'
          };
        }
      }
    }

    // URL parameter
    var urlParams = new URLSearchParams(window.location.search);
    var paneIssue = urlParams.get('issue');
    if (paneIssue) {
      var decoded = decodeURIComponent(paneIssue);
      var parts = decoded.split('|');
      if (parts.length >= 3) {
        return {
          owner: parts[0],
          repo: parts[1],
          number: parseInt(parts[2]),
          title: document.querySelector('.markdown-title')?.textContent?.trim() || 'No title'
        };
      }
    }

    return null;
  }

  function loadConfig() {
    return new Promise(function(resolve, reject) {
      if (!isExtensionContextValid()) {
        reject(new Error('Extension context invalidated'));
        return;
      }

      try {
        chrome.storage.local.get(['githubToken', 'userData'], function(result) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function createToggleButton() {
    // Main button - Opens panel
    var btn = document.createElement('button');
    btn.id = 'gtt-toggle-btn';
    btn.title = 'CronoHub';
    btn.style.display = 'none';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>';
    btn.onclick = function() {
      togglePanel();
    };
    document.body.appendChild(btn);
  }

  function createPanel() {
    var panel = document.createElement('div');
    panel.id = 'gtt-panel';
    panel.className = 'hidden';
    document.body.appendChild(panel);
  }

  function showButton() {
    var btn = document.getElementById('gtt-toggle-btn');
    if (btn) btn.style.display = 'flex';
  }

  function hideButton() {
    var btn = document.getElementById('gtt-toggle-btn');
    if (btn) btn.style.display = 'none';
    var panel = document.getElementById('gtt-panel');
    if (panel) panel.classList.add('hidden');
    state.isOpen = false;
  }

  function togglePanel() {
    state.isOpen = !state.isOpen;
    var panel = document.getElementById('gtt-panel');

    if (state.isOpen) {
      loadConfig().then(function(config) {
        state.config = config;
        renderPanel();
        panel.classList.remove('hidden');
      }).catch(function(error) {
        console.error('CronoHub: Error loading config', error);
        state.isOpen = false;

        // Check if it's an extension context invalidated error
        if (error.message && error.message.includes('Extension context invalidated')) {
          showToast('CronoHub was updated. Please reload this page.', 'error');
        } else {
          showToast('Error loading configuration: ' + error.message, 'error');
        }
      });
    } else {
      panel.classList.add('hidden');
    }
  }

  function renderPanel() {
    var panel = document.getElementById('gtt-panel');
    var isProjectView = window.location.pathname.includes('/projects/');

    console.log('CronoHub: pathname =', window.location.pathname);
    console.log('CronoHub: isProjectView =', isProjectView);
    console.log('CronoHub: panelMode =', state.panelMode);

    if (!state.config || !state.config.githubToken) {
      panel.innerHTML = getErrorContent();
      document.getElementById('gtt-close').onclick = togglePanel;
      return;
    }

    // Reports mode doesn't require issue detection
    if (state.panelMode === 'reports') {
      if (isProjectView) {
        renderReportsPanelInIframe(panel);
      } else {
        renderReportsPanelDirect(panel);
      }
      return;
    }

    // Log mode requires issue detection
    if (!state.issueData) {
      panel.innerHTML = getNoIssueContent();
      document.getElementById('gtt-close').onclick = togglePanel;
      return;
    }

    var userName = state.config.userData ? (state.config.userData.name || state.config.userData.login || '') : '';

    if (isProjectView) {
      // In projects view, use iframe
      renderPanelInIframe(panel, userName);
    } else {
      // In normal view, render directly
      renderPanelDirect(panel, userName);
    }
  }

  function renderPanelDirect(panel, userName) {
    panel.innerHTML = [
      '<div class="gtt-header">',
      '<div class="gtt-header-title">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>',
      '<h3>CronoHub</h3>',
      '</div>',
      '<button class="gtt-close-btn" id="gtt-close" type="button">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '</button>',
      '</div>',
      '<div class="gtt-body">',
      '<div class="gtt-issue-info">',
      '<div class="gtt-issue-icon">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      '</div>',
      '<div class="gtt-issue-details">',
      '<div class="gtt-issue-number">#' + state.issueData.number + ' · ' + state.issueData.owner + '/' + state.issueData.repo + '</div>',
      '<div class="gtt-issue-title">' + escapeHtml(state.issueData.title) + '</div>',
      '</div>',
      '</div>',
      '<div class="gtt-user-info">',
      '<span class="gtt-user-label">Logging as:</span>',
      '<span class="gtt-user-name">' + escapeHtml(userName) + '</span>',
      '</div>',
      '<div class="gtt-form-group">',
      '<label>Hours worked</label>',
      '<div class="gtt-input-wrapper">',
      '<input type="number" id="gtt-hours" class="gtt-input gtt-hours-input" min="0.25" max="24" step="0.25" placeholder="2.5">',
      '<span class="gtt-input-suffix">hours</span>',
      '</div>',
      '</div>',
      '<div class="gtt-form-group">',
      '<label>Description (optional)</label>',
      '<textarea id="gtt-description" class="gtt-textarea" rows="3" placeholder="Brief description..."></textarea>',
      '</div>',
      '<button type="button" class="gtt-submit-btn" id="gtt-submit">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
      'Log time',
      '</button>',
      '<button type="button" class="gtt-secondary-btn" id="gtt-view-reports">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
      'View Reports',
      '</button>',
      '</div>'
    ].join('');

    document.getElementById('gtt-close').onclick = togglePanel;
    document.getElementById('gtt-submit').onclick = function() {
      console.log('CronoHub: Submit clicked');
      handleSubmit();
    };
    document.getElementById('gtt-view-reports').onclick = function() {
      state.panelMode = 'reports';
      renderPanel();
    };
  }

  function renderPanelInIframe(panel, userName) {
    var iframeHtml = getIframeContent(userName);
    
    panel.innerHTML = '<iframe id="gtt-iframe" style="width:100%;height:470px;border:none;border-radius:12px;overflow:hidden;"></iframe>';
    
    var iframe = document.getElementById('gtt-iframe');
    var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    
    iframeDoc.open();
    iframeDoc.write(iframeHtml);
    iframeDoc.close();
    
    // Connect events after iframe loads
    setTimeout(function() {
      var iframeDocument = iframe.contentDocument;
      
      // Close button
      var closeBtn = iframeDocument.getElementById('gtt-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', function() {
          togglePanel();
        });
      }
      
      // Submit button
      var submitBtn = iframeDocument.getElementById('gtt-submit-btn');
      if (submitBtn) {
        submitBtn.addEventListener('click', function() {
          var hours = iframeDocument.getElementById('hours').value;
          var description = iframeDocument.getElementById('description').value;
          console.log('CronoHub: Submit from iframe', hours, description);
          handleSubmitWithData(hours, description);
        });
      }

      // View Reports button
      var viewReportsBtn = iframeDocument.getElementById('gtt-view-reports-btn');
      if (viewReportsBtn) {
        viewReportsBtn.addEventListener('click', function() {
          state.panelMode = 'reports';
          renderPanel();
        });
      }
    }, 100);
  }

  function getIframeContent(userName) {
    return '<!DOCTYPE html><html><head><style>' +
      ':root{--gtt-bg-primary:#0d1117;--gtt-bg-secondary:#161b22;--gtt-bg-tertiary:#21262d;--gtt-border:#30363d;--gtt-text-primary:#f0f6fc;--gtt-text-secondary:#8b949e;--gtt-text-muted:#6e7681;--gtt-accent-green:#238636;--gtt-accent-blue:#58a6ff;}' +
      'body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif;background:var(--gtt-bg-secondary);color:var(--gtt-text-primary);font-size:14px;overflow:hidden;}' +
      '.gtt-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;background:var(--gtt-bg-primary);border-bottom:1px solid var(--gtt-border);}' +
      '.gtt-header-title{display:flex;align-items:center;gap:10px;}' +
      '.gtt-header-title svg{width:20px;height:20px;color:var(--gtt-accent-green);}' +
      '.gtt-header-title h3{font-size:14px;font-weight:600;color:var(--gtt-text-primary);margin:0;}' +
      '.gtt-close-btn{background:transparent;border:none;padding:6px;cursor:pointer;border-radius:6px;color:var(--gtt-text-muted);transition:all 150ms ease;display:flex;align-items:center;justify-content:center;}' +
      '.gtt-close-btn:hover{background:var(--gtt-bg-tertiary);color:var(--gtt-text-primary);}' +
      '.gtt-close-btn svg{width:18px;height:18px;}' +
      '.gtt-body{padding:18px;}' +
      '.gtt-issue-info{display:flex;align-items:flex-start;gap:12px;padding:14px;background:var(--gtt-bg-tertiary);border-radius:8px;margin-bottom:14px;}' +
      '.gtt-issue-icon{width:32px;height:32px;border-radius:50%;background:rgba(35,134,54,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;}' +
      '.gtt-issue-icon svg{width:16px;height:16px;color:var(--gtt-accent-green);}' +
      '.gtt-issue-details{flex:1;min-width:0;}' +
      '.gtt-issue-number{font-size:12px;color:var(--gtt-text-muted);margin-bottom:2px;}' +
      '.gtt-issue-title{font-size:13px;font-weight:500;color:var(--gtt-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.gtt-user-info{display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(35,134,54,0.1);border:1px solid rgba(35,134,54,0.3);border-radius:8px;margin-bottom:18px;}' +
      '.gtt-user-label{font-size:12px;color:var(--gtt-text-secondary);}' +
      '.gtt-user-name{font-size:13px;font-weight:600;color:var(--gtt-accent-green);}' +
      '.gtt-form-group{margin-bottom:16px;}' +
      '.gtt-form-group label{display:block;font-size:12px;font-weight:500;color:var(--gtt-text-secondary);margin-bottom:8px;}' +
      '.gtt-input-wrapper{position:relative;}' +
      '.gtt-input{width:100%;padding:12px 14px;padding-right:60px;font-size:14px;color:var(--gtt-text-primary);background:var(--gtt-bg-primary);border:1px solid var(--gtt-border);border-radius:8px;outline:none;transition:all 150ms ease;box-sizing:border-box;}' +
      '.gtt-input:focus{border-color:var(--gtt-accent-blue);box-shadow:0 0 0 3px rgba(88,166,255,0.15);}' +
      '.gtt-input::placeholder{color:var(--gtt-text-muted);}' +
      '.gtt-input[type="number"]::-webkit-outer-spin-button,.gtt-input[type="number"]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}' +
      '.gtt-input[type="number"]{-moz-appearance:textfield;}' +
      '.gtt-input-suffix{position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--gtt-text-muted);pointer-events:none;}' +
      '.gtt-textarea{width:100%;min-height:80px;padding:12px 14px;font-size:14px;color:var(--gtt-text-primary);background:var(--gtt-bg-primary);border:1px solid var(--gtt-border);border-radius:8px;outline:none;resize:vertical;font-family:inherit;transition:all 150ms ease;box-sizing:border-box;}' +
      '.gtt-textarea:focus{border-color:var(--gtt-accent-blue);box-shadow:0 0 0 3px rgba(88,166,255,0.15);}' +
      '.gtt-textarea::placeholder{color:var(--gtt-text-muted);}' +
      '.gtt-submit-btn{width:100%;padding:12px 18px;font-size:14px;font-weight:600;color:white;background:linear-gradient(135deg,var(--gtt-accent-green) 0%,#1a7f37 100%);border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all 150ms ease;margin-top:8px;}' +
      '.gtt-submit-btn:hover{box-shadow:0 4px 12px rgba(35,134,54,0.3);transform:translateY(-1px);}' +
      '.gtt-submit-btn:active{transform:translateY(0);}' +
      '.gtt-submit-btn:disabled{opacity:0.6;cursor:not-allowed;}' +
      '.gtt-submit-btn svg{width:18px;height:18px;}' +
      '.gtt-secondary-btn{width:100%;padding:10px 16px;font-size:13px;font-weight:500;color:var(--gtt-text-secondary);background:transparent;border:1px solid var(--gtt-border);border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 150ms ease;margin-top:8px;}' +
      '.gtt-secondary-btn:hover{background:var(--gtt-bg-tertiary);color:var(--gtt-text-primary);border-color:var(--gtt-text-muted);}' +
      '.gtt-secondary-btn svg{width:16px;height:16px;}' +
      '.gtt-spinner{width:18px;height:18px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:gtt-spin 600ms linear infinite;}' +
      '@keyframes gtt-spin{to{transform:rotate(360deg);}}' +
      '</style></head><body>' +
      '<div class="gtt-header">' +
      '<div class="gtt-header-title">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>' +
      '<h3>CronoHub</h3>' +
      '</div>' +
      '<button class="gtt-close-btn" id="gtt-close-btn">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '</div>' +
      '<div class="gtt-body">' +
      '<div class="gtt-issue-info">' +
      '<div class="gtt-issue-icon">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
      '</div>' +
      '<div class="gtt-issue-details">' +
      '<div class="gtt-issue-number">#' + state.issueData.number + ' · ' + state.issueData.owner + '/' + state.issueData.repo + '</div>' +
      '<div class="gtt-issue-title">' + escapeHtml(state.issueData.title) + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="gtt-user-info">' +
      '<span class="gtt-user-label">Logging as:</span>' +
      '<span class="gtt-user-name">' + escapeHtml(userName) + '</span>' +
      '</div>' +
      '<div class="gtt-form-group">' +
      '<label>Hours worked</label>' +
      '<div class="gtt-input-wrapper">' +
      '<input type="number" id="hours" class="gtt-input" min="0.25" max="24" step="0.25" placeholder="2.5">' +
      '<span class="gtt-input-suffix">hours</span>' +
      '</div>' +
      '</div>' +
      '<div class="gtt-form-group">' +
      '<label>Description (optional)</label>' +
      '<textarea id="description" class="gtt-textarea" placeholder="Brief description..."></textarea>' +
      '</div>' +
      '<button class="gtt-submit-btn" id="gtt-submit-btn">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' +
      'Log time' +
      '</button>' +
      '<button class="gtt-secondary-btn" id="gtt-view-reports-btn">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>' +
      'View Reports' +
      '</button>' +
      '</div>' +
      '</body></html>';
  }

  function handleSubmitWithData(hoursValue, description) {
    console.log('CronoHub: handleSubmitWithData', hoursValue, description);

    if (state.isLoading) return;

    var hours = parseFloat(hoursValue);

    if (!hours || isNaN(hours)) {
      showToast('Please enter hours worked', 'error');
      return;
    }

    if (hours <= 0 || hours > 24) {
      showToast('Hours must be between 0.25 and 24', 'error');
      return;
    }

    if (!state.issueData) {
      showToast('Issue not detected', 'error');
      return;
    }

    state.isLoading = true;
    updateIframeSubmitButton(true);

    postTimeComment(hours, description.trim())
      .then(function(result) {
        console.log('CronoHub: Success', result);

        var panel = document.getElementById('gtt-panel');
        if (panel) panel.classList.add('hidden');
        state.isOpen = false;

        showToast('Time logged successfully', 'success');
      })
      .catch(function(error) {
        console.error('CronoHub: Error', error);
        showToast(error.message || 'Error logging time', 'error');
      })
      .finally(function() {
        state.isLoading = false;
        updateIframeSubmitButton(false);
      });
  }

  function renderReportsPanelDirect(panel) {
    var defaultRange = window.CronoHubReports.getDefaultDateRange();

    panel.innerHTML = [
      '<div class="gtt-header">',
      '<div class="gtt-header-title">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>',
      '<h3>Time Reports</h3>',
      '</div>',
      '<button class="gtt-close-btn" id="gtt-close" type="button">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '</button>',
      '</div>',
      '<div class="gtt-body gtt-reports-body">',
      '<div class="gtt-form-group">',
      '<label>Organization / Repository</label>',
      '<div class="gtt-org-info" id="gtt-org-info">',
      '<span class="gtt-org-detecting">Detecting organization...</span>',
      '</div>',
      '</div>',
      '<div class="gtt-form-group">',
      '<label>Collaborators <span style="color:var(--gtt-text-muted);font-weight:normal;font-size:11px;">(leave empty for all)</span></label>',
      '<div class="gtt-chip-selector" id="gtt-chip-selector">',
      '<div class="gtt-chips-container" id="gtt-chips-container"></div>',
      '<input type="text" class="gtt-chip-input" id="gtt-chip-input" placeholder="Type to search collaborators..." autocomplete="off">',
      '<div class="gtt-chip-dropdown hidden" id="gtt-chip-dropdown"></div>',
      '</div>',
      '</div>',
      '<div class="gtt-form-group">',
      '<label>Date Range</label>',
      '<div class="gtt-date-range">',
      '<div class="gtt-date-input-group">',
      '<label class="gtt-date-label">From</label>',
      '<input type="date" id="gtt-start-date" class="gtt-input gtt-date-input" value="' + defaultRange.startDate + '" data-cronohub-start-date>',
      '</div>',
      '<div class="gtt-date-input-group">',
      '<label class="gtt-date-label">To</label>',
      '<input type="date" id="gtt-end-date" class="gtt-input gtt-date-input" value="' + defaultRange.endDate + '" data-cronohub-end-date>',
      '</div>',
      '</div>',
      '</div>',
      '<button type="button" class="gtt-submit-btn" id="gtt-generate-report" data-cronohub-generate-report>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>',
      'Generate Report',
      '</button>',
      '<button type="button" class="gtt-secondary-btn" id="gtt-back-to-log">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>',
      'Back to Log Time',
      '</button>',
      '<div id="gtt-report-results" class="gtt-report-results" data-cronohub-report-results></div>',
      '<div id="gtt-report-error" class="gtt-report-error" data-cronohub-error></div>',
      '</div>'
    ].join('');

    document.getElementById('gtt-close').onclick = togglePanel;

    // Load organization and collaborators
    loadOrganizationData();

    // Setup generate report button
    document.getElementById('gtt-generate-report').onclick = function() {
      handleGenerateReport();
    };

    // Setup back button
    document.getElementById('gtt-back-to-log').onclick = function() {
      state.panelMode = 'log';
      renderPanel();
    };
  }

  function renderReportsPanelInIframe(panel) {
    var iframeHtml = getReportsIframeContent();

    panel.innerHTML = '<iframe id="gtt-iframe" style="width:100%;height:600px;border:none;border-radius:12px;overflow:hidden;"></iframe>';

    var iframe = document.getElementById('gtt-iframe');
    var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

    iframeDoc.open();
    iframeDoc.write(iframeHtml);
    iframeDoc.close();

    // Connect events after iframe loads
    setTimeout(function() {
      var iframeDocument = iframe.contentDocument;

      // Close button
      var closeBtn = iframeDocument.getElementById('gtt-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', function() {
          togglePanel();
        });
      }

      // Generate report button
      var generateBtn = iframeDocument.getElementById('gtt-generate-report-btn');
      if (generateBtn) {
        generateBtn.addEventListener('click', function() {
          var select = iframeDocument.getElementById('collaborator-select');
          var selectedOptions = Array.from(select.selectedOptions).map(function(option) { return option.value; });
          var startDate = iframeDocument.getElementById('start-date').value;
          var endDate = iframeDocument.getElementById('end-date').value;
          handleGenerateReportWithData(selectedOptions, startDate, endDate, iframeDocument);
        });
      }

      // Back to Log Time button
      var backBtn = iframeDocument.getElementById('gtt-back-to-log-btn');
      if (backBtn) {
        backBtn.addEventListener('click', function() {
          state.panelMode = 'log';
          renderPanel();
        });
      }

      // Load organization data in iframe
      loadOrganizationDataInIframe(iframeDocument);
    }, 100);
  }

  function getReportsIframeContent() {
    var defaultRange = window.CronoHubReports.getDefaultDateRange();

    return '<!DOCTYPE html><html><head><style>' +
      ':root{--gtt-bg-primary:#0d1117;--gtt-bg-secondary:#161b22;--gtt-bg-tertiary:#21262d;--gtt-border:#30363d;--gtt-text-primary:#f0f6fc;--gtt-text-secondary:#8b949e;--gtt-text-muted:#6e7681;--gtt-accent-green:#238636;--gtt-accent-blue:#58a6ff;--gtt-accent-orange:#d29922;}' +
      'body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif;background:var(--gtt-bg-secondary);color:var(--gtt-text-primary);font-size:14px;overflow-y:auto;}' +
      '.gtt-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;background:var(--gtt-bg-primary);border-bottom:1px solid var(--gtt-border);}' +
      '.gtt-header-title{display:flex;align-items:center;gap:10px;}' +
      '.gtt-header-title svg{width:20px;height:20px;color:var(--gtt-accent-orange);}' +
      '.gtt-header-title h3{font-size:14px;font-weight:600;color:var(--gtt-text-primary);margin:0;}' +
      '.gtt-close-btn{background:transparent;border:none;padding:6px;cursor:pointer;border-radius:6px;color:var(--gtt-text-muted);transition:all 150ms ease;display:flex;align-items:center;justify-content:center;}' +
      '.gtt-close-btn:hover{background:var(--gtt-bg-tertiary);color:var(--gtt-text-primary);}' +
      '.gtt-close-btn svg{width:18px;height:18px;}' +
      '.gtt-body{padding:18px;}' +
      '.gtt-form-group{margin-bottom:16px;}' +
      '.gtt-form-group label{display:block;font-size:12px;font-weight:500;color:var(--gtt-text-secondary);margin-bottom:8px;}' +
      '.gtt-select,.gtt-input{width:100%;padding:10px 14px;font-size:14px;color:var(--gtt-text-primary);background:var(--gtt-bg-primary);border:1px solid var(--gtt-border);border-radius:8px;outline:none;transition:all 150ms ease;box-sizing:border-box;}' +
      '.gtt-select:focus,.gtt-input:focus{border-color:var(--gtt-accent-blue);box-shadow:0 0 0 3px rgba(88,166,255,0.15);}' +
      '.gtt-date-range{display:grid;grid-template-columns:1fr 1fr;gap:12px;}' +
      '.gtt-date-input-group{display:flex;flex-direction:column;gap:6px;}' +
      '.gtt-date-label{font-size:11px;color:var(--gtt-text-muted);}' +
      '.gtt-input[type="date"]{color-scheme:dark;}' +
      '.gtt-org-info{padding:10px 14px;background:var(--gtt-bg-tertiary);border-radius:8px;font-size:13px;}' +
      '.gtt-submit-btn{width:100%;padding:12px 18px;font-size:14px;font-weight:600;color:white;background:linear-gradient(135deg,var(--gtt-accent-orange) 0%,#bf8700 100%);border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all 150ms ease;margin-top:8px;}' +
      '.gtt-submit-btn:hover:not(:disabled){box-shadow:0 4px 12px rgba(210,153,34,0.3);transform:translateY(-1px);}' +
      '.gtt-submit-btn:active:not(:disabled){transform:translateY(0);}' +
      '.gtt-submit-btn:disabled{opacity:0.6;cursor:not-allowed;}' +
      '.gtt-submit-btn svg{width:18px;height:18px;}' +
      '.gtt-secondary-btn{width:100%;padding:10px 16px;font-size:13px;font-weight:500;color:#8b949e;background:transparent;border:1px solid #30363d;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 150ms ease;margin-top:8px;}' +
      '.gtt-secondary-btn:hover{background:#21262d;color:#f0f6fc;border-color:#6e7681;}' +
      '.gtt-secondary-btn svg{width:16px;height:16px;}' +
      '.gtt-spinner{width:18px;height:18px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:gtt-spin 600ms linear infinite;}' +
      '@keyframes gtt-spin{to{transform:rotate(360deg);}}' +
      '.gtt-report-results{margin-top:18px;}' +
      '.gtt-report-error{margin-top:12px;padding:12px;background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.3);border-radius:8px;color:#f85149;font-size:13px;display:none;}' +
      '.gtt-report-error.show{display:block;}' +
      '</style></head><body>' +
      '<div class="gtt-header">' +
      '<div class="gtt-header-title">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>' +
      '<h3>Time Reports</h3>' +
      '</div>' +
      '<button class="gtt-close-btn" id="gtt-close-btn">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '</div>' +
      '<div class="gtt-body">' +
      '<div class="gtt-form-group">' +
      '<label>Organization / Repository</label>' +
      '<div class="gtt-org-info" id="org-info">Detecting organization...</div>' +
      '</div>' +
      '<div class="gtt-form-group">' +
      '<label>Collaborators <span style="color:#6e7681;font-weight:normal;font-size:11px;">(hold Ctrl/Cmd to select multiple, leave empty for all)</span></label>' +
      '<select id="collaborator-select" class="gtt-select" multiple size="5">' +
      '<option value="">Loading collaborators...</option>' +
      '</select>' +
      '</div>' +
      '<div class="gtt-form-group">' +
      '<label>Date Range</label>' +
      '<div class="gtt-date-range">' +
      '<div class="gtt-date-input-group">' +
      '<label class="gtt-date-label">From</label>' +
      '<input type="date" id="start-date" class="gtt-input" value="' + defaultRange.startDate + '">' +
      '</div>' +
      '<div class="gtt-date-input-group">' +
      '<label class="gtt-date-label">To</label>' +
      '<input type="date" id="end-date" class="gtt-input" value="' + defaultRange.endDate + '">' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<button class="gtt-submit-btn" id="gtt-generate-report-btn">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>' +
      'Generate Report' +
      '</button>' +
      '<button class="gtt-secondary-btn" id="gtt-back-to-log-btn">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>' +
      'Back to Log Time' +
      '</button>' +
      '<div id="report-results" class="gtt-report-results"></div>' +
      '<div id="report-error" class="gtt-report-error"></div>' +
      '</div>' +
      '</body></html>';
  }

  function loadOrganizationData() {
    if (!state.issueData) {
      // Try to detect from URL
      var urlMatch = window.location.pathname.match(/\/([^/]+)\/([^/]+)/);
      if (urlMatch) {
        var org = urlMatch[1];
        var repo = urlMatch[2];
        document.getElementById('gtt-org-info').innerHTML = '<strong>' + org + '</strong> / ' + repo;

        // Load collaborators for this org
        loadCollaborators(org);
      } else {
        document.getElementById('gtt-org-info').innerHTML = '<span style="color:var(--gtt-accent-red);">Could not detect organization</span>';
      }
    } else {
      document.getElementById('gtt-org-info').innerHTML = '<strong>' + state.issueData.owner + '</strong> / ' + state.issueData.repo;
      loadCollaborators(state.issueData.owner);
    }
  }

  function loadOrganizationDataInIframe(iframeDoc) {
    if (!state.issueData) {
      var urlMatch = window.location.pathname.match(/\/([^/]+)\/([^/]+)/);
      if (urlMatch) {
        var org = urlMatch[1];
        var repo = urlMatch[2];
        iframeDoc.getElementById('org-info').innerHTML = '<strong>' + org + '</strong> / ' + repo;
        loadCollaboratorsInIframe(org, iframeDoc);
      } else {
        iframeDoc.getElementById('org-info').innerHTML = '<span style="color:#f85149;">Could not detect organization</span>';
      }
    } else {
      iframeDoc.getElementById('org-info').innerHTML = '<strong>' + state.issueData.owner + '</strong> / ' + state.issueData.repo;
      loadCollaboratorsInIframe(state.issueData.owner, iframeDoc);
    }
  }

  function loadCollaborators(org) {
    var input = document.getElementById('gtt-chip-input');
    var dropdown = document.getElementById('gtt-chip-dropdown');
    if (!input || !dropdown) return;

    // Store all members globally for filtering
    state.allCollaborators = [];
    state.selectedCollaborators = [];

    input.placeholder = 'Loading...';
    input.disabled = true;

    var currentUser = state.config.userData ? state.config.userData.login : null;

    window.CronoHubReports.fetchOrgMembers(org, state.config.githubToken)
      .then(function(members) {
        state.allCollaborators = members;

        // Preselect current user
        if (currentUser) {
          var currentUserMember = members.find(function(m) { return m.login === currentUser; });
          if (currentUserMember) {
            addChip(currentUserMember);
          }
        }

        input.placeholder = 'Type to search collaborators...';
        input.disabled = false;

        // Setup event listeners
        setupChipSelectorEvents();
      })
      .catch(function(error) {
        console.error('Error loading collaborators:', error);
        input.placeholder = 'Error loading collaborators';
        showToast(error.message || 'Error loading collaborators', 'error');
      });
  }

  function setupChipSelectorEvents() {
    var input = document.getElementById('gtt-chip-input');
    var dropdown = document.getElementById('gtt-chip-dropdown');

    if (!input || !dropdown) return;

    // Show/filter dropdown on input
    input.addEventListener('input', function() {
      var query = input.value.toLowerCase().trim();
      filterAndShowDropdown(query);
    });

    // Show dropdown on focus
    input.addEventListener('focus', function() {
      var query = input.value.toLowerCase().trim();
      filterAndShowDropdown(query);
    });

    // Hide dropdown on click outside
    document.addEventListener('click', function(e) {
      var chipSelector = document.getElementById('gtt-chip-selector');
      if (chipSelector && !chipSelector.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  function filterAndShowDropdown(query) {
    var dropdown = document.getElementById('gtt-chip-dropdown');
    if (!dropdown) return;

    // Filter out already selected collaborators
    var selectedLogins = state.selectedCollaborators.map(function(c) { return c.login; });
    var availableCollaborators = state.allCollaborators.filter(function(member) {
      return !selectedLogins.includes(member.login);
    });

    // Filter by query
    var filtered = query
      ? availableCollaborators.filter(function(member) {
          return member.login.toLowerCase().includes(query);
        })
      : availableCollaborators;

    if (filtered.length === 0) {
      dropdown.innerHTML = '<div class="gtt-chip-dropdown-empty">No collaborators found</div>';
      dropdown.classList.remove('hidden');
      return;
    }

    // Render dropdown items
    dropdown.innerHTML = '';
    filtered.slice(0, 10).forEach(function(member) {
      var item = document.createElement('div');
      item.className = 'gtt-chip-dropdown-item';
      item.textContent = member.login;
      item.onclick = function() {
        addChip(member);
        document.getElementById('gtt-chip-input').value = '';
        dropdown.classList.add('hidden');
      };
      dropdown.appendChild(item);
    });

    dropdown.classList.remove('hidden');
  }

  function addChip(member) {
    // Avoid duplicates
    if (state.selectedCollaborators.some(function(c) { return c.login === member.login; })) {
      return;
    }

    state.selectedCollaborators.push(member);

    var chipsContainer = document.getElementById('gtt-chips-container');
    if (!chipsContainer) return;

    var chip = document.createElement('div');
    chip.className = 'gtt-chip';
    chip.dataset.login = member.login;
    chip.innerHTML = [
      '<span class="gtt-chip-text">' + escapeHtml(member.login) + '</span>',
      '<button class="gtt-chip-remove" type="button">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">',
      '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      '</svg>',
      '</button>'
    ].join('');

    // Remove chip on X click
    chip.querySelector('.gtt-chip-remove').onclick = function() {
      removeChip(member.login);
    };

    chipsContainer.appendChild(chip);
  }

  function removeChip(login) {
    state.selectedCollaborators = state.selectedCollaborators.filter(function(c) {
      return c.login !== login;
    });

    var chipsContainer = document.getElementById('gtt-chips-container');
    if (!chipsContainer) return;

    var chip = chipsContainer.querySelector('[data-login="' + login + '"]');
    if (chip) {
      chip.remove();
    }
  }

  function loadCollaboratorsInIframe(org, iframeDoc) {
    var select = iframeDoc.getElementById('collaborator-select');
    if (!select) return;

    select.innerHTML = '<option value="">Loading...</option>';
    select.disabled = true;

    var currentUser = state.config.userData ? state.config.userData.login : null;

    window.CronoHubReports.fetchOrgMembers(org, state.config.githubToken)
      .then(function(members) {
        select.innerHTML = '';
        members.forEach(function(member) {
          var option = iframeDoc.createElement('option');
          option.value = member.login;
          option.textContent = member.login;

          // Preselect current user
          if (currentUser && member.login === currentUser) {
            option.selected = true;
          }

          select.appendChild(option);
        });
        select.disabled = false;
      })
      .catch(function(error) {
        console.error('Error loading collaborators:', error);
        select.innerHTML = '<option value="">Error loading collaborators</option>';
        var errorDiv = iframeDoc.getElementById('report-error');
        if (errorDiv) {
          errorDiv.textContent = error.message || 'Error loading collaborators';
          errorDiv.classList.add('show');
        }
      });
  }

  function handleGenerateReport() {
    var startDate = document.getElementById('gtt-start-date').value;
    var endDate = document.getElementById('gtt-end-date').value;
    var resultsDiv = document.getElementById('gtt-report-results');
    var errorDiv = document.getElementById('gtt-report-error');
    var btn = document.getElementById('gtt-generate-report');

    // Clear previous results/errors
    resultsDiv.innerHTML = '';
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    // Validate date range
    var validation = window.CronoHubReports.validateDateRange(startDate, endDate);
    if (!validation.valid) {
      errorDiv.textContent = validation.error;
      errorDiv.style.display = 'block';
      return;
    }

    // Get organization
    var org = state.issueData ? state.issueData.owner : window.location.pathname.match(/\/([^/]+)\/([^/]+)/)[1];

    // Show loading
    btn.disabled = true;
    btn.innerHTML = '<div class="gtt-spinner"></div>Loading...';

    // Get selected collaborators (or all if none selected)
    var selectedUsernames = state.selectedCollaborators.length > 0
      ? state.selectedCollaborators.map(function(c) { return c.login; })
      : state.allCollaborators.map(function(c) { return c.login; });

    // Fetch report data for selected users
    var fetchPromises = selectedUsernames.map(function(username) {
      return window.CronoHubReports.fetchUserCommentsInRange(username, org, startDate, endDate, state.config.githubToken)
        .then(function(comments) {
          return {
            username: username,
            comments: comments
          };
        })
        .catch(function(error) {
          console.error('Error fetching comments for ' + username + ':', error);
          return {
            username: username,
            comments: [],
            error: error.message
          };
        });
    });

    Promise.all(fetchPromises)
      .then(function(allData) {
        if (selectedUsernames.length === 1) {
          // Display single user report
          displayUserReport(allData[0].username, allData[0].comments, resultsDiv);
        } else {
          // Display multiple users report
          displayAllCollaboratorsReport(allData, resultsDiv);
        }
      })
      .catch(function(error) {
        console.error('Error generating report:', error);
        errorDiv.textContent = error.message || 'Error generating report';
        errorDiv.style.display = 'block';
      })
      .finally(function() {
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>Generate Report';
      });
  }

  function handleGenerateReportWithData(selectedOptions, startDate, endDate, iframeDoc) {
    var resultsDiv = iframeDoc.getElementById('report-results');
    var errorDiv = iframeDoc.getElementById('report-error');
    var btn = iframeDoc.getElementById('gtt-generate-report-btn');
    var select = iframeDoc.getElementById('collaborator-select');

    resultsDiv.innerHTML = '';
    errorDiv.classList.remove('show');
    errorDiv.textContent = '';

    var validation = window.CronoHubReports.validateDateRange(startDate, endDate);
    if (!validation.valid) {
      errorDiv.textContent = validation.error;
      errorDiv.classList.add('show');
      return;
    }

    var org = state.issueData ? state.issueData.owner : window.location.pathname.match(/\/([^/]+)\/([^/]+)/)[1];

    btn.disabled = true;
    btn.innerHTML = '<div class="gtt-spinner"></div>Loading...';

    // If no collaborators selected, use all collaborators
    if (selectedOptions.length === 0) {
      selectedOptions = Array.from(select.options).map(function(option) { return option.value; });
    }

    // Fetch report data for selected users
    var fetchPromises = selectedOptions.map(function(username) {
      return window.CronoHubReports.fetchUserCommentsInRange(username, org, startDate, endDate, state.config.githubToken)
        .then(function(comments) {
          return {
            username: username,
            comments: comments
          };
        })
        .catch(function(error) {
          console.error('Error fetching comments for ' + username + ':', error);
          return {
            username: username,
            comments: [],
            error: error.message
          };
        });
    });

    Promise.all(fetchPromises)
      .then(function(allData) {
        if (selectedOptions.length === 1) {
          displayUserReportInIframe(allData[0].username, allData[0].comments, resultsDiv);
        } else {
          displayAllCollaboratorsReportInIframe(allData, resultsDiv);
        }
      })
      .catch(function(error) {
        console.error('Error generating report:', error);
        errorDiv.textContent = error.message || 'Error generating report';
        errorDiv.classList.add('show');
      })
      .finally(function() {
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>Generate Report';
      });
  }

  /**
   * Gets the current issue number from the page context
   * @returns {string|null} - Current issue number or null if not in an issue page
   */
  function getCurrentIssueNumber() {
    // Method 1: From URL (most reliable)
    var urlMatch = window.location.pathname.match(/\/issues\/(\d+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    // Method 2: From state object (if available)
    if (typeof state !== 'undefined' && state.issueData && state.issueData.number) {
      return String(state.issueData.number);
    }

    return null;
  }

  /**
   * Extracts issue number, issue URL, comment URL, and comment ID from GitHub comment URL
   * @param {string} commentUrl - Full GitHub comment URL
   * @returns {Object|null} - Object with issueNumber, issueUrl, commentUrl, commentId or null
   */
  function extractIssueData(commentUrl) {
    if (!commentUrl) return null;

    var issueMatch = commentUrl.match(/\/issues\/(\d+)/);
    if (!issueMatch) return null;

    var issueNumber = issueMatch[1];
    var issueUrl = commentUrl.replace(/#issuecomment-\d+$/, '');

    // Extract comment ID if present
    var commentIdMatch = commentUrl.match(/#(issuecomment-\d+)$/);
    var commentId = commentIdMatch ? commentIdMatch[1] : null;

    return {
      issueNumber: issueNumber,
      issueUrl: issueUrl,
      commentUrl: commentUrl,
      commentId: commentId
    };
  }

  /**
   * Generates HTML with smart navigation based on current issue context
   * @param {Object} issueData - Object with issueNumber, issueUrl, commentUrl, commentId
   * @param {string} description - Time entry description text
   * @param {string} currentIssueNumber - Current issue number from page context
   * @returns {string} - HTML string with context-aware navigation
   */
  function generateSmartDualLinkHTML(issueData, description, currentIssueNumber) {
    if (!issueData || !issueData.issueNumber) {
      // Fallback to plain text if no issue data
      return escapeHtml(description);
    }

    var isSameIssue = (issueData.issueNumber === currentIssueNumber);
    var issueLink, descriptionLink;

    // Generate issue number link
    if (isSameIssue) {
      // Same issue: scroll to top
      issueLink = '<a href="#" onclick="window.scrollTo({top:0,behavior:\'smooth\'});return false;" class="gtt-issue-link">#' +
                  escapeHtml(issueData.issueNumber) + '</a>';
    } else {
      // Different issue: open in new tab
      issueLink = '<a href="' + escapeHtml(issueData.issueUrl) +
                  '" target="_blank" rel="noopener noreferrer" class="gtt-issue-link">#' +
                  escapeHtml(issueData.issueNumber) + '</a>';
    }

    // Generate description link
    if (isSameIssue && issueData.commentId) {
      // Same issue with comment ID: scroll to comment
      descriptionLink = '<a href="#' + escapeHtml(issueData.commentId) + '" onclick="var el=document.getElementById(\'' +
                        issueData.commentId + '\');if(el){el.scrollIntoView({behavior:\'smooth\',block:\'center\'});return false;}return true;" class="gtt-comment-link">' +
                        escapeHtml(description) + '</a>';
    } else if (!isSameIssue && issueData.commentUrl) {
      // Different issue: open in new tab
      descriptionLink = '<a href="' + escapeHtml(issueData.commentUrl) +
                        '" target="_blank" rel="noopener noreferrer" class="gtt-comment-link">' +
                        escapeHtml(description) + '</a>';
    } else {
      // Same issue but no comment ID: plain text
      descriptionLink = '<span class="gtt-comment-text">' + escapeHtml(description) + '</span>';
    }

    return issueLink + ' - ' + descriptionLink;
  }

  function displayUserReport(username, comments, container) {
    if (comments.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gtt-text-muted);">No time entries found for this period</div>';
      return;
    }

    var grouped = window.CronoHubReports.aggregateHoursByDate(comments);
    var total = window.CronoHubReports.calculateTotalHours(grouped);
    var dates = Object.keys(grouped).sort();

    var html = '<div class="gtt-report-header"><h4>Report for ' + escapeHtml(username) + '</h4><div class="gtt-report-total">Total: <strong>' + total.toFixed(2) + ' hours</strong></div></div>';

    dates.forEach(function(date) {
      var dayEntries = grouped[date];
      var dayTotal = dayEntries.reduce(function(sum, entry) { return sum + entry.hours; }, 0);

      html += '<div class="gtt-report-day">';
      html += '<div class="gtt-report-day-header">';
      html += '<span class="gtt-report-date">📅 ' + window.CronoHubReports.formatDate(date) + '</span>';
      html += '<span class="gtt-report-day-total">⏱️ ' + dayTotal.toFixed(2) + ' hours</span>';
      html += '</div>';

      dayEntries.forEach(function(entry) {
        var description = entry.comment.split('\n')[2] || 'No description';
        var issueData = extractIssueData(entry.url);
        var currentIssue = getCurrentIssueNumber();
        var linkHTML = generateSmartDualLinkHTML(issueData, description, currentIssue);

        html += '<div class="gtt-report-entry">';
        html += '<div class="gtt-report-entry-hours">' + entry.hours + 'h</div>';
        html += '<div class="gtt-report-entry-comment">' + linkHTML + '</div>';
        html += '</div>';
      });

      html += '</div>';
    });

    container.innerHTML = html;
  }

  function displayUserReportInIframe(username, comments, container) {
    if (comments.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#8b949e;">No time entries found for this period</div>';
      return;
    }

    var grouped = window.CronoHubReports.aggregateHoursByDate(comments);
    var total = window.CronoHubReports.calculateTotalHours(grouped);
    var dates = Object.keys(grouped).sort();

    var html = '<div style="margin-top:18px;padding:16px;background:#161b22;border:1px solid #30363d;border-radius:8px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #30363d;">';
    html += '<h4 style="margin:0;font-size:14px;font-weight:600;color:#f0f6fc;">Report for ' + username + '</h4>';
    html += '<div style="font-size:14px;color:#8b949e;">Total: <strong style="color:#238636;">' + total.toFixed(2) + ' hours</strong></div>';
    html += '</div>';

    dates.forEach(function(date) {
      var dayEntries = grouped[date];
      var dayTotal = dayEntries.reduce(function(sum, entry) { return sum + entry.hours; }, 0);

      html += '<div style="margin-bottom:14px;padding:12px;background:#0d1117;border-radius:6px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
      html += '<span style="font-size:13px;font-weight:500;color:#f0f6fc;">📅 ' + window.CronoHubReports.formatDate(date) + '</span>';
      html += '<span style="font-size:12px;color:#8b949e;">⏱️ ' + dayTotal.toFixed(2) + ' hours</span>';
      html += '</div>';

      dayEntries.forEach(function(entry) {
        var description = entry.comment.split('\n')[2] || 'No description';
        var issueData = extractIssueData(entry.url);
        var currentIssue = getCurrentIssueNumber();
        var linkHTML = generateSmartDualLinkHTML(issueData, description, currentIssue);

        html += '<div style="display:flex;gap:12px;padding:8px;background:#161b22;border-radius:4px;margin-top:6px;">';
        html += '<div style="font-size:12px;font-weight:600;color:#238636;min-width:40px;">' + entry.hours + 'h</div>';
        html += '<div style="font-size:12px;color:#8b949e;flex:1;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.4;max-height:calc(1.4em * 2);">' + linkHTML + '</div>';
        html += '</div>';
      });

      html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
  }

  function displayAllCollaboratorsReport(allData, container) {
    var hasData = allData.some(function(userData) { return userData.comments.length > 0; });

    if (!hasData) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gtt-text-muted);">No time entries found for this period</div>';
      return;
    }

    var html = '<div class="gtt-report-header"><h4>All Collaborators Report</h4></div>';

    var grandTotal = 0;
    allData.forEach(function(userData) {
      if (userData.comments.length === 0) return;

      var grouped = window.CronoHubReports.aggregateHoursByDate(userData.comments);
      var userTotal = window.CronoHubReports.calculateTotalHours(grouped);
      grandTotal += userTotal;

      html += '<div class="gtt-report-user">';
      html += '<div class="gtt-report-user-header">';
      html += '<span class="gtt-report-username">👤 ' + escapeHtml(userData.username) + '</span>';
      html += '<span class="gtt-report-user-total">' + userTotal.toFixed(2) + ' hours</span>';
      html += '</div>';
      html += '</div>';
    });

    html += '<div class="gtt-report-grand-total">Grand Total: <strong>' + grandTotal.toFixed(2) + ' hours</strong></div>';

    container.innerHTML = html;
  }

  function displayAllCollaboratorsReportInIframe(allData, container) {
    var hasData = allData.some(function(userData) { return userData.comments.length > 0; });

    if (!hasData) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:#8b949e;">No time entries found for this period</div>';
      return;
    }

    var html = '<div style="margin-top:18px;padding:16px;background:#161b22;border:1px solid #30363d;border-radius:8px;">';
    html += '<h4 style="margin:0 0 16px 0;font-size:14px;font-weight:600;color:#f0f6fc;padding-bottom:12px;border-bottom:1px solid #30363d;">All Collaborators Report</h4>';

    var grandTotal = 0;
    allData.forEach(function(userData) {
      if (userData.comments.length === 0) return;

      var grouped = window.CronoHubReports.aggregateHoursByDate(userData.comments);
      var userTotal = window.CronoHubReports.calculateTotalHours(grouped);
      grandTotal += userTotal;

      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:#0d1117;border-radius:6px;margin-bottom:8px;">';
      html += '<span style="font-size:13px;color:#f0f6fc;">👤 ' + userData.username + '</span>';
      html += '<span style="font-size:13px;font-weight:600;color:#238636;">' + userTotal.toFixed(2) + ' hours</span>';
      html += '</div>';
    });

    html += '<div style="margin-top:16px;padding-top:16px;border-top:1px solid #30363d;text-align:right;font-size:14px;color:#8b949e;">';
    html += 'Grand Total: <strong style="color:#238636;font-size:16px;">' + grandTotal.toFixed(2) + ' hours</strong>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  function getErrorContent() {
    return [
      '<div class="gtt-header">',
      '<div class="gtt-header-title">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>',
      '<h3>CronoHub</h3>',
      '</div>',
      '<button class="gtt-close-btn" id="gtt-close" type="button">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '</button>',
      '</div>',
      '<div class="gtt-error-state">',
      '<div class="gtt-error-icon">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      '</div>',
      '<p class="gtt-error-text">To use CronoHub you need to configure your GitHub token:</p>',
      '<ol class="gtt-instructions">',
      '<li>Click the extensions icon (🧩) in the browser toolbar</li>',
      '<li>Pin the <strong>CronoHub</strong> extension</li>',
      '<li>Click the icon and enter your token</li>',
      '</ol>',
      '</div>'
    ].join('');
  }

  function getNoIssueContent() {
    return [
      '<div class="gtt-header">',
      '<div class="gtt-header-title">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>',
      '<h3>CronoHub</h3>',
      '</div>',
      '<button class="gtt-close-btn" id="gtt-close" type="button">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      '</button>',
      '</div>',
      '<div class="gtt-error-state">',
      '<div class="gtt-error-icon">',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      '</div>',
      '<p class="gtt-error-text">No issue detected.</p>',
      '</div>'
    ].join('');
  }

  function handleSubmit() {
    console.log('CronoHub: handleSubmit called');

    if (state.isLoading) {
      console.log('CronoHub: Already loading');
      return;
    }

    var hoursInput = document.getElementById('gtt-hours');
    var descInput = document.getElementById('gtt-description');

    if (!hoursInput) {
      console.log('CronoHub: Hours input not found');
      return;
    }
    
    // Get value depending on whether it's input or contenteditable
    var hoursValue = hoursInput.value !== undefined ? hoursInput.value : hoursInput.textContent;
    var hours = parseFloat(hoursValue);
    
    var descValue = descInput ? (descInput.value !== undefined ? descInput.value : descInput.textContent) : '';
    var description = descValue.trim();

    console.log('CronoHub: Data', { hours: hours, description: description });

    if (!hours || isNaN(hours)) {
      showToast('Please enter hours worked', 'error');
      return;
    }

    if (hours <= 0 || hours > 24) {
      showToast('Hours must be between 0.25 and 24', 'error');
      return;
    }

    if (!state.issueData) {
      showToast('Issue not detected', 'error');
      return;
    }

    state.isLoading = true;
    updateSubmitButton(true);

    postTimeComment(hours, description)
      .then(function(result) {
        console.log('CronoHub: Success', result);
        
        var panel = document.getElementById('gtt-panel');
        if (panel) panel.classList.add('hidden');
        state.isOpen = false;
        
        showToast('Time logged successfully', 'success');
      })
      .catch(function(error) {
        console.error('CronoHub: Error', error);
        showToast(error.message || 'Error logging time', 'error');
      })
      .finally(function() {
        state.isLoading = false;
        updateSubmitButton(false);
      });
  }

  function postTimeComment(hours, description) {
    var owner = state.issueData.owner;
    var repo = state.issueData.repo;
    var number = state.issueData.number;
    
    var horaText = hours === 1 ? 'Hour' : 'Hours';
    var commentBody = '⏱️ **Time Tracked:** ' + hours + ' ' + horaText;
    
    if (description) {
      commentBody += '\n\n' + description;
    }
    
    commentBody += '\n\n---\n<sub>**Logged with CronoHub** by Gopenux AI</sub>';

    var url = 'https://api.github.com/repos/' + owner + '/' + repo + '/issues/' + number + '/comments';
    
    console.log('CronoHub: POST a', url);

    return fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + state.config.githubToken,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ body: commentBody })
    }).then(function(response) {
      console.log('CronoHub: Status', response.status);
      if (!response.ok) {
        return response.json().then(function(data) {
          console.error('CronoHub: Error data', data);
          throw new Error(data.message || 'Error ' + response.status);
        });
      }
      return response.json();
    });
  }

  function updateSubmitButton(loading) {
    var btn = document.getElementById('gtt-submit');
    if (!btn) return;

    if (loading) {
      btn.disabled = true;
      btn.innerHTML = '<div class="gtt-spinner"></div>Logging...';
    } else {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Log time';
    }
  }

  function updateIframeSubmitButton(loading) {
    var iframe = document.getElementById('gtt-iframe');
    if (!iframe) return;

    var iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
    var btn = iframeDocument.getElementById('gtt-submit-btn');
    if (!btn) return;

    if (loading) {
      btn.disabled = true;
      btn.innerHTML = '<div class="gtt-spinner"></div>Logging...';
    } else {
      btn.disabled = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Log time';
    }
  }

  function showToast(message, type) {
    var existing = document.querySelector('.gtt-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'gtt-toast ' + (type || 'success');
    toast.innerHTML = '<span class="gtt-toast-message">' + escapeHtml(message) + '</span>';
    document.body.appendChild(toast);

    setTimeout(function() {
      toast.remove();
    }, 4000);
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // Setup storage change listener with context validation
  if (isExtensionContextValid()) {
    try {
      chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'local') {
          loadConfig().then(function(config) {
            state.config = config;
          }).catch(function(error) {
            console.error('CronoHub: Error updating config', error);
          });
        }
      });
    } catch (error) {
      console.error('CronoHub: Failed to setup storage listener', error);
    }
  }

  // Expose functions for testing
  if (typeof window !== 'undefined') {
    window.getCurrentIssueNumber = getCurrentIssueNumber;
    window.extractIssueData = extractIssueData;
    window.generateSmartDualLinkHTML = generateSmartDualLinkHTML;
  }
})();
