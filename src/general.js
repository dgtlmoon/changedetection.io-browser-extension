chrome.storage.local.get(['apiKey', 'endpointUrl']).then(({apiKey, endpointUrl}) => {
    if (apiKey === undefined) {
        document.body.classList.add('state-unsynced')
        document.getElementById("sync-access").innerHTML=`Sync API Access <span class="material-symbols-outlined">sync_lock</span>`;
    } else {
        document.body.classList.add('state-synced')
        const w_link = document.getElementById('watch-list-link')
        if (w_link) {
            w_link.href = endpointUrl;
        }
    }
});