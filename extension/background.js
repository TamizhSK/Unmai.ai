// Background script for context menu
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu item
  chrome.contextMenus.create({
    id: "analyzeWithVerity",
    title: "Analyze with Verity AI",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "analyzeWithVerity") {
    // Store the selected text in storage
    chrome.storage.local.set({
      "selectedText": info.selectionText
    });
  }
});