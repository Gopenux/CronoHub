// CronoHub - Content Script
// Author: Gopenux AI
// Copyright (c) 2026 Gopenux AI

console.log('CronoHub: Content script loaded');

(function() {
  'use strict';

  // Check if extension context is valid
  function isExtensionContextValid() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  var state = {
    isOpen: false,
    isLoading: false,
    config: null,
    issueData: null
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
    
    if (!state.config || !state.config.githubToken) {
      panel.innerHTML = getErrorContent();
      document.getElementById('gtt-close').onclick = togglePanel;
      return;
    }

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
      '</div>'
    ].join('');

    document.getElementById('gtt-close').onclick = togglePanel;
    document.getElementById('gtt-submit').onclick = function() {
      console.log('CronoHub: Submit clicked');
      handleSubmit();
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
})();
