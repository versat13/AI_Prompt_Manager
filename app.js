// Popup script for Prompt Manager Extension
// Chrome拡張APIが使えない場合はlocalStorageにフォールバック
const storage = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)
    ? {
        get: (keys, cb) => chrome.storage.local.get(keys, cb),
        set: (items, cb) => chrome.storage.local.set(items, cb),
        remove: (keys, cb) => chrome.storage.local.remove(keys, cb)
    }
    : {
        get: (keys, cb) => {
            let result = {};
            if (Array.isArray(keys)) {
                keys.forEach(k => { result[k] = localStorage.getItem(k); });
            } else if (typeof keys === 'string') {
                result[keys] = localStorage.getItem(keys);
            } else if (typeof keys === 'object') {
                Object.keys(keys).forEach(k => { result[k] = localStorage.getItem(k); });
            }
            cb(result);
        },
        set: (items, cb) => {
            Object.keys(items).forEach(k => localStorage.setItem(k, items[k]));
            if (cb) cb();
        },
        remove: (keys, cb) => {
            if (Array.isArray(keys)) {
                keys.forEach(k => localStorage.removeItem(k));
            } else if (typeof keys === 'string') {
                localStorage.removeItem(keys);
            }
            if (cb) cb();
        }
    };
document.addEventListener('DOMContentLoaded', function () {
    const container = document.querySelector('.container');
    if (container) {
        container.addEventListener('dblclick', function (e) {
            // 右下角付近のみ反応
            const rect = container.getBoundingClientRect();
            const threshold = 32; // 32px以内
            if (
                e.clientX >= rect.right - threshold &&
                e.clientY >= rect.bottom - threshold
            ) {
                container.style.width = '910px';
                container.style.height = '750px';
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', function () {
    let state = {
        parts: [],
        templates: [],
        categories: ['スタイル', 'キャラクター', '背景', '品質向上', 'ネガティブプロンプト', 'カテゴリなし'],
        settings: { translationApiUrl: '',
                    apiType: 'auto' // 'libretranslate', 'deepl', 'gas', 'auto'
        },
        currentPrompt: { en: '', ja: '' },
        categoryStates: {},
        clickedPartIdsInSession: new Set(),
        selectedPartIdsForBulkEdit: new Set(),
        editingPartId: null,
        editingTemplateId: null,
        isApiRegistered: false,
    };

    let jsonConfigs = [];
    let activeConfigIndex = 0;

    const defaultParts = [
        { id: generateId(), en: 'masterpiece, best quality', ja: '最高品質の作品', category: '品質向上' },
        { id: generateId(), en: 'ultra detailed, 8k resolution, photorealistic', ja: '超詳細、8K解像度、フォトリアル', category: '品質向上' },
        { id: generateId(), en: 'a beautiful young woman', ja: '美しい若い女性', category: 'キャラクター' },
    ];

// popup.js - ランチャー専用スクリプト
document.addEventListener('DOMContentLoaded', () => {
    const launchWindowBtn = document.getElementById('launch-window');
    const launchTabBtn = document.getElementById('launch-tab');
    
    launchWindowBtn.addEventListener('click', () => {
        chrome.windows.create({
            url: chrome.runtime.getURL('main.html'),
            type: 'popup',
            width: 1200,
            height: 850
        });
    });
    
    launchTabBtn.addEventListener('click', () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('main.html')
        });
    });
});

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 's':
                    e.preventDefault();
                    const templatesTab = document.getElementById('templates-tab');
                    if (!templatesTab || !templatesTab.classList.contains('active')) {
                        DOMElements.saveTemplateBtn.click();
                    } else {
                        DOMElements.saveEditedTemplateBtn.click();
                    }
                    break;
                case 'c':
                    const creationTab = document.getElementById('creation-tab');
                    if (creationTab && creationTab.classList.contains('active') && !e.target.matches('input, textarea')) {
                        e.preventDefault();
                        DOMElements.copyPromptBtn.click();
                    }
                    break;
            }
        }
        if (e.key === 'Escape') {
            DOMElements.imageModal.style.display = 'none';
            DOMElements.dataEditorModal.style.display = 'none';
        }
    });

    const DOMElements = {
        tabs: document.querySelectorAll('.nav-tab'),
        tabContents: document.querySelectorAll('.tab-content'),
        promptInput: document.getElementById('prompt-input'),
        translationInput: document.getElementById('translation-input'),
        autoTranslateBtn: document.getElementById('auto-translate-btn'),
        categoriesContainer: document.getElementById('categories'),
        clearPromptBtn: document.getElementById('clear-prompt-btn'),
        saveTemplateBtn: document.getElementById('save-template-btn'),
        copyPromptBtn: document.getElementById('copy-prompt-btn'),
        partSearchInput: document.getElementById('part-search-input'),
        partsGrid: document.getElementById('parts-grid'),
        partsGridFilterInput: document.getElementById('parts-grid-filter-input'),
        partsFormTitle: document.getElementById('parts-form-title'),
        editingPartIdInput: document.getElementById('editing-part-id'),
        newPartEnInput: document.getElementById('new-part-en'),
        newPartJaInput: document.getElementById('new-part-ja'),
        newPartCategorySelect: document.getElementById('new-part-category'),
        submitPartBtn: document.getElementById('submit-part-btn'),
        categoryUnifiedList: document.getElementById('category-unified-list'),
        newCategoryInput: document.getElementById('new-category-input'),
        addCategoryBtn: document.getElementById('add-category-btn'),
        templateGrid: document.getElementById('template-grid'),
        templateSearchInput: document.getElementById('template-search-input'),
        templateEditForm: document.getElementById('template-edit-form'),
        editingTemplateIdInput: document.getElementById('editing-template-id'),
        templateTitleInput: document.getElementById('template-title-input'),
        templateDescInput: document.getElementById('template-desc-input'),
        templatePromptInput: document.getElementById('template-prompt-input'),
        templateTranslationInput: document.getElementById('template-translation-input'),
        thumbnailPreview: document.getElementById('thumbnail-preview'),
        thumbnailUpload: document.getElementById('thumbnail-upload'),
        clearThumbnailBtn: document.getElementById('clear-thumbnail-btn'),
        saveEditedTemplateBtn: document.getElementById('save-edited-template-btn'),
        translationApiUrlInput: document.getElementById('translation-api-url-input'),
        testApiBtn: document.getElementById('test-api-btn'),
        saveApiBtn: document.getElementById('save-api-btn'),
        apiTestResult: document.getElementById('api-test-result'),
        importDataInput: document.getElementById('import-data-input'),
        exportDataBtn: document.getElementById('export-data-btn'),
        editRawDataBtn: document.getElementById('edit-raw-data-btn'),
        resetDataBtn: document.getElementById('reset-data-btn'),
        imageModal: document.getElementById('image-modal'),
        modalImage: document.getElementById('modal-image'),
        dataEditorModal: document.getElementById('data-editor-modal'),
        closeDataEditorBtn: document.getElementById('close-data-editor-btn'),
        dataEditorTextarea: document.getElementById('data-editor-textarea'),
        cancelDataEditorBtn: document.getElementById('cancel-data-editor-btn'),
        saveDataFromEditorBtn: document.getElementById('save-data-from-editor-btn'),
        storageWarning: document.getElementById('storage-warning'),
        newJsonNameInput: document.getElementById('new-json-name-input'),
        saveCurrentJsonBtn: document.getElementById('save-current-json-btn'),
        jsonList: document.getElementById('json-list'),
        duplicateJsonBtn: document.getElementById('duplicate-json-btn'),
        renameJsonBtn: document.getElementById('rename-json-btn'),
        apiTypeButtons: document.querySelectorAll('.api-type-btn'),
    };

    // Notification
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type === 'error' ? 'error' : type === 'warning' ? 'warning' : ''}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(notification)) document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Tooltip
    let currentTooltip = null;
    function showTooltip(element, text, x, y) {
        hideTooltip();
        currentTooltip = document.createElement('div');
        currentTooltip.className = 'tooltip';
        currentTooltip.textContent = text;
        document.body.appendChild(currentTooltip);
        currentTooltip.style.left = Math.min(x, window.innerWidth - currentTooltip.offsetWidth - 10) + 'px';
        currentTooltip.style.top = Math.max(10, y - currentTooltip.offsetHeight - 5) + 'px';
        setTimeout(() => {
            if (currentTooltip) currentTooltip.classList.add('show');
        }, 50);
    }
    function hideTooltip() { if (currentTooltip) { currentTooltip.remove(); currentTooltip = null; } }

    // Storage usage watcher
    function checkStorageSize() {
        storage.get(['promptManagerData'], function (result) {
            const data = result.promptManagerData;
            if (data) {
                const sizeKB = (new Blob([data]).size / 1024).toFixed(1);
                const maxSizeKB = 5 * 1024; // 5MB
                const usagePercent = (sizeKB / maxSizeKB * 100).toFixed(1);
                if (sizeKB > maxSizeKB * 0.8) {
                    DOMElements.storageWarning.style.display = 'block';
                    DOMElements.storageWarning.textContent = `ストレージ使用量: ${sizeKB}KB (${usagePercent}%) - 容量不足の可能性があります`;
                    if (sizeKB > maxSizeKB * 0.9) {
                        showNotification('データ容量が上限に近づいています。不要なデータを削除してください。', 'warning');
                    }
                } else {
                    DOMElements.storageWarning.style.display = 'none';
                }
            }
        });
    }

    function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 9); }

    function saveData() {
        const orderedTemplates = state.templates.map(t => ({
            id: t.id,
            name: t.name,
            prompt: t.prompt,
            translation: t.translation,
            desc: t.desc,
            thumbnail: t.thumbnail
        }));
        const dataToSave = {
            settings: state.settings, // apiTypeも含まれる
            categories: state.categories,
            parts: state.parts,
            templates: orderedTemplates,
        };
        storage.set({
            promptManagerData: JSON.stringify(dataToSave),
            promptManagerCurrentPrompt: JSON.stringify(state.currentPrompt)
        }, checkStorageSize);
    }

    function loadData() {
        storage.get(['promptManagerData', 'promptManagerCurrentPrompt'], function (result) {
            const data = result.promptManagerData ? JSON.parse(result.promptManagerData) : null;
            const currentPrompt = result.promptManagerCurrentPrompt ? JSON.parse(result.promptManagerCurrentPrompt) : null;
            if (data) {
                state.parts = data.parts || [];
                state.templates = (data.templates || []).map(t => ({
                    id: t.id,
                    name: t.name,
                    prompt: t.prompt,
                    translation: t.translation,
                    desc: t.desc,
                    thumbnail: t.thumbnail
                }));
                state.categories = data.categories || ['スタイル', 'キャラクター', '背景', '品質向上', 'ネガティブプロンプト', 'カテゴリなし'];
                state.settings = data.settings || { translationApiUrl: '', apiType: 'auto' };
            }
            if (state.parts.length === 0) state.parts = defaultParts;
            if (currentPrompt) state.currentPrompt = currentPrompt;
            DOMElements.translationApiUrlInput.value = state.settings.translationApiUrl;
            state.isApiRegistered = !!state.settings.translationApiUrl;
            
            // APIタイプボタンのアクティブ状態を復元
            DOMElements.apiTypeButtons.forEach(btn => {
                if (btn.dataset.type === state.settings.apiType) {
                    btn.classList.add('active');
                }
            });
        });
    }


    // JSON config management
    function loadJsonConfigs() {
        storage.get(['jsonConfigs', 'activeConfigIndex'], function (result) {
            const saved = result.jsonConfigs;
            if (saved) {
                try {
                    jsonConfigs = JSON.parse(saved);
                    // テンプレートのキー順を統一
                    jsonConfigs.forEach(cfg => {
                        if (cfg.data && cfg.data.templates) {
                            cfg.data.templates = cfg.data.templates.map(t => ({
                                id: t.id,
                                name: t.name,
                                prompt: t.prompt,
                                translation: t.translation,
                                desc: t.desc,
                                thumbnail: t.thumbnail
                            }));
                        }
                        // settingsにapiTypeが無い場合は追加
                        if (cfg.data && cfg.data.settings && !cfg.data.settings.apiType) {
                            cfg.data.settings.apiType = 'auto';
                        }
                    });
                } catch (e) {
                    console.error('jsonConfigs読み込みエラー:', e);
                    // エラー時はデフォルトを作成
                    jsonConfigs = createDefaultConfig();
                }
            } else {
                // 初回起動時
                jsonConfigs = createDefaultConfig();
            }
            
            const activeIndex = result.activeConfigIndex;
            if (activeIndex !== undefined && activeIndex !== null) {
                activeConfigIndex = parseInt(activeIndex);
            }
            
            // アクティブなConfigが存在しない場合は0にリセット
            if (!jsonConfigs[activeConfigIndex]) {
                activeConfigIndex = 0;
            }
            
            if (jsonConfigs[activeConfigIndex]) {
                const config = jsonConfigs[activeConfigIndex].data;
                state.settings = config.settings || { translationApiUrl: '', apiType: 'auto' };
                state.categories = config.categories || ['スタイル', 'キャラクター', '背景', '品質向上', 'ネガティブプロンプト', 'カテゴリなし'];
                state.parts = config.parts || defaultParts;
                state.templates = config.templates || [];
                DOMElements.translationApiUrlInput.value = state.settings.translationApiUrl;
                state.isApiRegistered = !!state.settings.translationApiUrl;
            }
        });
    }
    function saveJsonConfigs() {
        storage.set({
            jsonConfigs: JSON.stringify(jsonConfigs),
            activeConfigIndex: activeConfigIndex.toString()
        });
    }
    function updateCurrentConfig() {
        if (jsonConfigs[activeConfigIndex]) {
            jsonConfigs[activeConfigIndex].data = {
                settings: state.settings, // apiTypeも含む
                categories: state.categories,
                parts: state.parts,
                templates: state.templates,
            };
            saveJsonConfigs();
        }
    }
    function renderJsonConfigs() {
        DOMElements.jsonList.innerHTML = jsonConfigs.map((config, index) => `
                <div class="json-item ${index === activeConfigIndex ? 'active' : ''}" data-index="${index}" draggable="true">
                    <span class="drag-handle" title="ドラッグで並び替え">&#9776;</span>
                    <span class="json-item-name">${config.name}</span>
                    <div class="json-item-actions">
                        <button class="btn btn-secondary btn-sm" data-action="switch" data-index="${index}">切替</button>
                        <button class="btn btn-danger btn-sm" data-action="delete" data-index="${index}" ${jsonConfigs.length === 1 ? 'disabled' : ''}>削除</button>
                    </div>
                </div>
            `).join('');
        initializeJsonConfigsDragAndDrop();
        function initializeJsonConfigsDragAndDrop() {
            const jsonItems = DOMElements.jsonList.querySelectorAll('.json-item');
            let draggedElement = null;
            jsonItems.forEach((item) => {
                item.addEventListener('dragstart', () => { draggedElement = item; item.classList.add('dragging'); });
                item.addEventListener('dragend', () => { item.classList.remove('dragging'); draggedElement = null; });
                item.addEventListener('dragover', (e) => e.preventDefault());
                item.addEventListener('drop', (e) => {
                    e.preventDefault();
                    if (draggedElement && draggedElement !== item) {
                        const draggedIndex = parseInt(draggedElement.dataset.index);
                        const targetIndex = parseInt(item.dataset.index);
                        const [draggedConfig] = jsonConfigs.splice(draggedIndex, 1);
                        jsonConfigs.splice(targetIndex, 0, draggedConfig);
                        saveJsonConfigs();
                        renderJsonConfigs();
                    }
                });
            });
        }
    }
    function createDefaultConfig() {
        const orderedTemplates = state.templates.map(t => ({
            id: t.id,
            name: t.name,
            prompt: t.prompt,
            translation: t.translation,
            desc: t.desc,
            thumbnail: t.thumbnail
        }));
        
        return [{
            name: 'デフォルト',
            data: {
                settings: { 
                    translationApiUrl: '', 
                    apiType: 'auto' 
                },
                categories: ['スタイル', 'キャラクター', '背景', '品質向上', 'ネガティブプロンプト', 'カテゴリなし'],
                parts: defaultParts.map((p) => ({ ...p, id: generateId() })),
                templates: orderedTemplates,
            },
        }];
    }


    async function resizeImage(file, maxSize = 400) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let { width, height } = img;
                    if (width > height) {
                        if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
                    } else {
                        if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    // quality引数（デフォルト0.85）
                    const quality = arguments.length > 2 ? arguments[2] / 100 : 0.85;
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function renderAll() {
        renderCategoriesAndParts();
        renderPartsGrid();
        renderCategoryManagement();
        updatePartCategorySelect();
        renderTemplates();
        updateBulkEditUI();
        renderJsonConfigs();
        DOMElements.promptInput.value = state.currentPrompt.en;
        DOMElements.translationInput.value = state.currentPrompt.ja;
    }

    function renderCategoriesAndParts() {
        const query = DOMElements.partSearchInput.value.toLowerCase();
        DOMElements.categoriesContainer.innerHTML = state.categories.map((categoryName) => {
            const isExpanded = state.categoryStates[categoryName] || false;
            const categoryParts = state.parts.filter(
                (p) => p.category === categoryName && (p.en.toLowerCase().includes(query) || (p.ja && p.ja.toLowerCase().includes(query)))
            );
            const allCategoryParts = state.parts.filter((p) => p.category === categoryName);
            if (categoryParts.length === 0 && query) return '';
            const toggleIcon = isExpanded ? '▽' : '▶';
            const partCount = allCategoryParts.length;
            return `
    <div class="category ${isExpanded ? 'expanded' : ''}">
        <div class="category-header" data-category-name="${categoryName}">
            <span class="category-toggle">${toggleIcon}</span>
            <span>${categoryName} <span style="color: #9ca3af; font-weight: normal;">(${partCount})</span></span>
        </div>
        <div class="category-content">
            ${categoryParts
                    .map((part) => {
                        const isSelected = state.clickedPartIdsInSession.has(part.id);
                        return `
                                        <div class="prompt-part" data-id="${part.id}" data-en="${part.en}" data-ja="${part.ja || ''}" title="${part.en}${part.ja ? ' / ' + part.ja : ''}">
                                            <div class="prompt-part-main long-text-handler">
                                                <div class="prompt-en">${part.en}</div>
                                                <div class="prompt-ja">${part.ja || '&nbsp;'}</div>
                                            </div>
                                            <button class="add-btn ${isSelected ? 'selected' : ''}" tabindex="-1">
                                                ${isSelected ? '<svg class="icon-plus" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="7" y="3" width="2" height="10" rx="1" fill="yellow"/><rect x="3" y="7" width="10" height="2" rx="1" fill="yellow"/></svg>' : '+'}
                                            </button>
                                        </div>`;
                    })
                    .join('')}
        </div>
    </div>`;
        }).join('');
    }

    function renderPartsGrid(query = '') {
        const lowerQuery = query.toLowerCase();
        const filteredParts = state.parts.filter((p) => p.en.toLowerCase().includes(lowerQuery) || (p.ja && p.ja.toLowerCase().includes(lowerQuery)));
        DOMElements.partsGrid.innerHTML = filteredParts
            .map((part, index) => {
                const isSelected = state.selectedPartIdsForBulkEdit.has(part.id);
                const isEditing = state.editingPartId === part.id;
                return `
    <div class="card" data-index="${index}" draggable="true">
        <input type="checkbox" class="bulk-part-checkbox" data-id="${part.id}" ${isSelected ? 'checked' : ''} style="margin-top: 4px;" />
        <div class="long-text-handler" style="flex:1;">
            <div style="font-weight: 500;">${part.en.length > 50 ? part.en.substring(0, 50) + '...' : part.en}</div>
            <div style="font-size: 12px; color: #666;">${part.ja ? (part.ja.length > 30 ? part.ja.substring(0, 30) + '...' : part.ja) : '翻訳文なし'}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0;">
            <span style="font-size: 11px; background: #eee; padding: 2px 6px; border-radius: 4px;">${part.category}</span>
            <div class="card-actions" style="margin:0; border:none; padding:0;">
                <button class="btn btn-secondary btn-sm ${isEditing ? 'active' : ''}" data-action="edit-part" data-id="${part.id}">編集</button>
                <button class="btn btn-danger btn-sm" data-action="delete-part" data-id="${part.id}">削除</button>
            </div>
        </div>
    </div>`;
            })
            .join('');
        initializePartsDragAndDrop();
        // ツールチップ表示を無効化（setupTooltips呼び出し削除）
    }

    function setupTooltips() {
        document.querySelectorAll('[data-full-text]').forEach((element) => {
            element.addEventListener('mouseenter', (e) => {
                let fullText = e.target.dataset.fullText;
                if (typeof fullText === 'undefined' && e.target.closest('[data-full-text]')) {
                    fullText = e.target.closest('[data-full-text]').dataset.fullText;
                }
                // null, undefined, 空文字列, 'null', 'undefined' の場合は何もしない
                if (
                    fullText !== undefined &&
                    fullText !== null &&
                    typeof fullText === 'string' &&
                    fullText.trim() !== '' &&
                    fullText.trim().toLowerCase() !== 'null' &&
                    fullText.trim().toLowerCase() !== 'undefined'
                ) {
                    showTooltip(e.target, fullText, e.pageX, e.pageY);
                }
            });
            element.addEventListener('mouseleave', hideTooltip);
            element.addEventListener('mousemove', (e) => {
                if (currentTooltip) {
                    currentTooltip.style.left = Math.min(e.pageX, window.innerWidth - currentTooltip.offsetWidth - 10) + 'px';
                    currentTooltip.style.top = Math.max(10, e.pageY - currentTooltip.offsetHeight - 5) + 'px';
                }
            });
        });
    }

    function updateBulkEditUI() {
        const hasBulkSelection = state.selectedPartIdsForBulkEdit.size > 0;
        DOMElements.newPartEnInput.disabled = hasBulkSelection;
        DOMElements.newPartJaInput.disabled = hasBulkSelection;
        if (hasBulkSelection) {
            DOMElements.partsFormTitle.textContent = 'カテゴリ変更';
            DOMElements.submitPartBtn.textContent = 'カテゴリを変更';
            DOMElements.newPartCategorySelect.disabled = false;
        } else {
            DOMElements.partsFormTitle.textContent = state.editingPartId ? 'パーツを編集' : 'パーツを追加';
            DOMElements.submitPartBtn.textContent = state.editingPartId ? 'パーツを更新' : 'パーツを追加';
            DOMElements.newPartCategorySelect.disabled = false;
        }
    }

    function renderCategoryManagement() {
        DOMElements.categoryUnifiedList.innerHTML = state.categories
            .map((cat, index) => {
                const partCount = state.parts.filter((p) => p.category === cat).length;
                return `
                    <div class="category-reorder-item" draggable="true" data-index="${index}">
                        <span class="drag-handle">☰</span>
                        <span class="category-name">${cat} <span style=\"color: #9ca3af; font-weight: normal;\">(${partCount})</span></span>
                        <button class="btn btn-danger btn-sm" data-action="delete-cat" data-category="${cat}">削除</button>
                    </div>`;
            })
            .join('');
        initializeCategoryDragAndDrop();
    }

    function initializeTemplateDragAndDrop() {
        const templateCards = DOMElements.templateGrid.querySelectorAll('.template-card');
        let draggedElement = null;
        templateCards.forEach((card) => {
            card.addEventListener('dragstart', () => { draggedElement = card; card.classList.add('dragging'); });
            card.addEventListener('dragend', () => { card.classList.remove('dragging'); draggedElement = null; });
            card.addEventListener('dragover', (e) => e.preventDefault());
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedElement && draggedElement !== card) {
                    const draggedIndex = parseInt(draggedElement.dataset.index);
                    const targetIndex = parseInt(card.dataset.index);
                    const [draggedTemplate] = state.templates.splice(draggedIndex, 1);
                    state.templates.splice(targetIndex, 0, draggedTemplate);
                    saveData();
                    updateCurrentConfig();
                    renderTemplates(DOMElements.templateSearchInput.value);
                }
            });
        });
    }

    function initializePartsDragAndDrop() {
        const partCards = DOMElements.partsGrid.querySelectorAll('.card');
        let draggedElement = null;
        partCards.forEach((card, index) => {
            card.setAttribute('data-index', index);
            card.setAttribute('draggable', 'true');
            card.addEventListener('dragstart', () => { draggedElement = card; card.classList.add('dragging'); });
            card.addEventListener('dragend', () => { card.classList.remove('dragging'); draggedElement = null; });
            card.addEventListener('dragover', (e) => e.preventDefault());
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedElement && draggedElement !== card) {
                    const draggedIndex = parseInt(draggedElement.dataset.index);
                    const targetIndex = parseInt(card.dataset.index);
                    const [draggedPart] = state.parts.splice(draggedIndex, 1);
                    state.parts.splice(targetIndex, 0, draggedPart);
                    saveData();
                    updateCurrentConfig();
                    renderPartsGrid(DOMElements.partsGridFilterInput.value);
                }
            });
        });
    }

    function setupImageModal() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('template-thumbnail')) {
                e.stopPropagation();
                const fullImageSrc = e.target.dataset.fullImage || e.target.src;
                DOMElements.modalImage.src = fullImageSrc;
                DOMElements.imageModal.style.display = 'flex';
                setTimeout(() => {
                    DOMElements.modalImage.style.opacity = '1';
                }, 10);
            }
        });
        DOMElements.modalImage.addEventListener('click', () => {
            DOMElements.modalImage.style.opacity = '0';
            setTimeout(() => {
                DOMElements.imageModal.style.display = 'none';
                DOMElements.modalImage.src = '';
            }, 400);
        });
    }

    function initializeCategoryDragAndDrop() {
        const categoryItems = DOMElements.categoryUnifiedList.querySelectorAll('.category-reorder-item');
        let draggedElement = null;
        categoryItems.forEach((item) => {
            item.addEventListener('dragstart', () => { draggedElement = item; item.classList.add('dragging'); });
            item.addEventListener('dragend', () => { item.classList.remove('dragging'); draggedElement = null; });
            item.addEventListener('dragover', (e) => e.preventDefault());
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedElement && draggedElement !== item) {
                    const draggedIndex = parseInt(draggedElement.dataset.index);
                    const targetIndex = parseInt(item.dataset.index);
                    const [draggedCategory] = state.categories.splice(draggedIndex, 1);
                    state.categories.splice(targetIndex, 0, draggedCategory);
                    saveData();
                    updateCurrentConfig();
                    renderCategoryManagement();
                    updatePartCategorySelect();
                }
            });
        });
    }

    function updatePartCategorySelect() {
        DOMElements.newPartCategorySelect.innerHTML = state.categories.map((cat) => `<option value="${cat}">${cat}</option>`).join('');
    }

    function renderTemplates(query = '') {
        const lowerQuery = query.toLowerCase();
        const filteredTemplates = state.templates.filter(
            (t) => (t.name && t.name.toLowerCase().includes(lowerQuery)) || (t.desc && t.desc.toLowerCase().includes(lowerQuery)) || (t.prompt && t.prompt.toLowerCase().includes(lowerQuery))
        );
        DOMElements.templateGrid.innerHTML = filteredTemplates
            .map((template, index) => `
    <div class="template-card" data-id="${template.id}" data-index="${index}" draggable="true">
        <div class="template-card-header">
            ${template.thumbnail
                    ? `<img src="${template.thumbnail}" style="width:60px; height:60px; object-fit:cover; border-radius:4px; cursor:pointer; flex-shrink: 0;" class="template-thumbnail" data-full-image="${template.thumbnail}">`
                    : `<div style=\"width:60px; height:60px; background:#eee; border-radius:4px; flex-shrink:0;\"></div>`}
            <input type="text" class="template-card-title" value="${template.name || 'タイトル未設定'}" data-id="${template.id}" placeholder="テンプレート名">
                <div class="template-card-actions">
                    <button class="btn btn-secondary btn-sm" data-action="apply-template" data-id="${template.id}">適用</button>
                    <button class="btn btn-secondary btn-sm ${state.editingTemplateId === template.id ? 'active' : ''}" data-action="edit-template" data-id="${template.id}">編集</button>
                    <button class="btn btn-danger btn-sm" data-action="delete-template" data-id="${template.id}">削除</button>
                </div>
        </div>
        <div class="template-card-details" data-full-text="${template.prompt || 'プロンプトなし'} | ${template.translation || '翻訳文なし'} | ${template.desc || 'メモなし'}">
            <p><strong>プロンプト:</strong> ${template.prompt ? (template.prompt.length > 50 ? template.prompt.substring(0, 50) + '...' : template.prompt) : 'なし'}</p>
            <p><strong>翻訳文:</strong> ${template.translation ? (template.translation.length > 30 ? template.translation.substring(0, 30) + '...' : template.translation) : 'なし'}</p>
            <p><strong>メモ:</strong> ${template.desc ? (template.desc.length > 40 ? template.desc.substring(0, 40) + '...' : template.desc) : 'なし'}</p>
        </div>
    </div>`)
            .join('');
        initializeTemplateDragAndDrop();
        setupTooltips();
    }

    function setupThumbnailHandlers() {
        // プロンプト作成画面用サムネイル
        const creationThumbnailPreview = document.getElementById('creation-thumbnail-preview');
        const creationThumbnailUpload = document.getElementById('creation-thumbnail-upload');
        let creationThumbnailData = null;

        // 画像選択クリック
        creationThumbnailPreview.addEventListener('click', () => {
            creationThumbnailUpload.click();
        });
        // ファイル選択
        creationThumbnailUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                try {
                    const resizedImage = await resizeImage(file, 600, 85);
                    creationThumbnailPreview.style.backgroundImage = `url(${resizedImage})`;
                    creationThumbnailPreview.classList.add('has-image');
                    creationThumbnailPreview.textContent = '';
                    creationThumbnailData = resizedImage;
                } catch (error) {
                    showNotification('画像の処理に失敗しました: ' + error.message, 'error');
                }
            }
        });
        // ドラッグ&ドロップ
        function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
            creationThumbnailPreview.addEventListener(eventName, preventDefaults, false);
        });
        ['dragenter', 'dragover'].forEach((eventName) => {
            creationThumbnailPreview.addEventListener(eventName, () => {
                creationThumbnailPreview.style.borderColor = 'var(--primary-color)';
            }, false);
        });
        ['dragleave', 'drop'].forEach((eventName) => {
            creationThumbnailPreview.addEventListener(eventName, () => {
                creationThumbnailPreview.style.borderColor = 'var(--border-color)';
            }, false);
        });
        creationThumbnailPreview.addEventListener('drop', async (e) => {
            const dt = e.dataTransfer; const files = dt.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    try {
                        const resizedImage = await resizeImage(file, 600, 85);
                        creationThumbnailPreview.style.backgroundImage = `url(${resizedImage})`;
                        creationThumbnailPreview.classList.add('has-image');
                        creationThumbnailPreview.textContent = '';
                        creationThumbnailData = resizedImage;
                    } catch (error) {
                        showNotification('画像の処理に失敗しました: ' + error.message, 'error');
                    }
                }
            }
        }, false);

        // クリアボタン・保存ボタン時に画像消去
        document.getElementById('clear-prompt-btn').addEventListener('click', () => {
            creationThumbnailPreview.style.backgroundImage = '';
            creationThumbnailPreview.classList.remove('has-image');
            creationThumbnailPreview.textContent = '画像';
            creationThumbnailData = null;
        });
        document.getElementById('save-template-btn').addEventListener('click', () => {
            setTimeout(() => {
                // プロンプトが空の場合は消さない
                if (document.getElementById('prompt-input').value) {
                    creationThumbnailPreview.style.backgroundImage = '';
                    creationThumbnailPreview.classList.remove('has-image');
                    creationThumbnailPreview.textContent = '画像';
                    creationThumbnailData = null;
                }
            }, 500); // 保存処理後に消去
        });

        // テンプレート保存時にサムネイルデータを渡す（既存保存処理に組み込み必要）
        window.getCreationThumbnailData = () => creationThumbnailData;
        // テンプレート編集画面用サムネイル
        const editThumbnailPreview = document.getElementById('thumbnail-preview');
        const editThumbnailUpload = document.getElementById('thumbnail-upload');
        let editThumbnailData = null;

        // 画像選択クリック
        editThumbnailPreview.addEventListener('click', () => {
            editThumbnailUpload.click();
        });
        // ファイル選択
        editThumbnailUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                try {
                    const resizedImage = await resizeImage(file, 600, 85);
                    editThumbnailPreview.style.backgroundImage = `url(${resizedImage})`;
                    editThumbnailPreview.classList.add('has-image');
                    editThumbnailPreview.textContent = '画像を変更するにはクリック';
                    editThumbnailData = resizedImage;
                } catch (error) {
                    showNotification('画像の処理に失敗しました: ' + error.message, 'error');
                }
            }
        });
        // ドラッグ&ドロップ
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
            editThumbnailPreview.addEventListener(eventName, preventDefaults, false);
        });
        ['dragenter', 'dragover'].forEach((eventName) => {
            editThumbnailPreview.addEventListener(eventName, () => {
                editThumbnailPreview.style.borderColor = 'var(--primary-color)';
            }, false);
        });
        ['dragleave', 'drop'].forEach((eventName) => {
            editThumbnailPreview.addEventListener(eventName, () => {
                editThumbnailPreview.style.borderColor = 'var(--border-color)';
            }, false);
        });
        editThumbnailPreview.addEventListener('drop', async (e) => {
            const dt = e.dataTransfer; const files = dt.files;
            if (files.length > 0) {
                const file = files[0];
                if (file.type.startsWith('image/')) {
                    try {
                        const resizedImage = await resizeImage(file, 600, 85);
                        editThumbnailPreview.style.backgroundImage = `url(${resizedImage})`;
                        editThumbnailPreview.classList.add('has-image');
                        editThumbnailPreview.textContent = '画像を変更するにはクリック';
                        editThumbnailData = resizedImage;
                    } catch (error) {
                        showNotification('画像の処理に失敗しました: ' + error.message, 'error');
                    }
                }
            }
        }, false);

        // クリアボタン
        document.getElementById('clear-thumbnail-btn').addEventListener('click', () => {
            editThumbnailPreview.style.backgroundImage = '';
            editThumbnailPreview.classList.remove('has-image');
            editThumbnailPreview.textContent = 'クリックして画像を選択';
            editThumbnailData = null;
        });

        // 保存ボタン時に画像消去（タイトルが空の場合は消さない）
        document.getElementById('save-edited-template-btn').addEventListener('click', () => {
            setTimeout(() => {
                if (document.getElementById('template-title-input').value) {
                    editThumbnailPreview.style.backgroundImage = '';
                    editThumbnailPreview.classList.remove('has-image');
                    editThumbnailPreview.textContent = 'クリックして画像を選択';
                    editThumbnailData = null;
                }
            }, 500);
        });

        // テンプレート保存時にサムネイルデータを渡す（既存保存処理に組み込み必要）
        window.getEditThumbnailData = () => editThumbnailData;
    }
    // ===== 翻訳APIテスト =====
    async function testTranslationAPI(apiUrl, apiType) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                {
                    action: 'testApi',
                    apiUrl: apiUrl,
                    apiType: apiType
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve(response);
                    }
                }
            );
        });
    }
    // Tabs
    DOMElements.tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            DOMElements.tabs.forEach((t) => t.classList.remove('active'));
            tab.classList.add('active');
            DOMElements.tabContents.forEach((c) => c.classList.remove('active'));
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
            // プロンプト作成画面に入るたびにカテゴリを閉じない
            // if (tab.dataset.tab === 'creation') { state.categoryStates = {}; renderCategoriesAndParts(); }
        });
    });

    // ===== APIタイプ選択ボタンのイベントリスナー =====
    DOMElements.apiTypeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            DOMElements.apiTypeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.settings.apiType = btn.dataset.type;
            saveData();
            updateCurrentConfig();
            
            // URLプレースホルダーを変更
            const placeholders = {
                'libretranslate': 'https://libretranslate.de/translate',
                'deepl': 'https://api-free.deepl.com/v2/translate',
                'gas': 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
                'auto': '翻訳APIのURL'
            };
            DOMElements.translationApiUrlInput.placeholder = placeholders[state.settings.apiType] || '';
        });
    });

    // Category Panel
    DOMElements.categoriesContainer.addEventListener('click', (e) => {
        const header = e.target.closest('.category-header');
        if (header) {
            const categoryName = header.dataset.categoryName;
            state.categoryStates[categoryName] = !state.categoryStates[categoryName];
            renderCategoriesAndParts();
            return;
        }
        const partCard = e.target.closest('.prompt-part');
        if (partCard) {
            state.clickedPartIdsInSession.add(partCard.dataset.id);
            const enText = partCard.dataset.en;
            const currentVal = DOMElements.promptInput.value.trim();
            if (currentVal && !currentVal.endsWith(',')) { DOMElements.promptInput.value += ', '; }
            DOMElements.promptInput.value += enText;
            DOMElements.promptInput.dispatchEvent(new Event('input'));
            updatePartsBasedTranslation(); // パーツ選択時のみ翻訳文を自動生成
            renderCategoriesAndParts();
        }
    });

    // API settings
    DOMElements.saveApiBtn.addEventListener('click', () => {
        const apiUrl = DOMElements.translationApiUrlInput.value.trim();
        if (!apiUrl) { 
            DOMElements.apiTestResult.innerHTML = '<span style="color: red;">URLを入力してください。</span>'; 
            return; 
        }
        state.settings.translationApiUrl = apiUrl;
        state.isApiRegistered = true;
        saveData(); 
        updateCurrentConfig();
        DOMElements.apiTestResult.innerHTML = '<span style="color: green;">API URLが登録されました。</span>';
    });

    DOMElements.testApiBtn.addEventListener('click', async () => {
        const apiUrl = DOMElements.translationApiUrlInput.value.trim();
        if (!apiUrl) { 
            DOMElements.apiTestResult.innerHTML = '<span style="color: red;">URLを入力してください。</span>'; 
            return; 
        }
        DOMElements.apiTestResult.innerHTML = '<span style="color: blue;">テスト中...</span>';
        const result = await testTranslationAPI(apiUrl, state.settings.apiType);
        if (result.success) { 
            DOMElements.apiTestResult.innerHTML = `<span style="color: green;">成功: ${result.translation}</span>`; 
        } else { 
            DOMElements.apiTestResult.innerHTML = `<span style="color: red;">エラー: ${result.error}</span>`; 
        }
    });

    DOMElements.autoTranslateBtn.addEventListener('click', async () => {
        const apiUrl = state.settings.translationApiUrl;
        const textToTranslate = DOMElements.promptInput.value;

        if (!state.isApiRegistered || !apiUrl) {
            showNotification('設定画面でAPI URLを登録してください。', 'error');
            return;
        }
        if (!textToTranslate) {
            showNotification('翻訳するプロンプトがありません。', 'error');
            return;
        }

        try {
            DOMElements.autoTranslateBtn.textContent = '翻訳中...';
            DOMElements.autoTranslateBtn.disabled = true;

            chrome.runtime.sendMessage(
                {
                    action: 'translate',
                    apiUrl: apiUrl,
                    text: textToTranslate,
                    apiType: state.settings.apiType
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        showNotification(`エラー: ${chrome.runtime.lastError.message}`, 'error');
                    } else if (response && response.success) {
                        DOMElements.translationInput.value = response.translation;
                        state.currentPrompt.ja = response.translation;
                        saveData();
                        showNotification('翻訳が完了しました。');
                    } else {
                        const errorMsg = response ? response.error : 'Unknown error';
                        showNotification(`翻訳に失敗しました: ${errorMsg}`, 'error');
                    }

                    DOMElements.autoTranslateBtn.textContent = '🌐 自動翻訳';
                    DOMElements.autoTranslateBtn.disabled = false;
                }
            );
        } catch (error) {
            showNotification(`エラーが発生しました: ${error.message}`, 'error');
            DOMElements.autoTranslateBtn.textContent = '🌐 自動翻訳';
            DOMElements.autoTranslateBtn.disabled = false;
        }
    });

    // Prompt and translation inputs
    function updatePartsBasedTranslation() {
        const promptText = DOMElements.promptInput.value;
        if (!promptText.trim()) { DOMElements.translationInput.value = ''; state.currentPrompt.ja = ''; return; }
        const promptParts = promptText.split(/[ ,、]+/).map((p) => p.trim()).filter(Boolean);
        const translations = []; const usedPartIds = new Set();
        promptParts.forEach((enPart) => {
            let foundPart = state.parts.find((p) => p.en === enPart && !usedPartIds.has(p.id));
            if (!foundPart) {
                const matchingParts = state.parts
                    .filter((p) => !usedPartIds.has(p.id) && (p.en.includes(enPart) || enPart.includes(p.en)))
                    .sort((a, b) => b.en.length - a.en.length);
                if (matchingParts.length > 0) foundPart = matchingParts[0];
            }
            if (foundPart && foundPart.ja) { translations.push(foundPart.ja); usedPartIds.add(foundPart.id); }
        });
        if (translations.length > 0) { const newTranslation = translations.join('、'); DOMElements.translationInput.value = newTranslation; state.currentPrompt.ja = newTranslation; }
    }
    // 直接入力時は翻訳文を自動生成しない
    DOMElements.promptInput.addEventListener('input', () => { state.currentPrompt.en = DOMElements.promptInput.value; saveData(); });
    DOMElements.promptInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            const currentValue = DOMElements.promptInput.value.trim();
            if (currentValue && !currentValue.endsWith(',')) { DOMElements.promptInput.value += ', '; }
            DOMElements.promptInput.setSelectionRange(DOMElements.promptInput.value.length, DOMElements.promptInput.value.length);
            DOMElements.promptInput.dispatchEvent(new Event('input'));
        }
    });
    DOMElements.translationInput.addEventListener('input', () => { state.currentPrompt.ja = DOMElements.translationInput.value; saveData(); });
    DOMElements.clearPromptBtn.addEventListener('click', () => { state.currentPrompt = { en: '', ja: '' }; state.clickedPartIdsInSession.clear(); DOMElements.promptInput.value = ''; DOMElements.translationInput.value = ''; saveData(); renderCategoriesAndParts(); });
    DOMElements.copyPromptBtn.addEventListener('click', () => { navigator.clipboard.writeText(DOMElements.promptInput.value).then(() => { const originalText = DOMElements.copyPromptBtn.textContent; DOMElements.copyPromptBtn.textContent = 'コピー!'; setTimeout(() => (DOMElements.copyPromptBtn.textContent = originalText), 1500); }); });
    DOMElements.saveTemplateBtn.addEventListener('click', () => {
        if (!DOMElements.promptInput.value) { showNotification('プロンプトがありません。', 'error'); return; }
        const thumbnail = window.getCreationThumbnailData ? window.getCreationThumbnailData() : null;
        state.templates.unshift({ id: generateId(), name: '新しいテンプレート', desc: '', prompt: DOMElements.promptInput.value, translation: DOMElements.translationInput.value, thumbnail });
        saveData(); updateCurrentConfig(); renderTemplates(); showNotification('テンプレートを保存しました。');
    });

    // Search inputs
    DOMElements.partSearchInput.addEventListener('input', renderCategoriesAndParts);
    DOMElements.partsGridFilterInput.addEventListener('input', (e) => { renderPartsGrid(e.target.value); });
    DOMElements.templateSearchInput.addEventListener('input', (e) => { renderTemplates(e.target.value); });

    // Parts grid selection for bulk edit
    DOMElements.partsGrid.addEventListener('change', (e) => {
        if (e.target.classList.contains('bulk-part-checkbox')) {
            const partId = e.target.dataset.id;
            if (e.target.checked) state.selectedPartIdsForBulkEdit.add(partId); else state.selectedPartIdsForBulkEdit.delete(partId);
            updateBulkEditUI();
        }
    });

    // Add category
    DOMElements.addCategoryBtn.addEventListener('click', () => {
        const newCat = DOMElements.newCategoryInput.value.trim();
        if (newCat && !state.categories.includes(newCat)) {
            state.categories.unshift(newCat);
            DOMElements.newCategoryInput.value = '';
            saveData(); updateCurrentConfig(); renderCategoryManagement(); updatePartCategorySelect();
        }
    });

    // Add / Update part or bulk category change
    DOMElements.submitPartBtn.addEventListener('click', () => {
        const hasBulkSelection = state.selectedPartIdsForBulkEdit.size > 0;
        if (hasBulkSelection) {
            const newCategory = DOMElements.newPartCategorySelect.value;
            state.selectedPartIdsForBulkEdit.forEach((partId) => { const part = state.parts.find((p) => p.id === partId); if (part) part.category = newCategory; });
            state.selectedPartIdsForBulkEdit.clear();
            updateBulkEditUI();
            saveData(); updateCurrentConfig(); renderAll();
            showNotification('カテゴリを変更しました。');
        } else {
            const en = DOMElements.newPartEnInput.value.trim();
            const ja = DOMElements.newPartJaInput.value.trim();
            const category = DOMElements.newPartCategorySelect.value;
            if (!en) { showNotification('プロンプトを入力してください。', 'error'); return; }
            const editingId = DOMElements.editingPartIdInput.value;
            if (editingId) {
                const part = state.parts.find((p) => p.id === editingId);
                if (part) { part.en = en; part.ja = ja; part.category = category; }
                showNotification('パーツを更新しました。');
            } else {
                state.parts.push({ id: generateId(), en, ja, category });
                showNotification('パーツを追加しました。');
            }
            // reset form
            DOMElements.editingPartIdInput.value = '';
            DOMElements.newPartEnInput.value = '';
            DOMElements.newPartJaInput.value = '';
            state.editingPartId = null;
            updateBulkEditUI();
            saveData(); updateCurrentConfig(); renderAll();
        }
    });

    // Export / Import
    DOMElements.exportDataBtn.addEventListener('click', () => {
        storage.get(['promptManagerData'], function (result) {
            const data = result.promptManagerData || JSON.stringify({});
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'prompt-manager-data.json'; a.click(); URL.revokeObjectURL(url);
            showNotification('データをエクスポートしました。');
        });
    });
    DOMElements.importDataInput.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (confirm('現在のすべてのデータが上書きされます。よろしいですか？')) {
                    storage.set({ promptManagerData: JSON.stringify(data) }, function () {
                        location.reload();
                    });
                }
            } catch (error) { showNotification('ファイルの読み込みに失敗しました。', 'error'); }
        };
        reader.readAsText(file);
    });

    // Parts grid action buttons
    DOMElements.partsGrid.addEventListener('click', (e) => {
        const target = e.target.closest('button[data-action]'); if (!target) return; const id = target.dataset.id;
        if (target.dataset.action === 'edit-part') {
            state.selectedPartIdsForBulkEdit.clear();
            // すでに編集中ならキャンセル（解除）
            if (state.editingPartId === id) {
                DOMElements.editingPartIdInput.value = '';
                DOMElements.newPartEnInput.value = '';
                DOMElements.newPartJaInput.value = '';
                state.editingPartId = null;
                updateBulkEditUI();
                renderPartsGrid(DOMElements.partsGridFilterInput.value);
                return;
            }
            const part = state.parts.find((p) => p.id === id);
            if (!part) return;
            DOMElements.editingPartIdInput.value = id; state.editingPartId = id;
            DOMElements.newPartEnInput.value = part.en; DOMElements.newPartJaInput.value = part.ja || ''; DOMElements.newPartCategorySelect.value = part.category;
            updateBulkEditUI(); renderPartsGrid(DOMElements.partsGridFilterInput.value);
        } else if (target.dataset.action === 'delete-part') {
            state.parts = state.parts.filter((p) => p.id !== id);
            saveData(); updateCurrentConfig(); renderAll(); showNotification('パーツを削除しました。');
        }
    });

    // Category management actions
    DOMElements.categoryUnifiedList.addEventListener('click', (e) => {
        const target = e.target.closest('button[data-action]'); if (!target) return;
        if (target.dataset.action === 'delete-cat') {
            const categoryToDelete = target.dataset.category;
            if (confirm(`カテゴリ「${categoryToDelete}」を削除しますか？\n※このカテゴリのパーツは「カテゴリなし」カテゴリに移動されます。`)) {
                state.parts.forEach((part) => { if (part.category === categoryToDelete) part.category = 'カテゴリなし'; });
                state.categories = state.categories.filter((cat) => cat !== categoryToDelete);
                saveData(); updateCurrentConfig(); renderAll(); showNotification('カテゴリを削除しました。');
            }
        }
    });

    // Templates actions
    DOMElements.templateGrid.addEventListener('click', (e) => {
        const target = e.target.closest('button[data-action]'); if (!target) return; const id = target.dataset.id;
        if (target.dataset.action === 'edit-template') {
            // すでに編集中ならキャンセル（解除）
            if (state.editingTemplateId === id) {
                state.editingTemplateId = null;
                DOMElements.saveEditedTemplateBtn.textContent = 'テンプレートを作成';
                DOMElements.editingTemplateIdInput.value = '';
                DOMElements.templateTitleInput.value = '';
                DOMElements.templateDescInput.value = '';
                DOMElements.templatePromptInput.value = '';
                DOMElements.templateTranslationInput.value = '';
                DOMElements.thumbnailPreview.style.backgroundImage = '';
                DOMElements.thumbnailPreview.classList.remove('has-image');
                DOMElements.thumbnailPreview.textContent = 'クリックして画像を選択';
                renderTemplates(DOMElements.templateSearchInput.value);
                return;
            }
            const template = state.templates.find((t) => t.id === id); if (!template) return;
            state.editingTemplateId = id;
            DOMElements.saveEditedTemplateBtn.textContent = 'テンプレートを更新';
            DOMElements.editingTemplateIdInput.value = id;
            DOMElements.templateTitleInput.value = template.name || '';
            DOMElements.templatePromptInput.value = template.prompt || '';
            DOMElements.templateTranslationInput.value = template.translation || '';
            DOMElements.templateDescInput.value = template.desc || '';
            if (template.thumbnail) { DOMElements.thumbnailPreview.style.backgroundImage = `url(${template.thumbnail})`; DOMElements.thumbnailPreview.classList.add('has-image'); DOMElements.thumbnailPreview.textContent = '画像を変更するにはクリック'; }
            else { DOMElements.thumbnailPreview.style.backgroundImage = ''; DOMElements.thumbnailPreview.classList.remove('has-image'); DOMElements.thumbnailPreview.textContent = 'クリックして画像を選択'; }
            renderTemplates(DOMElements.templateSearchInput.value);
        } else if (target.dataset.action === 'apply-template') {
            const template = state.templates.find((t) => t.id === id); if (!template) return;
            state.currentPrompt.en = template.prompt || '';
            state.currentPrompt.ja = template.translation || '';
            DOMElements.promptInput.value = state.currentPrompt.en;
            DOMElements.translationInput.value = state.currentPrompt.ja;
            saveData(); showNotification('テンプレートを適用しました。');
            document.querySelector('[data-tab="creation"]').click();
        } else if (target.dataset.action === 'delete-template') {
            state.templates = state.templates.filter((t) => t.id !== id);
            if (state.editingTemplateId === id) {
                state.editingTemplateId = null;
                DOMElements.saveEditedTemplateBtn.textContent = 'テンプレートを作成';
                DOMElements.editingTemplateIdInput.value = '';
                DOMElements.templateTitleInput.value = '';
                DOMElements.templateDescInput.value = '';
                DOMElements.templatePromptInput.value = '';
                DOMElements.templateTranslationInput.value = '';
                DOMElements.thumbnailPreview.style.backgroundImage = '';
                DOMElements.thumbnailPreview.classList.remove('has-image');
                DOMElements.thumbnailPreview.textContent = 'クリックして画像を選択';
            }
            saveData(); updateCurrentConfig(); renderTemplates(); showNotification('テンプレートを削除しました。');
        }
    });
    DOMElements.templateGrid.addEventListener('input', (e) => {
        if (e.target.classList.contains('template-card-title')) {
            const id = e.target.dataset.id; const template = state.templates.find((t) => t.id === id);
            if (template) { template.name = e.target.value; saveData(); updateCurrentConfig(); }
        }
    });
    DOMElements.saveEditedTemplateBtn.addEventListener('click', () => {
        const id = DOMElements.editingTemplateIdInput.value;
        const title = DOMElements.templateTitleInput.value.trim();
        const desc = DOMElements.templateDescInput.value;
        const prompt = DOMElements.templatePromptInput.value;
        const translation = DOMElements.templateTranslationInput.value;
        if (!title) { showNotification('タイトルを入力してください。', 'error'); return; }
        const thumbnail = window.getEditThumbnailData ? window.getEditThumbnailData() : null;
        if (id) {
            const template = state.templates.find((t) => t.id === id);
            if (template) { template.name = title; template.desc = desc; template.prompt = prompt; template.translation = translation; template.thumbnail = thumbnail; showNotification('テンプレートを更新しました。'); }
        } else {
            state.templates.unshift({ id: generateId(), name: title, desc, prompt, translation, thumbnail });
            showNotification('テンプレートを作成しました。');
        }
        state.editingTemplateId = null;
        saveData(); updateCurrentConfig(); renderTemplates();
        // reset form
        DOMElements.saveEditedTemplateBtn.textContent = 'テンプレートを作成';
        DOMElements.editingTemplateIdInput.value = '';
        DOMElements.templateTitleInput.value = '';
        DOMElements.templatePromptInput.value = '';
        DOMElements.templateTranslationInput.value = '';
        DOMElements.templateDescInput.value = '';
        DOMElements.thumbnailPreview.style.backgroundImage = '';
        DOMElements.thumbnailPreview.classList.remove('has-image');
        DOMElements.thumbnailPreview.textContent = 'クリックして画像を選択';
    });

    // JSON settings buttons
    DOMElements.saveCurrentJsonBtn.addEventListener('click', () => {
        const name = DOMElements.newJsonNameInput.value.trim();
        if (!name) { showNotification('設定名を入力してください。', 'error'); return; }
        if (jsonConfigs.find((c) => c.name === name)) { showNotification('同じ名前の設定が既に存在します。', 'error'); return; }
        // テンプレートのキー順を統一
        const orderedTemplates = state.templates.map(t => ({
            id: t.id,
            name: t.name,
            prompt: t.prompt,
            translation: t.translation,
            desc: t.desc,
            thumbnail: t.thumbnail
        }));
        jsonConfigs.push({ name, data: { settings: state.settings, categories: state.categories, parts: state.parts, templates: orderedTemplates } });
        DOMElements.newJsonNameInput.value = '';
        saveJsonConfigs(); renderJsonConfigs(); showNotification('設定を保存しました。');
    });
    DOMElements.jsonList.addEventListener('click', (e) => {
        const target = e.target.closest('button[data-action]'); if (!target) return; const index = parseInt(target.dataset.index);
        if (target.dataset.action === 'switch') {
            if (index !== activeConfigIndex) {
                updateCurrentConfig();
                activeConfigIndex = index; const config = jsonConfigs[activeConfigIndex].data;
                state.settings = config.settings || { translationApiUrl: '' };
                state.categories = config.categories || ['スタイル', 'キャラクター', '背景', '品質向上', 'ネガティブプロンプト', 'カテゴリなし'];
                state.parts = config.parts || [];
                state.templates = config.templates || [];
                state.isApiRegistered = !!state.settings.translationApiUrl;
                DOMElements.translationApiUrlInput.value = state.settings.translationApiUrl;
                saveJsonConfigs(); saveData(); renderAll(); showNotification(`「${jsonConfigs[activeConfigIndex].name}」に切り替えました。`);
            }
        } else if (target.dataset.action === 'delete') {
            if (jsonConfigs.length > 1) {
                const configName = jsonConfigs[index].name;
                if (confirm(`設定「${configName}」を削除しますか？`)) {
                    jsonConfigs.splice(index, 1);
                    if (activeConfigIndex >= index) activeConfigIndex = Math.max(0, activeConfigIndex - 1);
                    saveJsonConfigs(); renderJsonConfigs(); showNotification('設定を削除しました。');
                }
            }
        }
    });
    DOMElements.duplicateJsonBtn.addEventListener('click', () => {
        const baseName = jsonConfigs[activeConfigIndex].name;
        let newName = baseName + ' (コピー)'; let counter = 1;
        while (jsonConfigs.find((c) => c.name === newName)) { newName = baseName + ` (コピー${counter})`; counter++; }
        jsonConfigs.push({ name: newName, data: JSON.parse(JSON.stringify(jsonConfigs[activeConfigIndex].data)) });
        saveJsonConfigs(); renderJsonConfigs(); showNotification('設定を複製しました。');
    });
    DOMElements.renameJsonBtn.addEventListener('click', () => {
        const currentName = jsonConfigs[activeConfigIndex].name;
        const newName = prompt('新しい設定名を入力してください:', currentName);
        if (newName && newName.trim() && newName !== currentName) {
            if (jsonConfigs.find((c) => c.name === newName.trim())) { showNotification('同じ名前の設定が既に存在します。', 'error'); return; }
            jsonConfigs[activeConfigIndex].name = newName.trim();
            saveJsonConfigs(); renderJsonConfigs(); showNotification('設定名を変更しました。');
        }
    });




    // Raw data editor modal
    DOMElements.editRawDataBtn.addEventListener('click', () => {
        storage.get(['promptManagerData'], function (result) {
            const prettyJson = JSON.stringify(JSON.parse(result.promptManagerData || '{}'), null, 2);
            DOMElements.dataEditorTextarea.value = prettyJson;
            DOMElements.dataEditorModal.style.display = 'flex';
        });
    });
    const closeModal = () => { DOMElements.dataEditorModal.style.display = 'none'; };
    DOMElements.closeDataEditorBtn.addEventListener('click', closeModal);
    DOMElements.cancelDataEditorBtn.addEventListener('click', closeModal);
    DOMElements.saveDataFromEditorBtn.addEventListener('click', () => {
        try {
            const editedJson = DOMElements.dataEditorTextarea.value;
            const parsedData = JSON.parse(editedJson);
            // テンプレートのキー順を統一
            if (parsedData.templates) {
                parsedData.templates = parsedData.templates.map(t => ({
                    id: t.id,
                    name: t.name,
                    prompt: t.prompt,
                    translation: t.translation,
                    desc: t.desc,
                    thumbnail: t.thumbnail
                }));
            }
            if (confirm('現在のすべてのデータが上書きされます。よろしいですか？')) {
                storage.set({ promptManagerData: JSON.stringify(parsedData) }, function () {
                    closeModal(); location.reload();
                });
            }
        } catch (error) { showNotification('JSONの形式が正しくありません。\nエラー: ' + error.message, 'error'); }
    });

    // Reset all data
    DOMElements.resetDataBtn.addEventListener('click', () => {
        if (confirm('すべてのデータが初期状態にリセットされます。\n（カテゴリ、パーツ、テンプレート、翻訳API）\nこの操作は元に戻せません。\n\n本当に実行しますか？')) {
            // stateを初期化
            state = {
                parts: defaultParts.map((p) => ({ ...p, id: generateId() })),
                templates: [],
                categories: ['スタイル', 'キャラクター', '背景', '品質向上', 'ネガティブプロンプト', 'カテゴリなし'],
                settings: { 
                    translationApiUrl: '',
                    apiType: 'auto'
                },
                currentPrompt: { en: '', ja: '' },
                categoryStates: {},
                clickedPartIdsInSession: new Set(),
                selectedPartIdsForBulkEdit: new Set(),
                editingPartId: null,
                editingTemplateId: null,
                isApiRegistered: false,
            };
            
            // jsonConfigsも初期化
            const orderedTemplates = state.templates.map(t => ({
                id: t.id,
                name: t.name,
                prompt: t.prompt,
                translation: t.translation,
                desc: t.desc,
                thumbnail: t.thumbnail
            }));
            
            jsonConfigs = [{ 
                name: 'デフォルト', 
                data: { 
                    settings: state.settings, 
                    categories: state.categories, 
                    parts: state.parts, 
                    templates: orderedTemplates 
                } 
            }];
            
            activeConfigIndex = 0;
            
            // ストレージをクリア
            storage.remove(['promptManagerData', 'promptManagerCurrentPrompt', 'jsonConfigs', 'activeConfigIndex'], function () {
                // 初期化したデータを保存
                saveJsonConfigs();
                saveData();
                
                // UIを再描画
                renderAll();
                
                // APIタイプボタンを更新
                DOMElements.apiTypeButtons.forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.type === 'auto') {
                        btn.classList.add('active');
                    }
                });
                
                showNotification('データを初期化しました。');
            });
        }
    });


    function setupImageModalInit() { setupImageModal(); }

    // Init
    function init() {
        loadJsonConfigs();
        // loadJsonConfigsが非同期なので、少し待ってからloadDataを呼ぶ
        setTimeout(() => {
            loadData();
            state.categoryStates = {};
            renderAll();
            setupThumbnailHandlers();
            setupImageModalInit();
            checkStorageSize();
        }, 100);
    }
    init();
});
