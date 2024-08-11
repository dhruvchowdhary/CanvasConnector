chrome.runtime.onInstalled.addListener(() => {
  console.log("Canvas Classmate Finder extension installed");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "runClicked") {
    console.log("Received runClicked message from popup");
    // Example: Execute a content script on the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ["content.js"],
      });
    });
  }
});
