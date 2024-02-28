document.getElementById('results').innerHTML = "";

function submitURL(endpointUrl, apiKey, watch_url, tag) {
    var manifest = chrome.runtime.getManifest();

    const endpoint = endpointUrl + `/api/v1/watch?from_extension_v=${manifest.version}`;

    console.log(`Submitting "${watch_url}" watch to "${endpoint}"`)
    data = {'url': watch_url}
    if (tag.trim().length > 0) {
        data['tag'] = tag.trim()
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
document.getElementById('watch').onclick = function () {
    // @todo test it works for single window
    chrome.storage.local.get(['apiKey', 'endpointUrl']).then(async ({apiKey, endpointUrl}) => {
        var url;
        chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {        // tabs is an array of tab objects representing the currently open tabs
            if (tabs && tabs.length > 0) {
                // Get the URL of the active tab
                url = tabs[0].url;
            }

            submitURL(endpointUrl, apiKey, url, document.getElementById('tag').value);
        });
    });

};

