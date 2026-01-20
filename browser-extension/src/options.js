/**
 * Pulse Browser Extension - Options Page Script
 */

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await checkAuth();
  await loadSettings();
  setupEventListeners();
}

// Authentication
async function checkAuth() {
  const session = await chrome.runtime.sendMessage({ action: 'getSession' });

  const loggedOutSection = document.getElementById('account-logged-out');
  const loggedInSection = document.getElementById('account-logged-in');

  if (session) {
    loggedOutSection.classList.add('hidden');
    loggedInSection.classList.remove('hidden');

    // Set user info
    const avatar = document.getElementById('user-avatar');
    const name = document.getElementById('user-name');
    const email = document.getElementById('user-email');

    if (session.user.user_metadata?.avatar_url) {
      avatar.src = session.user.user_metadata.avatar_url;
    }
    name.textContent = session.user.user_metadata?.full_name || 'Pulse User';
    email.textContent = session.user.email || '';

    // Load projects for dropdown
    await loadProjects();
  } else {
    loggedOutSection.classList.remove('hidden');
    loggedInSection.classList.add('hidden');
  }
}

async function loadProjects() {
  const result = await chrome.runtime.sendMessage({ action: 'getProjects' });
  const select = document.getElementById('default-project');

  // Keep the first option, remove the rest
  while (select.children.length > 1) {
    select.removeChild(select.lastChild);
  }

  if (result.success && result.projects) {
    result.projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      select.appendChild(option);
    });
  }
}

// Settings
async function loadSettings() {
  const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });

  document.getElementById('default-project').value = settings.defaultProjectId || '';
  document.getElementById('show-floating-btn').checked = settings.showFloatingButton !== false;
  document.getElementById('keyboard-shortcuts').checked = settings.keyboardShortcuts !== false;
}

async function saveSettings() {
  const settings = {
    defaultProjectId: document.getElementById('default-project').value || null,
    showFloatingButton: document.getElementById('show-floating-btn').checked,
    keyboardShortcuts: document.getElementById('keyboard-shortcuts').checked
  };

  const result = await chrome.runtime.sendMessage({
    action: 'saveSettings',
    settings
  });

  if (result.success) {
    showToast('Settings saved');
  }
}

// Event Listeners
function setupEventListeners() {
  // Login button
  document.getElementById('login-btn').addEventListener('click', async () => {
    const result = await chrome.runtime.sendMessage({ action: 'login' });
    if (result.success) {
      await checkAuth();
      await loadSettings();
    }
  });

  // Logout button
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'logout' });
    await checkAuth();
  });

  // Settings changes
  document.getElementById('default-project').addEventListener('change', saveSettings);
  document.getElementById('show-floating-btn').addEventListener('change', saveSettings);
  document.getElementById('keyboard-shortcuts').addEventListener('change', saveSettings);
}

// Toast
function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-message').textContent = message;

  toast.classList.remove('hidden');
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 300);
  }, 2000);
}
