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
6. KOREAN FORMALITY LOCK (when translating to Korean) — CRITICAL CONSISTENCY:
   
   **NARRATION RULES (지문/묘사):**
   - Narration/description sentences: Use ONE consistent ending throughout the ENTIRE message
   - DEFAULT: declarative form (-다/-었다/-한다/-했다)
   - NEVER mix -다 with -요/-습니다 within narration of the same message
   - Even ONE sentence break in formality is a CRITICAL FAILURE
   
   **DIALOGUE RULES (대사):**
   - Each character has ONE formality level: 반말 OR 존댓말 — NEVER both within same message
   - Lock that character's level from the FIRST sentence and maintain it to the LAST
   - If context messages show the character spoke in 반말, ALL their dialogue in this message is 반말
   - If context messages show 존댓말, ALL their dialogue is 존댓말
   - When context unclear, use the most natural register for the character's relationship
   
   **VERIFICATION CHECKLIST before output:**
   - Re-read every narration sentence: do they ALL end the same way (-다 OR -요, never both)?
   - Re-read every character's dialogue: same formality throughout?
   - If you find ONE inconsistency, fix it before output
   
   **EXAMPLES:**
   ❌ CRITICAL FAILURE — Mixed narration formality:
      "그가 그녀를 바라봤다. 그녀는 미소를 지었어요. 잠시 침묵이 흘렀다."
      (다 → 요 → 다 = FAIL)
   ✅ CORRECT — Consistent declarative:
      "그가 그녀를 바라봤다. 그녀는 미소를 지었다. 잠시 침묵이 흘렀다."
   
   ❌ CRITICAL FAILURE — Character flip-flop:
      Character A: "어디 가?" ... "어디 가시나요?"
      (반말 → 존댓말 = FAIL)
   ✅ CORRECT — Locked formality:
      Character A: "어디 가?" ... "뭐 해?"
      (consistent 반말)

[FEARLESS TRANSLATION RULES]
The text WILL contain complex formatting: HTML tags, Markdown, code blocks, YAML, special brackets.
DO NOT PANIC. DO NOT skip any section just because it looks complicated.
TRANSLATE EVERY piece of human-readable text fearlessly!

[FORMAT PRESERVATION]
1. TRANSLATE THE WORDS inside all tags, blocks, and brackets. Never leave readable text untranslated.
2. KEEP THE SYMBOLS. Preserve ALL HTML tags exactly as-is — including standard tags (<memo>, <div>, <small>, <pre>, <code>) AND custom tags (<info_panel>, <status_box>, <character_card>, <chat_box>, ANY tag the user uses). Never strip, modify, or omit any tag. Preserve brackets (『』, 【】, <>), and markdown (*bold*, _italic_) in their exact original positions.

[CODE BLOCK FENCE - CRITICAL]
Code block markers (\`\`\`yaml, \`\`\`json, \`\`\`python, \`\`\`) are TRIPLE BACKTICKS followed by an optional language identifier.
You MUST preserve ALL THREE BACKTICKS (\`\`\`) at the START and at the END of code blocks. 
NEVER drop the opening \`\`\`yaml or the closing \`\`\`. NEVER replace them with anything else.
ALSO preserve horizontal rule markers (___, ---) used inside info panels.

WRONG (lost the fence):
<memo><small>
[Time: ...]    ← yaml fence missing!
[Location: ...]
</small></memo>

CORRECT:
<memo><small>
___            ← horizontal rule preserved
\`\`\`yaml       ← opening fence preserved
[Time: ...]
[Location: ...]
\`\`\`            ← closing fence preserved
</small></memo>
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

[KOREAN KINSHIP TERMS - CRITICAL]
English family/relationship terms are AMBIGUOUS in Korean. Translate based on CONTEXT, never default to one form.

**brother (남성 형제):**
- Older brother spoken to by younger male: "형" (e.g., "Hey brother" by 10yo to 15yo male → "형!")
- Older brother spoken to by younger female: "오빠" (e.g., girl to older boy → "오빠")
- Younger brother: "남동생" or just the name
- Default when age unclear: USE THE NAME, NOT a generic term
- NEVER default "brother" to "동생" — that means YOUNGER brother specifically

**sister (여성 형제):**
- Older sister spoken to by younger male: "누나"
- Older sister spoken to by younger female: "언니"
- Younger sister: "여동생" or just the name
- Default when age unclear: USE THE NAME
- NEVER default "sister" to "언니" — that's specifically "older sister to female"

**Other ambiguous kinship:**
- uncle → 삼촌/외삼촌/이모부/고모부 (use context, or "아저씨" for non-relative older man)
- aunt → 이모/고모/외숙모/숙모 (or "아주머니" for non-relative older woman)
- cousin → 사촌 (acceptable as generic)
- grandfather/grandmother → 할아버지/할머니 (acceptable as generic)

**RULE: When context provides NO age/gender info → use the character's NAME instead of a generic kinship term.**

WRONG: "My brother arrived" → "내 동생이 도착했다" (assumed younger)
RIGHT (if older known): "My brother arrived" → "형이 도착했다"
RIGHT (if name known): "My brother John arrived" → "존이 도착했다"
RIGHT (unknown): "My brother arrived" → "내 형제가 도착했다" or use name

[DEFAULT TRANSLATION TONE - LOCKED]
Unless the user explicitly specifies a style or tone via a style preset or custom instruction:
- DEFAULT: Natural conversational Korean (구어체)
- Dialogue: Match the character's established voice from context
- Narration: Declarative form (-다/-었다/-한다) consistently
- DO NOT randomly switch between formal and informal mid-message
- DO NOT alternate between literary high-style and casual mid-message
- DO NOT add ornate/archaic vocabulary unless source has it
- DO NOT remove naturalness — keep it sounding like real spoken/read Korean

If the user has NOT provided explicit style instructions and the source is in standard English, output STANDARD conversational Korean. Don't get creative with tone.

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

    const { forceLang = null, prevTranslation = null, contextMessages = [], abortSignal = null, silent = false, forceFresh = false } = options;
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

    if (!prevTranslation && !forceFresh) {
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
            // [SPLIT 자동 병합] "Hi. [안녕.] I'm chat. [나는 챗.]" → "Hi. I'm chat. [안녕. 나는 챗.]"
            // 같은 따옴표 안에 여러 [번역] 블록이 있으면 통합
            const beforeMerge = cleaned;
            cleaned = cleaned.replace(/"([^"]*?)"/g, (match, content) => {
                // 따옴표 안에 [한국어/일본어/중국어] 패턴이 2개 이상 있으면 병합
                const bracketRegex = /\s*\[([^\]]*[가-힣ぁ-んァ-ヶ一-龥][^\]]*)\]\s*/g;
                const brackets = [...content.matchAll(bracketRegex)];
                if (brackets.length >= 2) {
                    // 원문(영어) 부분만 추출
                    const original = content.replace(bracketRegex, ' ').replace(/\s+/g, ' ').trim();
                    // 번역들을 순서대로 합침
                    const translations = brackets.map(b => b[1].trim()).join(' ');
                    return `"${original} [${translations}]"`;
                }
                return match;
            });
            if (beforeMerge !== cleaned) {
                console.log('[CAT] 🔗 끊긴 병기 자동 병합');
            }
            
            // [REVERSED 자동 교정] "한국어 [English]" → "English [한국어]" (역순으로 나온 경우)
            cleaned = cleaned.replace(/"([^"]*?[가-힣][^"]*?)\s*\[([^\]]*[a-zA-Z][^\]]*)\]([^"]*?)"/g, (match, kor, eng, rest) => {
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
            // 🚨 정리 대상: 짧은 영어 대사 + [한국어 번역] 패턴만 (HTML/yaml/시스템 패널 보호)
            const beforeClean = cleaned;
            
            // 안전 조건:
            // 1. 따옴표 안이 짧은 텍스트 (200자 미만)
            // 2. [한국어] 블록이 30자 미만
            // 3. 주변에 HTML 태그(<...>) 또는 코드블록(```)이 없음
            const safeBilingualPattern = /"([^"<>`]{1,200}?[a-zA-Z][^"<>`]{1,200}?)\s*\[([^\]<>`]{1,30}[가-힣][^\]<>`]{0,30})\]([^"<>`]{0,50}?)"/g;
            cleaned = cleaned.replace(safeBilingualPattern, '"$2$3"');
            cleaned = cleaned.replace(/「([^」<>`]{1,200}?[a-zA-Z][^」<>`]{1,200}?)\s*\[([^\]<>`]{1,30}[가-힣][^\]<>`]{0,30})\]([^」<>`]{0,50}?)」/g, '「$2$3」');
            cleaned = cleaned.replace(/『([^』<>`]{1,200}?[a-zA-Z][^』<>`]{1,200}?)\s*\[([^\]<>`]{1,30}[가-힣][^\]<>`]{0,30})\]([^』<>`]{0,50}?)』/g, '『$2$3』');
            
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
        
        // 🚨 응답 품질 검증: 너무 짧은 응답 감지 (번역 실패)
        // 원문보다 30% 미만이면 번역 실패 가능성 (yaml/HTML 다 빠진 경우 등)
        if (cleaned.length < text.length * 0.3 && text.length > 100) {
            console.warn(`[CAT] ⚠️ 응답 너무 짧음: ${cleaned.length}자 (원문 ${text.length}자, ${Math.round(cleaned.length / text.length * 100)}%)`);
            catNotify(`${getThemeEmoji()} 번역이 너무 짧아요 (${Math.round(cleaned.length / text.length * 100)}%). 다시 시도해보세요.`, "warning");
        }
        
        // 🚨 번역 언어 검증: 한국어 번역인데 한국어가 거의 없음
        if (targetLang === 'Korean' && cleaned.length > 50) {
            const koreanChars = (cleaned.match(/[가-힣]/g) || []).length;
            const koreanRatio = koreanChars / cleaned.length;
            if (koreanRatio < 0.15) {
                console.warn(`[CAT] ⚠️ 한국어 비율 매우 낮음: ${Math.round(koreanRatio * 100)}%`);
                catNotify(`${getThemeEmoji()} 번역에 한국어가 거의 없어요. AI가 번역 실패한 것 같아요.`, "warning");
            }
        }
        
        // 🚨 존댓말/반말 혼용 감지 (한국어 번역만)
        if (targetLang === 'Korean' && cleaned.length > 50) {
            checkFormalityMix(cleaned);
        }
        
        await setCached(text, targetLang, cleaned, thought, getCacheModelKey(settings));
        return { text: cleaned, lang: targetLang, fromCache: false };
    } catch (e) {
        if (e.name === 'AbortError') return null;
        const errMsg = e.message || '알 수 없는 오류';
        _lastDebugLog.error = errMsg;
        
        // 🚨 네트워크/시스템 오류 분류 - 어디서 맛탱이 갔는지 명확히
        const networkErrorMsg = classifyNetworkError(e);
        
        // Vertex 모델 실패 시 프로젝트 ID/리전 입력 안내
        if (isVertexModel && !settings.vertexProject) {
            $('#ct-vertex-extra').slideDown(200);
            catNotify(`🚨 Vertex 연결 실패! 프로젝트 ID와 리전을 입력해보세요.`, "error");
        } else if (networkErrorMsg) {
            // 네트워크 분류기로 명확한 원인 표시
            catNotify(`${getThemeEmoji()} ${networkErrorMsg}`, "error");
        } else if (errMsg.includes('[') && errMsg.includes(']')) {
            // 이미 분류된 메시지 (API_ERROR_MESSAGES 등) - 그대로 표시
            catNotify(`${getThemeEmoji()} ${errMsg}`, "error");
        } else {
            // 분류 불가능한 미지의 오류
            catNotify(`${getThemeEmoji()} ❓ [원인 불명] ${errMsg.substring(0, 80)}`, "error");
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

🚨🚨🚨 ABSOLUTE RULE: ONE QUOTATION MARK PAIR = ONE TRANSLATION BLOCK 🚨🚨🚨
A "quotation" means everything inside one pair of " ". 
NO MATTER how many sentences are inside a single quotation, translate them ALL TOGETHER as ONE consolidated [translation] block at the END.
NEVER split per sentence. NEVER interleave [translation] between sentences.

CORRECT FORMAT — Single [translation] block at the END of each quotation:
✅ "Hi. I'm chat-si. [안녕. 나는 챗시야.]"
✅ "Get down! There's a sniper. Move now! [엎드려! 저격수가 있어. 지금 움직여!]"
✅ "I love you. I always have. I always will. [널 사랑해. 항상 사랑했어. 앞으로도 사랑할 거야.]"

❌ ABSOLUTELY WRONG — Split per sentence (this is the most common mistake):
❌ "Hi. [안녕.] I'm chat-si. [나는 챗시야.]"
❌ "Get down! [엎드려!] There's a sniper. [저격수가 있어.] Move now! [지금 움직여!]"
❌ "I love you. [널 사랑해.] I always have. [항상 사랑했어.]"

WHY WRONG: Translation goes ONCE at the END of the entire quotation, not after each sentence.

❌ WRONG (reversed order):
"<${bl.tgtLabel} translation> [<${bl.srcLabel} dialogue>]"

❌ WRONG (bracket outside quote):
"<${bl.srcLabel} dialogue>"[<${bl.tgtLabel} translation>]

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

═══════════════════════════════════════════
MULTI-SENTENCE DIALOGUE EXAMPLE (CRITICAL)
═══════════════════════════════════════════

SOURCE:
She introduced herself with a smile. "Hi. I'm chat-si. Nice to meet you."

CORRECT OUTPUT:
그녀가 미소를 지으며 자신을 소개했다. "Hi. I'm chat-si. Nice to meet you. [안녕. 나는 챗시야. 만나서 반가워.]"

❌ WRONG (split each sentence into its own bracket):
그녀가 미소를 지으며 자신을 소개했다. "Hi. [안녕.] I'm chat-si. [나는 챗시야.] Nice to meet you. [만나서 반가워.]"

KEY POINT: Multiple sentences inside ONE quotation get ONE translation block at the END.

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
5. For multi-sentence quotes: Is there ONLY ONE [translation] block per quotation? (If split per sentence → MERGE into one block at the end)
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
    400: '📋 [입력 오류] AI가 요청을 이해 못 했어요. 원문이 너무 길거나 형식이 이상할 수도 있어요 (400)',
    401: '🔑 [인증 실패] API 키가 만료됐거나 잘못됐어요. 키를 다시 확인하세요 (401)',
    403: '🚫 [접근 거부] API 키 권한이 없거나, 해당 모델/지역이 차단됐어요 (403)',
    404: '🔍 [모델 없음] 모델명을 찾을 수 없어요. 모델 이름 또는 API 엔드포인트 확인하세요 (404)',
    408: '⏱️ [요청 타임아웃] AI가 시간 안에 응답 못 했어요. 다시 시도해보세요 (408)',
    413: '📏 [크기 초과] 원문이 너무 길어요. 짧게 나눠보세요 (413)',
    429: '🚦 [사용량 초과] 분당/일당 한도를 다 썼어요. 잠시 후 다시 시도하세요 (429)',
    500: '💥 [Gemini 서버 오류] AI 측 문제예요 (Gemini 자체 불안정). 자동 재시도 중... (500)',
    502: '🔌 [게이트웨이 오류] AI 서버 연결 문제예요. 자동 재시도 중... (502)',
    503: '🔧 [Gemini 서비스 일시 중단] AI 측 점검 중이에요. 잠시 후 다시 시도하세요 (503)',
    504: '⏳ [게이트웨이 타임아웃] AI 응답이 너무 느려요. 다시 시도해보세요 (504)'
};

// 🚨 네트워크/시스템 오류 분류기 - 어디서 맛탱이 갔는지 명확히
function classifyNetworkError(e) {
    const msg = e.message || '';
    const name = e.name || '';
    
    // 사용자 취소
    if (msg === '취소됨' || name === 'AbortError') return null;
    
    // 인터넷 연결 끊김
    if (name === 'TypeError' && /failed to fetch|networkerror|네트워크/i.test(msg)) {
        return '🌐 [인터넷 끊김] 인터넷 연결이 끊겼어요. Wi-Fi/데이터를 확인하세요';
    }
    if (/network|enotfound|econnrefused|econnreset/i.test(msg)) {
        return '🌐 [네트워크 오류] 네트워크 연결에 문제가 있어요. 잠시 후 다시 시도하세요';
    }
    
    // DNS 문제
    if (/dns|name not resolved/i.test(msg)) {
        return '🛰️ [DNS 오류] 서버 주소를 찾을 수 없어요. 인터넷 설정 확인하세요';
    }
    
    // SSL/TLS 문제
    if (/ssl|tls|certificate/i.test(msg)) {
        return '🔐 [보안 인증 오류] HTTPS 연결에 문제가 있어요';
    }
    
    // 응답 파싱 실패
    if (/json|parse|unexpected token/i.test(msg)) {
        return '📦 [응답 형식 오류] AI 응답이 잘못된 형식이에요 (Gemini 측 일시 오류). 재시도 권장';
    }
    
    // CORS
    if (/cors|cross-origin/i.test(msg)) {
        return '🚧 [CORS 오류] 브라우저 보안 정책 차단. 직접 연결 모드 사용해보세요';
    }
    
    // 타임아웃 (내부 60초)
    if (/응답 시간 초과|timeout/i.test(msg)) {
        return '⏱️ [응답 지연] AI가 60초 안에 응답 못 했어요. 원문이 너무 길거나 Gemini 측 부하 상태';
    }
    
    // Vertex 관련
    if (/vertex|gcp|google cloud/i.test(msg)) {
        return '☁️ [Vertex 연결 오류] GCP 프로젝트/리전 설정을 확인하세요';
    }
    
    return null; // 분류 불가
}

async function fetchWithRetry(url, body, retries = 5, abortSignal = null, extraHeaders = {}) {
    // 🚨 안정화 강화: exponential backoff + jitter + 5xx 별도 처리 + timeout
    // 시도 횟수: 6 (initial + 5 retries) — Gemini 자체 불안정성 완화
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        let timeoutId;
        try {
            // 🚨 60초 timeout (hang 방지)
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 60000);
            
            // 외부 abortSignal과 내부 timeout 둘 다 지원
            const signal = abortSignal 
                ? combineSignals(abortSignal, controller.signal)
                : controller.signal;
            
            const fetchOptions = { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json', ...extraHeaders }, 
                body: JSON.stringify(body),
                signal
            };
            
            const res = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);
            
            // 429 Rate Limit: 더 긴 대기
            if (res.status === 429) {
                if (attempt < retries) { 
                    await sleep(calculateBackoff(attempt, 2000, 30000));
                    continue; 
                }
                throw new Error(API_ERROR_MESSAGES[429]);
            }
            
            // 5xx Server Error (Gemini 자주 발생): 재시도
            if (res.status >= 500 && res.status < 600) {
                if (attempt < retries) { 
                    console.warn(`[CAT] 🔁 ${res.status} 서버 오류 → 재시도 ${attempt + 1}/${retries}`);
                    await sleep(calculateBackoff(attempt, 1500, 20000));
                    continue; 
                }
                throw new Error(API_ERROR_MESSAGES[res.status] || `❌ 서버 오류 (${res.status})`);
            }
            
            if (!res.ok) {
                throw new Error(API_ERROR_MESSAGES[res.status] || `❌ 알 수 없는 오류 (${res.status})`);
            }
            
            return await res.json();
        } catch (e) {
            if (timeoutId) clearTimeout(timeoutId);
            
            // 외부 abort (사용자 취소)는 즉시 종료
            if (abortSignal?.aborted) throw new Error('취소됨');
            if (e.name === 'AbortError' && !abortSignal?.aborted) {
                // 우리 timeout으로 인한 abort
                lastError = new Error('⏱️ 응답 시간 초과 (60초)');
                if (attempt < retries) {
                    console.warn(`[CAT] ⏱️ 타임아웃 → 재시도 ${attempt + 1}/${retries}`);
                    await sleep(calculateBackoff(attempt, 1000, 10000));
                    continue;
                }
                throw lastError;
            }
            
            lastError = e;
            if (attempt >= retries) throw e;
            
            // 네트워크 오류 등 일반 에러 재시도
            console.warn(`[CAT] 🔁 ${e.message?.substring(0, 50) || '오류'} → 재시도 ${attempt + 1}/${retries}`);
            await sleep(calculateBackoff(attempt, 1000, 15000));
        }
    }
    throw lastError || new Error('재시도 실패');
}

// exponential backoff with jitter (thundering herd 방지)
function calculateBackoff(attempt, base = 1000, max = 15000) {
    const exp = Math.min(base * Math.pow(2, attempt), max);
    const jitter = Math.random() * 0.3 * exp; // 0-30% jitter
    return Math.floor(exp + jitter);
}

// 🚨 존댓말/반말 혼용 감지 (지문 기준)
// 따옴표 밖의 narration만 보고 -다 와 -요/-습니다 같이 쓰는지 검사
function checkFormalityMix(text) {
    // 대사 (따옴표 안) 제거
    let narration = text.replace(/"[^"]*"|'[^']*'|「[^」]*」|『[^』]*』/g, '');
    
    // 평서문 종결 어미 카운트
    // -다: -다., -이다., -었다., -한다., -겠다. 등
    // -요/-습니다: -요., -아요., -어요., -습니다., -ㅂ니다. 등
    const decl = (narration.match(/[가-힣](다|었다|했다|한다|이다|된다|겠다)\.\s/g) || []).length;
    const poli = (narration.match(/[가-힣](요|아요|어요|예요|네요|군요|습니다|ㅂ니다|입니다)\.\s/g) || []).length;
    
    // 둘 다 있고 비율이 80:20 안쪽이면 혼용
    if (decl >= 2 && poli >= 2) {
        const total = decl + poli;
        const minRatio = Math.min(decl, poli) / total;
        if (minRatio > 0.15) {
            console.warn(`[CAT] ⚠️ 지문 존댓말/반말 혼용 감지: -다 ${decl}개, -요/-습니다 ${poli}개`);
            catNotify(`${getThemeEmoji()} 지문에 -다와 -요가 섞였어요 (${decl}/${poli}). 재번역 권장.`, "warning");
        }
    }
}

// 두 AbortSignal 결합 (외부 + 내부 timeout)
function combineSignals(...signals) {
    const controller = new AbortController();
    for (const signal of signals) {
        if (!signal) continue;
        if (signal.aborted) { controller.abort(); return controller.signal; }
        signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return controller.signal;
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
