// Popup script to manage the extension UI

let allElements = [];
let filteredElements = [];
let suggestMode = false;

// Get current tab and send message to content script
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Collect elements from the page
async function collectElements() {
  const tab = await getCurrentTab();
  if (!tab) return;
  
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getElements' });
    if (response && response.elements) {
      allElements = response.elements;
      filteredElements = allElements;
      updateUI();
    }
  } catch (error) {
    console.error('Error collecting elements:', error);
    showError('Unable to collect elements. Make sure you are on a valid webpage.');
  }
}

// Highlight elements on the page
async function highlightElements() {
  const tab = await getCurrentTab();
  if (!tab) return;
  
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'highlight' });
    collectElements(); // Refresh the list after highlighting
  } catch (error) {
    console.error('Error highlighting elements:', error);
  }
}

// Remove highlights from the page
async function removeHighlights() {
  const tab = await getCurrentTab();
  if (!tab) return;
  
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'removeHighlight' });
  } catch (error) {
    console.error('Error removing highlights:', error);
  }
}

// Update the UI with collected elements
function updateUI() {
  const countElement = document.getElementById('count');
  const listElement = document.getElementById('elementsList');
  
  countElement.textContent = filteredElements.length;
  
  if (filteredElements.length === 0) {
    listElement.innerHTML = '<div class="empty-state">No elements found with data-testid</div>';
    return;
  }
  
  listElement.innerHTML = filteredElements.map((item, index) => `
    <div class="element-item" data-index="${index}">
      <div class="element-header">
        <span class="test-id">${escapeHtml(item.testId)}</span>
        <span class="tag-name">${item.tagName}</span>
      </div>
      ${item.text ? `<div class="element-text">${escapeHtml(item.text)}</div>` : ''}
      <div class="element-selector">${escapeHtml(item.selector)}</div>
    </div>
  `).join('');
  
  // Add click handlers to scroll & highlight elements
  document.querySelectorAll('.element-item').forEach((item, index) => {
    item.addEventListener('click', () => {
      focusElementOnPage(filteredElements[index].testId);
    });
  });
}

// Scroll to element on the page and highlight border briefly
async function focusElementOnPage(testId) {
  const tab = await getCurrentTab();
  if (!tab) return;
  
  try {
    await chrome.tabs.sendMessage(tab.id, { 
      action: 'focusElement', 
      testId 
    });
  } catch (error) {
    console.error('Error focusing element:', error);
  }
}

// Filter elements based on search
function filterElements(searchTerm) {
  if (!searchTerm.trim()) {
    filteredElements = allElements;
  } else {
    const term = searchTerm.toLowerCase();
    filteredElements = allElements.filter(item => 
      item.testId.toLowerCase().includes(term) ||
      item.tagName.toLowerCase().includes(term) ||
      item.text.toLowerCase().includes(term) ||
      item.selector.toLowerCase().includes(term)
    );
  }
  updateUI();
}

// Export to JSON
async function exportToJSON() {
  const tab = await getCurrentTab();
  const currentUrl = tab ? tab.url : 'unknown';
  
  const data = {
    timestamp: new Date().toISOString(),
    url: currentUrl,
    count: allElements.length,
    elements: allElements
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `data-testid-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Copy all test IDs to clipboard
async function copyAllTestIds() {
  const testIds = allElements.map(item => item.testId).join('\n');
  try {
    await navigator.clipboard.writeText(testIds);
    showNotification('All test IDs copied to clipboard!');
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    showNotification('Failed to copy to clipboard');
  }
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  const listElement = document.getElementById('elementsList');
  listElement.innerHTML = `<div class="empty-state" style="color: #f44336;">${message}</div>`;
}

function showNotification(message) {
  // Simple notification (could be enhanced with a toast)
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4CAF50;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2000);
}

async function toggleSuggestions() {
  const tab = await getCurrentTab();
  if (!tab) return;

  const nextState = !suggestMode;
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'enableSuggestions',
      enable: nextState
    });
    suggestMode = nextState;
    const btn = document.getElementById('suggestBtn');
    if (suggestMode) {
      btn.textContent = 'Stop suggestions';
      btn.classList.add('active');
      const count = response?.suggested ?? 0;
      showNotification(`Suggesting data-testid for ${count} element${count === 1 ? '' : 's'}`);
    } else {
      btn.textContent = 'Suggest data-testid';
      btn.classList.remove('active');
      showNotification('Suggestions cleared');
    }
  } catch (error) {
    console.error('Error toggling suggestions:', error);
  }
}

// Event listeners
document.getElementById('highlightBtn').addEventListener('click', highlightElements);
document.getElementById('removeHighlightBtn').addEventListener('click', removeHighlights);
document.getElementById('refreshBtn').addEventListener('click', collectElements);
document.getElementById('exportBtn').addEventListener('click', exportToJSON);
document.getElementById('copyAllBtn').addEventListener('click', copyAllTestIds);
document.getElementById('suggestBtn').addEventListener('click', toggleSuggestions);

document.getElementById('searchInput').addEventListener('input', (e) => {
  filterElements(e.target.value);
});

// Initialize on load
collectElements();

