// ============================================================
// 🐱 Translator v1.0.4 - utils.js
// 유틸리티: 알림, 정규식 세탁기, HTML/CSS 방어, 언어 감지
// ============================================================

export function getThemeEmoji() {
    const theme = document.body.getAttribute('data-cat-theme');
    return theme === 'tiger' ? '🐯' : '🐱';
}

export function getCompletionEmoji() {
    const theme = document.body.getAttribute('data-cat-theme');
    return theme === 'tiger' ? '🍖' : '🐟';
}

export function catNotify(message, type = 'success') {
    // 같은 내용 중복 알림 방지
    const existing = $('.cat-notification');
    let isDuplicate = false;
    existing.each(function() { if ($(this).text() === message) isDuplicate = true; });
    if (isDuplicate) return existing.first();
    
    // 최대 3개까지만 스택, 오래된 것부터 제거
    if (existing.length >= 3) existing.first().removeClass('show').remove();
    
    const emoji = getThemeEmoji();
    const colors = { success: '#2ecc71', warning: '#f39c12', error: '#e74c3c', progress: '#f39c12', autosave: '#1e8449' };
    const bgColor = colors[type] || colors.success;
    const displayMsg = message.replace(/^(🐱|🐯)\s*/, `${emoji} `);
    const notifyHtml = $(`<div class="cat-notification cat-native-font" style="background-color: ${bgColor};">${displayMsg}</div>`);
    $('body').append(notifyHtml);
    
    // 스택 위치 계산: 기존 알림들 아래에 쌓기
    const _recalcStack = () => {
        let topOffset = 20;
        $('.cat-notification.show').each(function() {
            $(this).css('top', topOffset + 'px');
            topOffset += $(this).outerHeight() + 8;
        });
    };
    
    requestAnimationFrame(() => { notifyHtml.addClass('show'); _recalcStack(); });

    if (type !== 'progress') {
        setTimeout(() => {
            notifyHtml.removeClass('show');
            setTimeout(() => { notifyHtml.remove(); _recalcStack(); }, 500);
        }, 2500);
    }
    return notifyHtml;
}

export function catNotifyProgress(message, onAbort) {
    const el = catNotify(message, 'progress');
    if (onAbort) {
        el.css({ cursor: 'pointer', pointerEvents: 'auto' });
        el.on('click', () => { onAbort(); el.removeClass('show'); setTimeout(() => el.remove(), 500); });
    }
    return el;
}

// 🚨 정밀 클리너: AI가 추가한 래핑만 제거, 원본 코드블록/YAML 보존!
export function cleanResult(text, originalText = null) {
    if (!text) return "";
    
    // AI가 앞에 붙이는 "번역:" 등 접두어 제거
    let cleaned = text.replace(/^(번역|Translation|Output|Input|Result):\s*/gi, "");
    
    // 🚨 추론/사고 과정 텍스트 자동 제거 (Gemini Pro 모델이 종종 출력)
    // 영어 추론 단락만 정확히 제거 (한국어가 시작되는 지점까지만)
    // 핵심 마커: "Let's break down", "I have completed", "I will now proceed" 등
    const reasoningStartMarkers = /^(Let'?s break down|I have completed|I will now proceed|I have identified|Based on the directives|Let me translate|I do not need further|Looking at the (text|source|context)|Analyzing the (text|source|context)|First, let me|To translate this|Here is my analysis)/i;
    
    if (reasoningStartMarkers.test(cleaned)) {
        // 추론 시작 → 한국어/일본어/중국어가 시작되는 첫 위치까지 잘라냄
        const targetLangMatch = cleaned.match(/[\u3131-\uD79D\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/);
        if (targetLangMatch) {
            const targetIdx = targetLangMatch.index;
            // 추론 단락이 한국어 시작 직전까지만 차지하는지 검증
            // (영어가 50자 이상 + 한국어 시작 → 추론 제거)
            const beforeTarget = cleaned.substring(0, targetIdx);
            if (beforeTarget.length > 30 && /[a-zA-Z]/.test(beforeTarget)) {
                cleaned = cleaned.substring(targetIdx);
                console.log('[CAT] 🧹 추론 텍스트 제거됨');
            }
        }
    }
    cleaned = cleaned.trim();
    
    // AI가 응답 전체를 코드블록으로 감싼 경우만 벗기기
    const wholeCodeBlockMatch = cleaned.match(/^```[a-z]*\n([\s\S]*?)\n```\s*$/i);
    if (wholeCodeBlockMatch) {
        const inner = wholeCodeBlockMatch[1];
        if (!inner.includes('```')) {
            cleaned = inner;
        }
    }
    
    // 🚨 한영병기 후처리: "대사"[번역] → "대사 [번역]" (따옴표 안으로 이동)
    // 패턴1: "text"[한국어] → "text [한국어]"
    cleaned = cleaned.replace(/"([^"]*?)"\s*\[([^\]]+)\]/g, '"$1 [$2]"');
    // 패턴2: 「text」[한국어] → 「text [한국어]」
    cleaned = cleaned.replace(/「([^」]*?)」\s*\[([^\]]+)\]/g, '「$1 [$2]」');
    // 패턴3: 『text』[한국어] → 『text [한국어]』
    cleaned = cleaned.replace(/『([^』]*?)』\s*\[([^\]]+)\]/g, '『$1 [$2]』');
    
    // 🚨 AI 생성모드 감지: 번역이 아닌 RP 이어쓰기/시스템 프롬프트 번역 방지
    if (originalText) {
        const ratio = cleaned.length / originalText.length;
        // 비율 3배 초과 + 시스템 프롬프트 패턴 감지 → 오염된 결과
        const systemPatterns = /\[ABSOLUTE DIRECTIVE|\[SYSTEM|\[OOC|\[IMPORTANT|DO NOT narrate|DO NOT summarize|DO NOT break|Write the full simulation|as an unbroken narrative|maintaining their established voice/i;
        if (ratio > 3 && systemPatterns.test(cleaned)) {
            console.warn('[CAT] 🚨 AI 생성모드 감지: 시스템 프롬프트 오염. 결과 폐기.');
            return "";
        }
        // 비율 4배 초과 → 이어쓰기 의심
        if (ratio > 4) {
            console.warn(`[CAT] ⚠️ 번역 결과 비정상 길이 (${ratio.toFixed(1)}배). 원문 기준 잘라냄.`);
            const cutPoint = originalText.length * 3;
            cleaned = cleaned.substring(0, cutPoint);
            const lastSentence = cleaned.match(/.*[.!?。！？」』\])\n]/s);
            if (lastSentence) cleaned = lastSentence[0];
        }
        // 🚨 번역 잘림 감지: 결과가 원문 대비 너무 짧으면 경고
        if (ratio < 0.3 && originalText.length > 200) {
            console.warn(`[CAT] ⚠️ 번역 결과가 짧음 (${(ratio * 100).toFixed(0)}%). 잘렸을 수 있음.`);
        }
    }
    
    // 줄바꿈 정리 (원본 구조 보존하면서)
    cleaned = cleaned
        .replace(/\r\n/g, "\n")        // \r\n → \n 통일
        .replace(/\n{4,}/g, "\n\n\n"); // 빈줄 4개 이상만 정리 (3개까지는 유지)
    
    return cleaned.trim();
}

export function getCacheModelKey(settings) {
    let key;
    if (settings.profile) key = `profile:${settings.profile}`;
    else key = settings.directModel || 'default';
    if (settings.dialogueBilingual && settings.dialogueBilingual !== 'off') {
        key += `::bilingual:${settings.dialogueBilingual}`;
    }
    return key;
}

export function getModelTheme(modelName) {
    if (!modelName) return 'cat';
    const lower = modelName.toLowerCase();
    if (lower.includes('pro') || lower.includes('프로') || lower.includes('호랑이') || lower.includes('tiger')) return 'tiger';
    if (lower.includes('flash') || lower.includes('플래') || lower.includes('플레') || lower.includes('고양이') || lower.includes('cat')) return 'cat';
    if (lower.includes('vertex')) {
        if (lower.includes('pro')) return 'tiger';
        return 'cat';
    }
    return 'cat';
}

export function detectLanguageDirection(text, settings) {
    const korCount = (text.match(/[가-힣]/g) || []).length;
    const engCount = (text.match(/[a-zA-Z]/g) || []).length;
    const jpCount = (text.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
    const cnCount = (text.match(/[\u4E00-\u9FFF]/g) || []).length;
    const total = korCount + engCount + jpCount + cnCount;

    if (total === 0) return { isToEnglish: false, targetLang: settings.targetLang };
    const korRatio = korCount / total; const engRatio = engCount / total;
    const jpRatio = jpCount / total; const cnRatio = cnCount / total;
    const bidir = settings.bidirectional || 'off';

    // 양방향 꺼짐 → 무조건 목표 언어로만
    if (bidir === 'off') {
        return { isToEnglish: false, targetLang: settings.targetLang };
    }

    // 한↔영
    if (bidir === 'ko-en') {
        if (korRatio >= 0.7) return { isToEnglish: true, targetLang: 'English' };
        if (engRatio >= 0.7) return { isToEnglish: false, targetLang: 'Korean' };
    }

    // 한↔일
    if (bidir === 'ko-ja') {
        if (korRatio >= 0.7) return { isToEnglish: false, targetLang: 'Japanese' };
        if (jpRatio >= 0.5) return { isToEnglish: false, targetLang: 'Korean' };
    }

    // 한↔중
    if (bidir === 'ko-zh') {
        if (korRatio >= 0.7) return { isToEnglish: false, targetLang: 'Chinese' };
        if (cnRatio >= 0.5) return { isToEnglish: false, targetLang: 'Korean' };
    }

    return { isToEnglish: false, targetLang: settings.targetLang };
}

export function applyPreReplace(text, dictionary, isToEnglish) { return applyPreReplaceWithCount(text, dictionary, isToEnglish).swapped; }
export function applyPreReplaceWithCount(text, dictionary, isToEnglish) {
    if (!dictionary || dictionary.trim() === "") return { swapped: text, matchCount: 0 };
    const lines = dictionary.split('\n').filter(l => l.includes('='));
    if (lines.length === 0) return { swapped: text, matchCount: 0 };

    let result = text; let matchCount = 0;
    lines.sort((a, b) => b.split('=')[0].length - a.split('=')[0].length);

    lines.forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const orig = parts[0].trim(); const trans = parts.slice(1).join('=').trim();
            const searchStr = isToEnglish ? trans : orig; const replaceStr = isToEnglish ? orig : trans;
            if (searchStr && replaceStr) {
                const escaped = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // 🚨 영문 단어는 word boundary 적용 (bro가 broken 안에서 매칭되는 것 방지)
                const isLatinWord = /^[a-zA-Z]/.test(searchStr) && /[a-zA-Z]$/.test(searchStr);
                const pattern = isLatinWord ? `\\b${escaped}\\b` : escaped;
                const regex = new RegExp(pattern, 'gi'); const matches = result.match(regex);
                if (matches) { matchCount += matches.length; result = result.replace(regex, replaceStr); }
            }
        }
    });
    return { swapped: result, matchCount };
}

export function normalizeText(text) {
    if (!text) return "";
    return text.toLowerCase().replace(/[^a-z가-힣0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, '').trim();
}

export function setTextareaValue(el, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    if (nativeSetter) nativeSetter.call(el, value); else el.value = value;
    $(el).val(value); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
}

// 🚨 캐릭터별 말투 패턴 분석 (정규식 기반, 비용 0)
export function analyzeSpeechPatterns(contextMessages) {
    if (!contextMessages || contextMessages.length === 0) return null;
    
    const speakerData = {};
    contextMessages.forEach(msg => {
        const speaker = msg.speaker || msg.name || 'Unknown';
        const text = msg.text || msg.mes || '';
        if (!text) return;
        
        if (!speakerData[speaker]) {
            speakerData[speaker] = { texts: [], totalLen: 0, hasKorean: 0, hasEnglish: 0, profanityCount: 0,
                shortSentences: 0, longSentences: 0, banmal: 0, jondaetmal: 0,
                scottishMarkers: 0, irishMarkers: 0, britishMarkers: 0, texanMarkers: 0 };
        }
        const d = speakerData[speaker];
        d.texts.push(text);
        d.totalLen += text.length;
        
        // 언어 감지
        if (/[가-힣]/.test(text)) d.hasKorean++;
        if (/[a-zA-Z]{3,}/.test(text)) d.hasEnglish++;
        
        // 욕설 감지 (한/영)
        if (/씨발|좆|개새끼|병신|fuck|shit|bitch|bastard|damn/gi.test(text)) d.profanityCount++;
        
        // 문장 길이 (대화만)
        const dialogues = text.match(/"[^"]+"/g) || [];
        dialogues.forEach(d_text => {
            const wordCount = d_text.split(/\s+/).length;
            if (wordCount < 8) speakerData[speaker].shortSentences++;
            else if (wordCount > 20) speakerData[speaker].longSentences++;
        });
        
        // 한국어 어미 (반말/존댓말) - 정확한 패턴만 매칭
        // 반말: -야, -어, -지, -다 + 종결 (단 -다음 같은 것 제외)
        const banmalEndings = (text.match(/[다어야지네군](?=[.!?\s"」』]|$)/g) || []).length;
        const jondaetmalEndings = (text.match(/요(?=[.!?\s"」』]|$)|습니다|입니다|시오|십시오|세요/g) || []).length;
        // 반말이 존댓말로 오탐되는 케이스 보정
        const correctedBanmal = Math.max(0, banmalEndings - jondaetmalEndings);
        d.banmal += correctedBanmal;
        d.jondaetmal += jondaetmalEndings;
        
        // 영어 사투리 마커
        if (/\b(aye|lass|laddie|wee|bonnie|bairn|cannae|dinnae|wouldnae)\b/gi.test(text)) d.scottishMarkers++;
        if (/\b(begorrah|wee|grand|craic|after.*ing|tis|sure and)\b/gi.test(text)) d.irishMarkers++;
        if (/\b(bloody|bloke|blimey|innit|cheers mate|brilliant|reckon)\b/gi.test(text)) d.britishMarkers++;
        if (/\b(y'all|reckon|fixin'|ain't|howdy|partner|yonder)\b/gi.test(text)) d.texanMarkers++;
    });
    
    // 패턴 요약 생성
    const patterns = [];
    Object.entries(speakerData).forEach(([speaker, d]) => {
        if (d.texts.length === 0) return;
        const traits = [];
        const avgLen = d.totalLen / d.texts.length;
        
        // 언어
        if (d.hasKorean > 0 && d.hasEnglish > 0) traits.push('mixed Korean/English');
        else if (d.hasKorean > d.hasEnglish) traits.push('primarily Korean');
        else traits.push('primarily English');
        
        // 사투리 마커
        if (d.scottishMarkers > 0) traits.push('Scottish dialect markers (aye/lass/wee)');
        if (d.irishMarkers > 0) traits.push('Irish dialect markers');
        if (d.britishMarkers > 0) traits.push('British slang (bloody/bloke)');
        if (d.texanMarkers > 0) traits.push('Texan/Southern markers');
        
        // 문장 스타일
        if (d.shortSentences > d.longSentences * 2) traits.push('terse/short sentences');
        else if (d.longSentences > d.shortSentences * 2) traits.push('elaborate/long sentences');
        
        // 욕설
        if (d.profanityCount > 0) traits.push(`uses profanity (${d.profanityCount}x)`);
        
        // 한국어 어미
        if (d.hasKorean > 0) {
            if (d.banmal > d.jondaetmal * 2) traits.push('Korean: 반말 (informal)');
            else if (d.jondaetmal > d.banmal * 2) traits.push('Korean: 존댓말 (formal)');
            else if (d.banmal > 0 || d.jondaetmal > 0) traits.push('Korean: mixed formality');
        }
        
        if (traits.length > 0) patterns.push(`- ${speaker}: ${traits.join(', ')}`);
    });
    
    return patterns.length > 0 ? patterns.join('\n') : null;
}
