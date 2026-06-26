// Server-only LLM helper using Google Gemini with retry + fallback chain.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Ordered fallback chain. If one rate-limits, try the next.
// All are free-tier eligible; lite has highest RPD/RPM.
const MODEL_CHAIN = {
  diagram: ['gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash'],
  chat:    ['gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash'],
}

export function modelsFor(kind) { return MODEL_CHAIN[kind] || MODEL_CHAIN.chat }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

function parseRetryDelay(text) {
  // Gemini 429 returns "Please retry in 35.97s" or RetryInfo with retryDelay "30s"
  const m = text.match(/retry in (\d+(?:\.\d+)?)s/i) || text.match(/"retryDelay"\s*:\s*"(\d+)s"/)
  if (m) return Math.min(Math.ceil(parseFloat(m[1]) * 1000), 8000) // cap 8s
  return 1500
}

async function callOnce({ model, system, contents, json, temperature }) {
  const body = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: 16384,
      thinkingConfig: { thinkingBudget: 0 },
    },
  }
  if (system) body.systemInstruction = { parts: [{ text: system }] }
  if (json) body.generationConfig.responseMimeType = 'application/json'

  const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': process.env.GEMINI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(`Gemini ${res.status}: ${text.slice(0, 400)}`)
    err.status = res.status
    err.body = text
    throw err
  }
  let data
  try { data = JSON.parse(text) } catch { throw new Error('Bad JSON from Gemini') }
  const out = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
  if (!out) throw new Error(`Gemini returned no content: ${text.slice(0, 300)}`)
  return out
}

export async function callLLM({ system, messages, kind = 'chat', json = false, temperature = 0.7, model }) {
  const contents = []
  for (const m of messages) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })
  }

  const models = model ? [model] : modelsFor(kind)
  let lastErr
  for (let i = 0; i < models.length; i++) {
    const mdl = models[i]
    try {
      return await callOnce({ model: mdl, system, contents, json, temperature })
    } catch (e) {
      lastErr = e
      console.warn(`[LLM] ${mdl} failed (status=${e.status || '?'}); trying next model in chain...`)
      // On 429 (daily quota), don't waste time retrying same model — jump to next immediately
      // On 5xx or network errors, also move to next model
      continue
    }
  }
  // All models failed. If last error was 429, throw a user-friendly variant.
  if (lastErr?.status === 429) {
    const err = new Error('All AI models are rate-limited right now (free-tier daily quota). Please try one of the example prompts (they are cached) or try again in a few minutes.')
    err.status = 429
    throw err
  }
  throw lastErr || new Error('All LLM models failed')
}

const LANG_NAMES = {
  en: 'English', te: 'Telugu (తెలుగు)', hi: 'Hindi (हिन्दी)', ta: 'Tamil (தமிழ்)',
  kn: 'Kannada (ಕನ್ನಡ)', ml: 'Malayalam (മലയാളം)', mr: 'Marathi (मराठी)',
  bn: 'Bengali (বাংলা)', gu: 'Gujarati (ગુજરાતી)',
  es: 'Spanish (Español)', fr: 'French (Français)', de: 'German (Deutsch)',
  ja: 'Japanese (日本語)', ko: 'Korean (한국어)', zh: 'Chinese (中文)', ar: 'Arabic (العربية)',
}

function langInstruction(lang) {
  if (!lang || lang === 'en') return ''
  const name = LANG_NAMES[lang] || lang
  return `

LANGUAGE OUTPUT REQUIREMENT (CRITICAL):
Generate ALL natural-language text content in ${name}. This includes: title, summary, node labels, node descriptions, node examples, step titles, step descriptions, formula names, formula descriptions, and insights.
RULES:
- JSON keys MUST remain in English (e.g. "title", "nodes", "label").
- Field values like "category" and node "type" MUST remain in English (e.g. "AI/ML", "input", "process").
- LaTeX formulas MUST remain universal (mathematical notation).
- Code snippets stay in their programming language; comments may be in ${name}.
- Universal technical terms (e.g. "Transformer", "Kubernetes", "GPU") may stay in English if no good native equivalent exists, but prefer native language wherever natural.
- Use proper native script. Do NOT transliterate.
`
}

export function buildDiagramSystemPrompt(lang) { return DIAGRAM_BASE + langInstruction(lang) }
export function buildTutorSystemPrompt(lang) {
  if (!lang || lang === 'en') return TUTOR_BASE
  const name = LANG_NAMES[lang] || lang
  return TUTOR_BASE + `\n\nIMPORTANT: Respond entirely in ${name} using proper native script. Code snippets and LaTeX may remain canonical. Universal technical terms may stay in English if commonly used as-is in ${name}.`
}

const DIAGRAM_BASE = `You are Visual Engineering AI — a world-class expert at explaining ANY technical concept (algorithms, AI/ML, system design, data structures, cloud, networking, math, physics) through interactive visual diagrams.

When given a concept, you respond with a SINGLE JSON object (no markdown, no commentary) matching this exact schema:

{
  "title": string,
  "category": string,                    // English only: "AI/ML", "Algorithm", "Architecture", "Data Structure", "Cloud", "Networking", "Math", "Database", "Security", "Other"
  "summary": string,
  "nodes": [
    {
      "id": string,
      "label": string,
      "type": string,                    // English only: "input", "process", "data", "decision", "output", "storage", "service", "model", "layer"
      "description": string,
      "code": string,
      "example": string,
      "x": number,
      "y": number
    }
  ],
  "edges": [
    { "id": string, "source": string, "target": string, "label": string, "animated": boolean }
  ],
  "steps": [
    { "index": number, "title": string, "description": string, "highlightNodes": [string], "highlightEdges": [string] }
  ],
  "formulas": [
    { "name": string, "latex": string, "description": string }
  ],
  "insights": [string]
}

LAYOUT RULES:
- Place nodes so they form a clear visual flow (left-to-right, top-to-bottom, or layered).
- Space nodes generously: at least 180px apart on x, 100px on y. Canvas is 1000x600.
- For neural networks/layered systems use vertical layers.
- For pipelines/algorithms use left-to-right flow.
- For architectures use logical grouping.

QUALITY RULES:
- 5-12 nodes total. Be technically accurate and pedagogically excellent.
- Make node labels concise; put detail in description.
- 4-8 steps that tell a coherent story when played in order.
- Include at least 1 formula if the concept has any mathematical underpinning.
- 3-5 insights.
- Output VALID JSON ONLY. No prose. No markdown fences.`

const TUTOR_BASE = `You are the Visual Engineering AI Tutor — a brilliant, patient teacher who has just walked the user through an interactive visual diagram of a technical concept.

The current concept context will be provided. Answer the user's follow-up questions clearly:
- Reference specific nodes/steps/formulas from the diagram when relevant.
- Use simple analogies first, then technical precision.
- Keep responses concise (2-5 short paragraphs).
- For interview-style questions, give structured answers (definition → mechanism → tradeoffs → example).
- Use markdown for code blocks and emphasis. Use $$ ... $$ for LaTeX block formulas, and $ ... $ for inline.
- If the user asks about something outside the current concept, briefly answer and offer to generate a new diagram.`

export const DIAGRAM_SYSTEM_PROMPT = DIAGRAM_BASE
export const TUTOR_SYSTEM_PROMPT = TUTOR_BASE
