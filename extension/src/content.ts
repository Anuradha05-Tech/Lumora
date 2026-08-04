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

// Explain Selection Feature
let explainButton: HTMLButtonElement | null = null;

// Inject styles for the floating button
const style = document.createElement('style');
style.textContent = `
  .lumora-explain-btn {
    position: absolute;
    z-index: 999999;
    background: #3b82f6;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 6px 12px;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease-out;
    animation: lumora-pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
  .lumora-explain-btn:hover {
    background: #2563eb;
    transform: translateY(-1px) scale(1.02);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }
  @keyframes lumora-pop {
    0% { opacity: 0; transform: scale(0.9) translateY(10px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
`;
document.head.appendChild(style);

document.addEventListener('mouseup', (e) => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();

  if (explainButton) {
    explainButton.remove();
    explainButton = null;
  }

  if (text && text.length > 0) {
    explainButton = document.createElement('button');
    explainButton.innerHTML = '✨ Explain with Lumora';
    explainButton.className = 'lumora-explain-btn';
    
    explainButton.style.left = `${e.pageX + 10}px`;
    explainButton.style.top = `${e.pageY - 30}px`;
    
    explainButton.addEventListener('click', (ev) => {
      ev.stopPropagation(); 
      chrome.runtime.sendMessage({ action: 'explainSelection', text: text });
      if (explainButton) explainButton.remove();
      explainButton = null;
      selection?.removeAllRanges();
    });
    
    document.body.appendChild(explainButton);
  }
});

document.addEventListener('mousedown', (e) => {
  if (explainButton && e.target !== explainButton) {
    explainButton.remove();
    explainButton = null;
  }
});
