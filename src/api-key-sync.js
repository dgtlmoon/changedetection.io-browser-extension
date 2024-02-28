// If we are on something that looks like the CDIO API page, use it as auto-config

// Function to handle anchor changes
function detectSyncAPIPage() {
    const hash = window.location.hash;
    var keyElement = document.getElementById('api-key');
    const baseUrl = window.location.href.trim();
    // background handler will figure out the baseUrl
    if (location.href.endsWith('/settings#api') && keyElement) {
        chrome.storage.local.get(['apiKey', 'endpointUrl']).then(({apiKey, endpointUrl}) => {
            if (apiKey === undefined || endpointUrl === undefined) {
                const save_endpointUrl = location.href.toLowerCase().trim().replace('/settings#api', '');
                chrome.storage.local.set({
                    apiKey: keyElement.textContent.trim(),
                    endpointUrl: save_endpointUrl
                }, function () {
                    chrome.runtime.sendMessage({
                        type: 'showNotification',
                        data: {
                            type: 'basic',
                            iconUrl: '/images/shortcut.png',
                            title: 'Success',
                            message: 'Now synchronised with your changedetection.io, happy change detecting!'
                        }
                    });
                });

            }
        });
    }
    console.log(`Found API information, request syncing to ${baseUrl}.`)
    document.body.classList.add('state-synced')
    document.body.classList.remove('state-unsynced')

}

if (location.href.toLowerCase().trim().includes('/settings')) {
    chrome.storage.local.get(['apiKey', 'endpointUrl']).then(({apiKey, endpointUrl}) => {

        // Only attempt to sync if we dont have any access defined
        if (apiKey === undefined) {
            console.log('Scanninng for API key..')
            var originalHashChangeFunction = window.onhashchange;

            function myHashChangeFunction() {
                // Invoke the original function if it exists (so we dont break existing sites)
                if (typeof originalHashChangeFunction === 'function') {
                    originalHashChangeFunction();
                }
                detectSyncAPIPage();
            }

            window.onhashchange = myHashChangeFunction;
            detectSyncAPIPage()
        }
    });
}