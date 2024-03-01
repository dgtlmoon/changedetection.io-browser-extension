// If we are on something that looks like the CDIO API page, use it as auto-config

// The API config page always ends in "/settings/#api", when this page is detected we can auto-configure ourself by using
// the API key and current URL.

// So you just only need to visit your API settings page and then this extension will know where to send its own data to.
// This is a lot easier than copying and pasting text and URLs and hoping that you get it correct :)


function attemptAPIAccessSync() {

    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {        // tabs is an array of tab objects representing the currently open tabs
        if (tabs && tabs.length > 0) {

            // Get the URL of the active tab
            const url = tabs[0].url.toLowerCase().trim();

            chrome.runtime.sendMessage({command: "getAPIKeyValue"}, function (response) {
                if (url.endsWith('/settings#api') && response !== false) {
                    const save_endpointUrl = url.replace('/settings#api', '');
                    chrome.storage.local.set({
                        apiKey: response.trim(),
                        endpointUrl: save_endpointUrl
                    }, function () {
                        document.body.classList.add('state-synced')
                        document.body.classList.remove('state-unsynced')
                        chrome.runtime.sendMessage({
                            type: 'showNotification',
                            data: {
                                type: 'basic',
                                iconUrl: '/images/shortcut-128.png',
                                title: 'Success',
                                message: 'Now synchronised with your changedetection.io, happy change detecting!'
                            }
                        });
                    });
                } else {
                    alert("Cant find your API information, are you on the API Tab in the Settings Page of your changedetection.io tool?")
                }
            });

        }
    });
}

chrome.storage.local.get(['apiKey', 'endpointUrl']).then(({apiKey, endpointUrl}) => {
    if (apiKey === undefined || endpointUrl === undefined) {
        var button = document.getElementById("sync-access");
        button.addEventListener("click", attemptAPIAccessSync);
    }
})
