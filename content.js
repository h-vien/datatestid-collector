// Content script to find and highlight elements with data-testid

let isHighlighting = false;
let highlightedElements = [];
let isSuggesting = false;
let suggestedElements = [];
let observer = null;

const interactiveSelector = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  'summary'
].join(',');

// Function to find all elements with data-testid
function findElementsWithTestId() {
  const elements = document.querySelectorAll('[data-testid]');
  return Array.from(elements).map(el => ({
    testId: el.getAttribute('data-testid'),
    tagName: el.tagName.toLowerCase(),
    text: el.textContent?.trim().substring(0, 50) || '',
    selector: generateSelector(el)
  }));
}

// Generate a simple selector for the element
function generateSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  if (element.className) {
    const classes = element.className.split(' ').filter(c => c).join('.');
    if (classes) {
      return `${element.tagName.toLowerCase()}.${classes}`;
    }
  }
  return element.tagName.toLowerCase();
}

// Suggestion helpers
function toKebabCase(text) {
  return text
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function buildSuggestion(el) {
  const tag = el.tagName.toLowerCase();
  const type = el.getAttribute('type');
  const aria = el.getAttribute('aria-label');
  const name = el.getAttribute('name');
  const id = el.id;
  const placeholder = el.getAttribute('placeholder');
  const text = (el.innerText || el.textContent || '').trim();

  const candidates = [
    aria,
    name,
    id,
    placeholder,
    text,
    type ? `${tag}-${type}` : tag,
    `${tag}-element`
  ].filter(Boolean);

  const candidate = candidates.find(c => toKebabCase(c).length > 0) || `${tag}-element`;
  return toKebabCase(candidate);
}

function shouldSuggestElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.getAttribute('data-testid')) return false;
  if (el.matches('[data-testid] *')) return false; // skip if ancestor carries data-testid
  if (el.matches('input[type="hidden"]')) return false;
  if (el.matches('[disabled], [aria-disabled="true"]')) return false;
  return el.matches(interactiveSelector);
}

function addSuggestion(el) {
  if (el.classList.contains('data-testid-suggest')) {
    return;
  }
  const suggestion = buildSuggestion(el);
  el.dataset.testidSuggestion = suggestion;
  el.classList.add('data-testid-suggest');

  // Preserve modal positioning; only add relative when safe for label positioning
  if (!isModalElement(el)) {
    const computedStyle = window.getComputedStyle(el);
    if (computedStyle.position === 'static') {
      el.dataset.testidSuggestPosition = 'added';
      el.style.position = 'relative';
    }
  }

  suggestedElements.push({
    element: el,
    suggestion
  });
}

function clearSuggestions() {
  isSuggesting = false;
  suggestedElements.forEach(item => {
    if (!item.element || !item.element.classList) return;
    item.element.classList.remove('data-testid-suggest');
    if (item.element.dataset.testidSuggestion) {
      delete item.element.dataset.testidSuggestion;
    }
    if (item.element.dataset.testidSuggestPosition === 'added') {
      item.element.style.position = '';
      delete item.element.dataset.testidSuggestPosition;
    }
  });
  suggestedElements = [];

  document.querySelectorAll('.data-testid-suggest').forEach(el => {
    el.classList.remove('data-testid-suggest');
    delete el.dataset.testidSuggestion;
    if (el.dataset.testidSuggestPosition === 'added') {
      el.style.position = '';
      delete el.dataset.testidSuggestPosition;
    }
  });
}

// Ensure a shared observer is running while highlighting or suggesting
function ensureObserver() {
  if (observer) return;
  observer = new MutationObserver(handleMutations);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function handleMutations(mutations) {
  if (!isHighlighting && !isSuggesting) {
    return;
  }

  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      if (isHighlighting) {
        processHighlightNode(node);
      }
      if (isSuggesting) {
        processSuggestionNode(node);
      }
    });
  });
}

function processHighlightNode(node) {
  if (node.hasAttribute && node.hasAttribute('data-testid')) {
    highlightElement(node);
  }
  const childrenWithTestId = node.querySelectorAll && node.querySelectorAll('[data-testid]');
  if (childrenWithTestId) {
    childrenWithTestId.forEach((el) => {
      highlightElement(el);
    });
  }
}

function processSuggestionNode(node) {
  if (shouldSuggestElement(node)) {
    addSuggestion(node);
  }
  const interactiveChildren = node.querySelectorAll && node.querySelectorAll(interactiveSelector);
  if (interactiveChildren) {
    interactiveChildren.forEach((el) => {
      if (shouldSuggestElement(el)) {
        addSuggestion(el);
      }
    });
  }
}

// Check if element is likely a modal/dialog
function isModalElement(el) {
  const role = el.getAttribute('role');
  const ariaModal = el.getAttribute('aria-modal');
  const className = el.className || '';
  
  // Check for modal indicators
  if (role === 'dialog' || role === 'alertdialog' || ariaModal === 'true') {
    return true;
  }
  
  // Check for common modal class patterns
  if (className.match(/\bmodal\b/i) || 
      className.match(/\bdialog\b/i) || 
      className.match(/\boverlay\b/i) ||
      className.match(/\bpopup\b/i)) {
    return true;
  }
  
  // Check if element has fixed/absolute positioning with high z-index (likely modal)
  const computedStyle = window.getComputedStyle(el);
  const position = computedStyle.position;
  const zIndex = parseInt(computedStyle.zIndex);
  
  if ((position === 'fixed' || position === 'absolute') && zIndex > 100) {
    return true;
  }
  
  return false;
}

// Function to highlight a single element
function highlightElement(el) {
  if (!el.classList.contains('data-testid-highlight')) {
    el.classList.add('data-testid-highlight');
    
    // For non-modal elements with static positioning, add relative for label
    // But NEVER modify positioning for modals or elements that already have positioning
    if (!isModalElement(el)) {
      const computedStyle = window.getComputedStyle(el);
      const position = computedStyle.position;
      // Only add position:relative if element is static (safe to modify)
      if (position === 'static') {
        el.dataset.testidHighlightPosition = 'added'; // Track that we added this
        el.style.position = 'relative';
      }
    }
    
    highlightedElements.push({
      element: el,
      testId: el.getAttribute('data-testid')
    });
  }
}

// Function to highlight elements
function highlightElements() {
  // Remove existing highlights first to allow re-highlighting
  if (isHighlighting) {
    removeHighlights();
  }
  
  isHighlighting = true;
  highlightedElements = [];
  ensureObserver();
  
  // Highlight existing elements
  const elements = document.querySelectorAll('[data-testid]');
  elements.forEach((el) => {
    highlightElement(el);
  });
  
  // Watch for new elements (like modals) being added to the DOM
  if (!observer) {
    observer = new MutationObserver((mutations) => {
      if (!isHighlighting) return;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node has data-testid
            if (node.hasAttribute && node.hasAttribute('data-testid')) {
              highlightElement(node);
            }
            // Check for data-testid in children
            const childrenWithTestId = node.querySelectorAll && node.querySelectorAll('[data-testid]');
            if (childrenWithTestId) {
              childrenWithTestId.forEach((el) => {
                highlightElement(el);
              });
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Send message to popup with collected data
  chrome.runtime.sendMessage({
    action: 'elementsFound',
    count: highlightedElements.length,
    elements: findElementsWithTestId()
  });
}

// Suggest missing data-testid on interactive elements
function suggestMissingTestIds() {
  if (isSuggesting) {
    clearSuggestions();
  }

  isSuggesting = true;
  suggestedElements = [];
  ensureObserver();

  const candidates = document.querySelectorAll(interactiveSelector);
  candidates.forEach((el) => {
    if (shouldSuggestElement(el)) {
      addSuggestion(el);
    }
  });

  chrome.runtime.sendMessage({
    action: 'suggestionsFound',
    count: suggestedElements.length
  });
}

function stopSuggestions() {
  clearSuggestions();
  if (!isHighlighting && observer) {
    observer.disconnect();
    observer = null;
  }
}

// Function to remove highlights
function removeHighlights() {
  isHighlighting = false;
  highlightedElements.forEach(item => {
    if (item.element && item.element.classList) {
      item.element.classList.remove('data-testid-highlight');
      // Remove position:relative only if we added it
      if (item.element.dataset.testidHighlightPosition === 'added') {
        item.element.style.position = '';
        delete item.element.dataset.testidHighlightPosition;
      }
    }
  });
  highlightedElements = [];
  
  // Also remove from any elements that might have been added dynamically
  document.querySelectorAll('.data-testid-highlight').forEach(el => {
    el.classList.remove('data-testid-highlight');
    // Clean up position style if we added it
    if (el.dataset.testidHighlightPosition === 'added') {
      el.style.position = '';
      delete el.dataset.testidHighlightPosition;
    }
  });
  
  // Stop observing only if no other feature is active
  if (observer && !isSuggesting) {
    observer.disconnect();
    observer = null;
  }
}

// Function to scroll to element with specific test ID
function scrollToElement(testId) {
  const element = document.querySelector(`[data-testid="${testId}"]`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Temporarily add a pulse effect
    element.style.transition = 'box-shadow 0.3s';
    element.style.boxShadow = '0 0 20px rgba(76, 175, 80, 0.8)';
    setTimeout(() => {
      element.style.boxShadow = '';
    }, 1000);
    return true;
  }
  return false;
}

// Scroll and add a temporary focus outline to the element
function focusElement(testId) {
  const element = document.querySelector(`[data-testid="${testId}"]`);
  if (!element) return false;

  // Ensure it gets the standard highlight outline
  highlightElement(element);

  // Add a temporary focus pulse class
  element.classList.add('data-testid-focus');
  setTimeout(() => {
    element.classList.remove('data-testid-focus');
  }, 1500);

  // Scroll into view
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'highlight') {
    highlightElements();
    sendResponse({ success: true });
  } else if (request.action === 'removeHighlight') {
    removeHighlights();
    sendResponse({ success: true });
  } else if (request.action === 'getElements') {
    const elements = findElementsWithTestId();
    sendResponse({ elements });
  } else if (request.action === 'scrollToElement') {
    const success = scrollToElement(request.testId);
    sendResponse({ success });
  } else if (request.action === 'focusElement') {
    const success = focusElement(request.testId);
    sendResponse({ success });
  } else if (request.action === 'enableSuggestions') {
    if (request.enable) {
      suggestMissingTestIds();
    } else {
      stopSuggestions();
    }
    sendResponse({ success: true, suggested: suggestedElements.length });
  }
  return true;
});

// Auto-highlight on page load (optional - can be toggled)
// highlightElements();

