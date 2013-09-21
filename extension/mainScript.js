var tabs = {};
var popupUrl = chrome.extension.getURL("page.html");

chrome.pageAction.onClicked.addListener(function(tab) {
    var tabInfo = tabs[tab.id];
    
    // Close the previous one, before opening a new one.
    if (tabInfo.openedTabId !== undefined) {
        chrome.tabs.remove(tabInfo.openedTabId);
    }
    
    chrome.tabs.create({"url": popupUrl}, function(createdTab) {
        tabInfo.openedTabId = createdTab.id;
        chrome.tabs.sendMessage(createdTab.id, {
            method: "dataFound",
            tabInfo: tabInfo
        });
    });
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    // Return if page isn't complete.
    if (changeInfo.status !== "complete") {
        return;
    }
    
    // Return if not HTTP or HTTPS.
    if (tab.url.indexOf("http://") < 0 && tab.url.indexOf("https://") < 0
            && tab.url.indexOf("file://") < 0) {
        return;
    }
    
    // Return if already scanned.
    if (tabs[tabId] !== undefined) {
        showPageAction(tabs[tabId]);
        return;
    }
    
    // Prevent rescan.
    tabs[tabId] = null;
    
    chrome.tabs.executeScript(tabId, {file: "scanPage.js"}, function (results) {
        if (results === undefined) {
            return;
        }
        
        var tabInfo = {
            tabId: tab.id,
            url: tab.url,
            title: tab.title,
            found: results[0]
        };
        tabs[tabInfo.tabId] = tabInfo;
        
        if (tabInfo.found.length > 0) {
            showPageAction(tabInfo);
        }
    });
});

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    delete tabs[tabId];
});

function buildTitle(tabInfo) {
    var f = tabInfo.found;
    var len = f.length;
    var ret = "Found " + f[0];
    for (var i = 1; i < len - 1; i++) {
        ret += ", " + f[i];
    }
    if (len >= 2) {
        ret += " and " + f[len - 1];
    }
    ret  += " in this page.";
    return ret;
}

function showPageAction(tabInfo) {
    chrome.pageAction.show(tabInfo.tabId);
    chrome.pageAction.setTitle({
        tabId: tabInfo.tabId,
        title: buildTitle(tabInfo)
    });
}
