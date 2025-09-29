// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    const { apiUrl, text } = request;

    const requestBody = JSON.stringify({
      q: text,
      source: 'en',   // 元の言語（必要に応じてUIで切替可能）
      target: 'ja',   // 翻訳先の言語
      format: 'text'
    });

    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`HTTP ${response.status}: ${text}`);
        });
      }
      return response.json(); // LibreTranslate は必ず JSON
    })
    .then(data => {
      const translation = data.translatedText;
      sendResponse({ success: true, translation });
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });

    return true; // 非同期応答を有効化
  }
});
