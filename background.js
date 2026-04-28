// Mở side panel khi click vào icon extension
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Cho phép side panel trên tất cả các tab
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Lắng nghe message từ content script để download file
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DOWNLOAD_FILE') {
    chrome.downloads.download({
      url: msg.url,
      filename: msg.filename,
      saveAs: false
    }, (downloadId) => {
      sendResponse({ ok: true, downloadId });
    });
    return true; // async response
  }
});
