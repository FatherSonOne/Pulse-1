/**
 * Pulse Browser Extension - Background Service Worker
 * Handles authentication, API communication, and context menus
 */

// Constants
const PULSE_URL = 'https://pulse.logosvision.org';
const SUPABASE_URL = 'https://ucaeuszgoihoyrvhewxk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYWV1c3pnb2lob3lydmhld3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMjg5ODYsImV4cCI6MjA4MDgwNDk4Nn0.0VGjpsPBYjyk6QTG5rAQX4_NcpfBTyR85ofE5jiHTKo';

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Pulse] Extension installed');
  setupContextMenus();
});

// Set up context menus
function setupContextMenus() {
  chrome.contextMenus.create({
    id: 'pulse-capture-selection',
    title: 'Capture to Pulse',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'pulse-capture-page',
    title: 'Capture entire page to Pulse',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'pulse-capture-link',
    title: 'Save link to Pulse',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: 'pulse-capture-image',
    title: 'Save image to Pulse',
    contexts: ['image']
  });
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const session = await getSession();

  if (!session) {
    // Open popup to login
    chrome.action.openPopup();
    return;
  }

  switch (info.menuItemId) {
    case 'pulse-capture-selection':
      captureFromContextMenu(tab, 'selection', info.selectionText);
      break;

    case 'pulse-capture-page':
      captureFromContextMenu(tab, 'page');
      break;

    case 'pulse-capture-link':
      captureFromContextMenu(tab, 'link', info.linkUrl);
      break;

    case 'pulse-capture-image':
      captureFromContextMenu(tab, 'image', info.srcUrl);
      break;
  }
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(request, sender) {
  switch (request.action) {
    case 'getSession':
      return await getSession();

    case 'login':
      return await initiateLogin();

    case 'logout':
      return await logout();

    case 'getProjects':
      return await getProjects();

    case 'captureContent':
      return await captureContent(request.data);

    case 'quickCapture':
      return await quickCapture(request.content, request.pageInfo);

    case 'getSettings':
      return await getSettings();

    case 'saveSettings':
      return await saveSettings(request.settings);

    default:
      return { error: 'Unknown action' };
  }
}

// Authentication
async function getSession() {
  try {
    const { session } = await chrome.storage.local.get('session');
    if (!session) return null;

    // Check if session is still valid
    if (session.expires_at && Date.now() > session.expires_at * 1000) {
      await chrome.storage.local.remove('session');
      return null;
    }

    return session;
  } catch (error) {
    console.error('[Pulse] Error getting session:', error);
    return null;
  }
}

async function initiateLogin() {
  try {
    // Open Pulse login page with extension callback
    const authUrl = `${PULSE_URL}/auth/extension-login`;
    const tab = await chrome.tabs.create({ url: authUrl });

    // Listen for the callback
    return new Promise((resolve) => {
      const listener = (tabId, changeInfo, updatedTab) => {
        if (tabId === tab.id && changeInfo.url) {
          const url = new URL(changeInfo.url);

          // Check for success callback
          if (url.pathname === '/auth/extension-callback') {
            const token = url.searchParams.get('token');
            const user = url.searchParams.get('user');

            if (token && user) {
              const session = {
                access_token: token,
                user: JSON.parse(decodeURIComponent(user)),
                expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour
              };

              chrome.storage.local.set({ session });
              chrome.tabs.remove(tabId);
              chrome.tabs.onUpdated.removeListener(listener);
              resolve({ success: true, session });
            }
          }

          // Check for error
          if (url.pathname === '/auth/extension-error') {
            chrome.tabs.remove(tabId);
            chrome.tabs.onUpdated.removeListener(listener);
            resolve({ success: false, error: url.searchParams.get('error') });
          }
        }
      };

      chrome.tabs.onUpdated.addListener(listener);

      // Timeout after 5 minutes
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve({ success: false, error: 'Login timeout' });
      }, 300000);
    });
  } catch (error) {
    console.error('[Pulse] Login error:', error);
    return { success: false, error: error.message };
  }
}

async function logout() {
  try {
    await chrome.storage.local.remove('session');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// API Functions
async function apiRequest(endpoint, options = {}) {
  const session = await getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function getProjects() {
  try {
    const projects = await apiRequest('/ai_projects?select=id,name,color,icon,description&order=updated_at.desc');
    return { success: true, projects };
  } catch (error) {
    console.error('[Pulse] Error fetching projects:', error);
    return { success: false, error: error.message };
  }
}

async function captureContent(data) {
  try {
    const session = await getSession();

    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Create knowledge document
    const doc = {
      user_id: session.user.id,
      title: data.title,
      file_type: 'web-capture',
      file_size: new Blob([data.content]).size,
      text_content: data.content,
      source_url: data.url,
      keywords: data.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const [createdDoc] = await apiRequest('/knowledge_docs', {
      method: 'POST',
      body: JSON.stringify(doc)
    });

    // Link to project if specified
    if (data.projectId && createdDoc) {
      await apiRequest('/project_docs', {
        method: 'POST',
        body: JSON.stringify({
          project_id: data.projectId,
          doc_id: createdDoc.id
        })
      });
    }

    return {
      success: true,
      docId: createdDoc?.id,
      projectId: data.projectId
    };
  } catch (error) {
    console.error('[Pulse] Capture error:', error);
    return { success: false, error: error.message };
  }
}

async function quickCapture(content, pageInfo) {
  try {
    const settings = await getSettings();
    const session = await getSession();

    if (!session) {
      return { success: false, error: 'Please sign in first' };
    }

    // Use default project from settings
    const projectId = settings.defaultProjectId || null;

    const result = await captureContent({
      title: pageInfo.title || 'Web Capture',
      content: content.text,
      url: pageInfo.url,
      projectId: projectId,
      tags: []
    });

    // Show notification
    if (result.success) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'Captured to Pulse',
        message: `"${pageInfo.title}" saved successfully`
      });
    }

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function captureFromContextMenu(tab, type, data) {
  try {
    let content = { text: data || '' };
    let pageInfo = { url: tab.url, title: tab.title };

    // Get content based on type
    if (type === 'selection') {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });
      content = response;
    } else if (type === 'page') {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getFullPage' });
      content = response;
    } else if (type === 'link') {
      content = { text: `Link: ${data}` };
    } else if (type === 'image') {
      content = { text: `Image: ${data}`, imageUrl: data };
    }

    // Get page info
    const infoResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
    pageInfo = infoResponse;

    // Capture
    const result = await quickCapture(content, pageInfo);

    // Show toast in page
    chrome.tabs.sendMessage(tab.id, {
      action: 'showToast',
      type: result.success ? 'success' : 'error',
      title: result.success ? 'Captured!' : 'Failed',
      message: result.success ? 'Content saved to Pulse' : result.error
    });
  } catch (error) {
    console.error('[Pulse] Context menu capture error:', error);
  }
}

// Settings
async function getSettings() {
  try {
    const { settings } = await chrome.storage.sync.get('settings');
    return settings || {
      defaultProjectId: null,
      autoCapture: false,
      showFloatingButton: true,
      keyboardShortcuts: true
    };
  } catch (error) {
    return {};
  }
}

async function saveSettings(settings) {
  try {
    await chrome.storage.sync.set({ settings });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Commands (keyboard shortcuts)
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) return;

  switch (command) {
    case 'capture_selection':
      captureFromContextMenu(tab, 'selection');
      break;

    case 'capture_page':
      captureFromContextMenu(tab, 'page');
      break;
  }
});
