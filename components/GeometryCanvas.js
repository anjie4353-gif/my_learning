'use client'

// SVG geometry renderer with progressive reveal animations.
// All geometric primitives fade/draw in based on visible IDs per step.

import { useMemo } from 'react'

export function GeometryCanvas({ geometry, visibleIds, onElementClick }) {
  if (!geometry) return null
  const visible = useMemo(() => new Set(visibleIds || []), [visibleIds])
  const showAll = !visibleIds || visibleIds.length === 0

  const viewBox = geometry.viewBox || '0 0 600 400'

  const pointById = useMemo(() => {
    const m = {}
    for (const p of geometry.points || []) m[p.id] = p
    return m
  }, [geometry])

  const isVisible = (id) => showAll || visible.has(id)

  function handleClick(kind, obj) {
    onElementClick?.({
      type: kind,
      label: obj.label || obj.id,
      description: obj.description || '',
      raw: obj,
    })
  }

  return (
    <svg
      viewBox={viewBox}
      className="w-full h-full bg-slate-950"
      preserveAspectRatio="xMidYMid meet"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <defs>
        <marker id="geo-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="#94a3b8" />
        </marker>
        <pattern id="geo-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#geo-grid)" />

      {/* Polygons (rendered first, behind lines) */}
      {(geometry.polygons || []).map((poly) => {
        const visible_ = isVisible(poly.id)
        const pts = (poly.pointIds || []).map((pid) => pointById[pid]).filter(Boolean)
        if (pts.length < 3) return null
        const dStr = pts.map((p) => `${p.x},${p.y}`).join(' ')
        return (
          <g key={poly.id} style={{ opacity: visible_ ? 1 : 0, transition: 'opacity 0.6s ease' }}>
            <polygon
              points={dStr}
              fill={poly.fill || 'rgba(59,130,246,0.18)'}
              stroke={poly.stroke || '#3b82f6'}
              strokeWidth="2"
              className="cursor-pointer hover:brightness-125"
              onClick={() => handleClick('polygon', poly)}
            />
            {poly.label && (
              <text
                x={pts.reduce((s, p) => s + p.x, 0) / pts.length}
                y={pts.reduce((s, p) => s + p.y, 0) / pts.length}
                fill="#e2e8f0"
                fontSize="14"
                fontWeight="600"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ pointerEvents: 'none' }}
              >
                {poly.label}
              </text>
            )}
          </g>
        )
      })}

      {/* Circles */}
      {(geometry.circles || []).map((c) => {
        const visible_ = isVisible(c.id)
        return (
          <g key={c.id} style={{ opacity: visible_ ? 1 : 0, transition: 'opacity 0.6s ease' }}>
            <circle
              cx={c.cx}
              cy={c.cy}
              r={c.r}
              fill={c.fill || 'none'}
              stroke={c.stroke || '#a855f7'}
              strokeWidth="2"
              className="cursor-pointer hover:brightness-125"
              onClick={() => handleClick('circle', c)}
            />
            {c.label && (
              <text x={c.cx} y={c.cy} fill="#e2e8f0" fontSize="12" fontWeight="600" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
                {c.label}
              </text>
            )}
          </g>
        )
      })}

      {/* Arcs (angles) */}
      {(geometry.arcs || []).map((a) => {
        const visible_ = isVisible(a.id)
        const r = a.r || 25
        const start = (a.startAngle * Math.PI) / 180
        const end = (a.endAngle * Math.PI) / 180
        const x1 = a.cx + r * Math.cos(start)
        const y1 = a.cy + r * Math.sin(start)
        const x2 = a.cx + r * Math.cos(end)
        const y2 = a.cy + r * Math.sin(end)
        const large = Math.abs(a.endAngle - a.startAngle) > 180 ? 1 : 0
        const mid = ((a.startAngle + a.endAngle) / 2 * Math.PI) / 180
        const lx = a.cx + (r + 14) * Math.cos(mid)
        const ly = a.cy + (r + 14) * Math.sin(mid)
        return (
          <g key={a.id} style={{ opacity: visible_ ? 1 : 0, transition: 'opacity 0.6s ease' }}>
            <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={a.stroke || '#fbbf24'} strokeWidth="2" />
            {a.label && <text x={lx} y={ly} fill="#fbbf24" fontSize="13" fontWeight="700" textAnchor="middle" dominantBaseline="middle">{a.label}</text>}
          </g>
        )
      })}

      {/* Lines */}
      {(geometry.lines || []).map((ln) => {
        const visible_ = isVisible(ln.id)
        const a = pointById[ln.from]
        const b = pointById[ln.to]
        if (!a || !b) return null
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        return (
          <g key={ln.id} style={{ opacity: visible_ ? 1 : 0, transition: 'opacity 0.5s ease' }}>
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={ln.color || '#60a5fa'}
              strokeWidth="2.5"
              strokeLinecap="round"
              className="cursor-pointer"
              onClick={() => handleClick('line', ln)}
            />
            {ln.label && (
              <text x={mx} y={my - 6} fill={ln.color || '#93c5fd'} fontSize="14" fontWeight="700" textAnchor="middle" style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#0f172a', strokeWidth: 4 }}>
                {ln.label}
              </text>
            )}
          </g>
        )
      })}

      {/* Points */}
      {(geometry.points || []).map((p) => {
        const visible_ = isVisible(p.id)
        return (
          <g key={p.id} style={{ opacity: visible_ ? 1 : 0, transition: 'opacity 0.4s ease', transform: visible_ ? 'scale(1)' : 'scale(0)', transformOrigin: `${p.x}px ${p.y}px` }}>
            <circle cx={p.x} cy={p.y} r="5" fill="#fbbf24" stroke="#0f172a" strokeWidth="2" className="cursor-pointer" onClick={() => handleClick('point', p)} />
            {p.label && (
              <text x={p.x + 10} y={p.y - 10} fill="#fbbf24" fontSize="16" fontWeight="800" style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#0f172a', strokeWidth: 4 }}>
                {p.label}
              </text>
            )}
          </g>
        )
      })}

      {/* Free labels */}
      {(geometry.labels || []).map((l) => {
        const visible_ = isVisible(l.id)
        return (
          <text
            key={l.id}
            x={l.x}
            y={l.y}
            fill={l.color || '#e2e8f0'}
            fontSize={l.fontSize || 16}
            fontWeight="700"
            textAnchor="middle"
            style={{ opacity: visible_ ? 1 : 0, transition: 'opacity 0.6s ease', paintOrder: 'stroke', stroke: '#0f172a', strokeWidth: 4, pointerEvents: 'none' }}
          >
            {l.text}
          </text>
        )
      })}
    </svg>
  )
}
