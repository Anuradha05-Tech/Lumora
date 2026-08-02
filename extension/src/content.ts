/// <reference types="chrome" />

// Listen for messages from the side panel to control the YouTube player
chrome.runtime.onMessage.addListener((message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (message.action === 'seekTo') {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      videoElement.currentTime = message.time;
      videoElement.play();
      sendResponse({ status: 'success' });
    } else {
      sendResponse({ status: 'error', message: 'Video element not found' });
    }
  }
  return true;
});
