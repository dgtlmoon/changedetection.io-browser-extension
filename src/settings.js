// Update the status so the user can see the general config

chrome.storage.local.get(['apiKey', 'endpointUrl']).then(({apiKey, endpointUrl}) => {
const replaceWithAsterisks = str => str.length > 6 ? str.slice(0, 6) + '*'.repeat(str.length - 6) : str;

    if (apiKey !== undefined) {
        document.querySelector('#info_apiKey').textContent = replaceWithAsterisks(apiKey);
        document.querySelector('#info_endpointUrl').textContent = endpointUrl;
    }
});


document.getElementById('clear-settings').onclick = async function () {
    chrome.storage.local.remove(["apiKey", "endpointUrl"], function () {
        chrome.runtime.sendMessage({
                        type: 'showNotification',
                        data: {
                            type: 'basic',
                            iconUrl: '/images/shortcut.png',
                            title: 'Cleared',
                            message: 'Settings were cleared, you should re-visit the API settings page to resync access.'
                        }
        });
    })
    location.reload()
};


document.getElementById('test-connection').onclick = function () {
    chrome.storage.local.get(['apiKey', 'endpointUrl']).then(({apiKey, endpointUrl}) => {

        // Fetch data from the API
        fetch(endpointUrl + "/api/v1/systeminfo", {
            method: 'GET',
            headers: {
                'x-api-key': apiKey
            }
        })
            .then(response => {
                if (!response.ok) {
                    chrome.notifications.create({
                        type: 'basic',
                        iconUrl: '/images/shortcut.png',
                        title: 'Error :(',
                        message: `Network error :(`
                    });
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Handle the API response data here
                chrome.runtime.sendMessage({
                        type: 'showNotification',
                        data: {
                            type: 'basic',
                            iconUrl: '/images/shortcut.png',
                            title: 'Success!',
                            message: `Looks like it works! version reported was "${data['version']}"`
                        }
                });
            })
            .catch(error => {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: '/images/shortcut.png',
                    title: 'Error :(',
                    message: `Error: ${error}`
                });
                console.error('There was a problem with the fetch operation:', error);
            });
    });
};
