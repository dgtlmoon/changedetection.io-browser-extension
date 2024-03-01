// Function to retrieve cookies for the current tab
function getCookiesForCurrentTab(callback) {
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        // Get cookies for the current tab
        chrome.cookies.getAll({url: tabs[0].url}, function (cookies) {
            callback(cookies);
        });
    });
}

// Function to convert cookies to Netscape cookiejar format string
function convertCookiesToNetscapeFormat(cookies) {
    let cookieString = "# Netscape HTTP Cookie File\n";
    cookies.forEach(function (cookie) {
        cookieString += cookie.domain + "\t";
        cookieString += "TRUE\t"; // Domain flag
        cookieString += cookie.path + "\t";
        cookieString += (cookie.secure ? "TRUE" : "FALSE") + "\t";
        cookieString += cookie.expirationDate + "\t";
        cookieString += cookie.name + "\t";
        cookieString += cookie.value + "\n";
    });
    return cookieString;
}

// Function to handle the click event on the menu item
function menuItemClicked(info, tab) {
    getCookiesForCurrentTab(function (cookies) {
        const cookieString = convertCookiesToNetscapeFormat(cookies);
        console.log("Cookies in Netscape format:");
        console.log(cookieString);
        // Do something with the cookieString, for example, copy it to the clipboard
    });
}

console.log("registering menu context")
// Create the context menu item
chrome.contextMenus.create({
    title: "Get Cookies in Netscape Format",
    contexts: ["link"],
    onclick: menuItemClicked
});
