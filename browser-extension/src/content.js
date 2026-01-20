/**
 * Pulse Browser Extension - Content Script
 * Handles page content extraction and selection capture
 */

// State
let captureButton = null;
let isCapturing = false;
let selectedContent = null;

// Initialize
init();

function init() {
  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener(handleMessage);

  // Set up selection listener
  document.addEventListener('mouseup', handleSelectionChange);
  document.addEventListener('keyup', handleSelectionChange);

  // Set up keyboard shortcuts
  document.addEventListener('keydown', handleKeydown);

  console.log('[Pulse] Content script initialized');
}

// Message Handler
function handleMessage(request, sender, sendResponse) {
  switch (request.action) {
    case 'getPageInfo':
      sendResponse(getPageInfo());
      break;

    case 'getSelection':
      sendResponse(getSelectedText());
      break;

    case 'getArticle':
      sendResponse(extractArticle());
      break;

    case 'getFullPage':
      sendResponse(getFullPageContent());
      break;

    case 'highlightElement':
      highlightElement(request.selector);
      sendResponse({ success: true });
      break;

    case 'clearHighlight':
      clearHighlights();
      sendResponse({ success: true });
      break;

    case 'showToast':
      showToast(request.type, request.title, request.message);
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  return true; // Keep message channel open for async response
}

// Page Info
function getPageInfo() {
  const favicon = document.querySelector('link[rel*="icon"]');
  const ogImage = document.querySelector('meta[property="og:image"]');
  const description = document.querySelector('meta[name="description"]') ||
                      document.querySelector('meta[property="og:description"]');

  return {
    url: window.location.href,
    title: document.title,
    favicon: favicon ? new URL(favicon.href, window.location.origin).href : null,
    image: ogImage ? ogImage.content : null,
    description: description ? description.content : null,
    domain: window.location.hostname
  };
}

// Selection Handling
function handleSelectionChange(event) {
  // Debounce
  clearTimeout(handleSelectionChange.timeout);
  handleSelectionChange.timeout = setTimeout(() => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 10) {
      showCaptureButton(selection);
      selectedContent = {
        text: text,
        html: getSelectionHtml(selection)
      };
    } else {
      hideCaptureButton();
      selectedContent = null;
    }
  }, 200);
}

function getSelectedText() {
  const selection = window.getSelection();
  const text = selection.toString().trim();

  if (!text) {
    return { text: '', html: '' };
  }

  return {
    text: text,
    html: getSelectionHtml(selection)
  };
}

function getSelectionHtml(selection) {
  if (!selection.rangeCount) return '';

  const container = document.createElement('div');
  for (let i = 0; i < selection.rangeCount; i++) {
    container.appendChild(selection.getRangeAt(i).cloneContents());
  }
  // Using cloneContents which is safe as it clones DOM nodes from the page itself
  return container.innerHTML;
}

// Capture Button
function showCaptureButton(selection) {
  if (!captureButton) {
    createCaptureButton();
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  captureButton.style.top = `${window.scrollY + rect.bottom + 10}px`;
  captureButton.style.left = `${window.scrollX + rect.left + (rect.width / 2) - 70}px`;
  captureButton.classList.add('visible');
}

function hideCaptureButton() {
  if (captureButton) {
    captureButton.classList.remove('visible');
  }
}

function createCaptureButton() {
  captureButton = document.createElement('button');
  captureButton.className = 'pulse-capture-button';

  // Create SVG element safely
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('fill', 'none');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M8 32 L18 32 L24 16 L32 48 L40 24 L48 40 L56 32');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);

  const textSpan = document.createElement('span');
  textSpan.textContent = 'Capture to Pulse';

  captureButton.appendChild(svg);
  captureButton.appendChild(textSpan);

  captureButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    captureSelection();
  });

  document.body.appendChild(captureButton);
}

async function captureSelection() {
  if (!selectedContent) return;

  hideCaptureButton();

  // Send to background script for capture
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'quickCapture',
      content: selectedContent,
      pageInfo: getPageInfo()
    });

    if (response.success) {
      showToast('success', 'Captured!', 'Content saved to Pulse');
    } else {
      showToast('error', 'Failed', response.error || 'Could not capture content');
    }
  } catch (error) {
    console.error('[Pulse] Capture error:', error);
    showToast('error', 'Error', 'Failed to capture content');
  }
}

// Article Extraction
function extractArticle() {
  // Try to find the main article content
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content-body',
    '#content',
    '.post',
    '.article'
  ];

  let articleElement = null;

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim().length > 500) {
      articleElement = element;
      break;
    }
  }

  if (!articleElement) {
    // Fallback: find the largest text block
    articleElement = findLargestTextBlock();
  }

  if (!articleElement) {
    return { text: '', html: '', error: 'Could not detect article content' };
  }

  // Clean up the content
  const clone = articleElement.cloneNode(true);

  // Remove unwanted elements
  const removeSelectors = [
    'script', 'style', 'nav', 'header', 'footer', 'aside',
    '.advertisement', '.ad', '.social-share', '.comments',
    '.related-posts', '.sidebar', '[role="complementary"]'
  ];

  removeSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  return {
    text: clone.textContent.trim(),
    // Safe to use innerHTML here as clone is from the same document
    html: clone.innerHTML
  };
}

function findLargestTextBlock() {
  const blocks = document.querySelectorAll('div, section, article');
  let largest = null;
  let maxLength = 0;

  blocks.forEach(block => {
    const textLength = block.textContent.trim().length;
    const childCount = block.querySelectorAll('p').length;

    // Prefer blocks with more paragraphs
    const score = textLength + (childCount * 100);

    if (score > maxLength && textLength > 500) {
      maxLength = score;
      largest = block;
    }
  });

  return largest;
}

// Full Page Content
function getFullPageContent() {
  const clone = document.body.cloneNode(true);

  // Remove unwanted elements
  const removeSelectors = [
    'script', 'style', 'noscript', 'iframe', 'nav', 'header', 'footer',
    '.advertisement', '.ad', '.cookie-banner', '.popup'
  ];

  removeSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  return {
    text: clone.textContent.trim(),
    // Safe to use innerHTML here as clone is from the document body
    html: clone.innerHTML
  };
}

// Highlighting
function highlightElement(selector) {
  clearHighlights();

  const element = document.querySelector(selector);
  if (element) {
    element.classList.add('pulse-selection-highlight');
  }
}

function clearHighlights() {
  document.querySelectorAll('.pulse-selection-highlight').forEach(el => {
    el.classList.remove('pulse-selection-highlight');
  });
}

// Toast Notifications - Using safe DOM methods
function showToast(type, title, message) {
  // Remove existing toast
  const existing = document.querySelector('.pulse-toast');
  if (existing) {
    existing.remove();
  }

  // Create toast container
  const toast = document.createElement('div');
  toast.className = `pulse-toast ${type}`;

  // Icon container
  const iconDiv = document.createElement('div');
  iconDiv.className = 'pulse-toast-icon';
  iconDiv.textContent = type === 'success' ? '✓' : '✕';
  toast.appendChild(iconDiv);

  // Content container
  const contentDiv = document.createElement('div');
  contentDiv.className = 'pulse-toast-content';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'pulse-toast-title';
  titleDiv.textContent = title;
  contentDiv.appendChild(titleDiv);

  const messageDiv = document.createElement('div');
  messageDiv.className = 'pulse-toast-message';
  messageDiv.textContent = message;
  contentDiv.appendChild(messageDiv);

  toast.appendChild(contentDiv);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'pulse-toast-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  });
  toast.appendChild(closeBtn);

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // Auto-hide after 4 seconds
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Keyboard Shortcuts
function handleKeydown(event) {
  // Check for Ctrl/Cmd + Shift + S (capture selection)
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'S') {
    event.preventDefault();
    if (selectedContent) {
      captureSelection();
    }
  }
}

// Export for testing
if (typeof module !== 'undefined') {
  module.exports = {
    getPageInfo,
    getSelectedText,
    extractArticle,
    getFullPageContent
  };
}
