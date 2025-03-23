
// Fetch tags from the API
function fetchTags(endpointUrl, apiKey) {
    // Ensure endpoint URL doesn't have trailing slash before adding path
    const baseUrl = endpointUrl.replace(/\/+$/, '');
    const tagsEndpoint = `${baseUrl}/api/v1/tags`;
    
    fetch(tagsEndpoint, {
        method: 'GET',
        headers: {
            'x-api-key': apiKey
        }
    })
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
            document.getElementById('tags-heading').style.display = 'none';
            return;
        }
        
        // Create clickable tags
        sortedTags.forEach(tag => {
            const tagItem = document.createElement('div');
            tagItem.className = 'tag-item';
            tagItem.textContent = tag.title;
            tagItem.dataset.uuid = tag.uuid;
            tagItem.onclick = function() {
                document.getElementById('tag').value = this.textContent;
                tagsList.style.display = 'none';
                document.getElementById('tags-heading').style.display = 'none';
            };
            tagsList.appendChild(tagItem);
        });
        
        // Show the tags list and heading
        tagsList.style.display = 'block';
        document.getElementById('tags-heading').style.display = 'block';
    })
    .catch(error => {
        console.error('Failed to fetch tags:', error);
    });
}

function submitURL(endpointUrl, apiKey, watch_url, tag, mode, includeFilter) {
    var manifest = chrome.runtime.getManifest();

    // Ensure endpoint URL doesn't have trailing slash before adding path
    const baseUrl = endpointUrl.replace(/\/+$/, '');
    const endpoint = `${baseUrl}/api/v1/watch?from_extension_v=${manifest.version}`;

    console.log(`Submitting "${watch_url}" watch to "${endpoint}"`)
    data = {'url': watch_url}

    // Validate tag before adding it to the request
    const trimmedTag = tag ? tag.trim() : '';
    if (trimmedTag.length > 0) {
        // Prevent excessively long tags (arbitrary limit of 100 chars)
        if (trimmedTag.length > 100) {
            alert('Tag is too long (max 100 characters)');
            return;
        }
        data['tag'] = trimmedTag;
    }
    
    // Add include_filter if provided and mode is text_json_diff
    if (mode === 'text_json_diff' && includeFilter && includeFilter.trim().length > 0) {
        data['include_filters'] = [includeFilter.trim()];
    }
    
    // Default is text_json_diff, also covers the case where their API doesn't support adding with "processor"
    if (mode !== 'text_json_diff') {
        data['processor'] = mode;
    }

    // Fetch data from the API
    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        },
        body: JSON.stringify(data)
    })
        .then(response => {
            if (!response.ok) {
                chrome.runtime.sendMessage({
                        type: 'showNotification',
                        data: {
                            type: 'basic',
                            iconUrl: '/images/shortcut.png',
                            title: 'Error :(',
                            message: `Network error :(`
                        }
                });
                throw new Error('Error in network response');
            }
            return response.json();
        })
        .then(data => {
            // Handle the API response data here
            chrome.notifications.create({
                type: 'basic',
                iconUrl: '/images/shortcut.png',
                title: 'Success!',
                message: `Saved.`
            });
            const link = `${endpointUrl}/edit/${data['uuid']}`;
            var container = document.getElementById('results');
            container.innerHTML = `<p style="font-weight: bold;"><a target=_new href="${link}">Edit your new watch here!</a></p>`;

        })
        .catch(error => {
            chrome.runtime.sendMessage({
                        type: 'showNotification',
                        data: {
                            type: 'basic',
                            iconUrl: '/images/shortcut.png',
                            title: 'Error :(',
                            message: `Error: ${error}`
                        }
            });
            console.error('There was a problem with the fetch operation:', error);
        });
}

// Could be re-used but just with extra cookie information stored
// set on class, and if ID=...
// Add event listener for the tag input to show the tags list
// Function to toggle XPath selector mode
function toggleSelectorMode() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "toggleSelectorMode" });
        }
    });
}

// Function to handle processor radio button changes
function handleProcessorChange() {
    const textJsonDiffSelected = document.getElementById('processor-0').checked;
    const includeFilterContainer = document.getElementById('include-filter-container');
    
    if (textJsonDiffSelected) {
        includeFilterContainer.style.display = 'block';
    } else {
        includeFilterContainer.style.display = 'none';
        
        // Disable selector mode if it's active when switching to a different processor
        disableSelectorMode();
    }
}

// Function to disable selector mode
function disableSelectorMode() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs && tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "disableSelectorMode" });
        }
    });
}

// Listen for XPath updates from background script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === "updateXPathInPopup" && message.xpath) {
        const includeFilterInput = document.getElementById('include_filter');
        if (includeFilterInput) {
            includeFilterInput.value = message.xpath;
        }
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // Setup tag input focus event
    const tagInput = document.getElementById('tag');
    if (tagInput) {
        tagInput.addEventListener('focus', function() {
            chrome.storage.local.get(['apiKey', 'endpointUrl']).then(({apiKey, endpointUrl}) => {
                if (apiKey && endpointUrl) {
                    fetchTags(endpointUrl, apiKey);
                }
            });
        });
        
        // Hide tags list and heading when clicking outside
        document.addEventListener('click', function(event) {
            if (event.target !== tagInput && !event.target.closest('#tags-list')) {
                document.getElementById('tags-list').style.display = 'none';
                document.getElementById('tags-heading').style.display = 'none';
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
});

document.getElementById('watch').onclick = function () {
    // @todo test it works for single window
    chrome.storage.local.get(['apiKey', 'endpointUrl']).then(async ({apiKey, endpointUrl}) => {
        var url;
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {        // tabs is an array of tab objects representing the currently open tabs
            if (tabs && tabs.length > 0) {
                // Get the URL of the active tab
                url = tabs[0].url;
            }

            // Get the selected processor value
            const processorValue = document.querySelector('input[name="processor"]:checked').value;
            
            // Only pass include_filter if the text_json_diff processor is selected
            const includeFilter = processorValue === 'text_json_diff' ? 
                document.getElementById('include_filter').value : null;

            submitURL(
                endpointUrl,
                apiKey,
                url,
                document.getElementById('tag').value,
                processorValue,
                includeFilter
            );
        });
    });
};

