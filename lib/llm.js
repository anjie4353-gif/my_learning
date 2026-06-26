// Multi-provider LLM helper. Primary: Groq (free, fast, 14,400 RPD on 8B model).
// Fallback: Gemini. OpenAI-compatible request format on both providers.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GROQ_BASE = 'https://api.groq.com/openai/v1'

// Provider/model chain. Higher-TPM/cheaper models first.
// Groq model TPM (free tier): llama-4-scout 30k, kimi-k2 10k, gpt-oss-120b 8k, llama-3.3-70b 6k, 8b-instant 6k.
const MODEL_CHAIN = {
  diagram: [
    { provider: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct' }, // 30k TPM, handles big prompts
    { provider: 'groq', model: 'openai/gpt-oss-120b' },
    { provider: 'groq', model: 'moonshotai/kimi-k2-instruct' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'gemini', model: 'gemini-2.5-flash-lite' },
    { provider: 'gemini', model: 'gemini-2.0-flash-lite' },
    { provider: 'gemini', model: 'gemini-2.0-flash' },
  ],
  chat: [
    { provider: 'groq', model: 'llama-3.1-8b-instant' }, // fastest for shorter chats
    { provider: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'groq', model: 'openai/gpt-oss-120b' },
    { provider: 'gemini', model: 'gemini-2.5-flash-lite' },
    { provider: 'gemini', model: 'gemini-2.0-flash-lite' },
  ],
}

export function modelsFor(kind) { return MODEL_CHAIN[kind] || MODEL_CHAIN.chat }

async function callGroq({ model, system, messages, json, temperature }) {
  // Groq requires the word "json" in messages when response_format = json_object.
  // Our diagram prompts already contain "JSON" so this is satisfied.
  const allMsgs = []
  if (system) allMsgs.push({ role: 'system', content: system })
  for (const m of messages) allMsgs.push({ role: m.role, content: m.content })

  const body = {
    model,
    messages: allMsgs,
    temperature,
    max_tokens: 8000,
  }
  if (json) body.response_format = { type: 'json_object' }

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(`Groq ${res.status}: ${text.slice(0, 400)}`)
    err.status = res.status
    err.body = text
    throw err
  }
  let data
  try { data = JSON.parse(text) } catch { throw new Error('Bad JSON from Groq') }
  const out = data?.choices?.[0]?.message?.content || ''
  if (!out) throw new Error(`Groq returned no content: ${text.slice(0, 300)}`)
  return out
}

async function callGemini({ model, system, messages, json, temperature }) {
  const contents = []
  for (const m of messages) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })
  }
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

async function callOnce({ provider, model, system, messages, json, temperature }) {
  if (provider === 'groq') return callGroq({ model, system, messages, json, temperature })
  if (provider === 'gemini') return callGemini({ model, system, messages, json, temperature })
  throw new Error(`Unknown provider: ${provider}`)
}

export async function callLLM({ system, messages, kind = 'chat', json = false, temperature = 0.7, model }) {
  const chain = model ? [{ provider: 'groq', model }] : modelsFor(kind)
  let lastErr
  for (const entry of chain) {
    try {
      const result = await callOnce({
        provider: entry.provider,
        model: entry.model,
        system,
        messages,
        json,
        temperature,
      })
      console.log(`[LLM] ✓ ${entry.provider}/${entry.model}`)
      return result
    } catch (e) {
      lastErr = e
      console.warn(`[LLM] ${entry.provider}/${entry.model} failed (status=${e.status || '?'}): ${(e.message || '').slice(0, 120)}`)
      continue
    }
  }
  if (lastErr?.status === 429) {
    const err = new Error('All AI providers are rate-limited right now. Please try one of the example prompts (they are cached) or try again in a few minutes.')
    err.status = 429
    throw err
  }
  throw lastErr || new Error('All LLM providers failed')
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

const DIAGRAM_BASE = `You are Visual Engineering AI — a world-class expert at explaining ANY technical concept (algorithms, AI/ML, system design, data structures, cloud, networking, math, geometry, physics) through interactive visual diagrams.

You automatically choose the BEST renderer for the concept:
- "geometry" — Use ONLY for pure GEOMETRY/MATH concepts that involve points, lines, polygons, angles, circles, theorems (e.g. Triangle, Pythagorean Theorem, Circle Area, Law of Sines, Polygon properties).
- "flow" — DEFAULT. Use for everything else: algorithms, data structures, neural networks, system architecture, cloud, networking, processes, etc.

When given a concept, respond with a SINGLE JSON object (no markdown, no commentary). The schema:

{
  "title": string,
  "category": string,                    // English only: "AI/ML", "Algorithm", "Architecture", "Data Structure", "Cloud", "Networking", "Math", "Database", "Security", "Geometry", "Physics", "Other"
  "renderer": "flow" | "geometry",
  "summary": string,
  "nodes": [                             // For "flow" renderer (also include even for geometry, can be brief)
    {
      "id": string, "label": string,
      "type": string,                    // English only: "input"|"process"|"data"|"decision"|"output"|"storage"|"service"|"model"|"layer"|"point"
      "description": string, "code": string, "example": string,
      "x": number, "y": number
    }
  ],
  "edges": [
    { "id": string, "source": string, "target": string, "label": string, "animated": boolean }
  ],
  "geometry": {                          // REQUIRED if renderer == "geometry"
    "viewBox": "0 0 600 400",            // SVG viewBox
    "points":   [{ "id": string, "x": number, "y": number, "label": string }],
    "lines":    [{ "id": string, "from": string, "to": string, "label": string, "color": string }],
    "polygons": [{ "id": string, "pointIds": [string], "fill": string, "stroke": string, "label": string }],
    "circles":  [{ "id": string, "cx": number, "cy": number, "r": number, "stroke": string, "fill": string, "label": string }],
    "arcs":     [{ "id": string, "cx": number, "cy": number, "r": number, "startAngle": number, "endAngle": number, "stroke": string, "label": string }],
    "labels":   [{ "id": string, "x": number, "y": number, "text": string, "color": string, "fontSize": number }]
  },
  "steps": [
    {
      "index": number, "title": string, "description": string,
      "highlightNodes": [string],        // For flow: node ids
      "highlightEdges": [string],        // For flow: edge ids
      "showGeometryIds": [string]        // For geometry: ids of points/lines/polygons/circles/arcs/labels visible at this step (cumulative recommended)
    }
  ],
  "formulas": [
    { "name": string, "latex": string, "description": string }
  ],
  "insights": [string],
  "simpleExplanation": string,           // ELI15: 3-4 sentences using a real-life analogy (a smart 15-year-old should "get it"). No jargon.
  "build": {                             // "Build It Yourself" — only for technical/coding concepts (algorithms, ML, software). Skip for pure-geometry/math by setting to null.
    "language": string,                  // "python" | "javascript" | "java" | etc. Pick most common for the concept.
    "setup": [string],                   // Step-by-step setup commands (e.g. "pip install numpy", "Install Python 3.10+")
    "folderStructure": string,           // ASCII tree of project layout
    "code": string,                      // Complete, runnable, well-commented code
    "walkthrough": [                     // Explain key code blocks
      { "snippet": string, "explanation": string }
    ],
    "runCommand": string,                // e.g. "python main.py"
    "expectedOutput": string,            // What the user should see
    "commonErrors": [
      { "error": string, "cause": string, "fix": string }
    ]
  },
  "projects": {                          // 3 project ideas. Set to null for non-buildable concepts.
    "mini": string,                      // 1-sentence idea + 1-sentence what's involved
    "intermediate": string,
    "advanced": string
  },
  "interviewQuestions": [                // 3 real interview questions with concise model answers
    { "question": string, "answer": string }
  ],
  "quiz": [
    {
      "id": string,
      "question": string,
      "options": [string, string, string, string],
      "correctIndex": number,
      "explanation": string
    }
  ]
}

LAYOUT RULES (flow):
- 5-12 nodes. Place so they form a clear flow. Space generously: ≥180px on x, ≥100px on y. Canvas 1000x600.
- Vertical layers for neural networks; left-to-right for pipelines; logical grouping for architectures.

GEOMETRY RULES:
- Use the geometry.viewBox coordinate space (default "0 0 600 400"); origin top-left, y grows down.
- Place geometric objects so the figure fills most of the viewBox with ~40px padding.
- Use color hex codes (e.g. "#3b82f6" blue, "#22c55e" green, "#f97316" orange, "#fbbf24" yellow, "#ef4444" red, "#ec4899" pink).
- For Pythagorean theorem: draw the right triangle + a square on each side; label sides a, b, c and areas a², b², c².
- For angles: use arcs with small r (e.g. 25) and an associated label.
- Steps should reveal the figure progressively via showGeometryIds (cumulative: each step lists ALL ids visible).
- Always include the title formula in formulas[] with LaTeX.

QUALITY RULES (all):
- Be technically accurate and pedagogically excellent.
- 4-8 steps with coherent narration when played in order.
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
