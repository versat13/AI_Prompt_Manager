// launcher.js - ランチャー用スクリプト

document.addEventListener('DOMContentLoaded', () => {
    const launchWindowBtn = document.getElementById('launch-window');
    const launchTabBtn = document.getElementById('launch-tab');
    
    // 別ウィンドウで開く（background.js に依頼）
    launchWindowBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "openAppWindow" });
    });
    
    // 新しいタブで開く（直接タブを開いてOK）
    launchTabBtn.addEventListener('click', () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('app.html')
        });
    });
});
