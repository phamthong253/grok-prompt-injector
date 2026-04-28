'use strict';
// Content script chạy trên trang Grok
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ ok: true, url: window.location.href });
  }
  return true;
});
