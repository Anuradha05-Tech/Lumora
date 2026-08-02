/// <reference types="chrome" />

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: any) => console.error(error));

chrome.tabs.onUpdated.addListener((tabId: number, _info: any, tab: chrome.tabs.Tab) => {
  if (!tab.url) return;
  const url = new URL(tab.url);
  
  if (url.origin === 'https://www.youtube.com') {
    // Enable the side panel on youtube.com
    chrome.sidePanel.setOptions({
      tabId,
      path: 'index.html',
      enabled: true
    });
  } else {
    // Disable the side panel on other sites
    chrome.sidePanel.setOptions({
      tabId,
      enabled: false
    });
  }
});
