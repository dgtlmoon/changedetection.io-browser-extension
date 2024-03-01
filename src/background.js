/**
 * Update icon badge counter on active page
 */

// Background script to handle messages from content script
chrome.runtime.onMessage.addListener(
    function (message, sender, sendResponse) {
        if (message.type === 'showNotification') {
            chrome.notifications.create({
                type: message.data.type,
                iconUrl: message.data.iconUrl,
                title: message.data.title,
                message: message.data.message
            });
        }
    }
);

