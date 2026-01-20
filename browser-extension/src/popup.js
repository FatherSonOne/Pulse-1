/**
 * Pulse Browser Extension - Popup Script
 * Handles UI interactions and state management
 */

// State
let currentTab = null;
let pageInfo = null;
let captureType = 'selection';
let contentPreview = null;

// DOM Elements
const states = {
  loading: document.getElementById('loading-state'),
  login: document.getElementById('login-state'),
  main: document.getElementById('main-state'),
  success: document.getElementById('success-state'),
  error: document.getElementById('error-state')
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  // Check authentication
  const session = await chrome.runtime.sendMessage({ action: 'getSession' });

  if (!session) {
    showState('login');
    setupLoginHandlers();
  } else {
    await setupMainUI(session);
  }
}

// State Management
function showState(state) {
  Object.keys(states).forEach(key => {
    states[key].classList.toggle('hidden', key !== state);
  });
}

// Login Handlers
function setupLoginHandlers() {
  document.getElementById('login-btn').addEventListener('click', async () => {
    showState('loading');

    const result = await chrome.runtime.sendMessage({ action: 'login' });

    if (result.success) {
      await setupMainUI(result.session);
    } else {
      showError(result.error || 'Login failed');
    }
  });
}

// Main UI Setup
async function setupMainUI(session) {
  showState('main');

  // Set user info
  const avatar = document.getElementById('user-avatar');
  if (session.user.user_metadata?.avatar_url) {
    avatar.src = session.user.user_metadata.avatar_url;
  } else {
    avatar.src = 'icons/icon-48.png';
  }

  // Get page info
  try {
    pageInfo = await chrome.tabs.sendMessage(currentTab.id, { action: 'getPageInfo' });
    updatePageInfo();
  } catch (error) {
    console.error('Could not get page info:', error);
    pageInfo = {
      url: currentTab.url,
      title: currentTab.title,
      favicon: currentTab.favIconUrl
    };
    updatePageInfo();
  }

  // Load projects
  await loadProjects();

  // Set up event listeners
  setupEventListeners();

  // Get initial selection
  await updateContent();
}

function updatePageInfo() {
  document.getElementById('page-title').textContent = pageInfo.title || 'Unknown Page';
  document.getElementById('page-url').textContent = pageInfo.url || '';

  const favicon = document.getElementById('page-favicon');
  if (pageInfo.favicon) {
    favicon.src = pageInfo.favicon;
    favicon.style.display = 'block';
  } else {
    favicon.style.display = 'none';
  }

  // Set default document title
  document.getElementById('doc-title').value = pageInfo.title || '';
}

async function loadProjects() {
  const result = await chrome.runtime.sendMessage({ action: 'getProjects' });
  const select = document.getElementById('project-select');

  // Clear existing options using DOM methods
  while (select.firstChild) {
    select.removeChild(select.firstChild);
  }

  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select a project...';
  select.appendChild(defaultOption);

  if (result.success && result.projects) {
    result.projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      select.appendChild(option);
    });

    // Get default project from settings
    const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
    if (settings.defaultProjectId) {
      select.value = settings.defaultProjectId;
    }
  }
}

function setupEventListeners() {
  // Capture type buttons
  document.querySelectorAll('.capture-type').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.capture-type').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      captureType = btn.dataset.type;
      await updateContent();
    });
  });

  // Logout button
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'logout' });
    showState('login');
    setupLoginHandlers();
  });

  // Capture button
  document.getElementById('capture-btn').addEventListener('click', capture);

  // Success state buttons
  document.getElementById('view-in-pulse').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://pulse.logosvision.org/war-room' });
    window.close();
  });

  document.getElementById('capture-another').addEventListener('click', () => {
    showState('main');
    updateContent();
  });

  // Error retry button
  document.getElementById('retry-btn').addEventListener('click', () => {
    showState('main');
  });
}

async function updateContent() {
  const preview = document.getElementById('content-preview');
  const charCount = document.getElementById('char-count');
  const captureBtn = document.getElementById('capture-btn');

  try {
    let content;

    switch (captureType) {
      case 'selection':
        content = await chrome.tabs.sendMessage(currentTab.id, { action: 'getSelection' });
        break;
      case 'article':
        content = await chrome.tabs.sendMessage(currentTab.id, { action: 'getArticle' });
        break;
      case 'page':
        content = await chrome.tabs.sendMessage(currentTab.id, { action: 'getFullPage' });
        break;
    }

    contentPreview = content;

    // Clear preview content
    while (preview.firstChild) {
      preview.removeChild(preview.firstChild);
    }

    if (content && content.text && content.text.length > 0) {
      // Truncate preview if too long
      const previewText = content.text.length > 500
        ? content.text.substring(0, 500) + '...'
        : content.text;

      preview.textContent = previewText;
      charCount.textContent = `${content.text.length.toLocaleString()} characters`;
      captureBtn.disabled = false;
    } else {
      const placeholderP = document.createElement('p');
      placeholderP.className = 'placeholder';

      if (captureType === 'selection') {
        placeholderP.textContent = 'Select text on the page to capture';
      } else if (captureType === 'article') {
        placeholderP.textContent = content?.error || 'Could not detect article content';
      } else {
        placeholderP.textContent = 'No content found on page';
      }

      preview.appendChild(placeholderP);
      charCount.textContent = '0 characters';
      captureBtn.disabled = true;
    }
  } catch (error) {
    console.error('Error getting content:', error);

    // Clear preview content
    while (preview.firstChild) {
      preview.removeChild(preview.firstChild);
    }

    const placeholderP = document.createElement('p');
    placeholderP.className = 'placeholder';
    placeholderP.textContent = 'Could not access page content';
    preview.appendChild(placeholderP);
    charCount.textContent = '0 characters';
    captureBtn.disabled = true;
  }
}

async function capture() {
  if (!contentPreview || !contentPreview.text) {
    return;
  }

  const captureBtn = document.getElementById('capture-btn');
  const originalText = captureBtn.textContent;
  captureBtn.disabled = true;
  captureBtn.textContent = 'Capturing...';

  try {
    const title = document.getElementById('doc-title').value || pageInfo.title;
    const projectId = document.getElementById('project-select').value;
    const tags = document.getElementById('doc-tags').value
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    const notes = document.getElementById('doc-notes').value;

    // Combine content with notes
    let fullContent = contentPreview.text;
    if (notes) {
      fullContent = `Notes:\n${notes}\n\n---\n\n${fullContent}`;
    }

    const result = await chrome.runtime.sendMessage({
      action: 'captureContent',
      data: {
        title,
        content: fullContent,
        url: pageInfo.url,
        projectId: projectId || null,
        tags
      }
    });

    if (result.success) {
      document.getElementById('success-message').textContent =
        projectId ? 'Content saved to your project!' : 'Content saved to Pulse!';
      showState('success');
    } else {
      showError(result.error || 'Failed to capture content');
    }
  } catch (error) {
    showError(error.message);
  } finally {
    captureBtn.disabled = false;
    captureBtn.textContent = originalText;
  }
}

function showError(message) {
  document.getElementById('error-message').textContent = message;
  showState('error');
}
