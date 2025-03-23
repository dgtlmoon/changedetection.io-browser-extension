// Update the status so the user can see the general config
document.addEventListener('DOMContentLoaded', function() {
    try {
        chrome.storage.local.get(['apiKey', 'endpointUrl'])
            .then(({apiKey, endpointUrl}) => {
                const replaceWithAsterisks = str => {
                    if (!str) return '';
                    return str.length > 6 ? str.slice(0, 6) + '*'.repeat(str.length - 6) : str;
                };

                if (apiKey !== undefined) {
                    const apiKeyElement = document.querySelector('#info_apiKey');
                    const endpointUrlElement = document.querySelector('#info_endpointUrl');
                    
                    if (apiKeyElement) {
                        apiKeyElement.textContent = replaceWithAsterisks(apiKey);
                    }
                    
                    if (endpointUrlElement) {
                        endpointUrlElement.textContent = endpointUrl || '';
                    }
                }
            })
            .catch(error => {
                console.error("Error getting storage items:", error);
            });

        // Set up clear settings button
        const clearSettingsButton = document.getElementById('clear-settings');
        if (clearSettingsButton) {
            clearSettingsButton.addEventListener('click', clearSettings);
        }
        
        // Set up test connection button
        const testConnectionButton = document.getElementById('test-connection');
        if (testConnectionButton) {
            testConnectionButton.addEventListener('click', testConnection);
        }
    } catch (error) {
        console.error("Error in DOMContentLoaded:", error);
    }
});

// Function to clear settings
function clearSettings() {
    try {
        chrome.storage.local.remove(["apiKey", "endpointUrl"], function() {
            if (chrome.runtime.lastError) {
                console.error("Error clearing settings:", chrome.runtime.lastError);
                showNotification('Error', 'Failed to clear settings: ' + chrome.runtime.lastError.message);
                return;
            }
            
            showNotification(
                'Cleared',
                'Settings were cleared, you should re-visit the API settings page to resync access.'
            );
            
            // Reload page
            setTimeout(() => {
                location.reload();
            }, 1000);
        });
    } catch (error) {
        console.error("Error in clearSettings:", error);
        showNotification('Error', 'An unexpected error occurred');
    }
}

// Function to test connection
function testConnection() {
    try {
        chrome.storage.local.get(['apiKey', 'endpointUrl'])
            .then(({apiKey, endpointUrl}) => {
                if (!apiKey || !endpointUrl) {
                    showNotification('Error', 'API key or endpoint URL is missing');
                    return;
                }

                // Ensure endpoint URL doesn't have trailing slash before adding path
                const baseUrl = endpointUrl.replace(/\/+$/, '');
                const systemInfoUrl = `${baseUrl}/api/v1/systeminfo`;

                // Fetch data from the API
                fetch(systemInfoUrl, {
                    method: 'GET',
                    headers: {
                        'x-api-key': apiKey
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        showNotification('Error :(', 'Network error :(');
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    // Handle the API response data here
                    showNotification(
                        'Success!', 
                        `Looks like it works! version reported was "${data['version']}"`
                    );
                })
                .catch(error => {
                    console.error('There was a problem with the fetch operation:', error);
                    showNotification('Error :(', `Error: ${error.message || error}`);
                });
            })
            .catch(error => {
                console.error("Error getting storage items:", error);
                showNotification('Error', 'Could not access storage');
            });
    } catch (error) {
        console.error("Error in testConnection:", error);
        showNotification('Error', 'An unexpected error occurred');
    }
}

// Helper function to show notifications
function showNotification(title, message) {
    try {
        // Try background script first
        chrome.runtime.sendMessage({
            type: 'showNotification',
            data: {
                type: 'basic',
                iconUrl: '/images/shortcut.png',
                title: title,
                message: message
            }
        }).catch(error => {
            // If background script method fails, try direct method
            console.error("Error sending notification via background:", error);
            
            try {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: '/images/shortcut.png',
                    title: title,
                    message: message
                });
            } catch (directError) {
                console.error("Error sending notification directly:", directError);
                alert(`${title}: ${message}`);
            }
        });
    } catch (error) {
        console.error("Error in showNotification:", error);
        // Last resort - use alert
        alert(`${title}: ${message}`);
    }
}