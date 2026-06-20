// ============================================================
// 🐱 Translator v1.0.4 - ui.js
// ============================================================
import { catNotify, catNotifyProgress, getThemeEmoji, getCompletionEmoji, getModelTheme, setTextareaValue } from './utils.js';
import { getStats, clearAllCache, exportSettings, importSettings, getHistory, togglePin } from './cache.js';
import { fetchTranslation, gatherContextMessages, SYSTEM_SHIELD, STYLE_PRESETS, getLastDebugLog } from './translator.js';

let bulkAbortController = null;
let isTranslatingInput = false;
let _settingsRef = null;  // 🚨 collectSettings에서 promptPresets/charPresetMap 접근용
let _suppressAutoSave = false;  // 🚨 프리셋 로드 중 autoSave/스타일핸들러 차단
let _autoSaveTimer = null;  // 🚨 모듈 스코프로 이동 (CHAT_CHANGED에서 접근 필요)

/** 프리셋 로드 시 autoSave 레이스 컨디션 방지용 */
export function setSuppressAutoSave(val) { _suppressAutoSave = val; }
/** 대기 중인 autoSave 타이머 취소 */
export function clearPendingAutoSave() { clearTimeout(_autoSaveTimer); _autoSaveTimer = null; }

export function setupSettingsPanel(settings, stContext, saveSettingsFn) {
    _settingsRef = settings;  // 🚨 collectSettings에서 접근용
    if ($('#cat-trans-container').length) return;

    let profileOptions = '<option value="">⚡ 직접 연결 모드</option>';
    (stContext.extensionSettings?.connectionManager?.profiles || []).forEach(p => { profileOptions += `<option value="${p.id}">${p.name}</option>`; });

    const languages = ['Korean', 'English', 'Chinese', 'Japanese', 'German', 'Russian', 'French'];
    const langOptions = languages.map(l => `<option value="${l}">${l}</option>`).join('');
    const styleOptions = Object.entries(STYLE_PRESETS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
    const statsData = getStats();
    
    const dictIcon = (settings.dictionary && settings.dictionary.trim()) ? '📬' : '📭';

    const html = `
    <div id="cat-trans-container" class="inline-drawer">
        <div id="cat-drawer-header" class="inline-drawer-header interactable" tabindex="0">
            <div class="inline-drawer-title"><span class="cat-theme-emoji">🐱</span><span>Translator</span></div>
            <i id="cat-drawer-toggle" class="inline-drawer-toggle fa-fw fa-solid fa-circle-chevron-down inline-drawer-icon down interactable"></i>
        </div>
        <div id="cat-drawer-content" class="inline-drawer-content" style="display:none; padding:10px;">
            <div class="cat-setting-row"><label>연결 프로필</label><select id="ct-profile" class="text_pole">${profileOptions}</select></div>
            <div id="ct-direct-toggle" class="cat-setting-row" style="cursor:pointer; opacity:0.7; font-size:0.85em; padding:4px 0;">
                <span id="ct-direct-arrow">▶</span> <span>직접 연결 설정 (고급)</span>
            </div>
            <div id="ct-direct-settings" style="display:none;">
                <div style="font-size:0.8em; opacity:0.6; margin-bottom:8px; padding:6px; border-radius:6px; background:var(--SmartThemeBlurTintColor, rgba(0,0,0,0.1));">💡 연결 프로필 사용을 권장합니다. 직접 연결은 <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--ca-accent);">Google AI Studio</a>에서 발급한 API Key(AIza...)가 필요합니다.</div>
                <div class="cat-setting-row" style="position:relative;">
                    <label>API Key</label>
                    <input type="password" id="ct-key" class="text_pole" value="${settings.customKey}" style="padding-right:36px;">
                    <span id="ct-key-toggle" class="cat-paw-toggle" title="키 보기/숨기기">🐾</span>
                </div>
                <div class="cat-setting-row">
                    <label>모델</label>
                    <select id="ct-model" class="text_pole">
                        <optgroup label="🐱 고양이 라인 (Flash)"><option value="gemini-2.5-flash">2.5 Flash</option><option value="gemini-2.0-flash">2.0 Flash</option></optgroup>
                        <optgroup label="🐯 호랑이 라인 (Pro)"><option value="gemini-2.5-pro">2.5 Pro</option><option value="gemini-3.1-pro-preview">3.1 Pro Preview</option></optgroup>
                        <option value="custom">✏️ 직접 입력...</option>
                    </select>
                    <input type="text" id="ct-model-custom" class="text_pole" placeholder="모델명 직접 입력" style="display:none; margin-top:4px;">
                </div>
            </div>
            <div style="display:flex; gap:8px;">
                <div class="cat-setting-row" style="flex:1;"><label>자동 번역</label><select id="ct-auto-mode" class="text_pole"><option value="none">꺼짐</option><option value="input">입력만</option><option value="output">출력만</option><option value="both">둘 다</option></select></div>
                <div class="cat-setting-row" style="flex:1;"><label>양방향 번역</label><select id="ct-bidirectional" class="text_pole"><option value="off">꺼짐</option><option value="ko-en">한↔영</option><option value="ko-ja">한↔일</option><option value="ko-zh">한↔중</option></select></div>
            </div>
            <div style="display:flex; gap:8px;">
                <div class="cat-setting-row" style="flex:1;"><label>목표 언어 (AI 기본)</label><select id="ct-lang" class="text_pole">${langOptions}</select></div>
                <div class="cat-setting-row" style="flex:1;"><label>대사 병기</label><select id="ct-dialogue-bilingual" class="text_pole"><option value="off">꺼짐</option><option value="ko-en">한영 병기</option><option value="ko-ja">한일 병기</option><option value="ko-zh">한중 병기</option></select></div>
            </div>
            <div style="display:flex; gap:8px;">
                <div class="cat-setting-row" style="flex:1;"><label>스타일</label><select id="ct-style" class="text_pole">${styleOptions}</select></div>
                <div class="cat-setting-row" style="width:80px;"><label>온도</label><input type="number" id="ct-temperature" class="text_pole" value="${settings.temperature || ''}" min="0" max="1" step="0.1" placeholder="0.0~1.0"></div>
            </div>
            <div style="display:flex; gap:8px;">
                <div class="cat-setting-row" style="flex:1;"><label>토큰</label><input type="number" id="ct-max-tokens" class="text_pole" value="${settings.maxTokens || ''}" min="256" max="20000" step="256" placeholder="권장 8192"></div>
                <div class="cat-setting-row" style="width:100px;"><label>문맥 범위</label><input type="number" id="ct-context-range" class="text_pole" value="${settings.contextRange || ''}" min="0" max="6" step="1" placeholder="최대 6"></div>
            </div>
            <div class="cat-setting-row">
                <label>재번역 강도 <span style="font-size:0.8em; opacity:0.6;">(이전 번역과 얼마나 다르게)</span></label>
                <select id="ct-retranslate-strength" class="text_pole">
                    <option value="soft" ${(settings.retranslateStrength === 'soft') ? 'selected' : ''}>약함 (살짝만 변형, 품질 유지)</option>
                    <option value="normal" ${(settings.retranslateStrength === 'normal' || !settings.retranslateStrength) ? 'selected' : ''}>보통 (다른 표현 시도)</option>
                    <option value="strong" ${(settings.retranslateStrength === 'strong') ? 'selected' : ''}>강함 (완전히 다르게 강제)</option>
                </select>
            </div>
            <div class="cat-setting-row">
                <label>원문 수정 후 동작 <span style="font-size:0.8em; opacity:0.6;">(✏️ 연필로 영어 수정 시)</span></label>
                <select id="ct-after-edit" class="text_pole">
                    <option value="notify" ${(!settings.afterEditMode || settings.afterEditMode === 'notify') ? 'selected' : ''}>알림 + 재번역 버튼 (기본)</option>
                    <option value="auto" ${settings.afterEditMode === 'auto' ? 'selected' : ''}>자동 재번역</option>
                    <option value="keep" ${settings.afterEditMode === 'keep' ? 'selected' : ''}>기존 번역 유지</option>
                </select>
            </div>
            <div class="cat-setting-row">
                <label>📁 채팅 파일 관리 미리보기 번역 <span style="font-size:0.8em; opacity:0.6;">(자동 옵저버, 캐시 우선 → API)</span></label>
                <select id="ct-preview-translate" class="text_pole">
                    <option value="off" ${(!settings.previewTranslate || settings.previewTranslate === 'off' || settings.previewTranslate === 'cache') ? 'selected' : ''}>OFF</option>
                    <option value="on" ${(settings.previewTranslate === 'on' || settings.previewTranslate === 'auto') ? 'selected' : ''}>ON (자동 처리)</option>
                </select>
            </div>
            <div class="cat-setting-row">
                <label>🧹 미리보기 마크업 정리 <span style="font-size:0.8em; opacity:0.6;">(yaml/태그 숨김)</span></label>
                <select id="ct-preview-cleanup" class="text_pole">
                    <option value="off" ${(!settings.previewCleanup || settings.previewCleanup === 'off') ? 'selected' : ''}>OFF</option>
                    <option value="on" ${settings.previewCleanup === 'on' ? 'selected' : ''}>ON</option>
                </select>
            </div>
            <div class="cat-setting-row" style="display:none"><label>시스템 보호막 (🔒 고정)</label><textarea id="ct-shield" class="text_pole cat-readonly-area" rows="3" readonly>${SYSTEM_SHIELD}</textarea></div>
            <div class="cat-setting-row">
                <label style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:4px;">
                    <span>추가 지시사항</span>
                    <span style="display:inline-flex; gap:4px; align-items:center;">
                        <select id="ct-prompt-preset" class="text_pole" style="width:auto; min-width:80px; font-size:0.85em; padding:2px 4px;"><option value="">없음</option></select>
                        <span id="ct-prompt-save" style="cursor:pointer; font-size:1.2em;" title="현재 지시사항 + 온도를 프롬프트로 저장">💾</span>
                        <span id="ct-prompt-delete" style="cursor:pointer; font-size:1.2em;" title="선택한 프롬프트 삭제">🗑️</span>
                        <span id="ct-prompt-link" style="cursor:pointer; font-size:1.2em;" title="현재 캐릭터에 프롬프트 연결">🔗</span>
                    </span>
                </label>
                <textarea id="ct-user-prompt" class="text_pole" rows="3" placeholder="번역 스타일, 상황극 설정 등 자유롭게 입력">${settings.userPrompt || ''}</textarea>
            </div>
            <div class="cat-setting-row">
                <label>사전 (원문 = 번역어) 
                    <span id="ct-dict-reset" style="float:right; cursor:pointer; font-size:1.4em; transition:0.2s;" title="사전 지우기 (우편함 비우기)">${dictIcon}</span>
                </label>
                <textarea id="ct-dictionary" class="text_pole" rows="3" placeholder="Ghost=고스트&#10;Soap=소프">${settings.dictionary || ''}</textarea>
            </div>
            <div class="cat-setting-row"><label>아이콘 표시</label><select id="ct-icon-visibility" class="text_pole"><option value="all">전체 보기</option><option value="hide-input">입력창 숨기기</option><option value="hide-message">메시지창 숨기기</option></select></div>
            <div id="ct-cache-stats" class="cat-stats-bar"><span id="ct-cache-icon" style="font-size:1.3em;">🗂️</span> 캐시 히트율: ${statsData.hitRate}% | 절약 토큰: ~${statsData.tokensSaved.toLocaleString()}</div>
            <div style="display:flex; gap:8px; margin-top:4px;">
                <button id="ct-clear-cache" class="menu_button cat-btn-secondary" style="flex:1;">🗑️ 캐시 삭제</button>
                <button id="ct-reset-settings" class="menu_button cat-btn-secondary" style="flex:1;">🔄 설정 초기화</button>
            </div>
            <div style="display:flex; gap:8px; margin-top:8px;">
                <button id="ct-export" class="menu_button cat-btn-secondary" style="flex:1;">📤 내보내기</button><button id="ct-import-btn" class="menu_button cat-btn-secondary" style="flex:1;">📥 가져오기</button>
                <input type="file" id="ct-import-file" accept=".json" style="display:none;">
            </div>
            <button id="ct-clean-chat" class="menu_button cat-btn-secondary" style="width:100%; margin-top:8px;">🧹 현재 채팅 오염 정리 (자동 재번역 안 될 때)</button>
            <button id="cat-save-btn" class="menu_button cat-save-button" style="margin-top:10px; width:100%;">설정 저장 및 적용 <span class="cat-theme-emoji">🐱</span></button>
            <button id="ct-debug-btn" class="menu_button cat-btn-secondary" style="margin-top:6px; width:100%;">🐛 마지막 LLM 응답 보기</button>
        </div>
    </div>`;

    $('#extensions_settings').append(html);

    $('#cat-drawer-header').on('click', (e) => { e.stopPropagation(); $('#cat-drawer-content').slideToggle(200); $('#cat-drawer-toggle').toggleClass('fa-circle-chevron-down fa-circle-chevron-up'); });
    $('#ct-key-toggle').on('click', () => { const i = $('#ct-key'); i.attr('type', i.attr('type') === 'password' ? 'text' : 'password'); });
    
    // 🚨 디버그 팝업
    $('#ct-debug-btn').on('click', showDebugPopup);
    
    // 🚨 자동 저장 디바운스 시스템
    const autoSave = () => {
        if (_suppressAutoSave) return;
        clearTimeout(_autoSaveTimer);
        _autoSaveTimer = setTimeout(() => {
            if (_suppressAutoSave) return;
            saveSettingsFn();
            catNotify(`${getCompletionEmoji()} 설정이 자동 저장되었습니다.`, "autosave");
        }, 500);
    };
    
    // 모든 설정 필드에 자동 저장 연결
    $('#ct-profile, #ct-auto-mode, #ct-bidirectional, #ct-dialogue-bilingual, #ct-lang, #ct-style, #ct-temperature, #ct-max-tokens, #ct-context-range, #ct-retranslate-strength, #ct-after-edit, #ct-preview-translate, #ct-preview-cleanup').on('change', autoSave);
    $('#ct-key, #ct-model-custom, #ct-user-prompt, #ct-dictionary').on('input', autoSave);
    
    $('#ct-model').val(settings.directModel).on('change', function () {
        const val = $(this).val();
        $('#ct-model-custom').toggle(val === 'custom');
        if (val !== 'custom') {
            // 🚨 bodyObserver 레이스 컨디션 방지: autoSave 전에 즉시 반영
            settings.directModel = val;
            applyTheme(getModelTheme(val), true);
        }
        autoSave();
    });
    $('#ct-model-custom').val(settings.customModelName || '').on('input', function () { settings.customModelName = $(this).val(); applyTheme(getModelTheme($(this).val()), true); });
    // 🚨 직접 연결 토글 버튼
    $('#ct-direct-toggle').on('click', function () {
        const ds = $('#ct-direct-settings');
        const arrow = $('#ct-direct-arrow');
        if (ds.is(':visible')) {
            ds.slideUp(200);
            arrow.text('▶');
        } else {
            ds.slideDown(200);
            arrow.text('▼');
        }
    });
    $('#ct-profile').val(settings.profile).on('change', function () {
        settings.profile = $(this).val();
        const pn = $(this).find('option:selected').text().toLowerCase();
        if (pn.includes('pro') || pn.includes('프로') || pn.includes('tiger') || pn.includes('호랑이')) {
            applyTheme('tiger', true);
        } else if (pn.includes('flash') || pn.includes('플래') || pn.includes('플레') || pn.includes('cat') || pn.includes('고양이')) {
            applyTheme('cat', true);
        } else if (settings.profile === '') {
            applyTheme(getModelTheme(settings.directModel), true);
        } else {
            applyTheme('cat', true);
        }
    });
    $('#ct-style').val(settings.style || 'normal').on('change', function () { if (_suppressAutoSave) return; const preset = STYLE_PRESETS[$(this).val()]; if (preset) $('#ct-temperature').val(preset.temperature); });
    $('#ct-auto-mode').val(settings.autoMode); $('#ct-bidirectional').val(settings.bidirectional || 'off'); $('#ct-dialogue-bilingual').val(settings.dialogueBilingual || 'off'); $('#ct-lang').val(settings.targetLang); $('#ct-temperature').val(settings.temperature || 0.3);
    
    // 대사 병기 변경 시 알림
    $('#ct-dialogue-bilingual').on('change', function() {
        const val = $(this).val();
        const labels = { 'off': '꺼짐', 'ko-en': '한영 병기', 'ko-ja': '한일 병기', 'ko-zh': '한중 병기' };
        if (val !== 'off') { catNotify(`${getThemeEmoji()} 대사 병기: ${labels[val]} 모드 활성화!`, "success"); }
        else { catNotify(`${getThemeEmoji()} 대사 병기 꺼짐`, "success"); }
    });
    
    // 아이콘 표시 초기값 + 토글 로직
    $('#ct-icon-visibility').val(settings.iconVisibility || 'all').on('change', function() {
        const val = $(this).val();
        if (val === 'hide-input') { $('#cat-input-btn, #cat-input-revert, #cat-bulk-btn').hide(); $('.cat-btn-group').removeClass('cat-hidden'); }
        else if (val === 'hide-message') { $('#cat-input-btn, #cat-input-revert, #cat-bulk-btn').show(); $('.cat-btn-group').addClass('cat-hidden'); }
        else { $('#cat-input-btn, #cat-input-revert, #cat-bulk-btn').show(); $('.cat-btn-group').removeClass('cat-hidden'); }
        autoSave();
    });
    // 초기 적용
    const initIconVis = settings.iconVisibility || 'all';
    if (initIconVis === 'hide-input') { setTimeout(() => $('#cat-input-btn, #cat-input-revert, #cat-bulk-btn').hide(), 500); }
    else if (initIconVis === 'hide-message') { setTimeout(() => $('.cat-btn-group').addClass('cat-hidden'), 500); }
    
    $('#ct-dictionary').on('input', function () {
        settings.dictionary = $(this).val();
        $('#ct-dict-reset').text(settings.dictionary.trim() ? '📬' : '📭');
    });
    $('#ct-dict-reset').on('click', async function() {
        $('#ct-dictionary').val(''); settings.dictionary = ''; saveSettingsFn();
        $(this).text('📭');
        await clearAllCache(); updateCacheStats();
        catNotify(`${getThemeEmoji()} 📭 우편함(사전) 비우기 + 캐시 초기화 완료!`, "success");
    });
    
    $('#ct-user-prompt').on('input', function () { settings.userPrompt = $(this).val(); });
    
    // 🚨 번역 프롬프트 프리셋 시스템
    const _rebuildPresetDropdown = () => {
        const select = $('#ct-prompt-preset');
        const currentVal = select.val();
        select.find('option:not(:first)').remove();
        Object.keys(settings.promptPresets || {}).forEach(name => {
            select.append(`<option value="${name}">${name}</option>`);
        });
        if (currentVal && settings.promptPresets?.[currentVal]) select.val(currentVal);
    };
    _rebuildPresetDropdown();
    
    // 프롬프트 선택 시 로드
    $('#ct-prompt-preset').on('change', function() {
        const name = $(this).val();
        if (!name) return;
        const preset = settings.promptPresets?.[name];
        if (preset) {
            _suppressAutoSave = true;  // 🚨 로드 중 autoSave/스타일핸들러 차단
            clearTimeout(_autoSaveTimer);
            settings.userPrompt = preset.prompt || '';
            settings.temperature = preset.temperature ?? 0.3;
            settings.style = preset.style || 'normal';
            $('#ct-user-prompt').val(settings.userPrompt);
            $('#ct-style').val(settings.style);
            $('#ct-temperature').val(settings.temperature);
            _suppressAutoSave = false;
            saveSettingsFn();
            catNotify(`${getThemeEmoji()} 프롬프트 "${name}" 로드!`, "success");
        }
    });
    
    // 프롬프트 저장
    $('#ct-prompt-save').on('click', function() {
        const currentPrompt = $('#ct-user-prompt').val().trim();
        if (!currentPrompt) { catNotify(`⚠️ 추가 지시사항이 비어있습니다.`, "warning"); return; }
        const name = prompt('프롬프트 이름을 입력하세요:', $('#ct-prompt-preset').val() || '');
        if (!name || !name.trim()) return;
        if (!settings.promptPresets) settings.promptPresets = {};
        settings.promptPresets[name.trim()] = { prompt: currentPrompt, temperature: parseFloat($('#ct-temperature').val()) || 0.3, style: $('#ct-style').val() || 'normal' };
        _rebuildPresetDropdown();
        $('#ct-prompt-preset').val(name.trim());
        saveSettingsFn();
        catNotify(`${getThemeEmoji()} 프롬프트 "${name.trim()}" 저장 완료!`, "success");
    });
    
    // 프롬프트 삭제
    $('#ct-prompt-delete').on('click', function() {
        const name = $('#ct-prompt-preset').val();
        if (!name) { catNotify(`⚠️ 삭제할 프롬프트를 선택하세요.`, "warning"); return; }
        if (!confirm(`"${name}" 프롬프트를 삭제하시겠습니까?`)) return;
        delete settings.promptPresets?.[name];
        // 연결된 캐릭터 매핑도 정리
        if (settings.charPresetMap) {
            Object.keys(settings.charPresetMap).forEach(char => {
                if (settings.charPresetMap[char] === name) delete settings.charPresetMap[char];
            });
        }
        $('#ct-prompt-preset').val('');
        _rebuildPresetDropdown();
        saveSettingsFn();
        catNotify(`${getThemeEmoji()} 프롬프트 "${name}" 삭제 완료!`, "success");
    });
    
    // 현재 캐릭터에 프롬프트 연결
    $('#ct-prompt-link').on('click', function() {
        const name = $('#ct-prompt-preset').val();
        // 🚨 클릭 시점의 최신 캐릭터 이름 사용
        const charName = (SillyTavern?.getContext?.()?.name2) || stContext.name2 || '';
        if (!charName || charName === 'SillyTavern System') {
            catNotify(`⚠️ 캐릭터 채팅을 먼저 열어주세요!`, "warning"); return;
        }
        if (!settings.charPresetMap) settings.charPresetMap = {};
        if (!name) {
            // 연결 해제
            delete settings.charPresetMap[charName];
            saveSettingsFn();
            catNotify(`${getThemeEmoji()} ${charName} 프롬프트 연결 해제!`, "success");
        } else {
            settings.charPresetMap[charName] = name;
            saveSettingsFn();
            catNotify(`${getThemeEmoji()} ${charName} → "${name}" 연결 완료!`, "success");
        }
    });
    
    $('#ct-context-range').on('change', function () { let val = parseInt($(this).val()) || 0; val = Math.min(6, Math.max(0, val)); $(this).val(val); });
    $('#cat-save-btn').on('click', () => { saveSettingsFn(true); catNotify(`${getThemeEmoji()} 저장 완료! 기본 설정이 확정되었습니다.`, "success"); });
    $('#ct-clear-cache').on('click', async () => { await clearAllCache(); updateCacheStats(); catNotify(`${getThemeEmoji()} 캐시 전체 삭제 완료! 📂`, "success"); });
    
    // 🚨 오염 채팅 정리: 자동 재번역이 안 되는 경우 사용
    $('#ct-clean-chat').on('click', () => {
        const ctx = SillyTavern?.getContext?.();
        if (!ctx?.chat) { catNotify(`${getThemeEmoji()} 채팅을 찾을 수 없어요`, "warning"); return; }
        if (!confirm('현재 채팅의 모든 메시지에서 swipe 번역 캐시 + 동기화 정보 + 편집 상태를 정리합니다.\n\n표시되는 번역(display_text)은 유지되지만, 다른 스와이프의 저장된 번역들은 삭제됩니다.\n\n계속하시겠어요?')) return;
        
        let cleaned = 0;
        let damaged = []; // 영어 원본이 손실된 메시지 ID
        
        ctx.chat.forEach((msg, i) => {
            if (!msg?.extra) return;
            let touched = false;
            
            // 1. swipe_translations 정리
            if (msg.extra.swipe_translations) { delete msg.extra.swipe_translations; touched = true; }
            if (msg.extra.cat_swipe_id !== undefined) { delete msg.extra.cat_swipe_id; touched = true; }
            
            // 2. 한국어 오염 검사
            const mesIsKorean = msg.extra.original_mes && /[가-힣]/.test(msg.mes) && msg.mes.length > 10;
            const origIsKorean = msg.extra.original_mes && /[가-힣]/.test(msg.extra.original_mes) && msg.extra.original_mes.length > 10;
            
            if (origIsKorean) {
                // 🚨 영어 원본 자체가 손실됨 - 복구 불가
                damaged.push(i);
            } else if (mesIsKorean && msg.extra.original_mes) {
                // msg.mes만 오염 → original_mes에서 복원 가능
                msg.mes = msg.extra.original_mes;
                touched = true;
            }
            
            // 3. DOM 측 정리
            const $mes = $(`.mes[mesid="${i}"]`);
            if ($mes.length > 0) {
                $mes.removeData('cat-edit-active')
                    .removeData('cat-edit-display')
                    .removeData('cat-edit-original')
                    .removeData('cat-edit-type')
                    .removeData('cat-captured-text')
                    .removeData('cat-last-textarea')
                    .removeData('cat-direct-bound');
                $mes.find('.cat-glow-anim').removeClass('cat-glow-anim');
            }
            
            if (touched) cleaned++;
        });
        
        // 4. 글로벌 캡처 Map 초기화
        if (window._catCapturedText) window._catCapturedText.clear();
        
        try { ctx.saveChat(); } catch (e) {}
        
        let msg = `${getThemeEmoji()} ${cleaned}개 메시지 정리 완료!`;
        if (damaged.length > 0) {
            msg += `\n\n⚠️ 영어 원본 손상 (#${damaged.join(', #')}): 이 메시지들은 자동 재번역 불가. ST의 🔄 재생성 또는 메시지 삭제 필요.`;
        }
        catNotify(msg, damaged.length > 0 ? "warning" : "success");
        
        setTimeout(() => {
            if (confirm('정리 완료! 그래도 자동 재번역이 안 되면 페이지 새로고침을 권장해요. 지금 새로고침할까요?')) {
                location.reload();
            }
        }, 1500);
    });
    
    $('#ct-reset-settings').on('click', () => {
        if (!confirm('모든 설정을 초기값으로 되돌리시겠습니까?')) return;
        $('#ct-profile').val(''); $('#ct-key').val('');
        $('#ct-model').val('gemini-2.5-flash'); $('#ct-model-custom').val('').hide();
        $('#ct-auto-mode').val('none'); $('#ct-bidirectional').val('off'); $('#ct-dialogue-bilingual').val('off'); $('#ct-icon-visibility').val('all'); $('#ct-lang').val('Korean'); $('#ct-style').val('normal'); $('#ct-retranslate-strength').val('normal'); $('#ct-after-edit').val('notify'); $('#ct-preview-translate').val('off'); $('#ct-preview-cleanup').val('off');
        $('#ct-temperature').val(0.3); $('#ct-max-tokens').val(8192); $('#ct-context-range').val(1);
        $('#ct-user-prompt').val(''); $('#ct-dictionary').val(''); $('#ct-dict-reset').text('📭');
        settings.promptPresets = {}; settings.charPresetMap = {}; $('#ct-prompt-preset').val('').find('option:not(:first)').remove();
        $('#ct-direct-settings').hide(); $('#ct-direct-arrow').text('▶');
        $('#cat-input-btn, #cat-input-revert, #cat-bulk-btn').show(); $('.cat-btn-group').removeClass('cat-hidden');
        saveSettingsFn(true); catNotify(`${getThemeEmoji()} 설정이 초기화되었습니다!`, "success");
    });
    $('#ct-export').on('click', () => { saveSettingsFn(); exportSettings(settings); catNotify(`${getThemeEmoji()} 설정 내보내기 완료!`, "success"); });
    $('#ct-import-btn').on('click', () => $('#ct-import-file').click());
    $('#ct-import-file').on('change', async function () { const file = this.files[0]; if (!file) return; try { const imported = await importSettings(file); Object.assign(settings, imported); saveSettingsFn(true); catNotify(`${getThemeEmoji()} 설정 가져오기 완료! 새로고침하면 적용됩니다.`, "success"); } catch (e) { catNotify(`${getThemeEmoji()} 오류: ${e.message}`, "error"); } this.value = ''; });
    
    const initialProfileName = ($('#ct-profile option:selected').text() || '').toLowerCase();
    const initialModel = (settings.directModel || '').toLowerCase();
    const allNames = initialProfileName + ' ' + initialModel;
    if (allNames.includes('pro') || allNames.includes('프로') || allNames.includes('호랑이') || allNames.includes('tiger')) {
        applyTheme('tiger');
    } else {
        applyTheme('cat');
    }
}

export function collectSettings() {
    const modelVal = $('#ct-model').val();
    return {
        profile: $('#ct-profile').val() || '', customKey: $('#ct-key').val() || '',
        vertexKey: _settingsRef?.vertexKey || '', vertexProject: _settingsRef?.vertexProject || '',
        vertexRegion: _settingsRef?.vertexRegion || 'global',
        directModel: modelVal === 'custom' ? ($('#ct-model-custom').val() || 'gemini-2.5-flash') : (modelVal || 'gemini-2.5-flash'),
        customModelName: $('#ct-model-custom').val() || '', autoMode: $('#ct-auto-mode').val() || 'none',
        bidirectional: $('#ct-bidirectional').val() || 'off', dialogueBilingual: $('#ct-dialogue-bilingual').val() || 'off', iconVisibility: $('#ct-icon-visibility').val() || 'all',
        targetLang: $('#ct-lang').val() || 'Korean', style: $('#ct-style').val() || 'normal',
        temperature: parseFloat($('#ct-temperature').val()) || 0.3, maxTokens: parseInt($('#ct-max-tokens').val()) || 8192,
        contextRange: Math.min(6, Math.max(0, parseInt($('#ct-context-range').val()) || 1)),
        userPrompt: $('#ct-user-prompt').val() || '', dictionary: $('#ct-dictionary').val() || '',
        retranslateStrength: $('#ct-retranslate-strength').val() || 'normal',
        afterEditMode: $('#ct-after-edit').val() || 'notify',
        previewTranslate: $('#ct-preview-translate').val() || 'off',
        previewCleanup: $('#ct-preview-cleanup').val() || 'off',
        promptPresets: _settingsRef?.promptPresets || {}, charPresetMap: _settingsRef?.charPresetMap || {}
    };
}
export function updateCacheStats() {
    const s = getStats();
    const icon = s.hits > 0 ? '🗂️' : '📂';
    $('#ct-cache-icon').text(icon);
    $('#ct-cache-stats').html(`<span id="ct-cache-icon" style="font-size:1.3em;">${icon}</span> 캐시 히트율: ${s.hitRate}% | 절약 토큰: ~${s.tokensSaved.toLocaleString()}`);
}
let _lastAppliedTheme = null;
export function applyTheme(theme, notify = false) {
    document.body.setAttribute('data-cat-theme', theme); const emoji = theme === 'tiger' ? '🐯' : '🐱'; const editEmoji = theme === 'tiger' ? '🍖' : '🐟';
    $('.cat-theme-emoji').text(emoji); $('.cat-mes-trans-btn .cat-emoji-icon').text(emoji); $('#cat-input-btn .cat-emoji-icon').text(emoji);
    $('.cat-mes-edit-btn .cat-emoji-icon').text(editEmoji);
    if (notify) {
        if (theme === 'tiger') catNotify('🐯 어흥! 호랑이 모드 활성화!', 'success'); else catNotify('🐱 야옹~ 고양이 모드 활성화!', 'success');
    }
    _lastAppliedTheme = theme;
}

export function injectInputButtons(settings, stContext, processMessageFn) {
    if ($('#cat-input-btn').length > 0) {
        const icon = $('#cat-input-btn .cat-emoji-icon'); if (isTranslatingInput) icon.addClass('cat-glow-anim'); else icon.removeClass('cat-glow-anim');
        // 🚨 아이콘 숨김 설정 지속 적용
        const vis = settings.iconVisibility || 'all';
        if (vis === 'hide-input') { $('#cat-input-btn, #cat-input-revert, #cat-bulk-btn').hide(); }
        return;
    }
    const target = $('#send_but'); if (target.length === 0) return;
    const emoji = getThemeEmoji();
    const transBtn = $(`<div id="cat-input-btn" title="번역" class="cat-input-icon interactable"><span class="cat-emoji-icon">${emoji}</span></div>`);
    const revertBtn = $(`<div id="cat-input-revert" title="되돌리기" class="cat-input-icon interactable"><i class="fa-solid fa-rotate-left"></i></div>`);
    const bulkBtn = $(`<div id="cat-bulk-btn" title="전체 번역" class="cat-input-icon interactable"><span class="cat-emoji-icon">⚡</span></div>`);
    target.before(transBtn).before(revertBtn).before(bulkBtn);
    
    // 🚨 생성 직후 아이콘 숨김 설정 적용
    if ((settings.iconVisibility || 'all') === 'hide-input') {
        transBtn.hide(); revertBtn.hide(); bulkBtn.hide();
    }

    transBtn.on('click', async (e) => {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        const sendArea = $('#send_textarea'); const currentText = sendArea.val().trim();
        if (isTranslatingInput || !currentText) return;
        isTranslatingInput = true; transBtn.find('.cat-emoji-icon').addClass('cat-glow-anim');
        try {
            const lastTranslated = sendArea.data('cat-last-translated'); const originalText = sendArea.data('cat-original-text'); const lastTargetLang = sendArea.data('cat-last-target-lang');
            const isRetry = (lastTranslated && currentText === lastTranslated);
            const textToTranslate = isRetry ? originalText : currentText; const forceLang = null; const prevTrans = isRetry ? currentText : null;
            
            catNotify(isRetry ? `${getThemeEmoji()} 입력창 재번역 중...` : `${getThemeEmoji()} 번역 진행 중...`, "success");
            
            const contextRange = parseInt(settings.contextRange) || 1; const lastMsgId = stContext.chat.length - 1;
            const contextMsgs = gatherContextMessages(lastMsgId + 1, stContext, contextRange);
            const bilingualInputLangMap = { 'ko-en': 'English', 'ko-ja': 'Japanese', 'ko-zh': 'Chinese' };
            const inputTargetLang = (settings.dialogueBilingual && settings.dialogueBilingual !== 'off') ? (bilingualInputLangMap[settings.dialogueBilingual] || settings.targetLang) : settings.targetLang;
            const inputSettings = { ...settings, dialogueBilingual: 'off', targetLang: inputTargetLang };
            const result = await fetchTranslation(textToTranslate, inputSettings, stContext, { forceLang, prevTranslation: prevTrans, contextMessages: contextMsgs });
            if (result && result.text && result.text !== currentText) {
                sendArea.data('cat-original-text', textToTranslate); sendArea.data('cat-last-translated', result.text); sendArea.data('cat-last-target-lang', result.lang);
                setTextareaValue(sendArea[0], result.text);
                catNotify(`${getCompletionEmoji()} 입력창 번역 완료!`, "success");
            }
        } finally { isTranslatingInput = false; transBtn.find('.cat-emoji-icon').removeClass('cat-glow-anim'); }
    });
    revertBtn.on('click', (e) => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); const sendArea = $('#send_textarea'); const originalText = sendArea.data('cat-original-text'); if (originalText) { setTextareaValue(sendArea[0], originalText); sendArea.removeData('cat-original-text').removeData('cat-last-translated'); catNotify(`${getThemeEmoji()} 원문 복구 완료!`, "success"); } });
    bulkBtn.on('click', (e) => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); showBulkPopup(e, settings, stContext, processMessageFn); });
}

export function injectMessageButtons(processMessageFn, revertMessageFn) {
    const ctx = SillyTavern?.getContext?.();
    $('.mes:not(:has(.cat-btn-group))').each(function () {
        const msgId = $(this).attr('mesid'); if (!msgId) return;
        const emoji = getThemeEmoji();
        const editEmoji = getCompletionEmoji();
        // 🚨 번역 데이터 유무에 따라 편집 버튼 표시 결정
        const msg = ctx?.chat?.[parseInt(msgId)];
        const hasTransData = msg?.extra?.original_mes || msg?.extra?.display_text;
        const editStyle = hasTransData ? 'opacity:0.8;' : 'opacity:0;pointer-events:none;';
        const group = $(`<div class="cat-btn-group"><span class="cat-mes-trans-btn interactable" title="번역" data-mesid="${msgId}"><span class="cat-emoji-icon">${emoji}</span></span><span class="cat-mes-revert-btn interactable" title="복구" data-mesid="${msgId}"><i class="fa-solid fa-rotate-left"></i></span><span class="cat-mes-edit-btn interactable" title="편집" data-mesid="${msgId}" style="${editStyle}"><span class="cat-emoji-icon">${editEmoji}</span></span></div>`);
        let target = $(this).find('.name_text'); if (target.length > 0) { target.append(group); } else { let sysWrap = $('<div style="text-align:right; margin-bottom:4px;"></div>'); sysWrap.append(group); $(this).find('.mes_text').first().prepend(sysWrap); }
    });
    // 🚨 이미 번역된 메시지의 편집 버튼 표시 복원 (인라인 스타일)
    if (ctx?.chat) {
        let restoredCount = 0;
        $('.mes').each(function () {
            const msgId = parseInt($(this).attr('mesid'));
            const msg = ctx.chat[msgId];
            if (msg?.extra?.original_mes || msg?.extra?.display_text) {
                $(this).find('.cat-mes-edit-btn').css({ opacity: 0.8, 'pointer-events': 'auto' });
                restoredCount++;
            }
        });
        if (restoredCount > 0) console.log(`[CAT] 🐟 편집 아이콘 복원: ${restoredCount}개 메시지`);
    }
    // 🚨 메시지 아이콘 숨김 설정 적용
    const vis = $('#ct-icon-visibility').val() || 'all';
    if (vis === 'hide-message') { $('.cat-btn-group').addClass('cat-hidden'); }
    if (!window._catMesBtnDelegated) {
        window._catMesBtnDelegated = true;
        $(document).on('click', '.cat-mes-trans-btn', function (e) { e.stopPropagation(); const msgId = $(this).data('mesid') || $(this).closest('.mes').attr('mesid'); const isUser = $(this).closest('.mes').hasClass('mes_user'); if (msgId !== undefined) processMessageFn(msgId, isUser); });
        $(document).on('click', '.cat-mes-revert-btn', function (e) { e.stopPropagation(); const msgId = $(this).data('mesid') || $(this).closest('.mes').attr('mesid'); if (msgId !== undefined) revertMessageFn(msgId); });
        // 🚨 🐟/🍖 클릭 → 바로 번역문 편집 모드 진입
        $(document).on('click', '.cat-mes-edit-btn', function (e) {
            e.stopPropagation();
            const msgId = parseInt($(this).data('mesid') || $(this).closest('.mes').attr('mesid'));
            const mesBlock = $(`.mes[mesid="${msgId}"]`);
            const ctx = SillyTavern?.getContext?.();
            const msg = ctx?.chat?.[msgId];
            if (!msg?.extra?.original_mes) {
                catNotify(`${getThemeEmoji()} 번역 데이터가 없어요.`, "warning");
                return;
            }
            enterTranslatedEdit(mesBlock, msg, msgId);
        });
    }
}

// 🚨 🐟/🍖 → 바로 번역문 편집 모드 진입
function enterTranslatedEdit(mesBlock, msg, msgId) {
    const savedOriginal = msg.extra.original_mes;
    const savedDisplay = msg.extra.display_text;

    // 🚨 편집 모드 마킹
    mesBlock.data('cat-edit-type', 'translated');

    // ST 편집 모드 진입
    const stEditBtn = mesBlock.find('.mes_edit');
    if (stEditBtn.length) stEditBtn.trigger('click');

    // textarea 나타난 후 번역문 삽입
    setTimeout(() => {
        const editArea = mesBlock.find('textarea.edit_textarea:visible, textarea.mes_edit_textarea:visible').first();
        if (!editArea.length) return;

        setTextareaValue(editArea[0], savedDisplay || msg.mes);
        catNotify(`${getCompletionEmoji()} 번역문 편집 모드`, "success");

        // 🚨 편집 닫힘 감지
        const _editWatcher = setInterval(() => {
            const stillEditing = mesBlock.find('textarea.edit_textarea:visible, textarea.mes_edit_textarea:visible').length > 0;
            if (!stillEditing) {
                clearInterval(_editWatcher);
                mesBlock.removeData('cat-edit-type').removeData('cat-edit-active').removeData('cat-edit-display').removeData('cat-edit-original');
                const ctx = SillyTavern?.getContext?.();
                const freshMsg = ctx?.chat?.[msgId];
                if (!freshMsg) return;

                const currentMes = freshMsg.mes;
                if (currentMes !== savedOriginal) {
                    // 번역문 수정 후 저장 → display_text 갱신, 원문 보존
                    if (!freshMsg.extra) freshMsg.extra = {};
                    freshMsg.extra.display_text = currentMes;
                    freshMsg.extra.original_mes = savedOriginal;
                    freshMsg.mes = savedOriginal;
                    console.log(`[CAT] 🐟 번역문 편집 저장 → display_text 갱신, 원문 보존 #${msgId}`);
                } else {
                    // 수정 없이 닫기 → 기존 번역문 재적용
                    if (freshMsg.extra) {
                        freshMsg.extra.display_text = savedDisplay;
                        freshMsg.extra.original_mes = savedOriginal;
                    }
                    console.log(`[CAT] 🐟 번역문 편집 취소 → 기존 번역문 재적용 #${msgId}`);
                }
                mesBlock.attr('data-cat-translated', 'true');
                ctx.updateMessageBlock(msgId, freshMsg);
            }
        }, 300);
    }, 350);
}

// 🚨 디버그 팝업: 마지막 번역 요청/응답 표시
function showDebugPopup() {
    $('.cat-debug-overlay').remove();
    const log = getLastDebugLog();
    const ts = log?.timestamp || '-';
    const mode = log?.mode || '(없음)';
    const model = log?.model || '(없음)';
    const error = log?.error || '(에러 없음)';
    const prompt = log?.prompt ? (log.prompt.length > 800 ? log.prompt.substring(0, 800) + '...(생략)' : log.prompt) : '(아직 요청 없음)';
    const raw = log?.rawResponse ? (log.rawResponse.length > 800 ? log.rawResponse.substring(0, 800) + '...(생략)' : log.rawResponse) : '(아직 LLM 응답 없음)';
    const cleaned = log?.cleaned ? (log.cleaned.length > 800 ? log.cleaned.substring(0, 800) + '...(생략)' : log.cleaned) : '(없음)';
    const thought = log?.thought ? (log.thought.length > 300 ? log.thought.substring(0, 300) + '...(생략)' : log.thought) : null;

    const overlay = $(`
    <div class="cat-debug-overlay" style="position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:999999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div class="cat-debug-modal" style="background:var(--SmartThemeBodyColor, #222); color:var(--SmartThemeEmColor, #fff); border-radius:12px; max-width:600px; width:100%; max-height:85vh; overflow-y:auto; padding:20px; box-shadow:0 8px 32px rgba(0,0,0,0.5);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="font-size:1.1em; font-weight:bold;">🐛 마지막 LLM 응답 / 에러 로그</div>
                <span class="cat-debug-close" style="cursor:pointer; font-size:1.5em; opacity:0.6; padding:4px 8px;">✕</span>
            </div>
            <div style="background:rgba(255,100,100,0.1); border:1px solid rgba(255,100,100,0.3); border-radius:8px; padding:10px; margin-bottom:10px;">
                <div style="font-weight:bold; margin-bottom:4px;">📌 에러 정보</div>
                <div style="font-size:0.85em; opacity:0.8;">시각: ${ts}<br>에러: ${error}</div>
            </div>
            <div style="background:rgba(100,180,255,0.1); border:1px solid rgba(100,180,255,0.3); border-radius:8px; padding:10px; margin-bottom:10px;">
                <div style="font-weight:bold; margin-bottom:4px;">🔑 API 호출 상태</div>
                <div style="font-size:0.85em; opacity:0.8;">모드: ${mode}<br>모델: ${model}</div>
            </div>
            <div style="background:rgba(255,200,50,0.1); border:1px solid rgba(255,200,50,0.3); border-radius:8px; padding:10px; margin-bottom:10px;">
                <div style="font-weight:bold; margin-bottom:4px;">📤 보낸 프롬프트 (${(log?.prompt || '').length}자)</div>
                <div style="font-size:0.8em; opacity:0.8; white-space:pre-wrap; word-break:break-all; max-height:200px; overflow-y:auto; font-family:monospace;">${prompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </div>
            <div style="background:rgba(100,255,100,0.1); border:1px solid rgba(100,255,100,0.3); border-radius:8px; padding:10px; margin-bottom:10px;">
                <div style="font-weight:bold; margin-bottom:4px;">📋 Raw LLM 응답 (${(log?.rawResponse || '').length}자)</div>
                <div style="font-size:0.8em; opacity:0.8; white-space:pre-wrap; word-break:break-all; max-height:200px; overflow-y:auto; font-family:monospace;">${raw.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </div>
            ${thought ? `<div style="background:rgba(200,100,255,0.1); border:1px solid rgba(200,100,255,0.3); border-radius:8px; padding:10px; margin-bottom:10px;">
                <div style="font-weight:bold; margin-bottom:4px;">🧠 사고 과정</div>
                <div style="font-size:0.8em; opacity:0.8; white-space:pre-wrap; word-break:break-all; max-height:150px; overflow-y:auto; font-family:monospace;">${thought.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </div>` : ''}
            <div style="background:rgba(100,200,255,0.1); border:1px solid rgba(100,200,255,0.3); border-radius:8px; padding:10px; margin-bottom:10px;">
                <div style="font-weight:bold; margin-bottom:4px;">✨ 후처리 결과 (${(log?.cleaned || '').length}자)</div>
                <div style="font-size:0.8em; opacity:0.8; white-space:pre-wrap; word-break:break-all; max-height:200px; overflow-y:auto; font-family:monospace;">${cleaned.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </div>
            <div style="display:flex; gap:8px; margin-bottom:8px;">
                <button class="cat-debug-copy menu_button" style="flex:1;">📋 복사</button>
                <button class="cat-debug-close menu_button" style="flex:1;">닫기</button>
            </div>
            <div style="text-align:center; font-size:0.8em; opacity:0.5;">💡 이 로그를 복사해서 보여주면 정확한 원인 파악 가능!</div>
        </div>
    </div>`);

    $('body').append(overlay);
    overlay.find('.cat-debug-close').on('click', () => overlay.remove());
    overlay.on('click', (e) => { if ($(e.target).hasClass('cat-debug-overlay')) overlay.remove(); });
    overlay.find('.cat-debug-copy').on('click', () => {
        const copyText = `[🐱 Translator 디버그 로그]\n시각: ${ts}\n모드: ${mode}\n모델: ${model}\n에러: ${error}\n\n--- 프롬프트 ---\n${log?.prompt || '없음'}\n\n--- LLM 응답 ---\n${log?.rawResponse || '없음'}\n\n--- 후처리 결과 ---\n${log?.cleaned || '없음'}${thought ? '\n\n--- 사고 과정 ---\n' + thought : ''}`;
        navigator.clipboard.writeText(copyText).then(() => catNotify('📋 디버그 로그 복사 완료!', 'success')).catch(() => catNotify('복사 실패 — 수동으로 복사해주세요', 'warning'));
    });
}

function showBulkPopup(event, settings, stContext, processMessageFn) {
    $('.cat-bulk-popup').remove();
    $(document).off('click.catBulkClose touchstart.catBulkClose');
    
    const popup = $(`<div class="cat-bulk-popup">
        <div class="cat-bulk-option" data-count="all">📋 전체 번역</div>
        <div class="cat-bulk-option" data-count="20">🦁 최근 20개</div>
        <div class="cat-bulk-option" data-count="15">🐯 최근 15개</div>
        <div class="cat-bulk-option" data-count="10">🐱 최근 10개</div>
        <div class="cat-bulk-option" data-count="5">🐭 최근 5개</div>
        <div class="cat-bulk-option" data-count="custom">✏️ 직접 입력...</div>
    </div>`);
    
    const btn = document.getElementById('cat-bulk-btn');
    if (!btn) return;
    
    $('body').append(popup);
    const rect = btn.getBoundingClientRect();
    
    // 번개 아이콘 바로 위에 절대 좌표로 고정
    popup.css({ 
        position: 'fixed', 
        top: (rect.top - popup.outerHeight() - 10) + 'px', 
        left: Math.max(10, rect.left - 40) + 'px', 
        zIndex: 2147483647 
    });
    
    // 터치 중복 방지 (무적 시간)
    let _bulkJustOpened = true;
    setTimeout(() => { _bulkJustOpened = false; }, 300);
    
    popup.on('touchstart click', (e) => { e.stopPropagation(); });
    
    popup.find('.cat-bulk-option').on('click touchend', async function (e) {
        e.preventDefault(); e.stopPropagation();
        let count = $(this).data('count');
        if (count === 'custom') {
            popup.remove();
            $(document).off('click.catBulkClose touchstart.catBulkClose');
            const input = prompt('번역할 최근 메시지 수를 입력하세요:', '10');
            if (!input || isNaN(parseInt(input))) return;
            count = parseInt(input);
            if (count <= 0) return;
        }
        popup.remove();
        $(document).off('click.catBulkClose touchstart.catBulkClose');
        await executeBulkTranslation(count, settings, stContext, processMessageFn);
    });
    
    setTimeout(() => {
        $(document).on('click.catBulkClose touchstart.catBulkClose', (e) => {
            if (_bulkJustOpened) return;
            if (!$(e.target).closest('.cat-bulk-popup, #cat-bulk-btn').length) {
                popup.remove();
                $(document).off('click.catBulkClose touchstart.catBulkClose');
            }
        });
    }, 300);
}

async function executeBulkTranslation(count, settings, stContext, processMessageFn) {
    const BULK_CONCURRENCY = 2;  // 🚨 동시 워커 수 (함수 최상단 선언)
    const allMes = $('.mes'); let targets = []; let originalCount = 0;
    if (count === 'all') { allMes.each(function () { targets.push($(this)); }); } else { const num = parseInt(count); const start = Math.max(0, allMes.length - num); allMes.slice(start).each(function () { targets.push($(this)); }); }
    originalCount = targets.length;
    targets = targets.filter(el => { const msgId = parseInt(el.attr('mesid'), 10); const msg = stContext.chat[msgId]; return msg && !msg.extra?.display_text; });
    const skipped = originalCount - targets.length;
    if (targets.length === 0) { catNotify(`${getThemeEmoji()} 번역할 메시지가 없습니다. (${skipped}개 이미 번역됨)`, "warning"); return; }

    bulkAbortController = new AbortController(); const total = targets.length; let completed = 0;
    $('#cat-bulk-btn').html('<span class="cat-emoji-icon" style="filter:grayscale(1);">⚡</span>');
    const abortHandler = () => { if (bulkAbortController) bulkAbortController.abort(); };
    $('#cat-bulk-btn').off('click').on('click', (e) => { e.preventDefault(); abortHandler(); });

    const progressEl = catNotifyProgress(`${getThemeEmoji()} 벌크 번역 중... (0/${total}) [클릭시 중단]`, abortHandler);
    const bulkStartTime = performance.now();
    console.log(`[CAT] ⚡ 벌크 시작: ${total}개 메시지, 동시 ${BULK_CONCURRENCY}개 병렬`);
    // 🚨 병렬 처리: 동시 2개 워커로 벌크 속도 ~2배 향상
    let taskIdx = 0;
    const bulkWorker = async () => {
        while (taskIdx < targets.length) {
            if (bulkAbortController.signal.aborted) return;
            const i = taskIdx++;
            if (i >= targets.length) return;
            const el = targets[i];
            const msgId = el.attr('mesid'); const isUser = el.hasClass('mes_user');
            await processMessageFn(msgId, isUser, bulkAbortController.signal, true);
            completed++;
            if (progressEl.length) progressEl.text(`${getThemeEmoji()} 벌크 번역 중... (${completed}/${total}) [클릭시 중단]`);
            if (!bulkAbortController.signal.aborted) await new Promise(r => setTimeout(r, 150));
        }
    };
    await Promise.all(Array.from({ length: BULK_CONCURRENCY }, () => bulkWorker()));
    const bulkElapsed = ((performance.now() - bulkStartTime) / 1000).toFixed(1);
    console.log(`[CAT] ⚡ 벌크 완료: ${completed}/${total}개, ${bulkElapsed}초 소요`);
    progressEl.remove(); $('#cat-bulk-btn').html('<span class="cat-emoji-icon">⚡</span>');
    $('#cat-bulk-btn').off('click').on('click', (e) => { e.preventDefault(); e.stopPropagation(); showBulkPopup(e, settings, stContext, processMessageFn); });
    if (bulkAbortController.signal.aborted) catNotify(`🔴 번역 중단됨 (${completed}개 완료)`, "error"); else catNotify(`${getCompletionEmoji()} 벌크 완료! ${completed}개 번역${skipped > 0 ? ', ' + skipped + '개 스킵' : ''}`, "success");
    bulkAbortController = null;
}

export async function showHistoryPopup(originalText, targetLang, anchorEl, onSelect, modelKey = 'default') {
    $('.cat-history-popup').remove();
    const history = await getHistory(originalText, targetLang, modelKey);
    if (history.length < 3) return false;

    const sorted = [...history].sort((a, b) => { if (a.pinned && !b.pinned) return -1; if (!a.pinned && b.pinned) return 1; return b.time - a.time; }).slice(0, 5);
    let items = sorted.map((h, i) => {
        const pinClass = h.pinned ? 'cat-pinned' : ''; const pinIcon = h.pinned ? '📌' : '📍'; const truncated = h.text.length > 80 ? h.text.substring(0, 80) + '...' : h.text;
        return `<div class="cat-history-item ${pinClass}" data-idx="${i}"><span class="cat-history-text" data-text="${encodeURIComponent(h.text)}">${truncated}</span><span class="cat-history-pin" data-text="${encodeURIComponent(h.text)}">${pinIcon}</span></div>`;
    }).join('');
    items += `<div class="cat-history-item cat-history-new">🔄 새로 번역</div>`;

    const popup = $(`<div class="cat-history-popup">${items}</div>`);
    
    const rect = anchorEl[0].getBoundingClientRect();
    const popupWidth = 280;
    let leftPos = rect.left;
    
    if (leftPos + popupWidth > window.innerWidth - 8) {
        leftPos = window.innerWidth - popupWidth - 8;
    }
    leftPos = Math.max(8, leftPos);
    
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow > 200) {
        popup.css({ position: 'fixed', top: (rect.bottom + 4) + 'px', left: leftPos + 'px', zIndex: 2147483647 });
    } else {
        popup.css({ position: 'fixed', bottom: (window.innerHeight - rect.top + 4) + 'px', left: leftPos + 'px', zIndex: 2147483647 });
    }
    
    $('body').append(popup);

    popup.find('.cat-history-text').on('click', function () { const text = decodeURIComponent($(this).data('text')); onSelect(text, false); popup.remove(); });
    popup.find('.cat-history-pin').on('click', async function (e) { e.stopPropagation(); const text = decodeURIComponent($(this).data('text')); await togglePin(originalText, targetLang, text, modelKey); popup.remove(); showHistoryPopup(originalText, targetLang, anchorEl, onSelect, modelKey); });
    
    let newTransBusy = false;
    popup.find('.cat-history-new').on('click', () => {
        if (newTransBusy) return;
        newTransBusy = true;
        catNotify(`${getThemeEmoji()} 새로운 번역 생성 중...`, "success");
        onSelect(null, true);
        popup.remove();
    });

    setTimeout(() => {
        $(document).on('click.catHistoryClose touchstart.catHistoryClose', (e) => {
            if (!$(e.target).closest('.cat-history-popup').length) {
                popup.remove();
                $(document).off('click.catHistoryClose touchstart.catHistoryClose');
            }
        });
    }, 500);
    return true;
}

export function setupDragDictionary(settings, saveSettingsFn) {
    let pawIcon = null; let _dragDebounce = null;
    const handleSelection = () => {
        clearTimeout(_dragDebounce);
        _dragDebounce = setTimeout(() => {
            const selection = window.getSelection(); const selectedText = selection?.toString()?.trim(); $('.cat-drag-paw').remove();
            if (!selectedText || selectedText.length === 0 || selectedText.length > 100) return;
            const anchorNode = selection.anchorNode; if (!anchorNode || !$(anchorNode).closest('#chat').length) return;
            let range; try { range = selection.getRangeAt(0); } catch (e) { return; }
            const rect = range.getBoundingClientRect(); if (rect.width === 0) return;
            pawIcon = $(`<div class="cat-drag-paw" title="사전 등록">🐾</div>`); const isMobile = window.innerWidth < 768; const topOffset = isMobile ? rect.bottom + 12 : rect.bottom + 4;
            pawIcon.css({ position: 'fixed', top: Math.min(topOffset, window.innerHeight - 50) + 'px', left: Math.max(8, rect.left + rect.width / 2 - 14) + 'px', zIndex: 99999 });
            $('body').append(pawIcon);
            pawIcon.on('click', (ev) => { ev.stopPropagation(); showDragDictPopup(selectedText, rect, settings, saveSettingsFn); pawIcon.remove(); });
            setTimeout(() => pawIcon?.remove(), 8000);
        }, 200);
    };
    document.addEventListener('selectionchange', handleSelection); $(document).on('mouseup touchend', '#chat', handleSelection);
    $(document).on('mousedown', (e) => { if (!$(e.target).closest('.cat-drag-paw, .cat-drag-popup').length) { $('.cat-drag-paw, .cat-drag-popup').remove(); } });
}

function showDragDictPopup(selectedText, rect, settings, saveSettingsFn) {
    $('.cat-drag-popup').remove();
    const popup = $(`<div class="cat-drag-popup"><div class="cat-drag-header">"${selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}" →</div><input type="text" class="cat-drag-input text_pole" placeholder="번역어 입력"><div class="cat-drag-actions"><button class="cat-drag-register menu_button">등록</button><button class="cat-drag-cancel menu_button">취소</button></div></div>`);
    const isMobile = window.innerWidth < 768; if (isMobile) { popup.css({ position: 'fixed', top: '60px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999, width: 'calc(100vw - 32px)', maxWidth: '320px' }); } else { popup.css({ position: 'fixed', top: (rect.bottom + 8) + 'px', left: Math.max(8, rect.left - 20) + 'px', zIndex: 99999 }); }
    $('body').append(popup); popup.find('.cat-drag-input').focus();
    const doRegister = () => {
        const transWord = popup.find('.cat-drag-input').val().trim(); if (!transWord) return;
        const existingLines = (settings.dictionary || '').split('\n').filter(l => l.includes('='));
        const isDuplicate = existingLines.some(line => {
            const parts = line.split('=');
            const orig = parts[0].trim().toLowerCase();
            const trans = parts.slice(1).join('=').trim().toLowerCase();
            return orig === selectedText.toLowerCase() && trans === transWord.toLowerCase();
        });
        if (isDuplicate) {
            catNotify(`⚠️ "${selectedText}=${transWord}" 동일한 쌍이 이미 등록되어 있습니다!`, "warning");
            popup.remove(); return;
        }
        const newEntry = `${selectedText}=${transWord}`; const current = settings.dictionary || '';
        settings.dictionary = current ? `${current}\n${newEntry}` : newEntry; $('#ct-dictionary').val(settings.dictionary);
        $('#ct-dict-reset').text('📬');
        saveSettingsFn(); catNotify(`🐾 사전 등록 완료! ${selectedText} → ${transWord}`, "success"); popup.remove();
    };
    popup.find('.cat-drag-register').on('click', doRegister); popup.find('.cat-drag-input').on('keydown', (e) => { if (e.key === 'Enter') doRegister(); if (e.key === 'Escape') popup.remove(); }); popup.find('.cat-drag-cancel').on('click', () => popup.remove());
}

// 🚨 원문 수정 감지 → 재번역 안내 토스트 (afterEditMode === 'notify')
function showRetranslatePrompt(msgId, processMessageFn) {
    $('.cat-retranslate-toast').remove();
    const toast = $(`
        <div class="cat-retranslate-toast" style="position:fixed; bottom:80px; left:50%; transform:translateX(-50%); z-index:99999; background:var(--SmartThemeBlurTintColor,#333); color:var(--SmartThemeBodyColor,#fff); border:1px solid var(--ca-accent,#888); border-radius:10px; padding:10px 14px; box-shadow:0 4px 16px rgba(0,0,0,0.3); display:flex; align-items:center; gap:10px; max-width:90vw;">
            <span>${getThemeEmoji()} 원문이 수정되었어요. 재번역할까요?</span>
            <button class="cat-retranslate-yes menu_button" style="padding:4px 10px; margin:0;">재번역</button>
            <span class="cat-retranslate-close" style="cursor:pointer; opacity:0.6; padding:0 4px;">✕</span>
        </div>
    `);
    $('body').append(toast);
    toast.find('.cat-retranslate-yes').on('click', () => {
        toast.remove();
        const mesBlock = $(`.mes[mesid="${msgId}"]`);
        const msg = SillyTavern.getContext().chat[msgId];
        if (msg?.extra) delete msg.extra.display_text;
        mesBlock.removeAttr('data-cat-translated');
        processMessageFn(msgId, false, null, false, false);
    });
    toast.find('.cat-retranslate-close').on('click', () => toast.remove());
    setTimeout(() => toast.fadeOut(400, () => toast.remove()), 10000);
}

export function setupMutationObserver(processMessageFn, revertMessageFn, settings, stContext) {
    const chatContainer = document.getElementById('chat'); if (!chatContainer) { setTimeout(() => setupMutationObserver(processMessageFn, revertMessageFn, settings, stContext), 500); return; }
    const observer = new MutationObserver((mutations) => { let needsButtonInjection = false; for (const mutation of mutations) { if (mutation.addedNodes.length > 0) { needsButtonInjection = true; break; } } if (needsButtonInjection) { injectMessageButtons(processMessageFn, revertMessageFn); injectInputButtons(settings, stContext, processMessageFn); }
        // 🚨 편집 모드 호환: 번역된 메시지의 edit textarea에 display_text 표시
        // ST가 편집 모드 진입 시 data-cat-translated를 제거하므로, msg.extra로 판별
        $('.mes').each(function() {
            const mesBlock = $(this);
            const editArea = mesBlock.find('textarea.edit_textarea:visible, textarea.mes_edit_textarea:visible').first();
            const msgId = parseInt(mesBlock.attr('mesid'));
            const msg = stContext.chat[msgId];
            if (!msg) return;
            
            // 번역 데이터가 없는 메시지는 스킵 (백업 데이터도 확인)
            const hasTransData = msg.extra?.original_mes || mesBlock.data('cat-edit-original');
            if (!hasTransData) return;
            
            if (editArea.length > 0 && !mesBlock.data('cat-edit-active')) {
                // 편집 모드 진입: display_text를 백업
                mesBlock.data('cat-edit-active', true);
                if (msg.extra?.display_text) mesBlock.data('cat-edit-display', msg.extra.display_text);
                if (msg.extra?.original_mes) mesBlock.data('cat-edit-original', msg.extra.original_mes);
                
                // 🚨 textarea에 직접 input 리스너 바인딩 (글로벌 Map에 저장)
                const msgIdStr = String(msgId);
                window._catCapturedText = window._catCapturedText || new Map();
                window._catCapturedText.set(msgIdStr, editArea.val()); // 초기값
                editArea.off('input.catedit keyup.catedit').on('input.catedit keyup.catedit', function() {
                    const val = $(this).val();
                    if (val) {
                        window._catCapturedText.set(msgIdStr, val);
                    }
                });
                
                // 🚨 ✓ 버튼에 직접 클릭 핸들러 바인딩 (위임 이벤트 백업)
                // 모바일 ST에서 $(document).on이 안 잡히는 케이스 대응
                const $doneBtn = mesBlock.find('.mes_edit_done, .mes_edit_save, .edit_mes_save, [class*="mes_edit_done"]').first();
                if ($doneBtn.length > 0 && !$doneBtn.data('cat-direct-bound')) {
                    $doneBtn.data('cat-direct-bound', true);
                    $doneBtn.on('click.catdirect', function() {
                        const $ta = mesBlock.find('textarea').first();
                        if ($ta.length > 0 && $ta.val()) {
                            window._catCapturedText.set(msgIdStr, $ta.val());
                        }
                        const captured = window._catCapturedText.get(msgIdStr);
                        console.log(`[CAT] ✓ 직접 핸들러 #${msgIdStr} 캡처: ${captured ? captured.substring(0, 50) : '없음'}`);
                        catNotify(`${getThemeEmoji ? getThemeEmoji() : '🐱'} 편집 저장 #${msgIdStr}`, "info");
                        // index.js의 handleEditSaved를 window에서 호출
                        setTimeout(() => {
                            if (typeof window._catHandleEditSaved === 'function') {
                                window._catHandleEditSaved(msgIdStr, captured);
                            }
                        }, 500);
                    });
                }
            } else if (editArea.length === 0 && mesBlock.data('cat-edit-active')) {
                // 편집 모드 종료 - 백업 데이터만 정리 (실제 처리는 index.js handleEditSaved + 폴링이 담당)
                mesBlock.removeData('cat-edit-active');
                
                // 🚨 🐟/🍖 편집 팝업에서 진입한 편집은 _editWatcher가 처리 → 여기서 스킵
                if (mesBlock.data('cat-edit-type')) return;
                
                const savedDisplay = mesBlock.data('cat-edit-display');
                const savedOriginal = mesBlock.data('cat-edit-original');
                mesBlock.removeData('cat-edit-display').removeData('cat-edit-original');
                
                if (savedDisplay && savedOriginal) {
                    // msg.mes가 한국어로 오염되었으면 원문 복원만 (자동 재번역은 index.js handleEditSaved가 담당)
                    const hasKorean = /[가-힣]/.test(msg.mes) && msg.mes.length > 10;
                    if (hasKorean) {
                        if (!msg.extra) msg.extra = {};
                        msg.extra.original_mes = savedOriginal;
                        msg.mes = savedOriginal;
                        msg.extra.display_text = savedDisplay;
                        mesBlock.attr('data-cat-translated', 'true');
                        stContext.updateMessageBlock(msgId, msg);
                        console.log(`[CAT] 🛡️ 옵저버: 한국어 차단, 원문 보존 #${msgId}`);
                    } else if (msg.mes === savedOriginal) {
                        // 변경 없음 → display_text 재적용
                        if (!msg.extra) msg.extra = {};
                        msg.extra.original_mes = savedOriginal;
                        msg.extra.display_text = savedDisplay;
                        mesBlock.attr('data-cat-translated', 'true');
                        stContext.updateMessageBlock(msgId, msg);
                    }
                    // 영어 수정된 경우는 handleEditSaved에서 처리 → 여기서는 아무것도 안 함
                }
            }
        });
    });
    observer.observe(chatContainer, { childList: true, subtree: true });
    injectMessageButtons(processMessageFn, revertMessageFn); injectInputButtons(settings, stContext, processMessageFn); setInterval(() => injectInputButtons(settings, stContext, processMessageFn), 2000);
}

