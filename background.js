// background.js - 複数翻訳API対応版
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    const { apiUrl, text, apiType } = request;

    // APIタイプに応じてリクエストを構築
    let requestBody, headers, parseResponse;

    switch (apiType) {
      case 'libretranslate':
        requestBody = JSON.stringify({
          q: text,
          source: 'en',
          target: 'ja',
          format: 'text'
        });
        headers = { 'Content-Type': 'application/json' };
        parseResponse = (data) => data.translatedText;
        break;

      case 'deepl':
        // DeepL API形式
        requestBody = JSON.stringify({
          text: [text],
          source_lang: 'EN',
          target_lang: 'JA'
        });
        headers = { 'Content-Type': 'application/json' };
        parseResponse = (data) => data.translations[0].text;
        break;

      case 'gas':
        // Google Apps Script形式
        requestBody = JSON.stringify({
          text: text,
          source: 'en',
          target: 'ja'
        });
        headers = { 'Content-Type': 'application/json' };
        parseResponse = (data) => data.translatedText || data.text || data.result;
        break;

      default:
        // 汎用形式（自動判定）
        requestBody = JSON.stringify({
          text: text,
          q: text,
          source: 'en',
          target: 'ja',
          source_lang: 'EN',
          target_lang: 'JA'
        });
        headers = { 'Content-Type': 'application/json' };
        parseResponse = (data) => {
          // 複数のフィールドを試す
          return data.translatedText || 
                 data.text || 
                 data.result || 
                 (data.translations && data.translations[0]?.text) ||
                 JSON.stringify(data);
        };
    }

    fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: requestBody
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`HTTP ${response.status}: ${text}`);
        });
      }
      return response.json();
    })
    .then(data => {
      const translation = parseResponse(data);
      sendResponse({ success: true, translation });
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });

    return true; // 非同期応答を有効化
  }

  if (request.action === 'testApi') {
    // テストリクエスト
    const { apiUrl, apiType } = request;
    const testText = 'Hello';

    let requestBody, headers, parseResponse;

    switch (apiType) {
      case 'libretranslate':
        requestBody = JSON.stringify({
          q: testText,
          source: 'en',
          target: 'ja',
          format: 'text'
        });
        headers = { 'Content-Type': 'application/json' };
        parseResponse = (data) => data.translatedText;
        break;

      case 'deepl':
        requestBody = JSON.stringify({
          text: [testText],
          source_lang: 'EN',
          target_lang: 'JA'
        });
        headers = { 'Content-Type': 'application/json' };
        parseResponse = (data) => data.translations[0].text;
        break;

      case 'gas':
        requestBody = JSON.stringify({
          text: testText,
          source: 'en',
          target: 'ja'
        });
        headers = { 'Content-Type': 'application/json' };
        parseResponse = (data) => data.translatedText || data.text || data.result;
        break;

      default:
        requestBody = JSON.stringify({
          text: testText,
          q: testText,
          source: 'en',
          target: 'ja'
        });
        headers = { 'Content-Type': 'application/json' };
        parseResponse = (data) => {
          return data.translatedText || 
                 data.text || 
                 data.result || 
                 (data.translations && data.translations[0]?.text) ||
                 'テスト成功（翻訳結果を取得できませんでした）';
        };
    }

    fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: requestBody
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`HTTP ${response.status}: ${text}`);
        });
      }
      return response.json();
    })
    .then(data => {
      const translation = parseResponse(data);
      sendResponse({ success: true, translation });
    })
    .catch(error => {
      sendResponse({ success: false, error: error.message });
    });

    return true;
  }
});
