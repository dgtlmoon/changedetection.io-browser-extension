/**
 * Update icon badge counter on active page
 */

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
            }
        } catch (error) {
            console.error("Error handling message:", error);
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