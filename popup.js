// CronoHub - GitHub Time Tracker
// Author: Gopenux AI
// Copyright (c) 2026 Gopenux AI

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const elements = {
    connectionStatus: document.getElementById('connection-status'),
    authSection: document.getElementById('auth-section'),
    userSection: document.getElementById('user-section'),
    githubToken: document.getElementById('github-token'),
    saveConfig: document.getElementById('save-config'),
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    userLogin: document.getElementById('user-login'),
    logoutBtn: document.getElementById('logout-btn')
  };

  await loadConfig(elements);

  elements.saveConfig.addEventListener('click', () => saveConfig(elements));
  elements.logoutBtn.addEventListener('click', () => logout(elements));
}

async function loadConfig(elements) {
  try {
    const result = await chrome.storage.local.get(['githubToken', 'userData']);
    
    if (result.githubToken && result.userData) {
      showAuthenticatedState(elements, result.userData);
    } else if (result.githubToken) {
      await validateAndSaveUser(result.githubToken, elements);
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

async function saveConfig(elements) {
  const token = elements.githubToken.value.trim();

  if (!token) {
    showToast('Please enter your GitHub token', 'error');
    return;
  }

  elements.saveConfig.disabled = true;
  elements.saveConfig.innerHTML = `
    <svg class="spinner" width="16" height="16" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="30 70" />
    </svg>
    Validating...
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { animation: spin 1s linear infinite; }
  `;
  document.head.appendChild(style);

  await validateAndSaveUser(token, elements);
}

async function validateAndSaveUser(token, elements) {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error('Invalid token');
    }

    const userData = await response.json();

    await chrome.storage.local.set({
      githubToken: token,
      userData: {
        login: userData.login,
        name: userData.name || userData.login,
        avatar_url: userData.avatar_url
      }
    });

    showAuthenticatedState(elements, {
      login: userData.login,
      name: userData.name || userData.login,
      avatar_url: userData.avatar_url
    });

    showToast('Configuration saved successfully', 'success');

  } catch (error) {
    console.error('Error validating token:', error);
    showToast('Invalid token. Please verify and try again.', 'error');
    
    elements.saveConfig.disabled = false;
    elements.saveConfig.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Save configuration
    `;
  }
}

function showAuthenticatedState(elements, userData) {
  elements.connectionStatus.innerHTML = `
    <div class="status-indicator connected"></div>
    <span>Connected as <strong>${userData.name}</strong></span>
  `;

  elements.userAvatar.src = userData.avatar_url;
  elements.userName.textContent = userData.name;
  elements.userLogin.textContent = `@${userData.login}`;
  
  elements.authSection.classList.add('hidden');
  elements.userSection.classList.remove('hidden');

  elements.saveConfig.disabled = false;
  elements.saveConfig.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
    Save configuration
  `;
}

async function logout(elements) {
  await chrome.storage.local.remove(['githubToken', 'userData']);
  
  elements.connectionStatus.innerHTML = `
    <div class="status-indicator disconnected"></div>
    <span>Not authenticated</span>
  `;
  
  elements.githubToken.value = '';
  elements.authSection.classList.remove('hidden');
  elements.userSection.classList.add('hidden');

  showToast('Session closed', 'success');
}

function showToast(message, type = 'success') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideUp 200ms ease reverse';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}
