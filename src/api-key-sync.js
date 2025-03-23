// If we are on something that looks like the CDIO API page, use it as auto-config

// The API config page always ends in "/settings/#api", when this page is detected we can auto-configure ourself by using
// the API key and current URL.

// So you just only need to visit your API settings page and then this extension will know where to send its own data to.
// This is a lot easier than copying and pasting text and URLs and hoping that you get it correct :)


function attemptAPIAccessSync(triggerElem) {
    try {
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
            if (!tabs || tabs.length === 0) {
                console.error("No active tabs found");
                alert("Cannot access active tab. Please try again.");
                return;
            }

            // Get the URL of the active tab
            const url = tabs[0].url.toLowerCase().trim();
            const tabId = tabs[0].id;
            
            // Update button text to indicate checking
            if (triggerElem) {
                triggerElem.innerHTML = `Checking for access key <span class="material-symbols-outlined">sync_lock</span>`;
            }
            
            // Set up callback to handle response from background script
            chrome.runtime.sendMessage({command: "getAPIKeyValue", tabId: tabId}, function (response) {
                // Handle runtime errors
                if (chrome.runtime.lastError) {
                    console.error("Runtime error:", chrome.runtime.lastError);
                    alert("Error accessing page content. Please make sure you're on the API settings page.");
                    return;
                }
                
                // This callback will be called with the result from sendResponse in background.js
                if (url.endsWith('#api') && response !== false) {
                    // Validate API key is not empty after trimming
                    const apiKey = response ? response.trim() : '';
                    if (!apiKey) {
                        alert("API key is empty or invalid. Please make sure the API key is properly displayed on the page.");
                        return;
                    }
                    
                    // Use URL constructor to get base URL safely
                    try {
                        const urlObj = new URL(url);
                        const save_endpointUrl = urlObj.origin + urlObj.pathname.replace(/\/settings\/?$/, '');
                        
                        chrome.storage.local.set({
                            apiKey: apiKey,
                            endpointUrl: save_endpointUrl
                        }, function () {
                            if (chrome.runtime.lastError) {
                                alert("Error saving settings: " + chrome.runtime.lastError.message);
                                return;
                            }
                            
                            // Update UI state
                            document.body.classList.add('state-synced');
                            document.body.classList.remove('state-unsynced');
                            
                            // Show notification
                            try {
                                chrome.runtime.sendMessage({
                                    type: 'showNotification',
                                    data: {
                                        type: 'basic',
                                        iconUrl: '/images/shortcut-128.png',
                                        title: 'Success',
                                        message: 'Now synchronised with your changedetection.io, happy change detecting!'
                                    }
                                });
                            } catch (error) {
                                console.error("Error showing notification:", error);
                                // Try direct notification as fallback
                                try {
                                    chrome.notifications.create({
                                        type: 'basic',
                                        iconUrl: '/images/shortcut-128.png',
                                        title: 'Success',
                                        message: 'Now synchronised with your changedetection.io, happy change detecting!'
                                    });
                                } catch (notifError) {
                                    console.error("Both notification methods failed:", notifError);
                                    alert('Now synchronised with your changedetection.io, happy change detecting!');
                                }
                            }
                        });
                    } catch (e) {
                        console.error("URL parsing error:", e);
                        alert("The endpoint URL is invalid. Please check the URL format.");
                    }
                } else {
                    alert("Can't find your API information. Are you on the API Tab in the Settings Page of your changedetection.io tool?");
                }
            });
        });
    } catch (error) {
        console.error("Error in attemptAPIAccessSync:", error);
        alert("An unexpected error occurred. Please try again.");
    }
}

// Setup the button listener when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    try {
        chrome.storage.local.get(['apiKey', 'endpointUrl'])
            .then(({apiKey, endpointUrl}) => {
                if (apiKey === undefined || endpointUrl === undefined) {
                    const button = document.getElementById("sync-access");
                    if (button) {
                        button.addEventListener("click", function(event) {
                            attemptAPIAccessSync(event.target);
                        });
                    }
                }
            })
            .catch(error => {
                console.error("Error accessing storage:", error);
            });
    } catch (error) {
        console.error("Error in DOMContentLoaded listener:", error);
    }
});