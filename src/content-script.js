// Content script to handle element selection mode
let selectorModeActive = false;
let highlightedElement = null;
let port = null;
let isConnecting = false;

// Helper function to escape XPath string values
function escapeXPathString(str) {
    // If the string contains no quotes, wrap in double quotes
    if (!str.includes('"') && !str.includes("'")) {
        return `"${str}"`;
    }
    // If it contains only double quotes, wrap in single quotes
    if (!str.includes("'")) {
        return `'${str}'`;
    }
    // If it contains only single quotes, wrap in double quotes
    if (!str.includes('"')) {
        return `"${str}"`;
    }
    // If it contains both types of quotes, use concat()
    const parts = str.split('"').map((part, index) => {
        if (index === 0) return `"${part}"`;
        return `'"',"${part}"`;
    });
    return `concat(${parts.join(',')})`;
}

// Initialize connection with the popup
function initPort() {
    // Prevent multiple simultaneous connection attempts
    if (isConnecting || port) {
        return;
    }

    isConnecting = true;
    try {
        port = chrome.runtime.connect({ name: "xpathSelector" });
        isConnecting = false;

        port.onDisconnect.addListener(() => {
            // When popup closes (port disconnects), disable selector mode
            if (selectorModeActive) {
                disableSelectorMode();
            }
            port = null;
            isConnecting = false;
        });
    } catch (error) {
        console.error("Port connection failed:", error);
        port = null;
        isConnecting = false;
    }
}

// Function to generate XPath for an element
function getXPath(element) {
    if (!element) return "";

    // Try using id first if it exists
    if (element.id) {
        return `//*[@id=${escapeXPathString(element.id)}]`;
    }
    
    // If no id, traverse the DOM tree to create a path
    const parts = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
        let siblings = Array.from(element.parentNode.children).filter(
            sibling => sibling.nodeName === element.nodeName
        );
        
        if (siblings.length > 1) {
            // If there are multiple siblings with the same tag name, use the index
            const index = siblings.indexOf(element) + 1;
            parts.unshift(`${element.nodeName.toLowerCase()}[${index}]`);
        } else {
            // If it's a unique tag among its siblings
            parts.unshift(element.nodeName.toLowerCase());
        }
        
        element = element.parentNode;
    }
    
    return `//${parts.join('/')}`;
}

// Function to get a more optimized XPath
function getOptimizedXPath(element) {
    if (!element) return "";

    // Try id first
    if (element.id) {
        return `//*[@id=${escapeXPathString(element.id)}]`;
    }

    // Try checking for unique classes
    if (element.classList && element.classList.length > 0) {
        const classesToTry = Array.from(element.classList);
        for (const className of classesToTry) {
            try {
                // Check if this class is unique enough on the page
                const elementsWithClass = document.querySelectorAll(`.${CSS.escape(className)}`);
                if (elementsWithClass.length === 1) {
                    return `//*[contains(@class, ${escapeXPathString(className)})]`;
                }
            } catch (error) {
                console.error("Error checking class uniqueness:", error);
                // Continue with next class if this one fails
            }
        }
    }

    // Try data attributes as they're often unique
    const dataAttributes = Array.from(element.attributes)
        .filter(attr => attr.name.startsWith('data-'));

    for (const attr of dataAttributes) {
        try {
            const selector = `[${CSS.escape(attr.name)}=${CSS.escape(attr.value)}]`;
            const elementsWithAttr = document.querySelectorAll(selector);
            if (elementsWithAttr.length === 1) {
                return `//*[@${attr.name}=${escapeXPathString(attr.value)}]`;
            }
        } catch (error) {
            // Continue with next attribute if this one fails
        }
    }
    
    // If no unique identifiers found, fall back to position-based XPath
    return getXPath(element);
}

// Safely send message to port
function safelySendMessage(message) {
    if (port) {
        try {
            port.postMessage(message);
            return true;
        } catch (error) {
            console.error("Error sending message:", error);
            port = null;
            // Connection lost, try to re-establish but don't retry the message
            // (XPath updates are frequent and losing one message is acceptable)
            initPort();
            return false;
        }
    } else if (!isConnecting) {
        // Try to re-establish connection if lost and not already connecting
        initPort();
    }
    return false;
}

// Function to handle mouseover event
function handleMouseOver(e) {
    if (!selectorModeActive) return;
    
    e.stopPropagation();
    
    // Remove highlight from previous element
    if (highlightedElement) {
        try {
            highlightedElement.style.outline = '';
        } catch (error) {
            console.error("Error removing highlight:", error);
        }
    }
    
    // Highlight current element
    highlightedElement = e.target;
    try {
        highlightedElement.style.outline = '2px solid red';
    } catch (error) {
        console.error("Error applying highlight:", error);
    }
    
    // Generate XPath and send it to popup
    try {
        const xpath = getOptimizedXPath(highlightedElement);
        safelySendMessage({ action: "updateXPath", xpath: xpath });
    } catch (error) {
        console.error("Error generating or sending XPath:", error);
    }
}

// Function to handle click event during selector mode
function handleClick(e) {
    if (!selectorModeActive) return;
    
    // Prevent the default click behavior
    e.preventDefault();
    e.stopPropagation();
    
    // If we have a highlighted element, lock in the selection
    if (highlightedElement) {
        try {
            const xpath = getOptimizedXPath(highlightedElement);
            safelySendMessage({ action: "updateXPath", xpath: xpath });
        } catch (error) {
            console.error("Error handling click:", error);
        }
    }
    
    // Return false to prevent any bubbling
    return false;
}

// Function to handle keydown event to exit selector mode with Space key
function handleKeyDown(e) {
    if (!selectorModeActive) return;
    
    // Exit selector mode if Space key is pressed
    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        disableSelectorMode();
        return false;
    }
}

// Function to toggle selector mode
function toggleSelectorMode() {
    selectorModeActive = !selectorModeActive;
    
    if (selectorModeActive) {
        // Add event listeners when selector mode is active
        document.addEventListener('mouseover', handleMouseOver, true);
        document.addEventListener('click', handleClick, true);
        document.addEventListener('keydown', handleKeyDown, true);
        document.body.style.cursor = 'crosshair';
    } else {
        // Remove event listeners and reset styles when selector mode is inactive
        disableSelectorMode();
    }
}

// Function to forcefully disable selector mode
function disableSelectorMode() {
    if (selectorModeActive) {
        selectorModeActive = false;
        
        // Remove event listeners and reset styles
        try {
            document.removeEventListener('mouseover', handleMouseOver, true);
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('keydown', handleKeyDown, true);
            document.body.style.cursor = '';
        } catch (error) {
            console.error("Error removing event listeners:", error);
        }
        
        // Remove highlight from element
        if (highlightedElement) {
            try {
                highlightedElement.style.outline = '';
                highlightedElement = null;
            } catch (error) {
                console.error("Error removing highlight on disable:", error);
            }
        }
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (message.action === "toggleSelectorMode") {
            toggleSelectorMode();
            sendResponse({ status: "ok", selectorModeActive: selectorModeActive });
        } else if (message.action === "disableSelectorMode") {
            disableSelectorMode();
            sendResponse({ status: "ok", selectorModeActive: false });
        } else if (message.action === "getSelectorModeStatus") {
            sendResponse({ status: "ok", selectorModeActive: selectorModeActive });
        }
    } catch (error) {
        console.error("Error handling message:", error);
        sendResponse({ status: "error", error: error.message });
    }
    return true;
});

// Function to check if current page is a diff page and notify background
function checkForDiffPage() {
    try {
        // Get the current URL
        const currentUrl = window.location.href.toLowerCase();

        // Check if URL contains /diff/ path
        if (currentUrl.includes('/diff/')) {

            // Send message to background script to update badge immediately
            chrome.runtime.sendMessage({
                type: 'updateBadgeFromDiffPage'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error sending diff page message:", chrome.runtime.lastError);
                }
            });
        }
    } catch (error) {
        console.error("Error checking for diff page:", error);
    }
}

// Check for diff page on initial load
checkForDiffPage();

// Listen for URL changes (for single-page applications)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        checkForDiffPage();
    }
}).observe(document, { subtree: true, childList: true });

// Also listen for popstate events (back/forward navigation)
window.addEventListener('popstate', checkForDiffPage);

// Initialize the port connection
initPort();