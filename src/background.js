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
)

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.command === "getAPIKeyValue") {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.scripting.executeScript({
                target: {tabId: tabs[0].id},
                function: getElementsContent
            }).then(([result]) => {
                sendResponse(result.result);
            }).catch(error => {
                console.error("Script execution failed: " + error.message);
                sendResponse(false);
            });
        });
        return true; // Required to indicate that sendResponse will be called asynchronously

    }
});

function getElementsContent() {
    const element = document.getElementById("api-key");
    if (element) {
        return element.textContent;
    } else {
        return null;
    }
}