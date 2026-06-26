'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import 'katex/dist/katex.min.css'
import { BlockMath, InlineMath } from 'react-katex'
import {
  Sparkles, Send, Play, Pause, SkipBack, SkipForward, X, Loader2,
  Brain, MessageCircle, Zap, Code2, BookOpen, Lightbulb, ChevronRight, Cpu, Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { LanguageSelector } from '@/components/LanguageSelector'
import { useLang } from '@/app/providers'
import { EXAMPLE_PROMPTS, langByCode } from '@/lib/i18n'

const TYPE_COLORS = {
  input: { bg: '#1e3a8a', border: '#3b82f6', text: '#dbeafe' },
  output: { bg: '#14532d', border: '#22c55e', text: '#dcfce7' },
  process: { bg: '#3b0764', border: '#a855f7', text: '#f3e8ff' },
  decision: { bg: '#713f12', border: '#eab308', text: '#fef9c3' },
  data: { bg: '#164e63', border: '#06b6d4', text: '#cffafe' },
  storage: { bg: '#365314', border: '#84cc16', text: '#ecfccb' },
  service: { bg: '#831843', border: '#ec4899', text: '#fce7f3' },
  model: { bg: '#7c2d12', border: '#f97316', text: '#ffedd5' },
  layer: { bg: '#1e293b', border: '#64748b', text: '#e2e8f0' },
}
function colorFor(type) { return TYPE_COLORS[type] || TYPE_COLORS.layer }

function buildFlow(diagram, highlightNodeIds = [], highlightEdgeIds = []) {
  const nodes = (diagram?.nodes || []).map((n) => {
    const c = colorFor(n.type)
    const isHi = highlightNodeIds.includes(n.id)
    return {
      id: n.id,
      position: { x: Number(n.x) || 0, y: Number(n.y) || 0 },
      data: { label: n.label, raw: n },
      style: {
        background: c.bg,
        color: c.text,
        border: `2px solid ${isHi ? '#fbbf24' : c.border}`,
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: 13,
        fontWeight: 600,
        minWidth: 120,
        boxShadow: isHi
          ? '0 0 0 4px rgba(251,191,36,0.25), 0 8px 24px rgba(251,191,36,0.35)'
          : '0 4px 16px rgba(0,0,0,0.4)',
        transition: 'all 0.4s ease',
      },
    }
  })
  const edges = (diagram?.edges || []).map((e) => {
    const isHi = highlightEdgeIds.includes(e.id)
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label || undefined,
      animated: isHi || e.animated,
      style: {
        stroke: isHi ? '#fbbf24' : '#64748b',
        strokeWidth: isHi ? 3 : 1.8,
        transition: 'all 0.3s ease',
      },
      labelStyle: { fill: '#cbd5e1', fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: '#0f172a' },
      markerEnd: { type: MarkerType.ArrowClosed, color: isHi ? '#fbbf24' : '#64748b' },
    }
  })
  return { nodes, edges }
}

export default function App() {
  const { t, lang, setLang, detectedSuggestion, dismissSuggestion } = useLang()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [diagram, setDiagram] = useState(null)
  const [error, setError] = useState('')
  const [rateLimited, setRateLimited] = useState(false)
  const [selectedNode, setSelectedNode] = useState(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [tutorOpen, setTutorOpen] = useState(false)
  const [chat, setChat] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatScrollRef = useRef(null)

  const currentStep = diagram?.steps?.[stepIndex] || null
  const flow = useMemo(
    () => buildFlow(diagram, currentStep?.highlightNodes || [], currentStep?.highlightEdges || []),
    [diagram, currentStep]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  useEffect(() => { setNodes(flow.nodes); setEdges(flow.edges) }, [flow, setNodes, setEdges])

  useEffect(() => {
    if (!playing || !diagram?.steps?.length) return
    const tt = setTimeout(() => {
      setStepIndex((i) => {
        if (i + 1 >= diagram.steps.length) { setPlaying(false); return i }
        return i + 1
      })
    }, 2200)
    return () => clearTimeout(tt)
  }, [playing, stepIndex, diagram])

  async function generate(text) {
    const p = (text ?? prompt).trim()
    if (!p) return
    setLoading(true); setError(''); setRateLimited(false); setSelectedNode(null); setStepIndex(0); setPlaying(false); setChat([])
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p, lang }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.rateLimited) setRateLimited(true)
        throw new Error(data.error || 'Failed to generate')
      }
      setDiagram(data.diagram)
      setPrompt(p)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function sendChat(messageOverride) {
    const msg = (messageOverride ?? chatInput).trim()
    if (!msg || chatLoading) return
    const newHistory = [...chat, { role: 'user', content: msg }]
    setChat(newHistory)
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: chat, concept: diagram, lang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'tutor failed')
      setChat([...newHistory, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setChat([...newHistory, { role: 'assistant', content: `Error: ${e.message}` }])
    } finally {
      setChatLoading(false)
      setTimeout(() => { chatScrollRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }) }, 50)
    }
  }

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node.data?.raw || null)
  }, [])

  // ---------- LANDING ----------
  if (!diagram) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-10 pb-24">
          <nav className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Brain className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg">{t('app_name')}</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-purple-500/40 text-purple-300 hidden sm:inline-flex">
                <Sparkles className="w-3 h-3 mr-1" /> {t('powered_by')}
              </Badge>
              <LanguageSelector />
            </div>
          </nav>

          {detectedSuggestion && (
            <div className="mb-8 mx-auto max-w-2xl bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-xl px-4 py-3 flex items-center gap-3 backdrop-blur">
              <Globe className="w-5 h-5 text-purple-300 shrink-0" />
              <div className="flex-1 text-sm">
                {t('switch_lang')} <span className="font-semibold">{langByCode(detectedSuggestion).native}</span>?
              </div>
              <Button size="sm" onClick={() => setLang(detectedSuggestion)} className="bg-purple-600 hover:bg-purple-500 h-8">
                {t('switch_yes')}
              </Button>
              <button onClick={dismissSuggestion} className="text-slate-400 hover:text-slate-100 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="text-center mb-12">
            <Badge className="mb-6 bg-purple-500/10 text-purple-300 border-purple-500/30">
              {t('badge_interactive')}
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 leading-tight">
              {t('hero_1')}<br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                {t('hero_2')}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
              {t('hero_subtitle')}
            </p>

            <div className="max-w-2xl mx-auto">
              <div className="flex gap-2 p-2 bg-slate-900/80 border border-slate-700 rounded-2xl backdrop-blur shadow-2xl">
                <Input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && generate()}
                  placeholder={t('input_placeholder')}
                  className="flex-1 bg-transparent border-0 text-base focus-visible:ring-0 placeholder:text-slate-500"
                />
                <Button
                  onClick={() => generate()}
                  disabled={loading || !prompt.trim()}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 px-6"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" />{t('visualize')}</>}
                </Button>
              </div>
              {error && !rateLimited && <p className="mt-3 text-red-400 text-sm">{error}</p>}
              {rateLimited && (
                <div className="mt-4 mx-auto max-w-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-sm rounded-xl px-4 py-3 text-left">
                  <div className="font-semibold mb-1">⚡ Rate limit reached (Gemini free tier: 20 req/day/model)</div>
                  <div className="text-amber-200/80">Try one of the cached example concepts below — they load instantly. Or upgrade the Gemini API key in <code className="px-1 bg-amber-900/40 rounded">.env</code> to remove this limit.</div>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  disabled={loading}
                  onClick={() => { setPrompt(ex); generate(ex) }}
                  className="px-3 py-1.5 rounded-full text-xs bg-slate-800/60 hover:bg-slate-700 border border-slate-700 hover:border-purple-500/50 transition disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mt-20">
            {[
              { icon: Zap, title: t('feat_1_t'), desc: t('feat_1_d') },
              { icon: Play, title: t('feat_2_t'), desc: t('feat_2_d') },
              { icon: MessageCircle, title: t('feat_3_t'), desc: t('feat_3_d') },
            ].map((f) => (
              <Card key={f.title} className="p-6 bg-slate-900/60 border-slate-800 backdrop-blur">
                <f.icon className="w-7 h-7 text-purple-400 mb-3" />
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-slate-400">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>

        {loading && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur flex items-center justify-center z-50">
            <div className="text-center">
              <div className="relative w-20 h-20 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse" />
                <Brain className="absolute inset-0 m-auto w-10 h-10" />
              </div>
              <p className="text-lg font-medium">{t('loading_title')}</p>
              <p className="text-sm text-slate-400 mt-1">{t('loading_sub')}</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---------- WORKSPACE ----------
  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/60 backdrop-blur z-10">
        <button
          onClick={() => { setDiagram(null); setPrompt(''); setError('') }}
          className="flex items-center gap-2 hover:opacity-80"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Brain className="w-4 h-4" />
          </div>
          <span className="font-bold hidden sm:inline">{t('app_name')}</span>
        </button>
        <div className="flex-1 mx-4 flex items-center gap-2 max-w-2xl">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            placeholder={t('try_another')}
            className="bg-slate-800 border-slate-700"
          />
          <Button onClick={() => generate()} disabled={loading} size="sm" className="bg-purple-600 hover:bg-purple-500">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </Button>
        </div>
        <LanguageSelector compact />
        <Button variant="outline" size="sm" onClick={() => setTutorOpen((o) => !o)} className="border-slate-700">
          <MessageCircle className="w-4 h-4 mr-2" />{t('ai_tutor')}
        </Button>
      </header>

      <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/40 flex items-center gap-3">
        <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30">{diagram.category}</Badge>
        <h2 className="text-lg font-semibold">{diagram.title}</h2>
        <p className="text-sm text-slate-400 hidden md:block truncate">{diagram.summary}</p>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1e293b" gap={20} />
            <Controls className="!bg-slate-800 !border-slate-700" />
            <MiniMap className="!bg-slate-900 !border-slate-700" nodeColor={(n) => n.style?.border || '#64748b'} maskColor="rgba(0,0,0,0.6)" />
          </ReactFlow>

          {diagram.steps?.length > 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl backdrop-blur px-4 py-3 flex items-center gap-3 min-w-[340px] max-w-[90%]">
              <Button size="icon" variant="ghost" onClick={() => { setPlaying(false); setStepIndex(0) }}>
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button size="icon" onClick={() => setPlaying((p) => !p)} className="bg-purple-600 hover:bg-purple-500">
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setStepIndex((i) => Math.min(i + 1, diagram.steps.length - 1))}>
                <SkipForward className="w-4 h-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>{t('step')} {stepIndex + 1} / {diagram.steps.length}</span>
                </div>
                <div className="text-sm font-medium truncate">{currentStep?.title}</div>
              </div>
            </div>
          )}

          {currentStep && (
            <div className="absolute top-4 left-4 right-4 md:right-auto max-w-md bg-slate-900/95 border border-slate-700 rounded-xl p-4 backdrop-blur shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold">{stepIndex + 1}</div>
                <span className="font-semibold">{currentStep.title}</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{currentStep.description}</p>
            </div>
          )}
        </div>

        <aside className="w-[360px] hidden lg:flex flex-col border-l border-slate-800 bg-slate-900/40">
          <ScrollArea className="flex-1">
            <div className="p-5 space-y-5">
              {selectedNode ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="mb-2 border-slate-700">{selectedNode.type}</Badge>
                      <h3 className="font-semibold text-lg">{selectedNode.label}</h3>
                    </div>
                    <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-slate-200">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{selectedNode.description}</p>
                  {selectedNode.code && (
                    <div>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Code2 className="w-3 h-3" />{t('code')}</div>
                      <pre className="text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap text-slate-300">{selectedNode.code}</pre>
                    </div>
                  )}
                  {selectedNode.example && (
                    <div>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mb-1"><Lightbulb className="w-3 h-3" />{t('real_world_example')}</div>
                      <p className="text-sm text-slate-300">{selectedNode.example}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-slate-500 text-sm py-4">
                  <Cpu className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  {t('click_node_hint')}
                </div>
              )}

              {diagram.formulas?.length > 0 && (
                <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3 flex items-center gap-1"><BookOpen className="w-3 h-3" />{t('formulas')}</h4>
                  <div className="space-y-3">
                    {diagram.formulas.map((f, i) => (
                      <div key={i} className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                        <div className="text-sm font-medium mb-1">{f.name}</div>
                        <div className="my-2 text-slate-200 overflow-x-auto">
                          <BlockMath math={f.latex} />
                        </div>
                        <div className="text-xs text-slate-400">{f.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {diagram.insights?.length > 0 && (
                <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1"><Lightbulb className="w-3 h-3" />{t('insights')}</h4>
                  <ul className="space-y-2">
                    {diagram.insights.map((ins, i) => (
                      <li key={i} className="text-sm text-slate-300 flex gap-2">
                        <ChevronRight className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                        <span>{ins}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>
      </div>

      {tutorOpen && (
        <div className="fixed bottom-0 right-0 top-0 w-full sm:w-[420px] bg-slate-900 border-l border-slate-800 z-40 flex flex-col shadow-2xl">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-sm">{t('ai_tutor')}</div>
                <div className="text-xs text-slate-400">{t('context')}: {diagram.title}</div>
              </div>
            </div>
            <button onClick={() => setTutorOpen(false)} className="text-slate-400 hover:text-slate-100"><X className="w-4 h-4" /></button>
          </div>
          <ScrollArea className="flex-1" viewportRef={chatScrollRef}>
            <div className="p-4 space-y-4">
              {chat.length === 0 && (
                <div className="text-sm text-slate-400 space-y-2">
                  <p>{t('ask_about')} <span className="text-slate-200 font-medium">{diagram.title}</span>:</p>
                  <div className="space-y-1.5">
                    {[t('suggest_1'), t('suggest_2'), t('suggest_3'), t('suggest_4')].map(q => (
                      <button key={q} onClick={() => sendChat(q)} className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700">{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === 'user' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-100 border border-slate-700'}`}>
                    <ChatMessage content={m.content} />
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('thinking')}
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="p-3 border-t border-slate-800 flex gap-2">
            <Textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
              placeholder={t('ask_diagram_placeholder')}
              className="min-h-[44px] max-h-32 resize-none bg-slate-800 border-slate-700"
            />
            <Button onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()} className="bg-purple-600 hover:bg-purple-500 self-end">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ChatMessage({ content }) {
  const parts = []
  const codeRegex = /```(\w+)?\n?([\s\S]*?)```/g
  let last = 0
  let m
  while ((m = codeRegex.exec(content)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: content.slice(last, m.index) })
    parts.push({ type: 'code', lang: m[1] || '', value: m[2] })
    last = m.index + m[0].length
  }
  if (last < content.length) parts.push({ type: 'text', value: content.slice(last) })

  return (
    <div className="space-y-2">
      {parts.map((p, i) => {
        if (p.type === 'code') {
          return <pre key={i} className="text-xs bg-slate-950 border border-slate-700 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap">{p.value}</pre>
        }
        return <TextWithMath key={i} text={p.value} />
      })}
    </div>
  )
}

function TextWithMath({ text }) {
  const blockRegex = /\$\$([\s\S]+?)\$\$/g
  const segments = []
  let last = 0
  let m
  while ((m = blockRegex.exec(text)) !== null) {
    if (m.index > last) segments.push({ type: 'inline', value: text.slice(last, m.index) })
    segments.push({ type: 'block', value: m[1].trim() })
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ type: 'inline', value: text.slice(last) })

  return (
    <div className="whitespace-pre-wrap">
      {segments.map((s, i) => {
        if (s.type === 'block') {
          return <div key={i} className="my-2 overflow-x-auto"><BlockMath math={s.value} /></div>
        }
        return <InlineText key={i} text={s.value} />
      })}
    </div>
  )
}

function InlineText({ text }) {
  const inlineRegex = /\$([^$\n]+?)\$/g
  const out = []
  let last = 0
  let m
  while ((m = inlineRegex.exec(text)) !== null) {
    if (m.index > last) out.push(<span key={out.length}>{renderBold(text.slice(last, m.index))}</span>)
    out.push(<InlineMath key={out.length} math={m[1]} />)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(<span key={out.length}>{renderBold(text.slice(last))}</span>)
  return <>{out}</>
}

function renderBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="px-1 py-0.5 bg-slate-950 rounded text-xs">{p.slice(1, -1)}</code>
    return <span key={i}>{p}</span>
  })
}
