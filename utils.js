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
    
    // 🚨 AI 거부/오류 응답 감지 (도구 거부, 검색 강제, 정책 거부 등)
    if (originalText) {
        const refusalPatterns = [
            /Google 검색을 수행해야|구글 검색을 수행해야/i,
            /도구 사용을 강제하는|도구를 사용해야/i,
            /이 작업을 수행할 수 없습니다|작업을 수행할 수 없어요|작업을 수행하기 어렵/i,
            /I (cannot|can'?t|am unable to) (perform|complete|fulfill|do|process) (this|that)/i,
            /I (need|must|have) to (search|use) (Google|the web|a tool)/i,
            /I'?m unable to (assist|help) with/i,
            /I cannot provide|I can'?t provide/i,
            /violates? (my|the|content) (guidelines|policy|policies)/i,
            /죄송하지만.*수행할 수 없|죄송합니다.*도와드릴 수 없/i,
            /사용자 사양을 준수하면서/i,
        ];
        // 거부 패턴이 본문 시작 100자 안에 있으면 거부 응답으로 판정
        const startSegment = cleaned.substring(0, 200);
        for (const pattern of refusalPatterns) {
            if (pattern.test(startSegment)) {
                console.warn('[CAT] 🚨 AI 거부 응답 감지. 결과 폐기 → 재번역 필요.');
                return "";
            }
        }
    }
    
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
    
    // 🚨 문단 구조 보존: 원문과 비교해서 문단 수 부족하면 경고
    if (originalText && originalText.length > 200) {
        const origParagraphs = originalText.split(/\n{2,}/).filter(p => p.trim().length > 0);
        const transParagraphs = cleaned.split(/\n{2,}/).filter(p => p.trim().length > 0);
        
        // 원문 3문단 이상인데 번역이 1문단으로 합쳐졌으면 명확한 실패
        if (origParagraphs.length >= 3 && transParagraphs.length === 1) {
            console.warn(`[CAT] ⚠️ 문단 구조 파괴: 원문 ${origParagraphs.length}문단 → 번역 1문단`);
            
            // 자동 복구 시도: 문장 끝 패턴 (.!? + 다음 대문자/대사)로 분할 후 원문 비율 맞춤
            cleaned = restoreParagraphStructure(cleaned, origParagraphs.length);
        } else if (origParagraphs.length >= 3 && transParagraphs.length < origParagraphs.length * 0.5) {
            console.warn(`[CAT] ⚠️ 문단 수 부족: 원문 ${origParagraphs.length}문단 → 번역 ${transParagraphs.length}문단`);
        }
    }
    
    // 🚨 따옴표 균형 검사 및 자동 복구
    cleaned = balanceQuotes(cleaned, originalText);
    
    return cleaned.trim();
}

// 🚨 문단 구조 자동 복구 (한 덩어리로 합쳐진 경우)
function restoreParagraphStructure(text, targetParagraphCount) {
    // 대사 시작/종료 + 묘사 전환 패턴으로 분할
    // 1. 닫는 따옴표 뒤 + 한국어 시작 → 문단 경계
    // 2. 한국어 종결 뒤 + 여는 따옴표 → 문단 경계
    
    // 자연스러운 분할 후보 위치 (점수 부여)
    const candidates = [];
    const len = text.length;
    
    // 패턴 1: "..." 다음 문장 (대사 종료 후 묘사)
    for (let m of text.matchAll(/(["」』])\s+([가-힣A-Z])/g)) {
        candidates.push({ pos: m.index + m[1].length, score: 3 });
    }
    
    // 패턴 2: 문장 끝(다.) 다음 대사 (묘사 종료 후 대사)
    for (let m of text.matchAll(/([다요까네])\.\s+(["「『])/g)) {
        candidates.push({ pos: m.index + 2, score: 3 });
    }
    
    // 패턴 3: 일반 문장 종료 (다./요./까?)
    for (let m of text.matchAll(/([다요까네])\.\s+([가-힣])/g)) {
        candidates.push({ pos: m.index + 2, score: 1 });
    }
    
    if (candidates.length === 0) return text; // 분할 불가
    
    // 후보 정렬 (위치 순)
    candidates.sort((a, b) => a.pos - b.pos);
    
    // 목표 문단 수에 가장 가까운 분할점 선택
    const breakCount = targetParagraphCount - 1;
    if (candidates.length < breakCount) return text; // 후보가 부족
    
    // 균등 분할 위치 계산
    const ideal = [];
    for (let i = 1; i <= breakCount; i++) {
        ideal.push((len * i) / targetParagraphCount);
    }
    
    // 각 ideal 위치에 가장 가까운 후보 선택
    const breakPoints = [];
    const used = new Set();
    for (const idealPos of ideal) {
        let best = null;
        let bestDist = Infinity;
        for (let i = 0; i < candidates.length; i++) {
            if (used.has(i)) continue;
            const dist = Math.abs(candidates[i].pos - idealPos) - candidates[i].score * 30;
            if (dist < bestDist) {
                bestDist = dist;
                best = i;
            }
        }
        if (best !== null) {
            breakPoints.push(candidates[best].pos);
            used.add(best);
        }
    }
    
    breakPoints.sort((a, b) => a - b);
    
    // 분할점에 \n\n 삽입
    let result = '';
    let last = 0;
    for (const bp of breakPoints) {
        result += text.substring(last, bp) + '\n\n';
        last = bp;
    }
    result += text.substring(last);
    
    console.log(`[CAT] 🔧 문단 자동 복구: 1개 → ${targetParagraphCount}개`);
    return result;
}

// 🚨 따옴표 균형 검사 및 복구
function balanceQuotes(text, originalText) {
    // 영어 따옴표: " (smart quotes는 별도)
    // 한국어 따옴표: "", 「」, 『』
    
    const countQuotes = (s, pattern) => (s.match(pattern) || []).length;
    
    // 1. 첫 줄 대사 따옴표 누락 복구
    // 원문 첫 줄이 "..." 패턴인데 번역 첫 줄이 따옴표 없이 시작하면 복구
    if (originalText) {
        const origFirstLine = originalText.split(/\n/)[0]?.trim();
        const transFirstLine = text.split(/\n/)[0]?.trim();
        
        if (origFirstLine && transFirstLine) {
            const origStartsWithQuote = /^["「『]/.test(origFirstLine);
            const transStartsWithQuote = /^["「『]/.test(transFirstLine);
            
            // 원문은 따옴표로 시작, 번역은 안 그러면 → 첫 따옴표 추가
            if (origStartsWithQuote && !transStartsWithQuote) {
                // 한국어 따옴표 ㅍ스타일 매칭
                const quoteChar = origFirstLine[0];
                const targetQuote = quoteChar === '"' ? '"' : quoteChar;
                text = targetQuote + text;
                console.log(`[CAT] 🔧 첫 줄 따옴표 복구: ${targetQuote} 추가`);
            }
        }
    }
    
    // 2. 따옴표 균형 검사 (열린 vs 닫힌)
    // ASCII 따옴표는 양방향이라 짝수면 OK
    const ascii = countQuotes(text, /"/g);
    if (ascii % 2 !== 0) {
        // 홀수 → 마지막에 " 추가 (닫는 따옴표 누락 가능성)
        text = text.trimEnd() + '"';
        console.log(`[CAT] 🔧 ASCII 따옴표 균형 복구: 닫는 " 추가`);
    }
    
    // 한국어 큰따옴표
    const koOpen = countQuotes(text, /"/g);
    const koClose = countQuotes(text, /"/g);
    if (koOpen > koClose) {
        text = text.trimEnd() + '"';
        console.log(`[CAT] 🔧 한국어 따옴표 균형 복구: 닫는 " 추가`);
    } else if (koClose > koOpen) {
        // 닫는 게 더 많음 → 맨 앞에 열린 따옴표 추가
        text = '"' + text;
        console.log(`[CAT] 🔧 한국어 따옴표 균형 복구: 여는 " 앞에 추가`);
    }
    
    return text;
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
