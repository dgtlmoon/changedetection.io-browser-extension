// Update UI state based on saved configuration
document.addEventListener('DOMContentLoaded', function() {
    try {
        chrome.storage.local.get(['apiKey', 'endpointUrl'])
            .then(({apiKey, endpointUrl}) => {
                if (apiKey === undefined) {
                    document.body.classList.add('state-unsynced');
                    const syncButton = document.getElementById("sync-access");
                    if (syncButton) {
                        syncButton.innerHTML = `Sync API Access <span class="material-symbols-outlined">sync_lock</span>`;
                    }
                } else {
                    document.body.classList.add('state-synced');
                    const watchListLink = document.getElementById('watch-list-link');
                    if (watchListLink && endpointUrl) {
                        watchListLink.href = endpointUrl;
                    }
                }
            })
            .catch(error => {
                console.error("Error accessing storage:", error);
                // If we can't access storage, assume unsynced state
                document.body.classList.add('state-unsynced');
                const syncButton = document.getElementById("sync-access");
                if (syncButton) {
                    syncButton.innerHTML = `Sync API Access <span class="material-symbols-outlined">sync_lock</span>`;
                }
            });
    } catch (error) {
        console.error("Error in general.js initialization:", error);
    }
});