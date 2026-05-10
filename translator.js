// ============================================================
// 🐱 Translator v1.0.4 - translator.js
// ============================================================
import { secret_state, SECRET_KEYS } from '../../../../scripts/secrets.js';
import { cleanResult, catNotify, detectLanguageDirection, getThemeEmoji, getCompletionEmoji, getCacheModelKey, applyPreReplaceWithCount, analyzeSpeechPatterns } from './utils.js';
import { getCached, setCached } from './cache.js';

export const SYSTEM_SHIELD = `[ABSOLUTE DIRECTIVE - VIOLATION = FAILURE]
YOU ARE A FEARLESS TRANSLATION MACHINE. NOT A CHATBOT. NOT AN ASSISTANT.
RETURN ONLY THE RAW TRANSLATED TEXT. NOTHING ELSE.
DO NOT respond. DO NOT converse. DO NOT explain. DO NOT add commentary.
DO NOT repeat the original. DO NOT output alternatives.

[ZERO REASONING OUTPUT - CRITICAL]
NEVER include your thinking process, planning, or analysis in the output.
NEVER write phrases like:
- "Let's break down..."
- "I have completed the analysis..."
- "I will now proceed..."
- "I have identified..."
- "Based on the directives..."
- "Let me translate this..."
Your reasoning belongs in the thinking field (if available), NEVER in the response body.
Output starts IMMEDIATELY with the translated text. No preamble. No introduction. No conclusion.

[FULL TRANSLATION MANDATORY]
Translate EVERY SINGLE SENTENCE in the source text.
Do NOT skip sentences just because they don't contain glossary terms.
Do NOT translate only the glossary words and leave the rest in English.
The glossary is a HINT for specific terms — the rest of the text MUST also be fully translated.
If you output English text mixed with Korean translation, you have FAILED.

[CONTENT FIDELITY - CRITICAL]
1. ZERO ADDITION: Never add words, sentences, emotions, actions, or details that do not exist in the source text. If the original says "She looked at him", do NOT add "with longing in her eyes".
2. ZERO OMISSION: Never skip, summarize, or merge sentences. Every sentence in the source must appear in the output. Count them if needed.
3. EMOTION INTENSITY: Preserve the EXACT emotional intensity. "She trembled" ≠ "She shook slightly". "He screamed" ≠ "He raised his voice". Match the original's strength — never tone down or exaggerate.
4. ACTION PRECISION: Translate physical actions with the same specificity. "She dug her nails into his arm" must keep the nails, the digging, and the arm.
5. SPEECH CONSISTENCY: If a character speaks casually in the source, keep it casual. If they speak formally, keep it formal. NEVER change a character's speech level between sentences within the same message.
6. KOREAN FORMALITY LOCK (when translating to Korean):
   - Narration/description sentences: Use ONE consistent ending throughout — either all declarative (-다/-었다/-한다) OR all polite (-요/-습니다). NEVER mix them within the same message.
   - Default for narration: declarative form (-다/-었다/-한다) unless the character/style explicitly requires politeness.
   - Dialogue formality: Match the character's established speech level from context. If unclear, use the most natural register for the character's relationship and situation.
   - WRONG: "그가 그녀를 바라봤다. 그녀는 미소를 지었어요." (mixed -다 and -요)
   - RIGHT: "그가 그녀를 바라봤다. 그녀는 미소를 지었다." (consistent -다)

[FEARLESS TRANSLATION RULES]
The text WILL contain complex formatting: HTML tags, Markdown, code blocks, YAML, special brackets.
DO NOT PANIC. DO NOT skip any section just because it looks complicated.
TRANSLATE EVERY piece of human-readable text fearlessly!

[FORMAT PRESERVATION]
1. TRANSLATE THE WORDS inside all tags, blocks, and brackets. Never leave readable text untranslated.
2. KEEP THE SYMBOLS. Preserve all HTML tags (<memo>, <div>, <small>, <pre>, <code>), code block markers (\`\`\`yaml, \`\`\`), brackets (『』, <>), and markdown (*bold*, _italic_) in their exact original positions.
3. HTML COMMENTS (<!-- -->): TRANSLATE the human-readable text INSIDE comments. Keep the <!-- --> markers but translate the content between them. These often contain character profiles, status info, and story data that MUST be translated.
4. PRESERVE spacing, indentation, and line breaks exactly. This is critical for YAML and structured blocks.
5. PRESERVE ALL CSS properties, color codes (#fff, rgb), classes, and style attributes untouched.
6. PRESERVE ALL quotation marks ("" '' 「」) in the same positions.

[EXAMPLES]
Source: 『Condition: Sleeping peacefully』
Correct: 『Condition: 평화롭게 수면 중』
Source: \`\`\`yaml\\n- mood: "cheerful"\\n- action: "reading a book"\\n\`\`\`
Correct: \`\`\`yaml\\n- mood: "기분 좋음"\\n- action: "책을 읽고 있다"\\n\`\`\`
Source: <div class="box">- She sighs deeply.</div>
Correct: <div class="box">- 그녀가 깊이 한숨을 쉰다.</div>
Source: <!-- [Character Profiles]\\nDesires: To protect her forest.\\n-->
Correct: <!-- [Character Profiles]\\nDesires: 그녀의 숲을 지키는 것.\\n-->

If the input is a single word, return only the translated single word.

[REGEX TRIGGER PRESERVATION]
Some text uses special patterns as UI triggers for info boxes, status panels, etc.
KEEP these trigger patterns EXACTLY as-is — do NOT translate the structural keywords:
- {{keyword:...}} patterns: translate content inside but keep {{keyword:}} wrapper
- Bracket patterns like [Status], [Info], [Scene]: keep the keyword in English
- Special brackets 『...』, 【...】: keep the bracket style, translate content inside
- Any pattern that looks like a UI/system tag: preserve it unchanged

[DIALECT HANDLING - STRICT]
Foreign accents/dialects (Scottish, Irish, Texan, Cockney, Australian, etc.) MUST NOT be mapped to Korean regional dialects (경상도, 전라도, 충청도, 강원도, 제주도, etc.).
This mapping ALWAYS produces unnatural and offensive results.

Instead, use these techniques to convey foreign dialect character:
1. Word choice variation — slightly archaic, slangy, or rural-sounding STANDARD Korean
2. Sentence rhythm — clipped or drawn-out standard Korean
3. Keep iconic dialect markers in original (e.g., "aye", "lass", "mate", "y'all", "wee")
4. For full Korean translation, use neutral standard Korean tone

WRONG: "Aye, lassie" → "아이고마, 가시나" (Korean dialect)
WRONG: "Y'all coming?" → "다들 갈끄여?" (Korean dialect)
RIGHT: "Aye, lassie" → "그래, 아가씨" or "Aye, 아가씨"
RIGHT: "Y'all coming?" → "다들 가는 거지?"

[CHARACTER VOICE LOCK - HIGHEST PRIORITY]
When context messages are provided, you MUST preserve each character's established voice:
1. FORMALITY LOCK: If a character spoke in 반말 before, KEEP IT 반말. If 존댓말, KEEP IT 존댓말. NEVER mid-flip.
2. PROFANITY LEVEL: Match exact intensity. If they said "씨발", don't soften to "젠장". If they said "fuck", don't soften.
3. SENTENCE STYLE: Terse characters stay terse. Elaborate characters stay elaborate. Don't normalize.
4. CULTURAL MARKERS: Preserve dialect markers, age markers, character-specific phrases.
5. EMOTIONAL DEFAULT: Cold characters stay cold. Warm characters stay warm. Don't homogenize.

If you detect inconsistency in source between character's previous voice and current message, TRUST the established voice from context.

Output ONLY the final translated text.`;

export const STYLE_PRESETS = {
    normal: { label: '일반 번역', temperature: 0.3,
        prompt: `Translate accurately and faithfully. Maintain a CONSISTENT formality level throughout the entire message.
For narration/description: Use neutral declarative form (-다 / -었다 / -한다). Do NOT mix in 요/습니다 endings.
For dialogue: Match the character's speech level from context — if previously 반말, keep 반말; if previously 존댓말, keep 존댓말.
NEVER mix formality levels within a single character's speech in the same message.` },
    novel: { label: '소설 스타일', temperature: 0.5,
        prompt: `Use literary expressions while preserving the original nuance. Describe emotions richly.
Example: "Her heart ached as she watched him leave." → "그의 뒷모습을 바라보는 그녀의 가슴이 저릿하게 아려왔다."
Example: "He slammed his fist on the table." → "그가 주먹으로 탁자를 내리쳤다."` },
    casual: { label: '캐주얼', temperature: 0.4,
        prompt: `Translate naturally in casual conversational tone. Contractions and colloquialisms are welcome.
Example: "I can't believe you actually did that." → "야 진짜 그걸 해버린 거야?"
Example: "She was pretty upset about it." → "걔 그거 때문에 꽤 열받았더라."` },
    natural: { label: '번역체 탈피', temperature: 0.4,
        prompt: `Translate into natural, native-sounding Korean. Avoid translationese. Restructure sentences to follow natural Korean word order.
BAD: "그녀는 그것에 대해 생각하는 것을 멈출 수가 없었다."
GOOD: "그녀는 도무지 그 생각을 떨칠 수가 없었다."
BAD: "그는 그녀의 손을 잡는 것을 시도했다."
GOOD: "그가 그녀의 손을 잡으려 했다."` },
    formal: { label: '존댓말 고정', temperature: 0.3,
        prompt: `Translate all text using polite but natural Korean speech (해요체). Use casual-polite endings like -해요, -이에요, -거든요, -잖아요, -네요. Avoid stiff formal endings like -습니다/-합니다.
Example: "I think we should go now." → "이제 가야 할 것 같아요."
Example: "That's not what I meant." → "제가 말한 건 그게 아니에요."` },
    informal: { label: '반말 고정', temperature: 0.4,
        prompt: `Translate all text using casual/informal Korean speech (반말). Use -해, -야, -지, -거든 endings. Make it sound like close friends talking.
Example: "Could you help me with this?" → "이거 좀 도와줘."
Example: "I was worried about you." → "너 걱정했잖아."` },
    literary: { label: '문어체', temperature: 0.5,
        prompt: `Use formal written/literary Korean style (문어체). Employ refined vocabulary and elegant expressions.
Example: "The sun set behind the mountains." → "산등성이 너머로 해가 저물었다."
Example: "She couldn't hold back her tears." → "그녀는 끝내 눈물을 참지 못하였다."` }
};

const SAFETY_SETTINGS = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

// 🚨 디버그 로그: 마지막 요청/응답 저장 (설정창에서 확인 가능)
let _lastDebugLog = { timestamp: null, mode: '', model: '', prompt: '', rawResponse: '', cleaned: '', error: null, thought: null };
export function getLastDebugLog() { return _lastDebugLog; }

export async function fetchTranslation(text, settings, stContext, options = {}) {
    const isVertexModel = settings.directModel && settings.directModel.startsWith('vertex-');
    const apiKey = settings.customKey || secret_state[SECRET_KEYS.MAKERSUITE];
    const vertexKey = settings.vertexKey || '';
    
    if (!settings.profile && !apiKey && !(isVertexModel && vertexKey)) {
        catNotify(`🚨 API 키가 없습니다! 확장 설정에서 API Key를 먼저 입력해 주세요.`, "error");
        return null;
    }

    const { forceLang = null, prevTranslation = null, contextMessages = [], abortSignal = null, silent = false } = options;
    if (!text || text.trim() === "") return null;

    let targetLang; let isToEnglish;
    if (forceLang) {
        isToEnglish = (forceLang === "English"); targetLang = forceLang;
    } else {
        const detected = detectLanguageDirection(text, settings);
        isToEnglish = detected.isToEnglish; targetLang = detected.targetLang;
    }

    // 🚨 원문-목표 언어 동일 감지: 병기 모드 OFF일 때만 체크
    const bilingualActive = settings.dialogueBilingual && settings.dialogueBilingual !== 'off';
    if (!bilingualActive && !silent) {
        const korCount = (text.match(/[가-힣]/g) || []).length;
        const engCount = (text.match(/[a-zA-Z]/g) || []).length;
        const total = korCount + engCount;
        if (total > 0) {
            const korRatio = korCount / total;
            const engRatio = engCount / total;
            if (engRatio >= 0.7 && targetLang === 'English') {
                catNotify(`${getThemeEmoji()} 원문이 이미 영어입니다! 목표 언어를 확인해주세요!`, "warning");
                return null;
            }
            if (korRatio >= 0.7 && targetLang === 'Korean') {
                catNotify(`${getThemeEmoji()} 원문이 이미 한국어입니다! 목표 언어를 확인해주세요!`, "warning");
                return null;
            }
        }
    }

    if (!prevTranslation) {
        const modelKey = getCacheModelKey(settings);
        const cached = await getCached(text, targetLang, modelKey);
        if (cached) {
            if (!silent) catNotify(`${getCompletionEmoji()} 캐시 히트! ~${Math.round(text.length * 0.5)} 토큰 절약`, "success");
            return { text: cached.translated, lang: targetLang, fromCache: true };
        }
    }

    // 🚨 사전 pre-replace: API 호출 전에 고유명사 미리 치환 (프롬프트 glossary와 이중 안전망)
    const { swapped: preSwapped, matchCount: dictMatchCount } = applyPreReplaceWithCount(text.trim(), settings.dictionary, isToEnglish);
    if (dictMatchCount > 0) {
        console.log(`[CAT] 📖 사전 pre-replace: ${dictMatchCount}개 치환 완료`);
        if (!silent) catNotify(`🐾 사전 ${dictMatchCount}개 단어 치환 적용!`, "success");
    }

    // 🚨 캐릭터 카드 힌트 추출 (RP 톤 일관성)
    const characterHints = gatherCharacterHints(stContext);
    
    const prompt = assemblePrompt(preSwapped, targetLang, isToEnglish, settings, { prevTranslation, contextMessages, characterHints });

    try {
        let result = ""; let thought = null;
        _lastDebugLog = { timestamp: new Date().toLocaleTimeString(), mode: '', model: '', prompt: '', rawResponse: '', cleaned: '', error: null, thought: null };
        
        if (settings.profile && stContext.ConnectionManagerRequestService) {
            // 🚨 프로필 모드: systemInstruction 미지원 → 유저 메시지에 합침
            console.log('[CAT] 🔌 프로필 모드: SYSTEM_SHIELD → user 메시지 합침');
            const fullPrompt = SYSTEM_SHIELD + '\n' + prompt;
            _lastDebugLog.mode = '프로필';
            _lastDebugLog.model = settings.profile.substring(0, 20) + '...';
            _lastDebugLog.prompt = fullPrompt;
            const response = await stContext.ConnectionManagerRequestService.sendRequest(settings.profile, [{ role: "user", content: fullPrompt }], settings.maxTokens || 8192);
            result = typeof response === 'string' ? response : (response.content || "");
            _lastDebugLog.rawResponse = result;
        } else {
            // Vertex 모델 분기
            let actualModel = settings.directModel;
            let activeKey = apiKey;
            let url;
            
            if (isVertexModel) {
                actualModel = settings.directModel.replace('vertex-', '');
                activeKey = vertexKey || apiKey;
                const region = settings.vertexRegion || 'global';
                const project = settings.vertexProject || '';
                
                if (project && region !== 'global') {
                    // 프로젝트 ID + 리전 방식
                    url = `https://${region}-aiplatform.googleapis.com/v1beta1/projects/${project}/locations/${region}/publishers/google/models/${actualModel}:generateContent`;
                } else {
                    // 글로벌 (API Key 방식)
                    const model = actualModel.startsWith('models/') ? actualModel : `models/${actualModel}`;
                    url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${activeKey}`;
                }
            } else {
                const model = actualModel.startsWith('models/') ? actualModel : `models/${actualModel}`;
                url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${activeKey}`;
            }
            
            const baseTemp = parseFloat(settings.temperature) || 0.3; const temperature = prevTranslation ? Math.min(baseTemp + 0.3, 1.0) : baseTemp; const maxTokens = parseInt(settings.maxTokens) || 8192;
            
            const fetchBody = { systemInstruction: { parts: [{ text: SYSTEM_SHIELD }] }, contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature, maxOutputTokens: maxTokens }, safetySettings: SAFETY_SETTINGS };
            _lastDebugLog.mode = '직접 연결';
            _lastDebugLog.model = actualModel;
            _lastDebugLog.prompt = prompt;
            console.log(`[CAT] 🧠 Direct 모드: systemInstruction 분리 | 모델: ${actualModel} | temp: ${temperature} | maxTokens: ${maxTokens}`);
            
            // Vertex 프로젝트 방식은 Authorization 헤더 사용
            let extraHeaders = {};
            if (isVertexModel && settings.vertexProject && (settings.vertexRegion || 'global') !== 'global') {
                extraHeaders = { 'Authorization': `Bearer ${activeKey}` };
            }
            
            const data = await fetchWithRetry(url, fetchBody, 3, abortSignal, extraHeaders);
            const parts = data.candidates?.[0]?.content?.parts || []; const thoughtPart = parts.find(p => p.thought); thought = thoughtPart?.text || null; const actualPart = parts.find(p => !p.thought) || parts[parts.length - 1]; result = actualPart?.text?.trim() || "";
            _lastDebugLog.rawResponse = result;
            _lastDebugLog.thought = thought;
        }

        let cleaned = cleanResult(result, text);
        
        // 🚨 병기 후처리: "text."[번역] → "text. [번역]" 자동 교정
        const bilingualMode = settings.dialogueBilingual || 'off';
        if (bilingualMode !== 'off' && cleaned) {
            // [REVERSED 자동 교정] "한국어 [English]" → "English [한국어]" (역순으로 나온 경우)
            cleaned = cleaned.replace(/"([^"]*?[가-힣][^"]*?)\s*\[([^\]]*[a-zA-Z][^\]]*)\]([^"]*?)"/g, (match, kor, eng, rest) => {
                // 한국어 비율이 높은 경우만 역순으로 판정 (의도된 [영어 약어] 같은 건 보호)
                const korChars = (kor.match(/[가-힣]/g) || []).length;
                const engChars = (eng.match(/[a-zA-Z]/g) || []).length;
                if (korChars > 3 && engChars > 3) {
                    console.log('[CAT] 🔄 병기 역순 감지 → 자동 교정');
                    return `"${eng.trim()} [${kor.trim()}]${rest}"`;
                }
                return match;
            });
            // "text"[번역] → "text [번역]" (따옴표 밖에 있는 [번역]을 안으로 이동)
            cleaned = cleaned.replace(/"([^"]*?)"\s*\[([^\]]+)\]/g, '"$1 [$2]"');
            // "text."[번역]" → "text. [번역]" (이미 따옴표 안인데 마침표 직후 붙은 경우)
            cleaned = cleaned.replace(/\."\s*\[/g, '. [');
        } else if (bilingualMode === 'off' && cleaned) {
            // 🚨 병기 OFF인데 결과에 병기 흔적 (대사 내 [한국어]) 있으면 정리
            const beforeClean = cleaned;
            // "영어 텍스트 [한국어]" 형태 → 한국어만 남기기
            cleaned = cleaned.replace(/"([^"]*?[a-zA-Z][^"]*?)\s*\[([^\]]*[가-힣][^\]]*)\]([^"]*?)"/g, '"$2$3"');
            cleaned = cleaned.replace(/「([^」]*?[a-zA-Z][^」]*?)\s*\[([^\]]*[가-힣][^\]]*)\]([^」]*?)」/g, '「$2$3」');
            cleaned = cleaned.replace(/『([^』]*?[a-zA-Z][^』]*?)\s*\[([^\]]*[가-힣][^\]]*)\]([^』]*?)』/g, '『$2$3』');
            // 추가: 따옴표 밖 영어 묘사 + [한국어] 형태도 정리
            // "영어 묘사. [한국어 묘사.]" 형태 (지문에 잔존하는 병기)
            cleaned = cleaned.replace(/([a-zA-Z][a-zA-Z\s,.'!?]+)\s*\[([^\]]*[가-힣][^\]]*)\]/g, '$2');
            if (beforeClean !== cleaned) {
                console.log('[CAT] 🧹 병기 OFF 모드 - 잔존 병기 패턴 자동 정리');
            }
        }
        
        _lastDebugLog.cleaned = cleaned;
        if (!cleaned || cleaned.trim().length === 0) { 
            _lastDebugLog.error = '번역 결과 비어있음 (AI 거부 또는 오류)';
            // 원본에 거부 패턴이 있었으면 더 구체적으로 안내
            if (result && /검색을 수행해야|cannot perform|cannot provide|작업을 수행할 수 없|사용자 사양을 준수/i.test(result)) {
                catNotify(`${getThemeEmoji()} AI가 번역을 거부했어요. 다시 시도해주세요.`, "warning");
            } else {
                catNotify(`${getThemeEmoji()} 번역 결과가 비어있습니다. 원문 유지.`, "warning");
            }
            return null; 
        }
        await setCached(text, targetLang, cleaned, thought, getCacheModelKey(settings));
        return { text: cleaned, lang: targetLang, fromCache: false };
    } catch (e) {
        if (e.name === 'AbortError') return null;
        const errMsg = e.message || '알 수 없는 오류';
        _lastDebugLog.error = errMsg;
        // Vertex 모델 실패 시 프로젝트 ID/리전 입력 안내
        if (isVertexModel && !settings.vertexProject) {
            $('#ct-vertex-extra').slideDown(200);
            catNotify(`🚨 Vertex 연결 실패! 프로젝트 ID와 리전을 입력해보세요.`, "error");
        } else {
            catNotify(`${getThemeEmoji()} 오류: ${errMsg}`, "error");
        }
        return null;
    }
}

function assemblePrompt(text, targetLang, isToEnglish, settings, options = {}) {
    const { prevTranslation, contextMessages = [], characterHints = null } = options;
    const bilingualMode = settings.dialogueBilingual || 'off';
    
    // 🚨 병기 모드 ON이면 짧은 텍스트도 풀 프롬프트 경로 강제 사용
    if (bilingualMode === 'off' && text.length < 100 && !prevTranslation && contextMessages.length === 0 && (!settings.dictionary || !settings.dictionary.trim()) && (!settings.userPrompt || !settings.userPrompt.trim())) {
        const lang = isToEnglish ? 'English' : targetLang;
        const preset = STYLE_PRESETS[settings.style] || STYLE_PRESETS.normal;
        const styleHint = settings.style !== 'normal' ? ` Style: ${preset.prompt.split('\n')[0]}` : '';
        return `${text}\n\n(Translate the above to ${lang}.${styleHint} Reply with ONLY the translation. Keep all formatting exactly.)`;
    }
    let parts = [];  // 🚨 SYSTEM_SHIELD는 Gemini systemInstruction으로 분리됨
    const preset = STYLE_PRESETS[settings.style] || STYLE_PRESETS.normal; parts.push(`[Style: ${preset.prompt}]`);
    
    // 🚨 병기 모드 ON이면 지문 번역 방향을 Korean으로 강제 (목표 언어 설정과 무관하게)
    if (bilingualMode !== 'off') { targetLang = 'Korean'; isToEnglish = false; }
    
    if (isToEnglish) { parts.push(`Translate the following into English.`); } else { parts.push(`Translate the following into ${targetLang}.`); }
    
    // 🚨 대사 병기 모드 프롬프트 삽입
    if (bilingualMode !== 'off') {
        const bilingualLangMap = {
            'ko-en': { srcLabel: 'English', tgtLabel: '한국어', exSrc: 'I bought a mattress for you.', exTgt: '널 위해 매트리스를 샀어.', exNarSrc: 'He clenched his jaw.', exNarTgt: '그는 이를 악물었다.' },
            'ko-ja': { srcLabel: 'Japanese', tgtLabel: '한국어', exSrc: 'あなたのためにマットレスを買ったんだ。', exTgt: '널 위해 매트리스를 샀어.', exNarSrc: '彼は歯を食いしばった。', exNarTgt: '그는 이를 악물었다.' },
            'ko-zh': { srcLabel: 'Chinese', tgtLabel: '한국어', exSrc: '我给你买了床垫。', exTgt: '널 위해 매트리스를 샀어.', exNarSrc: '他咬紧了牙关。', exNarTgt: '그는 이를 악물었다.' }
        };
        const bl = bilingualLangMap[bilingualMode] || bilingualLangMap['ko-en'];
        parts.push(`
[BILINGUAL DIALOGUE MODE - HIGHEST PRIORITY OVERRIDE]
This message uses BILINGUAL DIALOGUE format. Apply these rules STRICTLY.

═══════════════════════════════════════════
RULE A: NARRATION (text OUTSIDE quotation marks)
═══════════════════════════════════════════
TRANSLATE ALL narration FULLY into ${bl.tgtLabel}.
This is NOT optional. This includes:
- Descriptions ("He walked down the hall" → "그는 복도를 걸었다")
- Actions ("She raised her gun" → "그녀가 총을 들어올렸다")
- Internal thoughts ("He wondered" → "그는 궁금해했다")
- Scene-setting ("The room was dark" → "방은 어두웠다")
- Speech tags ("he said" → "그가 말했다")
- ALL prose between dialogue lines

❌ NEVER leave narration in ${bl.srcLabel}.
❌ NEVER add original narration in brackets like "그가 말했다 [he said]".

═══════════════════════════════════════════
RULE B: DIALOGUE (text INSIDE quotation marks)
═══════════════════════════════════════════
For DIALOGUE ONLY (text wrapped in "" / 「」 / 『』 / ""):
KEEP the original ${bl.srcLabel} text → ADD ${bl.tgtLabel} translation in [] → INSIDE the closing quote.

CORRECT FORMAT:
"<${bl.srcLabel} dialogue> [<${bl.tgtLabel} translation>]"

NOT:
"<${bl.tgtLabel} translation> [<${bl.srcLabel} dialogue>]"  ← REVERSED, WRONG!
"<${bl.srcLabel} dialogue>"[<${bl.tgtLabel} translation>]   ← bracket OUTSIDE quote, WRONG!

═══════════════════════════════════════════
CONCRETE EXAMPLES (memorize these)
═══════════════════════════════════════════

SOURCE:
He looked at her. "I love you," he whispered.

CORRECT OUTPUT:
그는 그녀를 바라보았다. "I love you, [널 사랑해,]" 그가 속삭였다.

EXPLANATION:
- "He looked at her" → narration → "그는 그녀를 바라보았다" (full Korean)
- "I love you," → dialogue → "I love you, [널 사랑해,]" (English KEPT + Korean in brackets INSIDE quotes)
- "he whispered" → narration → "그가 속삭였다" (full Korean)

❌ WRONG (narration in English):
He looked at her. "I love you, [널 사랑해,]" he whispered.

❌ WRONG (reversed):
그는 그녀를 바라보았다. "널 사랑해, [I love you,]" 그가 속삭였다.

❌ WRONG (no Korean in brackets):
그는 그녀를 바라보았다. "I love you," 그가 속삭였다.

❌ WRONG (only Korean, no English):
그는 그녀를 바라보았다. "널 사랑해," 그가 속삭였다.

═══════════════════════════════════════════
SELF-CHECK BEFORE OUTPUT
═══════════════════════════════════════════
Verify EACH of these:
1. Is every sentence outside quotes in ${bl.tgtLabel}? (If NO → fix it)
2. Is every dialogue in format: "<original ${bl.srcLabel}> [<${bl.tgtLabel} translation>]"? (If NO → fix it)
3. Are translation brackets INSIDE the closing quote? (If NO → fix it)
4. Did I keep the ORIGINAL ${bl.srcLabel} text in dialogue? (If you only wrote ${bl.tgtLabel} → REVERSED, fix)
`);
    } else {
        // 🚨 병기 OFF 모드: 컨텍스트에 병기 흔적이 있어도 절대 따라하지 말 것
        parts.push(`
[STANDARD TRANSLATION MODE - NO BILINGUAL FORMAT]
Translate the ENTIRE text fully into the target language.
Even if the context messages contain bilingual format like "English [한국어]", DO NOT replicate that format.
Output should contain NO [translation] brackets, NO original-language preservation.
Just plain, fully-translated text.
`);
    }
    
    if (settings.userPrompt && settings.userPrompt.trim()) { parts.push(`[Additional instructions: ${settings.userPrompt.trim()}]`); }
    
    if (settings.dictionary && settings.dictionary.trim()) {
        // 🚨 본문에 실제 존재하는 사전 항목만 필터링 (AI가 무관한 항목을 오적용하는 것 방지)
        const textLower = text.toLowerCase();
        const matchedLines = settings.dictionary.split('\n').filter(l => {
            if (!l.includes('=')) return false;
            const orig = l.split('=')[0].trim();
            return orig && textLower.includes(orig.toLowerCase());
        });
        if (matchedLines.length > 0) {
            parts.push(`\n[MANDATORY GLOSSARY - For specific terms only]`);
            parts.push(`Below is a glossary for SPECIFIC TERMS ONLY. The REST of the text MUST be fully translated normally.`);
            parts.push(`You MUST use the following glossary for these specific terms when they appear. Apply natural morphological changes (plural, possessive, verb conjugations) according to the context without breaking the term's core meaning.`);
            parts.push(`CRITICAL: Output ONLY the translated term. NEVER add the original word in brackets, parentheses, or any annotation like "소프[Soap]" or "소프(Soap)". Just use the glossary term directly.`);
            parts.push(`WARNING: This glossary is NOT the entire translation task. Translate the ENTIRE text into the target language, using these glossary entries only for the specific listed terms.`);
            parts.push(matchedLines.join('\n'));
        }
    }

    if (prevTranslation) {
        const strength = settings.retranslateStrength || 'normal';
        if (strength === 'soft') {
            parts.push(`[Try a slightly different phrasing from this previous attempt: "${prevTranslation.substring(0, 200)}"]`);
            parts.push(`[Use different word choices while keeping the overall tone. Maintain quality - don't sacrifice naturalness for difference.]`);
        } else if (strength === 'strong') {
            parts.push(`[MANDATORY: Your translation MUST be COMPLETELY DIFFERENT from this: "${prevTranslation.substring(0, 200)}"]`);
            parts.push(`[Use different vocabulary, sentence structure, and tone. Do NOT produce a similar result.]`);
        } else {
            parts.push(`[Provide a different translation from this previous attempt: "${prevTranslation.substring(0, 200)}"]`);
            parts.push(`[Use different vocabulary and sentence structure while preserving meaning and tone.]`);
        }
    }
    
    // 🚨 말투 패턴 분석 결과 주입 (정규식 기반)
    if (contextMessages.length > 0) {
        const speechPatterns = analyzeSpeechPatterns(contextMessages);
        if (speechPatterns) {
            parts.push(`\n[Speech Patterns from Context - Reference for character voice. Apply only to dialogue, NOT narration]\n${speechPatterns}\n[NOTE: For narration/description outside dialogue, use the style preset above. Do NOT force these patterns onto narration.]`);
        }
    }
    
    // 🚨 캐릭터 카드 힌트 주입 (RP 배경/성격 컨텍스트)
    if (characterHints) {
        parts.push(`\n[Character Background - Use as reference for tone/setting consistency. Do NOT translate this:]\n${characterHints}`);
    }
    
    if (contextMessages.length > 0) {
        parts.push('\n[Context - Previous messages for reference. Match each character\'s speech style consistently. Do NOT translate these:]');
        contextMessages.forEach((msg, i) => { const offset = contextMessages.length - i; const speaker = typeof msg === 'object' ? msg.speaker : 'Unknown'; const text = typeof msg === 'object' ? msg.text : msg; parts.push(`[${speaker}] Message -${offset}: "${text}"`); });
    }
    parts.push(`\n[Translate this message:]\n${text}`);
    return parts.join('\n');
}

// 🚨 API 에러 한국어 메시지
const API_ERROR_MESSAGES = {
    400: '📋 잘못된 요청이에요. 입력을 확인해주세요 (400)',
    401: '🔑 API 키가 유효하지 않아요 (401)',
    403: '🚫 API 접근 권한이 없어요 (403)',
    404: '🔍 API를 찾을 수 없어요. 모델명을 확인해주세요 (404)',
    429: '⏳ 요청이 너무 많아요. 잠시 후 다시 시도해주세요 (429)',
    500: '💥 서버 오류가 발생했어요. 잠시 후 다시 시도해주세요 (500)',
    503: '🔧 서버 점검 중이에요. 잠시 후 다시 시도해주세요 (503)'
};

async function fetchWithRetry(url, body, retries = 3, abortSignal = null, extraHeaders = {}) {
    const delays = [500, 1000, 2000];
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const fetchOptions = { method: 'POST', headers: { 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(body) };
            if (abortSignal) fetchOptions.signal = abortSignal;
            const res = await fetch(url, fetchOptions);
            if (res.status === 429) {
                if (attempt < retries) { await sleep(delays[attempt] || 2000); continue; }
                throw new Error(API_ERROR_MESSAGES[429]);
            }
            if (!res.ok) {
                throw new Error(API_ERROR_MESSAGES[res.status] || `❌ 알 수 없는 오류 (${res.status})`);
            }
            return await res.json();
        } catch (e) {
            if (e.name === 'AbortError') throw e;
            if (attempt >= retries) throw e;
            await sleep(delays[attempt] || 2000);
        }
    }
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
export function gatherContextMessages(msgId, stContext, range = 1) {
    if (range <= 0) return []; const chat = stContext.chat; const messages = []; const startIdx = Math.max(0, msgId - range);
    for (let i = startIdx; i < msgId; i++) {
        if (chat[i] && chat[i].mes) {
            let cleanMsg = chat[i].mes.replace(/<(?!!--)[^>]+>/g, '').trim();
            // 🚨 컨텍스트에 병기 형식이 섞여있으면 제거 (현재 메시지 번역에 오염 방지)
            // "English [한국어]" → "English" 만 남김
            cleanMsg = cleanMsg.replace(/\s*\[[^\]]*[가-힣ぁ-んァ-ヶ一-龥][^\]]*\]/g, '');
            if (cleanMsg) {
                // 🚨 화자 정보 포함: AI가 캐릭터 말투 일관성을 유지하도록
                const speaker = chat[i].is_user ? (stContext.name1 || 'User') : (chat[i].name || stContext.name2 || 'Character');
                messages.push({ text: cleanMsg, speaker });
            }
        }
    } return messages;
}

// 🚨 캐릭터 카드에서 톤/배경 힌트 추출 (gatherContextMessages 보조)
export function gatherCharacterHints(stContext) {
    try {
        const characters = stContext.characters || [];
        const characterId = stContext.characterId;
        if (characterId === undefined || !characters[characterId]) return null;
        
        const char = characters[characterId];
        const description = (char.description || '').substring(0, 800);
        const personality = (char.personality || '').substring(0, 400);
        const scenario = (char.scenario || '').substring(0, 400);
        
        if (!description && !personality && !scenario) return null;
        
        const hints = [];
        if (description) hints.push(`Description: ${description}`);
        if (personality) hints.push(`Personality: ${personality}`);
        if (scenario) hints.push(`Scenario: ${scenario}`);
        
        return hints.join('\n');
    } catch (e) { return null; }
}
