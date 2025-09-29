// launcher.js - ランチャー用スクリプト

document.addEventListener('DOMContentLoaded', () => {
    const launchWindowBtn = document.getElementById('launch-window');
    const launchTabBtn = document.getElementById('launch-tab');
    
    // 別ウィンドウで開く
    launchWindowBtn.addEventListener('click', () => {
        chrome.windows.create({
            url: chrome.runtime.getURL('popup.html'),
            type: 'popup',
            width: 1200,
            height: 850,
            left: 100,
            top: 100
        });
    });
    
    // 新しいタブで開く
    launchTabBtn.addEventListener('click', () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html')
        });
    });
});