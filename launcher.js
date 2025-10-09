// launcher.js - ランチャー用スクリプト（直接編集対応）
document.addEventListener('DOMContentLoaded', () => {
    const launchWindowBtn = document.getElementById('launch-window');
    const launchTabBtn = document.getElementById('launch-tab');
    const copyBtn = document.getElementById('copy-btn');
    const workingTextarea = document.getElementById('working-textarea');
    const charCount = document.getElementById('char-count');
    
    let saveTimeout = null;
    
    // 別ウィンドウで開く
    launchWindowBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: "openAppWindow" });
    });
    
    // 新しいタブで開く
    launchTabBtn.addEventListener('click', () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('app.html')
        });
    });
    
    // コピーボタン
    copyBtn.addEventListener('click', async () => {
        const text = workingTextarea.value;
        
        if (text.trim()) {
            try {
                await navigator.clipboard.writeText(text);
                copyBtn.textContent = '✓';
                setTimeout(() => copyBtn.textContent = '📋', 1000);
            } catch (err) {
                console.error('コピー失敗:', err);
            }
        }
    });
    
    // テキストエリアの入力時
    workingTextarea.addEventListener('input', () => {
        updateCharCount();
        autoResizeTextarea();
        // 入力の度に保存（デバウンス付き）
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveWorkingPrompt();
        }, 500);
    });
    
    // フォーカスが外れたら即座に保存
    workingTextarea.addEventListener('blur', () => {
        clearTimeout(saveTimeout);
        saveWorkingPrompt();
    });
    
    // ポップアップが閉じる前に保存
    window.addEventListener('beforeunload', () => {
        saveWorkingPrompt();
    });
    
    // 文字数更新
    function updateCharCount() {
        const length = workingTextarea.value.length;
        charCount.textContent = `${length}文字`;
    }
    
    // テキストエリアの高さを自動調整
    function autoResizeTextarea() {
        workingTextarea.style.height = 'auto';
        const newHeight = Math.min(workingTextarea.scrollHeight, 300);
        workingTextarea.style.height = newHeight + 'px';
    }
    
    // 作業中プロンプトを保存
    function saveWorkingPrompt() {
        const text = workingTextarea.value;
        try {
            chrome.storage.local.set({ workingPrompt: text });
            console.log('保存成功:', text.length + '文字');
        } catch (err) {
            console.error('保存失敗:', err);
        }
    }
    
    // 作業中プロンプトを読み込み
    async function loadWorkingPrompt() {
        const result = await chrome.storage.local.get(['workingPrompt']);
        const text = result.workingPrompt || '';
        workingTextarea.value = text;
        updateCharCount();
        autoResizeTextarea();
    }
    
    // 初回読み込み
    loadWorkingPrompt();
    
    // ストレージ変更時に自動更新（他のタブからの変更を反映）
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.workingPrompt) {
            // 自分が編集中でない場合のみ更新
            if (document.activeElement !== workingTextarea) {
                workingTextarea.value = changes.workingPrompt.newValue || '';
                updateCharCount();
                autoResizeTextarea();
            }
        }
    });
});