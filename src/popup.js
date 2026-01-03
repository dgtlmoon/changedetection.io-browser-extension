// Helper function to add timeout to fetch requests
function fetchWithTimeout(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    return fetch(url, {
        ...options,
        signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
}

// Helper function to validate XPath filter
function validateXPath(xpath) {
    if (!xpath || typeof xpath !== 'string') {
        return { valid: false, error: 'XPath is empty or invalid type' };
    }

    const trimmed = xpath.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: 'XPath is empty' };
    }

    // Check for excessive length (arbitrary limit of 1000 chars)
    if (trimmed.length > 1000) {
        return { valid: false, error: 'XPath is too long (max 1000 characters)' };
    }

    // Basic XPath syntax validation - must start with / or //
    if (!trimmed.startsWith('/') && !trimmed.startsWith('(')) {
        return { valid: false, error: 'XPath must start with / or // or be wrapped in parentheses' };
    }

    // Check for balanced brackets
    const openBrackets = (trimmed.match(/\[/g) || []).length;
    const closeBrackets = (trimmed.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
        return { valid: false, error: 'XPath has unbalanced square brackets' };
    }

    // Check for balanced parentheses
    const openParens = (trimmed.match(/\(/g) || []).length;
    const closeParens = (trimmed.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
        return { valid: false, error: 'XPath has unbalanced parentheses' };
    }

    return { valid: true, xpath: trimmed };
}

// Fetch tags from the API
function fetchTags(endpointUrl, apiKey) {
    // Ensure endpoint URL doesn't have trailing slash before adding path
    const baseUrl = endpointUrl.replace(/\/+$/, '');
    const tagsEndpoint = `${baseUrl}/api/v1/tags`;

    fetchWithTimeout(tagsEndpoint, {
        method: 'GET',
        headers: {
            'x-api-key': apiKey
        }
    }, 15000)
    .then(response => {
        if (!response.ok) {
            throw new Error('Error fetching tags');
        }
        return response.json();
    })
    .then(tagsData => {
        // Sort tags alphabetically by title
        let sortedTags = [];
        for (const [uuid, tag] of Object.entries(tagsData)) {
            // Validate tag has a title property
            if (!tag || typeof tag.title !== 'string') {
                console.warn('Invalid tag format received:', tag);
                continue;
            }
            sortedTags.push({
                uuid: uuid,
                title: tag.title
            });
        }
        sortedTags.sort((a, b) => a.title.localeCompare(b.title));
        
        // Populate tags list
        const tagsList = document.getElementById('tags-list');
        if (!tagsList) {
            console.error('Tags list element not found');
            return;
        }
        tagsList.innerHTML = '';
        
        if (sortedTags.length === 0) {
            tagsList.style.display = 'none';
            const tagsHeading = document.getElementById('tags-heading');
            if (tagsHeading) {
                tagsHeading.style.display = 'none';
            }
            return;
        }
        
        // Create clickable tags
        sortedTags.forEach(tag => {
            const tagItem = document.createElement('div');
            tagItem.className = 'tag-item';
            tagItem.textContent = tag.title;
            tagItem.dataset.uuid = tag.uuid;
            tagItem.onclick = function() {
                const tagInput = document.getElementById('tag');
                if (tagInput) {
                    tagInput.value = this.textContent;
                }
                tagsList.style.display = 'none';
                const tagsHeading = document.getElementById('tags-heading');
                if (tagsHeading) {
                    tagsHeading.style.display = 'none';
                }
            };
            tagsList.appendChild(tagItem);
        });
        
        // Show the tags list and heading
        tagsList.style.display = 'block';
        const tagsHeading = document.getElementById('tags-heading');
        if (tagsHeading) {
            tagsHeading.style.display = 'block';
        }
    })
    .catch(error => {
        if (error.name === 'AbortError') {
            console.error('Tags fetch timed out:', error);
        } else {
            console.error('Failed to fetch tags:', error);
        }
    });
}

function submitURL(endpointUrl, apiKey, watch_url, tag, mode, includeFilter) {
    if (!endpointUrl || !apiKey || !watch_url) {
        console.error("Missing required parameters for submitURL");
        showErrorNotification("Missing required parameters");
        return;
    }

    try {
        var manifest = chrome.runtime.getManifest();

        // Ensure endpoint URL doesn't have trailing slash before adding path
        const baseUrl = endpointUrl.replace(/\/+$/, '');
        const endpoint = `${baseUrl}/api/v1/watch?from_extension_v=${manifest.version}`;

        console.log(`Submitting "${watch_url}" watch to "${endpoint}"`);
        const data = {'url': watch_url};

        // Validate tag before adding it to the request
        const trimmedTag = tag ? tag.trim() : '';
        if (trimmedTag.length > 0) {
            // Prevent excessively long tags (arbitrary limit of 100 chars)
            if (trimmedTag.length > 100) {
                showErrorNotification('Tag is too long (max 100 characters)');
                return;
            }
            data['tag'] = trimmedTag;
        }
        
        // Add include_filter if provided and mode is text_json_diff
        if (mode === 'text_json_diff' && includeFilter && includeFilter.trim().length > 0) {
            const validation = validateXPath(includeFilter);
            if (!validation.valid) {
                showErrorNotification(`Invalid XPath: ${validation.error}`);
                return;
            }
            data['include_filters'] = [validation.xpath];
        }
        
        // Default is text_json_diff, also covers the case where their API doesn't support adding with "processor"
        if (mode !== 'text_json_diff') {
            data['processor'] = mode;
        }

        // Fetch data from the API
        fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify(data)
        }, 30000)
        .then(response => {
            if (!response.ok) {
                showErrorNotification("Network error :(");
                throw new Error('Error in network response');
            }
            return response.json();
        })
        .then(data => {
            // Handle the API response data here
            showSuccessNotification("Saved.");
            // Safely construct the edit URL
            const baseUrl = endpointUrl.replace(/\/+$/, '');
            const editUrl = new URL(`${baseUrl}/edit/${encodeURIComponent(data['uuid'])}`);
            const container = document.getElementById('results');
            if (container) {
                container.innerHTML = `<p style="font-weight: bold;"><a target=_new href="${editUrl.href}">Edit your new watch here!</a></p>`;
            }
        })
        .catch(error => {
            if (error.name === 'AbortError') {
                showErrorNotification('Request timed out. Please try again.');
            } else {
                showErrorNotification(`Error: ${error.message || error}`);
            }
            console.error('There was a problem with the fetch operation:', error);
        });
    } catch (error) {
        showErrorNotification(`Error: ${error.message || error}`);
        console.error('Exception in submitURL:', error);
    }
}

// Helper function to show error notifications
function showErrorNotification(message) {
    try {
        chrome.runtime.sendMessage({
            type: 'showNotification',
            data: {
                type: 'basic',
                iconUrl: '/images/shortcut.png',
                title: 'Error :(',
                message: message
            }
        });
    } catch (error) {
        console.error("Failed to show error notification:", error);
        // Try using direct notifications API as fallback
        try {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: '/images/shortcut.png',
                title: 'Error :(',
                message: message
            });
        } catch (nestedError) {
            console.error("Both notification methods failed:", nestedError);
        }
    }
}

// Helper function to show success notifications
function showSuccessNotification(message) {
    try {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: '/images/shortcut.png',
            title: 'Success!',
            message: message
        });
    } catch (error) {
        console.error("Failed to show success notification:", error);
    }
}

// Function to toggle XPath selector mode
function toggleSelectorMode() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs.length > 0) {
            try {
                chrome.tabs.sendMessage(tabs[0].id, { action: "toggleSelectorMode" }, function(response) {
                    // Handle potential error in response
                    if (chrome.runtime.lastError) {
                        console.error("Error sending toggleSelectorMode message:", chrome.runtime.lastError);
                        return;
                    }
                    
                    // Toggle class on body based on selector mode state
                    if (response && response.selectorModeActive !== undefined) {
                        if (response.selectorModeActive) {
                            document.body.classList.add('selector-mode-enabled');
                        } else {
                            document.body.classList.remove('selector-mode-enabled');
                        }
                    }
                });
            } catch (error) {
                console.error("Exception in toggleSelectorMode:", error);
            }
        }
    });
}

// Function to handle processor radio button changes
function handleProcessorChange() {
    try {
        const processorRadio = document.querySelector('input[name="processor"]:checked');
        if (!processorRadio) return;
        
        const selectedProcessor = processorRadio.value;
        const textJsonDiffSelected = selectedProcessor === 'text_json_diff';
        const includeFilterContainer = document.getElementById('include-filter-container');
        const includeFilterInput = document.getElementById('include_filter');
        
        if (includeFilterContainer) {
            includeFilterContainer.style.display = textJsonDiffSelected ? 'block' : 'none';
        }
        
        if (!textJsonDiffSelected && includeFilterInput) {
            // Reset the XPath input value when switching to a different processor
            includeFilterInput.value = '';
            
            // Disable selector mode if it's active when switching to a different processor
            disableSelectorMode();
        }
    } catch (error) {
        console.error("Error in handleProcessorChange:", error);
    }
}

// Function to disable selector mode
function disableSelectorMode() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs.length > 0) {
            try {
                chrome.tabs.sendMessage(tabs[0].id, { action: "disableSelectorMode" }, function(response) {
                    if (chrome.runtime.lastError) {
                        console.error("Error disabling selector mode:", chrome.runtime.lastError);
                    }
                });
            } catch (error) {
                console.error("Exception in disableSelectorMode:", error);
            }
        }
    });
}

// Listen for XPath updates from background script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    try {
        if (message.action === "updateXPathInPopup" && message.xpath) {
            const includeFilterInput = document.getElementById('include_filter');
            if (includeFilterInput) {
                includeFilterInput.value = message.xpath;
            }
        }
    } catch (error) {
        console.error("Error handling message:", error);
    }
});

document.addEventListener('DOMContentLoaded', function() {
    try {
        // Check if selector mode is active when popup opens
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs.length > 0) {
                try {
                    chrome.tabs.sendMessage(tabs[0].id, { action: "getSelectorModeStatus" }, function(response) {
                        if (chrome.runtime.lastError) {
                            // Content script might not be ready yet, which is normal
                            console.log("Content script not ready:", chrome.runtime.lastError);
                            return;
                        }
                        
                        if (response && response.selectorModeActive) {
                            document.body.classList.add('selector-mode-enabled');
                        } else {
                            document.body.classList.remove('selector-mode-enabled');
                        }
                    });
                } catch (error) {
                    console.error("Error checking selector mode status:", error);
                }
            }
        });

        // Setup tag input focus event
        const tagInput = document.getElementById('tag');
        if (tagInput) {
            tagInput.addEventListener('focus', function() {
                chrome.storage.local.get(['apiKey', 'endpointUrl'])
                    .then(({apiKey, endpointUrl}) => {
                        if (apiKey && endpointUrl) {
                            fetchTags(endpointUrl, apiKey);
                        }
                    })
                    .catch(error => {
                        console.error("Error getting storage items:", error);
                    });
            });
            
            // Hide tags list and heading when clicking outside
            document.addEventListener('click', function(event) {
                const tagsList = document.getElementById('tags-list');
                const tagsHeading = document.getElementById('tags-heading');
                
                if (event.target !== tagInput && !event.target.closest('#tags-list')) {
                    if (tagsList) tagsList.style.display = 'none';
                    if (tagsHeading) tagsHeading.style.display = 'none';
                }
            });
        }
        
        // Setup processor radio buttons change event
        const processorRadios = document.querySelectorAll('input[name="processor"]');
        processorRadios.forEach(radio => {
            radio.addEventListener('change', handleProcessorChange);
        });
        
        // Initial call to set the correct display
        handleProcessorChange();
        
        // Setup selector mode button click event
        const selectorModeButton = document.getElementById('selector-mode');
        if (selectorModeButton) {
            selectorModeButton.addEventListener('click', function() {
                toggleSelectorMode();
            });
        }
        
        // Setup space key to toggle selector mode
        document.addEventListener('keydown', function(e) {
            // Check if space key is pressed
            if ((e.key === ' ' || e.code === 'Space') && !e.target.matches('input[type="text"], textarea')) {
                // Check if the text/HTML processor is selected
                const processorRadio = document.querySelector('input[name="processor"]:checked');
                if (!processorRadio) return;
                
                const selectedProcessor = processorRadio.value;
                const textJsonDiffSelected = selectedProcessor === 'text_json_diff';
                const includeFilterContainer = document.getElementById('include-filter-container');
                
                if (textJsonDiffSelected && includeFilterContainer && 
                    includeFilterContainer.style.display !== 'none') {
                    e.preventDefault();
                    toggleSelectorMode();
                }
            }
        });
        
        // Setup watch button
        const watchButton = document.getElementById('watch');
        if (watchButton) {
            watchButton.addEventListener('click', handleWatchButtonClick);
        }
    } catch (error) {
        console.error("Error in DOMContentLoaded:", error);
    }
});

function handleWatchButtonClick() {
    try {
        chrome.storage.local.get(['apiKey', 'endpointUrl'])
            .then(({apiKey, endpointUrl}) => {
                chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
                    if (tabs && tabs.length > 0) {
                        // Get the URL of the active tab
                        const url = tabs[0].url;
                        
                        // Get the selected processor value
                        const processorRadio = document.querySelector('input[name="processor"]:checked');
                        if (!processorRadio) {
                            showErrorNotification("No processor selected");
                            return;
                        }
                        
                        const processorValue = processorRadio.value;
                        
                        // Only pass include_filter if the text_json_diff processor is selected
                        const includeFilterInput = document.getElementById('include_filter');
                        const includeFilter = (processorValue === 'text_json_diff' && includeFilterInput) ? 
                            includeFilterInput.value : null;
                        
                        const tagInput = document.getElementById('tag');
                        const tagValue = tagInput ? tagInput.value : '';
                        
                        submitURL(
                            endpointUrl,
                            apiKey,
                            url,
                            tagValue,
                            processorValue,
                            includeFilter
                        );
                    } else {
                        showErrorNotification("No active tab found");
                    }
                });
            })
            .catch(error => {
                console.error("Error getting storage items:", error);
                showErrorNotification("Could not access storage");
            });
    } catch (error) {
        console.error("Error in watch button handler:", error);
        showErrorNotification("An error occurred");
    }
}