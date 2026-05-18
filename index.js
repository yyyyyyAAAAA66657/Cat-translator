// ============================================================
// 🐱 Translator v1.0.4
// ============================================================
import { extension_settings, getContext } from '../../../../scripts/extensions.js';
import { catNotify, getThemeEmoji, getCompletionEmoji, setTextareaValue, getModelTheme, detectLanguageDirection, getCacheModelKey } from './utils.js';
import { initCache, deleteCached } from './cache.js';
import { fetchTranslation, gatherContextMessages } from './translator.js';
import { setupSettingsPanel, collectSettings, updateCacheStats, injectMessageButtons, injectInputButtons, setupDragDictionary, setupMutationObserver, showHistoryPopup, applyTheme, setSuppressAutoSave, clearPendingAutoSave } from './ui.js';

const EXT_NAME = "cat-translator";
const stContext = getContext();

const defaultSettings = { profile: '', customKey: '', vertexKey: '', vertexProject: '', vertexRegion: 'global', directModel: 'gemini-2.5-flash', customModelName: '', autoMode: 'none', bidirectional: 'off', dialogueBilingual: 'off', iconVisibility: 'all', targetLang: 'Korean', style: 'normal', temperature: 0.3, maxTokens: 8192, contextRange: 1, userPrompt: '', dictionary: '', retranslateStrength: 'normal', afterEditMode: 'notify', promptPresets: {}, charPresetMap: {} };
// 베타 → 정식 설정 마이그레이션 (기존 사용자 설정 보존)
if (!extension_settings[EXT_NAME] && extension_settings["cat-translator-beta"]) {
    extension_settings[EXT_NAME] = { ...extension_settings["cat-translator-beta"] };
}
let settings = Object.assign({}, defaultSettings, extension_settings[EXT_NAME]);

// 🚨 전역 기준값 영구 보존: extension_settings에 별도 키로 저장
// 프리셋이 적용된 상태에서 새로고침해도 baseline이 오염되지 않음
const BASELINE_VERSION = 2;  // 🚨 baseline 구조 변경 시 올려서 강제 리셋
const _savedBaseline = extension_settings[EXT_NAME]?._baseline;
const _baselineValid = _savedBaseline && _savedBaseline._v === BASELINE_VERSION;
const _globalBaseline = _baselineValid
    ? { userPrompt: _savedBaseline.userPrompt ?? '', temperature: _savedBaseline.temperature ?? 0.3, style: _savedBaseline.style ?? 'normal', _v: BASELINE_VERSION }
    : { userPrompt: defaultSettings.userPrompt || '', temperature: defaultSettings.temperature ?? 0.3, style: defaultSettings.style || 'normal', _v: BASELINE_VERSION };
let _isPresetLoading = false;
if (!_baselineValid) {
    console.warn('[CAT] ⚠️ baseline 리셋: 구버전/미존재. "설정 저장 및 적용" 버튼으로 기본 설정을 확정해주세요!');
}
console.log('[CAT] 🏠 전역 baseline 초기화:', { style: _globalBaseline.style, temp: _globalBaseline.temperature, prompt: _globalBaseline.userPrompt.substring(0, 30) || '(없음)', source: _baselineValid ? '영구저장 복원' : 'defaultSettings (리셋)' });

// 🚨 프로필/모델 상태에 따른 올바른 테마 판별
function getCurrentTheme() {
    if (settings.profile) {
        const pn = ($('#ct-profile option:selected').text() || '').toLowerCase();
        if (pn.includes('pro') || pn.includes('프로') || pn.includes('호랑이') || pn.includes('tiger')) return 'tiger';
        if (pn.includes('flash') || pn.includes('플래') || pn.includes('플레') || pn.includes('고양이') || pn.includes('cat')) return 'cat';
        return 'cat';
    }
    return getModelTheme(settings.directModel);
}

function saveSettings(updateBaseline = false) {
    const collected = collectSettings(); Object.assign(settings, collected);
    // 🚨 baseline 갱신 조건: 수동 저장 + 프리셋 비활성 상태에서만
    if (updateBaseline) {
        const currentChar = (SillyTavern?.getContext?.()?.name2) || stContext.name2 || '';
        const hasCharPreset = !!(currentChar && settings.charPresetMap?.[currentChar]);
        const hasSelectedPreset = !!$('#ct-prompt-preset').val();
        if (hasCharPreset || hasSelectedPreset) {
            // 🚨 프리셋 활성 중 → baseline 보호, 프리셋만 저장
            console.log(`[CAT] 🔒 baseline 보호: 프리셋 활성 상태에서 저장 → baseline 유지`);
            catNotify(`${getThemeEmoji()} 캐릭터 설정 저장됨 (기본 설정은 변경되지 않음)`, "success");
        } else {
            // 🚨 프리셋 없음 → 진짜 전역 기본값 갱신
            _globalBaseline.userPrompt = settings.userPrompt || '';
            _globalBaseline.temperature = settings.temperature ?? 0.3;
            _globalBaseline.style = settings.style || 'normal';
            _globalBaseline._v = BASELINE_VERSION;
            console.log('[CAT] 🏠 baseline 갱신 (수동 저장):', { style: _globalBaseline.style, temp: _globalBaseline.temperature, prompt: _globalBaseline.userPrompt.substring(0, 30) || '(없음)' });
        }
    }
    // 🚨 baseline을 extension_settings에 영구 저장 (새로고침 후에도 복원)
    extension_settings[EXT_NAME] = { ...settings, _baseline: { ..._globalBaseline } };
    stContext.saveSettingsDebounced();
    applyTheme(getCurrentTheme()); updateCacheStats();
}

async function processMessage(id, isInput = false, abortSignal = null, silent = false, isAutoEvent = false) {
    const msgId = parseInt(id, 10); const msg = stContext.chat[msgId]; if (!msg) return;
    
    const mesBlock = $(`.mes[mesid="${msgId}"]`);

    // 🚨 스와이프 감지: 이전 번역을 swipe_translations에 보존 후 현재 swipe 데이터로 전환
    if (msg.extra?.original_mes && msg.extra?.cat_swipe_id !== undefined &&
        msg.swipe_id !== undefined && msg.swipe_id !== msg.extra.cat_swipe_id) {
        const prevSwipeId = msg.extra.cat_swipe_id;
        // 이전 swipe의 번역을 보존
        if (!msg.extra.swipe_translations) msg.extra.swipe_translations = {};
        msg.extra.swipe_translations[prevSwipeId] = {
            original_mes: msg.extra.original_mes,
            display_text: msg.extra.display_text
        };
        console.log(`[CAT] 💾 스와이프 #${prevSwipeId} 번역 보존 #${msgId}`);
        
        // 현재 swipe에 저장된 번역이 있으면 복원
        const currentSwipeData = msg.extra.swipe_translations[msg.swipe_id];
        if (currentSwipeData?.original_mes && currentSwipeData?.display_text) {
            msg.extra.original_mes = currentSwipeData.original_mes;
            msg.extra.display_text = currentSwipeData.display_text;
            msg.extra.cat_swipe_id = msg.swipe_id;
            console.log(`[CAT] 🔄 스와이프 #${msg.swipe_id} 저장된 번역 복원 #${msgId}`);
            stContext.updateMessageBlock(msgId, msg);
            mesBlock.attr('data-cat-translated', 'true');
        } else {
            // 현재 swipe 첫 방문 → 번역 데이터 초기화 (다시 번역 가능 상태)
            delete msg.extra.original_mes;
            delete msg.extra.display_text;
            delete msg.extra.cat_swipe_id;
            mesBlock.removeAttr('data-cat-translated');
            stContext.updateMessageBlock(msgId, msg);
            console.log(`[CAT] 🆕 스와이프 #${msg.swipe_id} 첫 방문 → 새 번역 대기`);
        }
    }

    if (isAutoEvent && mesBlock.attr('data-cat-translated') === 'true') return;
    if (isAutoEvent && msg.extra?.display_text) return;
    // 🚨 숨긴 메시지(Hide) + 이미지/시스템 메시지 자동 번역 스킵
    if (isAutoEvent && (msg.is_hidden || msg.is_system === true || msg.extra?.media?.length > 0 || mesBlock.css('display') === 'none' || mesBlock.hasClass('is_hidden'))) return;
    // 🚨 display_text 안전장치: 번역된 상태인데 display_text 누락 시 보정
    // 🚨 단, data-cat-translated 속성이 있을 때만 발동 (자동 재번역 시 우회를 위해)
    if (msg.extra?.original_mes && !msg.extra?.display_text && mesBlock.attr('data-cat-translated') === 'true') { msg.extra.display_text = msg.mes; }
    // 🚨 Legacy 감지: 구버전에서 msg.mes가 번역문으로 덮어쓰여진 경우 자동 복원
    if (msg.extra?.original_mes && msg.extra?.display_text && msg.mes === msg.extra.display_text && msg.mes !== msg.extra.original_mes) {
        msg.mes = msg.extra.original_mes;
        console.log(`[CAT] 🔧 Legacy 메시지 #${msgId} 자동 복원: msg.mes → 원문`);
    }

    const startGlow = () => {
        mesBlock.find('.cat-mes-trans-btn .cat-emoji-icon').addClass('cat-glow-anim').attr('data-cat-glow-start', Date.now());
    };
    const stopGlow = () => mesBlock.find('.cat-mes-trans-btn .cat-emoji-icon').removeClass('cat-glow-anim').removeAttr('data-cat-glow-start');

    const isAutoMode = (settings.autoMode !== 'none');
    const isAutoTriggered = isAutoMode && !abortSignal;

    // 🚨 글로우 stuck 자동 감지 및 복구: 60초 이상 stuck이면 강제 해제 후 진행
    const stuckGlow = mesBlock.find('.cat-mes-trans-btn .cat-emoji-icon.cat-glow-anim');
    if (stuckGlow.length > 0) {
        const startTime = parseInt(stuckGlow.attr('data-cat-glow-start') || '0');
        const elapsed = Date.now() - startTime;
        if (startTime > 0 && elapsed > 60000) {
            console.warn(`[CAT] 🔧 글로우 stuck 감지 (${Math.round(elapsed/1000)}s) → 강제 해제 후 재시도 #${msgId}`);
            stopGlow();
        } else {
            return;
        }
    }
    startGlow();
    // 🚨 글로우 안전장치: 60초 후 자동 해제 (에러로 stuck 방지)
    const glowTimeout = setTimeout(() => { stopGlow(); console.warn(`[CAT] ⚠️ 글로우 타임아웃 #${msgId}`); }, 60000);
    let historyShown = false;

    try {
        const editArea = mesBlock.find('textarea.edit_textarea:visible, textarea.mes_edit_textarea:visible').first();
        if (editArea.length > 0) { await handleEditAreaTranslation(editArea, msgId, abortSignal); return; }

        // 🚨 원본 결정: original_mes + display_text + 스와이프 일치 여부로 판정
        let textToTranslate;
        const hasTranslation = msg.extra?.original_mes && msg.extra?.display_text &&
            (msg.extra?.cat_swipe_id === undefined || msg.extra.cat_swipe_id === msg.swipe_id);
        
        if (hasTranslation) {
            textToTranslate = msg.extra.original_mes;
        } else {
            textToTranslate = msg.mes;
        }

        const existingTranslation = hasTranslation ? msg.extra.display_text : null;
        const isRetranslation = hasTranslation;

        if (!silent && !isRetranslation) {
            const prefix = isAutoTriggered ? '자동 번역' : '번역';
            catNotify(`${getThemeEmoji()} ${prefix} 진행 중...`, "success");
        }

        if (isRetranslation) {
            const anchorEl = mesBlock.find('.cat-mes-trans-btn');
            const detected = detectDir(textToTranslate);
            const modelKey = getCacheModelKey(settings);
            const shown = await showHistoryPopup(textToTranslate, detected.targetLang, anchorEl, async (selectedText, isNew) => {
                if (isNew) {
                    startGlow();
                    try {
                        await doTranslateMessage(msgId, msg, textToTranslate, isInput, existingTranslation, abortSignal, true);
                    } finally { stopGlow(); }
                } else if (selectedText) {
                    if (!msg.extra) msg.extra = {}; msg.extra.display_text = selectedText;
                    if (isInput) { msg.mes = selectedText; }
                    stContext.updateMessageBlock(msgId, msg);
                }
            }, modelKey);
            if (shown) { historyShown = true; return; }
        }
        await doTranslateMessage(msgId, msg, textToTranslate, isInput, existingTranslation, abortSignal, silent);
    } finally { clearTimeout(glowTimeout); if (!historyShown) stopGlow(); }
}

async function doTranslateMessage(msgId, msg, textToTranslate, isInput, prevTranslation, abortSignal, silent = false, forceFresh = false) {
    const source = msg.extra?.original_mes || textToTranslate;
    const detected = detectLanguageDirection(source, settings);
    const forceLang = detected.targetLang;
    const contextRange = parseInt(settings.contextRange) || 1;
    const contextMsgs = gatherContextMessages(msgId, stContext, contextRange);

    const result = await fetchTranslation(textToTranslate, settings, stContext, { forceLang, prevTranslation: isInput ? (msg.extra?.original_mes ? msg.mes : null) : prevTranslation, contextMessages: contextMsgs, abortSignal, silent, forceFresh });

    if (result && result.text && result.text.trim() && result.text !== textToTranslate) {
        if (!msg.extra) msg.extra = {};
        if (!msg.extra.original_mes) msg.extra.original_mes = textToTranslate;
        msg.extra.display_text = result.text;
        if (msg.swipe_id !== undefined) {
            msg.extra.cat_swipe_id = msg.swipe_id;
            // 🚨 스와이프별 번역 보존 — 다른 스와이프로 전환했다 돌아와도 유지됨
            if (!msg.extra.swipe_translations) msg.extra.swipe_translations = {};
            msg.extra.swipe_translations[msg.swipe_id] = {
                original_mes: textToTranslate,
                display_text: result.text
            };
        }
        // 🚨 입력 메시지: msg.mes = 번역문(영어) → AI 컨텍스트에 영어 전달
        // 🚨 출력 메시지: msg.mes = 원문 유지 → 컨텍스트 오염 방지
        if (isInput) { msg.mes = result.text; }
        
        $(`.mes[mesid="${msgId}"]`).attr('data-cat-translated', 'true');
        // 🚨 편집 버튼 표시 (번역 완료 → 🐟/🍖 활성화)
        $(`.mes[mesid="${msgId}"]`).find('.cat-mes-edit-btn').css({ opacity: 0.8, 'pointer-events': 'auto' });

        stContext.updateMessageBlock(msgId, msg);
        if (!silent) {
            const preview = result.text.substring(0, 25) + (result.text.length > 25 ? '...' : '');
            catNotify(`${getCompletionEmoji()} 번역 완료! '${preview}'`, "success");
        }
    } else if (!silent && result === null) {
        catNotify(`${getThemeEmoji()} 번역 결과를 받지 못했어요.`, "warning");
    }
}

async function handleEditAreaTranslation(editArea, msgId, abortSignal) {
    let currentText = editArea.val().trim(); if (!currentText) return;
    
    // 🚨 DOM에서 긁혀온 오염물 제거 (hidden comment + 코드박스 잔해)
    currentText = currentText.replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!currentText) return;
    
    const msg = stContext.chat[msgId];
    
    // 🚨 직전 아웃풋 딸려오기 차단: msg 기준으로 비정상 길이 감지
    if (msg) {
        const knownText = msg.extra?.display_text || msg.extra?.original_mes || msg.mes;
        if (knownText && currentText.length > knownText.length * 1.5) {
            const knownPrefix = knownText.substring(0, Math.min(50, knownText.length));
            if (currentText.startsWith(knownPrefix)) {
                currentText = knownText;
            }
        }
    }
    
    // 🚨 textarea 오염 방지: 이전 콘텐츠가 현재 메시지에 섞여 들어온 경우
    if (msg && msg.mes && currentText.includes(msg.mes) && currentText !== msg.mes) {
        currentText = msg.mes;
    }
    
    // 🚨 핵심: 재번역 vs 새 번역 판별
    let sourceText = currentText;
    let isReTranslation = false;
    
    if (msg?.extra?.original_mes) {
        if (currentText === msg.extra.display_text || 
            currentText === msg.extra.original_mes) {
            // 수정 안 함 → original_mes에서 재번역
            sourceText = msg.extra.original_mes;
            isReTranslation = true;
        } else {
            // 🚨 사용자가 새 텍스트 입력 → 옛날 original_mes 삭제 (강제 초기화!)
            delete msg.extra.original_mes;
            delete msg.extra.display_text;
            delete msg.extra.cat_swipe_id;
        }
    }
    
    const prevTrans = isReTranslation ? (msg.extra?.display_text || null) : null;
    catNotify(isReTranslation ? `${getThemeEmoji()} 다른 표현으로 재번역 중...` : `${getThemeEmoji()} 스마트 번역 중...`, "success");
    
    const contextRange = parseInt(settings.contextRange) || 1;
    const contextMsgs = gatherContextMessages(msgId, stContext, contextRange);
    const bilingualInputLangMap = { 'ko-en': 'English', 'ko-ja': 'Japanese', 'ko-zh': 'Chinese' };
    const inputTargetLang = (settings.dialogueBilingual && settings.dialogueBilingual !== 'off') ? (bilingualInputLangMap[settings.dialogueBilingual] || settings.targetLang) : settings.targetLang;
    const inputSettings = { ...settings, dialogueBilingual: 'off', targetLang: inputTargetLang };
    const result = await fetchTranslation(sourceText, inputSettings, stContext, { forceLang: null, prevTranslation: prevTrans, contextMessages: contextMsgs, abortSignal });
    
    if (result && result.text !== currentText) {
        // editArea jQuery 데이터 저장 (세션 내)
        editArea.data('cat-original-text', sourceText);
        editArea.data('cat-last-translated', result.text);
        editArea.data('cat-last-target-lang', result.lang);
        
        // 🚨 msg.extra 영구 저장 — 무조건 덮어쓰기! (if 가드 없음)
        if (!msg.extra) msg.extra = {};
        msg.extra.original_mes = sourceText;
        msg.extra.display_text = result.text;
        if (msg.swipe_id !== undefined) msg.extra.cat_swipe_id = msg.swipe_id;
        
        setTextareaValue(editArea[0], result.text);
        catNotify(isReTranslation ? `${getCompletionEmoji()} 재번역 덮어쓰기 완료!` : `${getCompletionEmoji()} 번역 덮어쓰기 완료!`, "success");
    }
}

function revertMessage(id) {
    const msgId = parseInt(id, 10); const msg = stContext.chat[msgId]; if (!msg) return;
    const editArea = $(`.mes[mesid="${msgId}"]`).find('textarea.edit_textarea:visible, textarea.mes_edit_textarea:visible, textarea:visible').first();
    if (editArea.length > 0) { const originalText = editArea.data('cat-original-text'); if (originalText) { setTextareaValue(editArea[0], originalText); editArea.removeData('cat-original-text').removeData('cat-last-translated').removeData('cat-last-target-lang'); catNotify(`${getThemeEmoji()} 원본 텍스트로 복구 완료!`, "success"); } else { catNotify("⚠️ 복구할 원본이 없습니다.", "warning"); } return; }
    if (msg.extra?.display_text) delete msg.extra.display_text;
    if (msg.extra?.original_mes) {
        // 🚨 입력 메시지는 msg.mes가 번역문이므로 원문 복원 필요
        // 출력 메시지는 msg.mes가 이미 원문이므로 덮어써도 동일
        msg.mes = msg.extra.original_mes;
        delete msg.extra.original_mes;
    }
    if (msg.extra?.cat_swipe_id !== undefined) delete msg.extra.cat_swipe_id;
    
    $(`.mes[mesid="${msgId}"]`).removeAttr('data-cat-translated');
    
    stContext.updateMessageBlock(msgId, msg); catNotify(`${getThemeEmoji()} 원문 복구 완료!`, "success");
}
function detectDir(text) { return detectLanguageDirection(text, settings); }

jQuery(async () => {
    try { await initCache(); console.log('[CAT] 🐱 IndexedDB 캐시 초기화 완료'); } catch (e) { console.warn('[CAT] IndexedDB 초기화 실패, 메모리 캐시로 대체:', e); }
    setupSettingsPanel(settings, stContext, saveSettings); setupDragDictionary(settings, saveSettings); setupMutationObserver(processMessage, revertMessage, settings, stContext);
    // 🚨 첫 마이그레이션 / baseline 리셋 안내
    if (!_baselineValid) {
        setTimeout(() => catNotify(`${getThemeEmoji()} 기본 설정을 확인 후 "설정 저장 및 적용" 버튼을 눌러주세요!`, "warning"), 2000);
    }
    // 🚨 자동 번역: 이미지/시스템/숨김 메시지 스킵 (데이터 기반)
    stContext.eventSource.on(stContext.event_types.CHARACTER_MESSAGE_RENDERED, (d) => {
        if (settings.autoMode === 'none' || settings.autoMode === 'input') return;
        const msgId = typeof d === 'object' ? d.messageId : d;
        setTimeout(() => {
            const msg = stContext.chat[parseInt(msgId)];
            // 🚨 이미지/시스템 메시지 즉시 스킵 (is_hidden 타이밍 무관)
            if (msg?.is_system === true || msg?.extra?.media?.length > 0) {
                console.log(`[CAT] ⏭️ 이미지/시스템 메시지 스킵 #${msgId}`);
                return;
            }
            if (msg?.is_hidden) { console.log(`[CAT] ⏭️ 숨긴 메시지 스킵 #${msgId}`); return; }
            processMessage(msgId, false, null, false, true);
        }, 500);
    });
    stContext.eventSource.on(stContext.event_types.USER_MESSAGE_RENDERED, (d) => { if (settings.autoMode === 'none' || settings.autoMode === 'output') return; const msgId = typeof d === 'object' ? d.messageId : d; setTimeout(() => processMessage(msgId, true, null, false, true), 500); });
    
    // 🚨 메시지 편집 직접 감지 (옵저버 백업) — afterEditMode 'auto'/'notify' 안전 트리거
    stContext.eventSource.on(stContext.event_types.MESSAGE_EDITED, (msgId) => {
        console.log(`[CAT] 🔔 MESSAGE_EDITED 이벤트 수신 #${msgId}`);
        handleEditSaved(msgId);
    });
    
    // 🚨 ST 저장 클릭 직전 textarea 값 캡처 (mousedown/touchstart가 click보다 먼저 발동)
    // ST가 click 후 msg.mes를 한국어로 덮어쓸 수 있어서 미리 영어 원본 캡처 필요
    $(document).on('mousedown touchstart', '.mes_edit_done, .mes_edit_save, .edit_mes_save, [class*="mes_edit_done"]', function () {
        const mesBlock = $(this).closest('.mes');
        const textarea = mesBlock.find('textarea.edit_textarea, textarea.mes_edit_textarea').first();
        if (textarea.length > 0) {
            const captured = textarea.val();
            mesBlock.data('cat-captured-text', captured);
            console.log(`[CAT] 📸 textarea 캡처 #${mesBlock.attr('mesid')}: ${captured.substring(0, 50)}...`);
        }
    });
    
    // 🚨 ST 저장 체크 버튼(✓) 클릭 직접 감지 (가장 확실한 백업)
    $(document).on('click', '.mes_edit_done, .mes_edit_save, .edit_mes_save, [class*="mes_edit_done"]', function () {
        const mesBlock = $(this).closest('.mes');
        const msgId = parseInt(mesBlock.attr('mesid'));
        const captured = mesBlock.data('cat-captured-text');
        mesBlock.removeData('cat-captured-text');
        console.log(`[CAT] ✓ 저장 버튼 클릭 감지 #${msgId}`);
        catNotify(`${getThemeEmoji()} 편집 저장 감지 #${msgId}`, "info");
        // ST 처리 완료 후 핸들러 호출 (captured는 영어 원본 백업)
        setTimeout(() => handleEditSaved(msgId, captured), 500);
    });
    
    // 🚨 편집 저장 통합 핸들러
    function handleEditSaved(msgId, capturedText = null) {
        const id = parseInt(typeof msgId === 'object' ? msgId.messageId : msgId);
        const msg = stContext.chat[id];
        if (!msg) { console.log(`[CAT] ⚠️ msg 없음 #${id}`); return; }
        if (msg.is_user) return;
        if (msg.is_system === true || msg.extra?.media?.length > 0) return;
        if (!msg.extra?.original_mes) { 
            console.log(`[CAT] ⚠️ original_mes 없음 #${id}`); 
            catNotify(`${getThemeEmoji()} #${id}: 번역 안 된 메시지`, "warning");
            return; 
        }
        
        const mode = settings.afterEditMode || 'notify';
        if (mode === 'keep') return;
        
        // 🚨 새 원문 결정: captured(영어 백업)가 있으면 우선, 없으면 msg.mes
        let newOriginal = msg.mes;
        const capturedIsKorean = capturedText && /[가-힣]/.test(capturedText) && capturedText.length > 10;
        const mesIsKorean = /[가-힣]/.test(msg.mes) && msg.mes.length > 10;
        
        if (capturedText && !capturedIsKorean) {
            // captured가 영어 → 가장 신뢰할 수 있는 새 원문
            newOriginal = capturedText;
            console.log(`[CAT] 📸 captured 영어 사용 #${id}: ${newOriginal.substring(0, 50)}`);
        } else if (mesIsKorean) {
            // msg.mes가 한국어로 오염됨 → captured도 없음 → 처리 불가
            msg.mes = msg.extra.original_mes;
            stContext.updateMessageBlock(id, msg);
            console.log(`[CAT] 🛡️ 한국어 차단 #${id}`);
            catNotify(`${getThemeEmoji()} #${id}: 한국어 감지 → 원문 보존`, "warning");
            return;
        }
        
        // 영어가 실제로 수정되었는지 확인
        if (newOriginal === msg.extra.original_mes) { 
            console.log(`[CAT] ➖ 변경 없음 #${id}`); 
            catNotify(`${getThemeEmoji()} #${id}: 변경 없음`, "info");
            return; 
        }
        
        console.log(`[CAT] ✏️ 원문 갱신 #${id}: "${msg.extra.original_mes.substring(0,30)}..." → "${newOriginal.substring(0,30)}..."`);
        catNotify(`${getThemeEmoji()} #${id}: 원문 수정 감지! 처리 중...`, "info");
        
        // 새 원문 적용
        msg.mes = newOriginal;
        msg.extra.original_mes = newOriginal;
        
        if (mode === 'auto') {
            delete msg.extra.display_text;
            if (msg.extra.swipe_translations && msg.swipe_id !== undefined) {
                delete msg.extra.swipe_translations[msg.swipe_id];
            }
            delete msg.extra.cat_swipe_id;
            $(`.mes[mesid="${id}"]`).removeAttr('data-cat-translated');
            stContext.updateMessageBlock(id, msg);
            const modelKey = getCacheModelKey(settings);
            const targetLang = detectLanguageDirection(msg.mes, settings).targetLang;
            deleteCached(msg.mes, targetLang, modelKey);
            setTimeout(() => processMessage(id, false, null, false, false), 300);
        }
    }
    const bodyObserver = new MutationObserver(() => { applyTheme(getCurrentTheme()); }); bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // 🚨 캐릭터 전환 시 번역 프롬프트 자동 로드
    stContext.eventSource.on(stContext.event_types.CHAT_CHANGED, () => {
        setTimeout(() => {
            // 🚨 채팅 로드 시 오염 자동 검사 + 복구 (msg.mes에 한국어가 들어간 경우)
            const ctx = SillyTavern?.getContext?.();
            if (ctx?.chat) {
                let fixedCount = 0;
                ctx.chat.forEach((msg, i) => {
                    if (!msg.is_user && msg.extra?.original_mes && /[가-힣]/.test(msg.mes) && msg.mes.length > 10 && msg.mes !== msg.extra.original_mes) {
                        msg.mes = msg.extra.original_mes;
                        fixedCount++;
                    }
                });
                if (fixedCount > 0) {
                    console.warn(`[CAT] 🔧 채팅 로드 시 ${fixedCount}개 메시지 원문 자동 복구`);
                }
            }

            // 🚨 전환 시점의 최신 캐릭터 이름 사용
            const charName = (SillyTavern?.getContext?.()?.name2) || stContext.name2 || '';
            if (!charName || charName === 'SillyTavern System') return;
            console.log(`[CAT] 📋 캐릭터 전환: "${charName}", 매핑: ${settings.charPresetMap?.[charName] || '없음'}`);
            
            // 🚨 프리셋 로드 전: 대기 중인 autoSave 취소 + 억제 ON
            clearPendingAutoSave();
            setSuppressAutoSave(true);
            _isPresetLoading = true;
            
            const presetName = settings.charPresetMap?.[charName];
            if (presetName && settings.promptPresets?.[presetName]) {
                const preset = settings.promptPresets[presetName];
                settings.userPrompt = preset.prompt || '';
                settings.temperature = preset.temperature ?? 0.3;
                settings.style = preset.style || 'normal';
                $('#ct-user-prompt').val(settings.userPrompt);
                $('#ct-style').val(settings.style);
                $('#ct-temperature').val(settings.temperature);
                $('#ct-prompt-preset').val(presetName);
                // 🚨 직접 저장 (autoSave 디바운스 충돌 방지) + baseline 영구 보존
                extension_settings[EXT_NAME] = { ...settings, _baseline: { ..._globalBaseline } };
                stContext.saveSettingsDebounced();
                catNotify(`${getThemeEmoji()} ${charName} → 프롬프트 "${presetName}" 자동 로드!`, "success");
                console.log(`[CAT] 🔗 프리셋 적용: "${presetName}" →`, { style: settings.style, temp: settings.temperature, prompt: settings.userPrompt.substring(0, 30) });
            } else {
                // 🚨 FIX: 매핑 없는 캐릭터 → 전역 baseline으로 복원 (하드코딩 기본값 X)
                settings.userPrompt = _globalBaseline.userPrompt;
                settings.temperature = _globalBaseline.temperature;
                settings.style = _globalBaseline.style;
                $('#ct-user-prompt').val(settings.userPrompt);
                $('#ct-style').val(settings.style);
                $('#ct-temperature').val(settings.temperature);
                $('#ct-prompt-preset').val('');
                // 🚨 직접 저장 + baseline 영구 보존
                extension_settings[EXT_NAME] = { ...settings, _baseline: { ..._globalBaseline } };
                stContext.saveSettingsDebounced();
                console.log(`[CAT] 🏠 baseline 복원 (프리셋 없음):`, { style: _globalBaseline.style, temp: _globalBaseline.temperature, prompt: _globalBaseline.userPrompt.substring(0, 30) || '(없음)' });
            }
            
            // 🚨 프리셋 로드 완료: 억제 OFF
            _isPresetLoading = false;
            setSuppressAutoSave(false);
        }, 500);
    });
    console.log('[CAT] 🐱 Translator v1.0.4 로드 완료!');
    
    // 🚨 페이지 가시성 변경 시 60초 이상 stuck 글로우 정리 (모바일 백그라운드 복귀 대응)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            $('.cat-mes-trans-btn .cat-emoji-icon.cat-glow-anim, #cat-input-btn .cat-emoji-icon.cat-glow-anim').each(function () {
                const startTime = parseInt($(this).attr('data-cat-glow-start') || '0');
                const elapsed = Date.now() - startTime;
                if (startTime > 0 && elapsed > 60000) {
                    $(this).removeClass('cat-glow-anim').removeAttr('data-cat-glow-start');
                    console.warn(`[CAT] 🔧 visibility 복귀 → stuck 글로우 정리 (${Math.round(elapsed/1000)}s)`);
                }
            });
        }
    });
    
    // 🚨 원문 오염 방어: msg.mes에 한국어가 들어가면 자동 복구
    // ST 내부 렌더링/저장 과정에서 display_text가 msg.mes로 역류하는 현상 방지
    function repairContamination(source = '') {
        const ctx = SillyTavern?.getContext?.();
        if (!ctx?.chat) return;
        let repaired = 0;
        ctx.chat.forEach((msg, i) => {
            if (!msg.is_user && msg.extra?.original_mes && msg.extra?.display_text) {
                // msg.mes가 display_text(번역문)와 같거나 한국어가 포함된 경우 → 원문 복원
                if (msg.mes === msg.extra.display_text && msg.mes !== msg.extra.original_mes) {
                    msg.mes = msg.extra.original_mes;
                    repaired++;
                } else if (/[가-힣]{3,}/.test(msg.mes) && msg.mes !== msg.extra.original_mes && !/[가-힣]/.test(msg.extra.original_mes)) {
                    // original_mes에 한국어가 없는데 msg.mes에 한국어가 있으면 오염
                    msg.mes = msg.extra.original_mes;
                    repaired++;
                }
            }
        });
        if (repaired > 0) {
            console.warn(`[CAT] 🛡️ 원문 오염 자동복구: ${repaired}개 (${source})`);
            // 🚨 복구 결과를 채팅 파일에 영구 저장
            try { ctx.saveChat(); } catch (e) { /* 저장 실패 무시 */ }
        }
    }
    
    // 🚨 스와이프별 번역 자동 복원: 채팅 진입 시 각 메시지의 현재 swipe에 맞는 번역 복원
    function restoreSwipeTranslations(source = '') {
        const ctx = SillyTavern?.getContext?.();
        if (!ctx?.chat) return;
        let restored = 0;
        ctx.chat.forEach((msg, i) => {
            if (msg.is_user) return;
            if (!msg.extra?.swipe_translations) return;
            if (msg.swipe_id === undefined) return;
            
            const currentSwipeData = msg.extra.swipe_translations[msg.swipe_id];
            if (!currentSwipeData?.display_text) return;
            
            // 현재 표시되는 번역이 이번 swipe와 다르면 복원
            if (msg.extra.cat_swipe_id !== msg.swipe_id || msg.extra.display_text !== currentSwipeData.display_text) {
                msg.extra.original_mes = currentSwipeData.original_mes;
                msg.extra.display_text = currentSwipeData.display_text;
                msg.extra.cat_swipe_id = msg.swipe_id;
                restored++;
            }
        });
        if (restored > 0) {
            console.log(`[CAT] 🔄 swipe 번역 복원: ${restored}개 (${source})`);
            try { ctx.saveChat(); } catch (e) {}
        }
    }
    
    // 채팅 진입 시 즉시 복구
    stContext.eventSource.on(stContext.event_types.CHAT_CHANGED, () => {
        setTimeout(() => { repairContamination('CHAT_CHANGED'); restoreSwipeTranslations('CHAT_CHANGED'); }, 300);
    });
    
    // 메시지 렌더 시 복구 (AI 응답 생성 전에 오염 제거)
    stContext.eventSource.on(stContext.event_types.CHARACTER_MESSAGE_RENDERED, () => {
        repairContamination('MESSAGE_RENDERED');
    });
    
    // 5초 간격 상시 감시
    setInterval(() => repairContamination('watchdog'), 5000);
    
    // 🚨 원문 수정 감지 폴링 (자동 재번역/알림 백업) — 3초 간격
    // 이벤트/옵저버가 누락해도 폴링으로 100% 잡음
    const _editPollProcessed = new Map(); // idx → 처리한 텍스트 fingerprint
    setInterval(() => {
        const mode = settings.afterEditMode || 'notify';
        if (mode === 'keep') return;
        if (!stContext.chat) return;
        
        stContext.chat.forEach((msg, idx) => {
            if (!msg || msg.is_user) return;
            if (msg.is_system === true || msg.extra?.media?.length > 0) return;
            if (!msg.extra?.original_mes) return;
            
            // 한국어 차단 (오염 방지)
            const hasKorean = /[가-힣]/.test(msg.mes) && msg.mes.length > 10;
            if (hasKorean) return;
            
            // 원문이 변경된 메시지 감지
            if (msg.mes === msg.extra.original_mes) {
                _editPollProcessed.delete(idx);
                return;
            }
            
            // 이미 처리한 메시지는 스킵
            const fingerprint = msg.mes.substring(0, 100);
            if (_editPollProcessed.get(idx) === fingerprint) return;
            _editPollProcessed.set(idx, fingerprint);
            
            console.log(`[CAT] 🔍 폴링 감지: 원문 수정 #${idx} (mode: ${mode})`);
            catNotify(`${getThemeEmoji()} 원문 수정 감지! 처리 중... #${idx}`, "info");
            msg.extra.original_mes = msg.mes;
            
            if (mode === 'auto') {
                delete msg.extra.display_text;
                // 🚨 swipe_translations에서도 현재 swipe 삭제 (restoreSwipeTranslations 차단)
                if (msg.extra.swipe_translations && msg.swipe_id !== undefined) {
                    delete msg.extra.swipe_translations[msg.swipe_id];
                }
                delete msg.extra.cat_swipe_id;
                $(`.mes[mesid="${idx}"]`).removeAttr('data-cat-translated');
                stContext.updateMessageBlock(idx, msg);
                // 🚨 캐시 우회: 새 원문에 대한 캐시 삭제 (이전 번역 재사용 방지)
                const modelKey = getCacheModelKey(settings);
                const targetLang = detectLanguageDirection(msg.mes, settings).targetLang;
                deleteCached(msg.mes, targetLang, modelKey);
                setTimeout(() => processMessage(idx, false, null, false, false), 300);
            } else if (mode === 'notify') {
                stContext.updateMessageBlock(idx, msg);
                catNotify(`${getThemeEmoji()} 원문이 수정되었어요. 메시지의 번역 버튼으로 재번역해주세요.`, "info");
            }
        });
    }, 3000);
    
    // 최초 로드 시 복구
    setTimeout(() => { repairContamination('init'); restoreSwipeTranslations('init'); }, 1500);
});

