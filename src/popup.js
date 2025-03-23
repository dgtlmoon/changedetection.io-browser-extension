
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
            };
            tagsList.appendChild(tagItem);
        });
        
        // Show the tags list
        tagsList.style.display = 'block';
    })
    .catch(error => {
        console.error('Failed to fetch tags:', error);
    });
}

function submitURL(endpointUrl, apiKey, watch_url, tag, mode) {
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
        
        // Hide tags list when clicking outside
        document.addEventListener('click', function(event) {
            if (event.target !== tagInput && !event.target.closest('#tags-list')) {
                document.getElementById('tags-list').style.display = 'none';
            }
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

            submitURL(endpointUrl,
                apiKey,
                url,
                document.getElementById('tag').value,
                document.querySelector('input[name="processor"]:checked').value
            );
        });
    });

};

