// Discovery and caching of the processors (change detection modes) the changedetection.io server offers.
// Shared by the popup (radio list) and the background service worker (right-click submenu).
//
// The list lives in chrome.storage.local under 'processors', it is refreshed from /api/v1/systeminfo
// when the API access is synced, when the service worker starts and whenever the popup opens.
// Anything that shows processors listens for storage changes, so a refresh updates it everywhere.

// Used before the first refresh, and for servers older than the 'processors' field in systeminfo
const DEFAULT_PROCESSORS = [
    {name: 'text_json_diff', description: 'Webpage Text/HTML, JSON and PDF changes'},
    {name: 'restock_diff', description: 'Re-stock Detection for single product pages'}
];

// Extra help text for the processors we know about, shown under the radio button in the popup
const PROCESSOR_HINTS = {
    'text_json_diff': 'Monitors a page for changes in text',
    'restock_diff': 'For pages that contains only ONE product'
};

function normaliseProcessors(list) {
    if (!Array.isArray(list)) {
        return null;
    }
    const processors = list
        .filter(p => p && typeof p.name === 'string' && p.name.trim().length > 0)
        .map(p => ({
            name: p.name.trim(),
            description: (typeof p.description === 'string' && p.description.trim()) || p.name.trim()
        }));
    return processors.length > 0 ? processors : null;
}

async function getCachedProcessors() {
    try {
        const {processors} = await chrome.storage.local.get(['processors']);
        return normaliseProcessors(processors) || DEFAULT_PROCESSORS;
    } catch (error) {
        console.error('Error reading cached processors:', error);
        return DEFAULT_PROCESSORS;
    }
}

// Ask the server which processors are enabled and store them if they changed.
// When the server can't be reached the cached list is kept as it is.
async function refreshProcessors() {
    const {apiKey, endpointUrl} = await chrome.storage.local.get(['apiKey', 'endpointUrl']);
    if (!apiKey || !endpointUrl) {
        return getCachedProcessors();
    }

    try {
        const baseUrl = endpointUrl.replace(/\/+$/, '');
        const response = await fetch(`${baseUrl}/api/v1/systeminfo`, {
            headers: {'x-api-key': apiKey},
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) {
            throw new Error(`systeminfo returned HTTP ${response.status}`);
        }
        const data = await response.json();
        // Older changedetection.io versions don't report their processors
        const processors = normaliseProcessors(data['processors']) || DEFAULT_PROCESSORS;

        const {processors: cached} = await chrome.storage.local.get(['processors']);
        if (JSON.stringify(cached) !== JSON.stringify(processors)) {
            await chrome.storage.local.set({processors});
        }
        return processors;
    } catch (error) {
        console.warn('Could not refresh the processor list, keeping the cached one:', error);
        return getCachedProcessors();
    }
}
