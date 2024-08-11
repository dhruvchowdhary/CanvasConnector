document.getElementById("run-button").addEventListener("click", () => {
  console.log("Run button clicked");

  // Just send a message to the background script to check if this part works
  chrome.runtime.sendMessage({ action: "runClicked" });
});
