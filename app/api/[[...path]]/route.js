import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import { callLLM, buildDiagramSystemPrompt, buildTutorSystemPrompt } from '@/lib/llm'

export const runtime = 'nodejs'
export const maxDuration = 60

let client
let db
async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

function extractJSON(text) {
  try { return JSON.parse(text) } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) { try { return JSON.parse(fence[1]) } catch {} }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(text.slice(start, end + 1)) } catch {}
  }
  throw new Error('Failed to parse JSON from LLM output')
}

async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const database = await connectToMongo()

    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(NextResponse.json({ message: 'Visual Engineering AI API ready' }))
    }

    if (route === '/generate' && method === 'POST') {
      const body = await request.json()
      const prompt = (body.prompt || '').trim()
      const lang = body.lang || 'en'
      if (!prompt) {
        return handleCORS(NextResponse.json({ error: 'prompt is required' }, { status: 400 }))
      }

      const raw = await callLLM({
        system: buildDiagramSystemPrompt(lang),
        messages: [{ role: 'user', content: `Concept: ${prompt}\n\nReturn ONLY the JSON object as specified.` }],
        model: 'gemini-2.5-flash',
        json: true,
        temperature: 0.6,
      })

      let diagram
      try {
        diagram = extractJSON(raw)
      } catch {
        console.error('Parse error. Raw output:', raw.slice(0, 500))
        return handleCORS(NextResponse.json({ error: 'AI returned malformed JSON. Please try again.' }, { status: 502 }))
      }

      diagram.nodes = Array.isArray(diagram.nodes) ? diagram.nodes : []
      diagram.edges = Array.isArray(diagram.edges) ? diagram.edges : []
      diagram.steps = Array.isArray(diagram.steps) ? diagram.steps : []
      diagram.formulas = Array.isArray(diagram.formulas) ? diagram.formulas : []
      diagram.insights = Array.isArray(diagram.insights) ? diagram.insights : []
      diagram.language = lang

      const record = { id: uuidv4(), prompt, diagram, lang, createdAt: new Date() }
      try { await database.collection('diagrams').insertOne({ ...record }) } catch (e) {
        console.warn('Mongo insert failed (non-fatal):', e.message)
      }

      return handleCORS(NextResponse.json({ id: record.id, diagram }))
    }

    if (route === '/tutor' && method === 'POST') {
      const body = await request.json()
      const userMessage = (body.message || '').trim()
      const history = Array.isArray(body.history) ? body.history : []
      const concept = body.concept || null
      const sessionId = body.sessionId || uuidv4()
      const lang = body.lang || 'en'

      if (!userMessage) {
        return handleCORS(NextResponse.json({ error: 'message is required' }, { status: 400 }))
      }

      let conceptContext = ''
      if (concept) {
        const safeConcept = {
          title: concept.title,
          category: concept.category,
          summary: concept.summary,
          nodes: (concept.nodes || []).map(n => ({ id: n.id, label: n.label, description: n.description })),
          steps: (concept.steps || []).map(s => ({ index: s.index, title: s.title, description: s.description })),
          formulas: concept.formulas || [],
          insights: concept.insights || [],
        }
        conceptContext = `\n\nCURRENT DIAGRAM CONTEXT:\n${JSON.stringify(safeConcept, null, 2)}`
      }

      const messages = []
      for (const m of history.slice(-10)) {
        if (m.role === 'user' || m.role === 'assistant') {
          messages.push({ role: m.role, content: m.content })
        }
      }
      messages.push({ role: 'user', content: userMessage })

      const reply = await callLLM({
        system: buildTutorSystemPrompt(lang) + conceptContext,
        messages,
        model: 'gemini-2.5-flash',
        temperature: 0.5,
      })

      return handleCORS(NextResponse.json({ sessionId, reply }))
    }

    if (route === '/diagrams' && method === 'GET') {
      const docs = await database.collection('diagrams').find({}).sort({ createdAt: -1 }).limit(20).toArray()
      const items = docs.map(({ _id, diagram, ...rest }) => ({
        ...rest,
        title: diagram?.title,
        category: diagram?.category,
      }))
      return handleCORS(NextResponse.json(items))
    }

    if (route.startsWith('/diagrams/') && method === 'GET') {
      const id = route.split('/diagrams/')[1]
      const doc = await database.collection('diagrams').findOne({ id })
      if (!doc) return handleCORS(NextResponse.json({ error: 'not found' }, { status: 404 }))
      const { _id, ...rest } = doc
      return handleCORS(NextResponse.json(rest))
    }

    return handleCORS(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
