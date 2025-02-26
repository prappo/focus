// Global variables
let focusList = [];
let focusModeEnabled = false;
let currentTabId = null;
let outOfFocusStartTime = null;
let tabTimeTracking = {}; // Object to track time spent on each tab
let currentFocusTabStartTime = null; // When the current focus tab was activated
let alertTime = 30; // Default to 30 seconds if not set

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);
  
  if (message.action === 'popupOpened') {
    console.log("Popup opened");
    // You can do any initialization here if needed
    sendResponse({success: true});
  }
  
  // Always return true if you want to use sendResponse asynchronously
  return true;
});

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  loadSettings();
  loadTrackingData();
  showWelcomeNotification();
  setupAlarms();
});

// Load settings from storage
function loadSettings() {
  chrome.storage.local.get(['focusList', 'focusModeEnabled', 'alertTime'], (data) => {
    focusList = data.focusList || [];
    focusModeEnabled = data.focusModeEnabled || false;
    
    if (data.alertTime) {
      alertTime = data.alertTime;
      console.log("Alert time set to", alertTime, "seconds");
    }
  });
}

// Load previous tracking data
function loadTrackingData() {
  chrome.storage.local.get(['tabTimeTracking'], (data) => {
    tabTimeTracking = data.tabTimeTracking || {};
  });
}

// Show welcome notification
function showWelcomeNotification() {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon128.png',
    title: 'Focus Activated',
    message: 'Ready to help you stay focused!',
    priority: 2
  });
}

// Setup recurring alarms
function setupAlarms() {
  // Save tracking data every minute
  chrome.alarms.create('saveTimeTracking', { periodInMinutes: 1 });
}

// Listen for changes in storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.focusList) {
      focusList = changes.focusList.newValue;
    }
    
    if (changes.focusModeEnabled) {
      focusModeEnabled = changes.focusModeEnabled.newValue;
      
      if (!focusModeEnabled) {
        clearOutOfFocusTracking();
      }
    }
    
    if (changes.alertTime) {
      alertTime = changes.alertTime.newValue;
      console.log("Alert time updated to", alertTime, "seconds");
    }
  }
});

// Listen for tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (!focusModeEnabled) return;
  
  currentTabId = activeInfo.tabId;
  checkIfTabInFocusList(currentTabId);
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!focusModeEnabled || tabId !== currentTabId || !changeInfo.url) return;
  
  checkIfTabInFocusList(tabId);
});

// Check if the current tab is in the focus list
function checkIfTabInFocusList(tabId) {
  saveCurrentTabTime();
  
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.error("Error checking tab:", chrome.runtime.lastError);
      return;
    }
    
    const isInFocusList = isTabInFocusList(tab);
    
    if (isInFocusList) {
      handleFocusTab(tab);
    } else {
      handleNonFocusTab();
    }
  });
}

// Check if a tab is in the focus list
function isTabInFocusList(tab) {
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

// Handle when user is on a focus tab
function handleFocusTab(tab) {
  console.log("Tab is in focus list");
  clearOutOfFocusTracking();
  
  // Start tracking time for this focus tab
  currentTabId = tab.id;
  currentFocusTabStartTime = Date.now();
  
  // Initialize or update tab tracking
  updateTabTrackingData(tab);
}

// Handle when user is on a non-focus tab
function handleNonFocusTab() {
  console.log("Tab is NOT in focus list");
  currentFocusTabStartTime = null;
  
  // Start tracking out-of-focus time
  outOfFocusStartTime = Date.now();
  
  // Create a repeating alarm that checks frequently
  chrome.alarms.clear('outOfFocusCheck');
  chrome.alarms.create('outOfFocusCheck', { periodInMinutes: 0.033 }); // ~2 seconds
}

// Update tab tracking data
function updateTabTrackingData(tab) {
  const tabKey = getDomainFromTab(tab);
  
  if (!tabTimeTracking[tabKey]) {
    tabTimeTracking[tabKey] = {
      totalTime: 0,
      title: tab.title || tabKey,
      lastVisit: new Date().toISOString()
    };
  } else {
    tabTimeTracking[tabKey].lastVisit = new Date().toISOString();
  }
  
  saveTrackingData();
}

// Helper function to save the current tab's time
function saveCurrentTabTime() {
  if (!currentFocusTabStartTime || !currentTabId) return;
  
  chrome.tabs.get(currentTabId, (tab) => {
    if (chrome.runtime.lastError) return;
    
    const tabKey = getDomainFromTab(tab);
    if (!tabTimeTracking[tabKey]) return;
    
    const timeSpent = Math.floor((Date.now() - currentFocusTabStartTime) / 1000);
    tabTimeTracking[tabKey].totalTime += timeSpent;
    
    console.log(`Added ${timeSpent}s to ${tabKey}, total: ${tabTimeTracking[tabKey].totalTime}s`);
    saveTrackingData();
    
    // Reset start time to now for continuous tracking
    currentFocusTabStartTime = Date.now();
  });
}

// Get domain key from tab
function getDomainFromTab(tab) {
  if (!tab.url) return `tab_${tab.id}`;
  
  try {
    const url = new URL(tab.url);
    return url.hostname;
  } catch (e) {
    return `tab_${tab.id}`;
  }
}

// Save tracking data to storage
function saveTrackingData() {
  chrome.storage.local.set({ tabTimeTracking });
}

// Check if Chrome is the active application
function isChromeActive(callback) {
  chrome.windows.getAll({ populate: false }, (windows) => {
    const anyFocused = windows.some(window => window.focused);
    callback(anyFocused);
  });
}

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'saveTimeTracking') {
    saveCurrentTabTime();
  }
  else if (alarm.name === 'outOfFocusCheck') {
    checkOutOfFocusState();
  }
});

// Check if the user is still out of focus
function checkOutOfFocusState() {
  isChromeActive((chromeIsActive) => {
    if (!chromeIsActive) {
      console.log("Chrome is not active, skipping check");
      return;
    }
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return;
      
      const currentTab = tabs[0];
      const isInFocusList = isTabInFocusList(currentTab);
      
      if (isInFocusList) {
        clearOutOfFocusTracking();
      } 
      else if (outOfFocusStartTime) {
        checkAndShowNotification();
      }
    });
  });
}

// Check conditions and show notification if needed
function checkAndShowNotification() {
  const timeSpent = (Date.now() - outOfFocusStartTime) / 1000;
  
  if (timeSpent >= alertTime) {
    const timeSinceLastInterval = timeSpent % alertTime;
    
    if (timeSinceLastInterval < 2) {
      showOutOfFocusNotification(timeSpent);
    }
  }
}

// Show notification for out of focus state
function showOutOfFocusNotification(timeSpent) {
  console.log(`Showing notification! Time elapsed: ${timeSpent}s, Interval: ${alertTime}s`);
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon128.png',
    title: 'Focus Reminder',
    message: `You've been distracted for over ${alertTime} seconds. Time to get back to focus!`,
    priority: 2
  }, (notificationId) => {
    if (!chrome.runtime.lastError) {
      outOfFocusStartTime = Date.now();
      console.log(`Timer reset - will show another notification in ${alertTime} seconds if still out of focus`);
    }
  });
}

// Clean up when extension is suspended
chrome.runtime.onSuspend.addListener(() => {
  saveCurrentTabTime();
});

// Clear out-of-focus tracking
function clearOutOfFocusTracking() {
  outOfFocusStartTime = null;
  chrome.alarms.clear('outOfFocusCheck');
} 