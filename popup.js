// Global variables
let allTabs = [];
let focusList = [];
let focusModeEnabled = false;

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initializePopup();
});

// Set up all event listeners
function setupEventListeners() {
  document.getElementById('saveButton').addEventListener('click', saveFocusList);
  document.getElementById('refreshButton').addEventListener('click', loadAllTabs);
  document.getElementById('focusToggle').addEventListener('change', toggleFocusMode);
  document.getElementById('saveSettingsButton').addEventListener('click', saveAlertSettings);
  document.getElementById('resetStatsButton').addEventListener('click', resetTimeStats);
  document.querySelector('h1').addEventListener('dblclick', debugFocusList);
  
  // Set up visibility listener for real-time updates
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadTimeStats();
    }
  });
}

// Initialize popup content
function initializePopup() {
  loadAllTabs();
  loadSettings();
  loadAlertSettings();
  loadTimeStats();
  
  // Update stats periodically when popup is visible
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      loadTimeStats();
    }
  }, 10000);
}

// Load all open tabs
function loadAllTabs() {
  const tabsListElement = document.getElementById('tabsList');
  tabsListElement.innerHTML = '<p>Loading tabs...</p>';
  
  chrome.tabs.query({}, (tabs) => {
    allTabs = tabs;
    displayTabs(tabs, tabsListElement);
  });
}

// Display tabs grouped by window
function displayTabs(tabs, container) {
  container.innerHTML = '';
  
  if (tabs.length === 0) {
    container.innerHTML = '<p>No tabs open</p>';
    return;
  }
  
  // Group tabs by window
  const tabsByWindow = groupTabsByWindow(tabs);
  
  // Create and append tab elements
  Object.keys(tabsByWindow).forEach(windowId => {
    const windowTabs = tabsByWindow[windowId];
    appendWindowSection(windowId, windowTabs, container);
  });
}

// Group tabs by their window ID
function groupTabsByWindow(tabs) {
  const tabsByWindow = {};
  
  tabs.forEach(tab => {
    if (!tabsByWindow[tab.windowId]) {
      tabsByWindow[tab.windowId] = [];
    }
    tabsByWindow[tab.windowId].push(tab);
  });
  
  return tabsByWindow;
}

// Append a window section with its tabs
function appendWindowSection(windowId, tabs, container) {
  const windowElement = document.createElement('div');
  windowElement.className = 'window-group';
  
  const windowTitle = document.createElement('div');
  windowTitle.className = 'window-title';
  windowTitle.textContent = `Window ${windowId}`;
  
  windowElement.appendChild(windowTitle);
  
  // Add a "select all" checkbox
  const selectAllContainer = document.createElement('div');
  selectAllContainer.className = 'tab-item';
  
  const selectAllCheckbox = document.createElement('input');
  selectAllCheckbox.type = 'checkbox';
  selectAllCheckbox.className = 'select-all-checkbox';
  selectAllCheckbox.dataset.windowId = windowId;
  
  const selectAllLabel = document.createElement('span');
  selectAllLabel.className = 'tab-title';
  selectAllLabel.textContent = 'Select All Tabs in This Window';
  
  selectAllContainer.appendChild(selectAllCheckbox);
  selectAllContainer.appendChild(selectAllLabel);
  windowElement.appendChild(selectAllContainer);
  
  // Handle select all checkbox changes
  selectAllCheckbox.addEventListener('change', () => {
    const isChecked = selectAllCheckbox.checked;
    const tabCheckboxes = windowElement.querySelectorAll('input[type="checkbox"]:not(.select-all-checkbox)');
    
    tabCheckboxes.forEach(checkbox => {
      checkbox.checked = isChecked;
    });
  });
  
  // Add individual tabs
  tabs.forEach(tab => {
    const tabElement = createTabElement(tab);
    windowElement.appendChild(tabElement);
  });
  
  container.appendChild(windowElement);
}

// Create a tab element with checkbox
function createTabElement(tab) {
  const tabElement = document.createElement('div');
  tabElement.className = 'tab-item';
  
  const tabCheckbox = document.createElement('input');
  tabCheckbox.type = 'checkbox';
  tabCheckbox.dataset.tabId = tab.id;
  tabCheckbox.dataset.windowId = tab.windowId;
  
  // Check if this tab is in the focus list
  const isInFocusList = checkIfTabInFocusList(tab);
  tabCheckbox.checked = isInFocusList;
  
  const tabFavicon = document.createElement('img');
  tabFavicon.className = 'tab-favicon';
  tabFavicon.src = tab.favIconUrl || 'images/icon16.png';
  tabFavicon.onerror = () => { tabFavicon.src = 'images/icon16.png'; };
  
  const tabTitle = document.createElement('span');
  tabTitle.className = 'tab-title';
  tabTitle.textContent = tab.title;
  tabTitle.title = tab.url; // Show URL on hover
  
  tabElement.appendChild(tabCheckbox);
  tabElement.appendChild(tabFavicon);
  tabElement.appendChild(tabTitle);
  
  return tabElement;
}

// Check if a tab is in the focus list
function checkIfTabInFocusList(tab) {
  return focusList.some(focusTab => {
    // Match by ID
    if (focusTab.id === tab.id) return true;
    
    // Match by URL domain
    if (tab.url && focusTab.url) {
      try {
        const tabDomain = new URL(tab.url).hostname;
        const focusDomain = new URL(focusTab.url).hostname;
        return tabDomain === focusDomain;
      } catch (e) {
        console.error("Error parsing URL:", e);
      }
    }
    return false;
  });
}

// Save the user's selected focus list
function saveFocusList() {
  const newFocusList = [];
  const tabCheckboxes = document.querySelectorAll('#tabsList input[type="checkbox"]:not(.select-all-checkbox)');
  
  tabCheckboxes.forEach(checkbox => {
    if (checkbox.checked) {
      const tabId = parseInt(checkbox.dataset.tabId);
      const tab = allTabs.find(t => t.id === tabId);
      
      if (tab) {
        newFocusList.push({
          id: tab.id,
          url: tab.url,
          title: tab.title
        });
      }
    }
  });
  
  chrome.storage.local.set({ focusList: newFocusList }, () => {
    focusList = newFocusList;
    showNotification('Focus list saved!');
  });
}

// Toggle focus mode on/off
function toggleFocusMode() {
  const isEnabled = document.getElementById('focusToggle').checked;
  
  chrome.storage.local.set({ focusModeEnabled: isEnabled }, () => {
    focusModeEnabled = isEnabled;
    const message = isEnabled ? 'Focus mode enabled!' : 'Focus mode disabled!';
    showNotification(message);
  });
}

// Load saved settings
function loadSettings() {
  chrome.storage.local.get(['focusList', 'focusModeEnabled'], (data) => {
    focusList = data.focusList || [];
    
    if (data.focusModeEnabled !== undefined) {
      focusModeEnabled = data.focusModeEnabled;
      document.getElementById('focusToggle').checked = focusModeEnabled;
    }
  });
}

// Load alert settings
function loadAlertSettings() {
  chrome.storage.local.get(['alertTime'], (data) => {
    if (data.alertTime) {
      document.getElementById('alertTimeInput').value = data.alertTime;
    }
  });
}

// Save alert settings
function saveAlertSettings() {
  const alertTime = parseInt(document.getElementById('alertTimeInput').value);
  
  // Validate the input
  if (isNaN(alertTime) || alertTime < 5) {
    showNotification('Alert time must be at least 5 seconds');
    return;
  }
  
  if (alertTime > 3600) {
    showNotification('Alert time cannot exceed 1 hour (3600 seconds)');
    return;
  }
  
  // Save the setting
  chrome.storage.local.set({ alertTime }, () => {
    showNotification('Settings saved!');
  });
}

// Show a notification within the popup
function showNotification(message) {
  // Remove any existing notification
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    document.body.removeChild(existingNotification);
  }
  
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Trigger animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Hide after delay
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 2000);
}

// Debug function for focus list
function debugFocusList() {
  console.log("Current focus list:", focusList);
  chrome.storage.local.get(['focusList'], (data) => {
    console.log("Storage focus list:", data.focusList);
  });
}

// Format seconds into readable time
function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
}

// Load time tracking statistics
function loadTimeStats() {
  chrome.storage.local.get(['tabTimeTracking'], (data) => {
    const timeStatsList = document.getElementById('timeStatsList');
    if (!timeStatsList) return;
    
    timeStatsList.innerHTML = '';
    
    if (!data.tabTimeTracking || Object.keys(data.tabTimeTracking).length === 0) {
      timeStatsList.innerHTML = '<p>No focus time recorded yet.</p>';
      return;
    }
    
    displayTimeStatsTable(data.tabTimeTracking, timeStatsList);
  });
}

// Display time statistics table
function displayTimeStatsTable(trackingData, container) {
  // Sort domains by total time (descending)
  const sortedDomains = Object.keys(trackingData).sort((a, b) => {
    return trackingData[b].totalTime - trackingData[a].totalTime;
  });
  
  // Create table
  const table = document.createElement('table');
  table.className = 'time-stats-table';
  
  // Add table header
  addTimeStatsTableHeader(table);
  
  // Add data rows
  let totalFocusTime = 0;
  sortedDomains.forEach(domain => {
    const stats = trackingData[domain];
    totalFocusTime += stats.totalTime;
    addTimeStatsTableRow(table, domain, stats);
  });
  
  // Add total row
  addTimeStatsTotalRow(table, totalFocusTime);
  
  container.appendChild(table);
}

// Add table header for time stats
function addTimeStatsTableHeader(table) {
  const headerRow = document.createElement('tr');
  
  const headerSite = document.createElement('th');
  headerSite.textContent = 'Site';
  
  const headerTime = document.createElement('th');
  headerTime.textContent = 'Time Spent';
  
  const headerLastVisit = document.createElement('th');
  headerLastVisit.textContent = 'Last Visit';
  
  headerRow.appendChild(headerSite);
  headerRow.appendChild(headerTime);
  headerRow.appendChild(headerLastVisit);
  table.appendChild(headerRow);
}

// Add data row to time stats table
function addTimeStatsTableRow(table, domain, stats) {
  const row = document.createElement('tr');
  
  const domainCell = document.createElement('td');
  domainCell.textContent = stats.title.length > 20 ? domain : stats.title;
  domainCell.title = domain; // Show full domain on hover
  
  const timeCell = document.createElement('td');
  timeCell.textContent = formatTime(stats.totalTime);
  
  const lastVisitCell = document.createElement('td');
  const lastVisitDate = new Date(stats.lastVisit);
  lastVisitCell.textContent = lastVisitDate.toLocaleDateString();
  lastVisitCell.title = lastVisitDate.toLocaleString(); // Show full date/time on hover
  
  row.appendChild(domainCell);
  row.appendChild(timeCell);
  row.appendChild(lastVisitCell);
  table.appendChild(row);
}

// Add total row to time stats table
function addTimeStatsTotalRow(table, totalTime) {
  const totalRow = document.createElement('tr');
  totalRow.className = 'total-row';
  
  const totalLabelCell = document.createElement('td');
  totalLabelCell.textContent = 'TOTAL';
  
  const totalTimeCell = document.createElement('td');
  totalTimeCell.textContent = formatTime(totalTime);
  
  const emptyCell = document.createElement('td');
  
  totalRow.appendChild(totalLabelCell);
  totalRow.appendChild(totalTimeCell);
  totalRow.appendChild(emptyCell);
  table.appendChild(totalRow);
}

// Reset time statistics
function resetTimeStats() {
  if (confirm('Are you sure you want to reset all time statistics? This cannot be undone.')) {
    chrome.storage.local.set({ tabTimeTracking: {} }, () => {
      loadTimeStats();
      showNotification('Time statistics have been reset.');
    });
  }
} 