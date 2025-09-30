// ===== background.js - 複数翻訳API + app.htmlウィンドウ管理 =====

let currentAppWindowId = null;

// メッセージ受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // -------- 翻訳API処理 --------
  if (request.action === 'translate' || request.action === 'testApi') {
    const { apiUrl, text, apiType } = request;
    const testText = text || 'Hello';

    let requestBody, headers, parseResponse;

    switch (apiType) {
      case 'libretranslate':
        requestBody = JSON.stringify({ q: testText, source: 'en', target: 'ja', format: 'text' });
        headers = { 'Content-Type': 'application/json' };
        parseResponse = data => data.translatedText;
        break;
      case 'deepl':
        requestBody = JSON.stringify({ text: [testText], source_lang: 'EN', target_lang: 'JA' });
        headers = { 'Content-Type': 'application/json' };
        parseResponse = data => data.translations[0].text;
        break;
      case 'gas':
        requestBody = JSON.stringify({ text: testText, source: 'en', target: 'ja' });
        headers = { 'Content-Type': 'application/json' };
        parseResponse = data => data.translatedText || data.text || data.result;
        break;
      default:
        requestBody = JSON.stringify({ text: testText, q: testText, source: 'en', target: 'ja' });
        headers = { 'Content-Type': 'application/json' };
        parseResponse = data => data.translatedText || data.text || data.result || (data.translations && data.translations[0]?.text) || '翻訳不可';
    }

    fetch(apiUrl, { method: 'POST', headers, body: requestBody })
      .then(response => response.ok ? response.json() : response.text().then(t => { throw new Error(`HTTP ${response.status}: ${t}`) }))
      .then(data => sendResponse({ success: true, translation: parseResponse(data) }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // 非同期応答
  }

  // -------- app.htmlウィンドウ処理 --------
  if (request.action === 'openAppWindow') {
    chrome.storage.local.get('appWindowBounds', (data) => {
      const bounds = data.appWindowBounds || { width: 1200, height: 850, left: 100, top: 100 };

      chrome.windows.create({
        url: 'app.html',
        type: 'popup',
        width: bounds.width,
        height: bounds.height,
        left: bounds.left,
        top: bounds.top,
      }, (win) => {
        currentAppWindowId = win.id;
      });
    });

    return true;
  }
});

// ===== ウィンドウ位置・サイズの保存 =====
chrome.windows.onBoundsChanged.addListener(win => {
  if (win.id === currentAppWindowId) {
    chrome.windows.get(win.id, w => {
      if (chrome.runtime.lastError) return;
      chrome.storage.local.set({
        appWindowBounds: {
          left: w.left,
          top: w.top,
          width: w.width,
          height: w.height,
        }
      });
    });
  }
});

chrome.windows.onRemoved.addListener(winId => {
  if (winId === currentAppWindowId) {
    currentAppWindowId = null;
    // 閉じたときは情報取得不可なので保存しない
  }
});
