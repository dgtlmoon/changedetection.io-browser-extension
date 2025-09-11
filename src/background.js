/**
 * Update icon badge counter on active page
 */

// Helper function to add timeout to fetch requests
function fetchWithTimeout(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    return fetch(url, {
        ...options,
        signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
}

// Helper function to submit URL to changedetection.io API
function submitURLToAPI(endpointUrl, apiKey, watch_url, tag = '', mode = 'text_json_diff', includeFilter = null) {
    if (!endpointUrl || !apiKey || !watch_url) {
        console.error("Missing required parameters for submitURL");
        return Promise.reject(new Error("Missing required parameters"));
    }

    try {
        const manifest = chrome.runtime.getManifest();
        const baseUrl = endpointUrl.replace(/\/+$/, '');
        const endpoint = `${baseUrl}/api/v1/watch?from_extension_v=${manifest.version}`;

        console.log(`Submitting "${watch_url}" watch to "${endpoint}"`);
        const data = {'url': watch_url};

        const trimmedTag = tag ? tag.trim() : '';
        if (trimmedTag.length > 0) {
            if (trimmedTag.length > 100) {
                return Promise.reject(new Error('Tag is too long (max 100 characters)'));
            }
            data['tag'] = trimmedTag;
        }

        if (mode !== 'text_json_diff') {
            data['processor'] = mode;
        }

        return fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify(data)
        }, 30000)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network error');
            }
            return response.json();
        })
        .then(data => {
            const baseUrl = endpointUrl.replace(/\/+$/, '');
            const editUrl = new URL(`${baseUrl}/edit/${encodeURIComponent(data['uuid'])}`);
            return editUrl.href;
        });
    } catch (error) {
        return Promise.reject(error);
    }
}

// Track if context menus are being initialized to prevent duplicates
let isInitializingMenus = false;

// Initialize context menus when extension is installed or updated
async function initializeContextMenus() {
    // Prevent concurrent initialization
    if (isInitializingMenus) {
        console.log('Context menu initialization already in progress, skipping...');
        return;
    }

    isInitializingMenus = true;

    try {
        // Remove any existing context menus and wait for completion
        await chrome.contextMenus.removeAll();

        // Check if we have API credentials
        const { apiKey, endpointUrl } = await chrome.storage.local.get(['apiKey', 'endpointUrl']);
        const isConfigured = !!(apiKey && endpointUrl);

        // Create context menu for links
        chrome.contextMenus.create({
            id: 'watch-link',
            title: 'Watch this link with changedetection.io',
            contexts: ['link'],
            enabled: isConfigured
        });

        // Create context menu for current page
        chrome.contextMenus.create({
            id: 'watch-page',
            title: 'Watch this page with changedetection.io',
            contexts: ['page'],
            enabled: isConfigured
        });

        console.log('Context menus initialized, configured:', isConfigured);
    } catch (error) {
        console.error('Error initializing context menus:', error);
    } finally {
        isInitializingMenus = false;
    }
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
        const { apiKey, endpointUrl } = await chrome.storage.local.get(['apiKey', 'endpointUrl']);

        if (!apiKey || !endpointUrl) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: '/images/shortcut.png',
                title: 'Not Configured',
                message: 'Please configure the extension by visiting your changedetection.io settings page first.'
            });
            return;
        }

        let urlToWatch = '';

        if (info.menuItemId === 'watch-link') {
            urlToWatch = info.linkUrl;
        } else if (info.menuItemId === 'watch-page') {
            urlToWatch = tab.url;
        }

        if (!urlToWatch) {
            console.error('No URL found to watch');
            return;
        }

        // Show processing notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/images/shortcut.png',
            title: 'Adding watch...',
            message: `Adding ${urlToWatch}`
        });

        // Submit the URL
        const editUrl = await submitURLToAPI(endpointUrl, apiKey, urlToWatch);

        // Show success notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/images/shortcut.png',
            title: 'Watch Added!',
            message: `Successfully added ${urlToWatch}. Click to edit.`,
            requireInteraction: true
        }, (notificationId) => {
            // Store the edit URL for this notification
            chrome.storage.local.set({ [`notification_${notificationId}`]: editUrl });
        });

    } catch (error) {
        console.error('Error adding watch from context menu:', error);
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/images/shortcut.png',
            title: 'Error',
            message: error.message || 'Failed to add watch'
        });
    }
});

// Handle notification clicks to open edit page
chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.storage.local.get([`notification_${notificationId}`], (result) => {
        const editUrl = result[`notification_${notificationId}`];
        if (editUrl) {
            chrome.tabs.create({ url: editUrl });
            // Clean up stored URL
            chrome.storage.local.remove([`notification_${notificationId}`]);
        }
    });
});

// Listen for storage changes to update context menu enabled state
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (changes.apiKey || changes.endpointUrl)) {
        initializeContextMenus();
    }
});

// Initialize context menus on extension install/update or startup
chrome.runtime.onInstalled.addListener(() => {
    initializeContextMenus();
});

// Initialize on service worker startup (handles browser restart)
chrome.runtime.onStartup.addListener(() => {
    initializeContextMenus();
});
// Variables for badge polling
let currentUnreadCount = 0;
const ALARM_NAME = 'badgeUpdate';

// Function to fetch unread count from API
async function fetchUnreadCount() {
    try {
        const { apiKey, endpointUrl } = await chrome.storage.local.get(['apiKey', 'endpointUrl']);
                
        if (!apiKey || !endpointUrl) {
            return 0;
        }

        const apiUrl = `${endpointUrl}/api/v1/watch`;
        
        const response = await fetch(apiUrl, {
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("API request failed:", response.status, response.statusText, errorText);
            return 0;
        }

        const data = await response.json();
        
        // Count items where viewed is false
        // The API returns an object with UUID keys, not an array
        let unreadCount = 0;
        if (data && typeof data === 'object') {
            unreadCount = Object.values(data).filter(item => item && item.viewed === false).length;
        }
        return unreadCount;
        
    } catch (error) {
        console.error("Error fetching unread count:", error);
        return 0;
    }
}

// Function to update the badge
async function updateBadge() {
    try {
        const unreadCount = await fetchUnreadCount();
        currentUnreadCount = unreadCount;
       
        if (unreadCount > 0) {
            await chrome.action.setBadgeText({ text: unreadCount.toString() });
            await chrome.action.setBadgeBackgroundColor({ color: '#663399' }); // Dark purple background
            await chrome.action.setBadgeTextColor({ color: '#FFFFFF' }); // White text
        } else {
            await chrome.action.setBadgeText({ text: '' }); // Clear badge
        }
    } catch (error) {
        console.error("Error updating badge:", error);
    }
}

// Function to start polling using alarms
async function startPolling() {
    try {
        // Clear any existing alarm
        await chrome.alarms.clear(ALARM_NAME);
        
        // Update badge immediately
        await updateBadge();
        
        // Set up alarm to trigger every 30 seconds (0.5 minutes)
        await chrome.alarms.create(ALARM_NAME, {
            delayInMinutes: 0.5,
            periodInMinutes: 0.5
        });        
    } catch (error) {
        console.error("Error starting polling:", error);
    }
}

// Function to stop polling
async function stopPolling() {
    try {
        await chrome.alarms.clear(ALARM_NAME);
    } catch (error) {
        console.error("Error stopping polling:", error);
    }
}

// Check if API is configured and start/stop polling accordingly
async function checkConfigAndStartPolling() {
    try {
        const { apiKey, endpointUrl } = await chrome.storage.local.get(['apiKey', 'endpointUrl']);
        
        if (apiKey && endpointUrl) {
            await startPolling();
        } else {
            await stopPolling();
            // Clear badge if not configured
            await chrome.action.setBadgeText({ text: '' });
        }
    } catch (error) {
        console.error("Error checking configuration:", error);
    }
}

// Listen for alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === ALARM_NAME) {
        await updateBadge();
    }
});

// Listen for storage changes to start/stop polling when API is configured
chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && (changes.apiKey || changes.endpointUrl)) {
        await checkConfigAndStartPolling();
    }
});

// Start polling when extension loads (if configured)
checkConfigAndStartPolling();

// Background script to handle messages from content script
chrome.runtime.onMessage.addListener(
    function (message, sender, sendResponse) {
        try {
            if (message.type === 'showNotification') {
                chrome.notifications.create({
                    type: message.data.type,
                    iconUrl: message.data.iconUrl,
                    title: message.data.title,
                    message: message.data.message
                });
            } else if (message.type === 'updateBadgeFromDiffPage') {
                // Handle immediate badge update when user visits diff page
                updateBadge().then(() => {
                    sendResponse({ success: true });
                }).catch(error => {
                    console.error("Error updating badge from diff page:", error);
                    sendResponse({ success: false, error: error.message });
                });
                return true; // Keep message channel open for async response
            }
        } catch (error) {
            console.error("Error handling message:", error);
            sendResponse({ success: false, error: error.message });
        }
    }
)

// Handle connection from content script
chrome.runtime.onConnect.addListener(function(port) {
    try {
        if (port.name === "xpathSelector") {
            // Listen for XPath updates from content script
            port.onMessage.addListener(function(message) {
                try {
                    if (message.action === "updateXPath") {
                        // Forward the XPath to the popup if it's open
                        chrome.runtime.sendMessage({
                            action: "updateXPathInPopup",
                            xpath: message.xpath
                        }).catch(error => {
                            // This is expected if popup is closed, no need to log an error
                            if (!error.message.includes("receiving end does not exist")) {
                                console.error("Error forwarding XPath:", error);
                            }
                        });
                    }
                } catch (error) {
                    console.error("Error handling port message:", error);
                }
            });
        }
    } catch (error) {
        console.error("Error in connection listener:", error);
    }
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    try {
        if (request.command === "getAPIKeyValue") {
            // Use the tabId sent in the message
            if (request.tabId) {
                chrome.scripting.executeScript({
                    target: {tabId: request.tabId},
                    function: getElementsContent
                }).then(([result]) => {
                    if (result && result.result !== undefined) {
                        sendResponse(result.result);
                    } else {
                        sendResponse(null);
                    }
                }).catch(error => {
                    console.error("Script execution failed: " + error.message);
                    sendResponse(false);
                });
                return true; // Keep the message channel open for the async response
            }
        }
    } catch (error) {
        console.error("Error in message listener:", error);
        sendResponse(false);
    }
    return false; // Only keep the channel open for async responses
});

function getElementsContent() {
    try {
        const element = document.getElementById("api-key");
        if (element) {
            return element.textContent;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error in getElementsContent:", error);
        return null;
    }
}