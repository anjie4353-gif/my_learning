import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import {
  signAccessToken, signRefreshToken, verifyRefresh,
  hashPassword, comparePassword, getAuth, requireActiveAdmin,
} from '@/lib/auth'

// ---------- Rate limiter (per IP+route) ----------
const buckets = new Map()
function rateLimit(key, max = 60, windowMs = 60_000) {
  const now = Date.now()
  const b = buckets.get(key) || { count: 0, reset: now + windowMs }
  if (now > b.reset) { b.count = 0; b.reset = now + windowMs }
  b.count += 1
  buckets.set(key, b)
  // periodic cleanup
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k)
  }
  return b.count <= max
}
function clientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown'
}

const json = (data, status = 200, extraHeaders = {}) =>
  NextResponse.json(data, { status, headers: extraHeaders })
const bad = (msg, status = 400) => json({ error: msg }, status)

function sanitize(str) {
  if (typeof str !== 'string') return str
  return str.replace(/<[^>]*>?/gm, '').trim()
}
function sanitizeObj(obj, fields) {
  const out = {}
  for (const f of fields) if (obj[f] !== undefined) out[f] = typeof obj[f] === 'string' ? sanitize(obj[f]) : obj[f]
  return out
}
function slugify(name) {
  return name.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}
function shortId(len = 6) {
  return uuidv4().replace(/-/g, '').slice(0, len)
}

async function audit(action, actor, meta = {}) {
  try {
    const db = await getDb()
    await db.collection('audit_logs').insertOne({
      id: uuidv4(), action, actor: actor || 'system', meta, createdAt: new Date(),
    })
  } catch (e) { console.error('audit fail', e) }
}

// ---------- Indexes (call once on first request) ----------
let indexesEnsured = false
async function ensureIndexes() {
  if (indexesEnsured) return
  try {
    const db = await getDb()
    await Promise.all([
      db.collection('products').createIndex({ id: 1 }, { unique: true }),
      db.collection('products').createIndex({ slug: 1 }, { unique: true, sparse: true }),
      db.collection('products').createIndex({ active: 1, createdAt: -1 }),
      db.collection('products').createIndex({ category: 1 }),
      db.collection('products').createIndex({ name: 'text', description: 'text' }),
      db.collection('inquiries').createIndex({ createdAt: -1 }),
      db.collection('inquiries').createIndex({ status: 1 }),
      db.collection('audit_logs').createIndex({ createdAt: -1 }),
      db.collection('admins').createIndex({ email: 1 }, { unique: true }),
      db.collection('admins').createIndex({ id: 1 }, { unique: true }),
      db.collection('contact_messages').createIndex({ createdAt: -1 }),
    ])
    indexesEnsured = true
  } catch (e) { console.error('index err', e) }
}

// ---------- Seeds ----------
async function ensureAdmin() {
  const db = await getDb()
  const admins = db.collection('admins')
  const existing = await admins.findOne({ email: process.env.ADMIN_EMAIL })
  if (!existing) {
    // Sole-admin model: clear any stale admin records (e.g., when ADMIN_EMAIL is rotated)
    await admins.deleteMany({})
    const hashed = await hashPassword(process.env.ADMIN_PASSWORD)
    await admins.insertOne({
      id: uuidv4(), email: process.env.ADMIN_EMAIL,
      passwordHash: hashed, role: 'admin',
      sessionId: null,
      createdAt: new Date(),
    })
  }
}

async function ensureSlug(productsCol, base) {
  let slug = base
  let tries = 0
  while (await productsCol.findOne({ slug })) {
    slug = `${base}-${shortId(4)}`
    if (++tries > 5) { slug = `${base}-${shortId(8)}`; break }
  }
  return slug
}

async function ensureSamples() {
  const db = await getDb()
  const products = db.collection('products')
  const count = await products.countDocuments()
  if (count > 0) return
  const samples = [
    { name: 'Royal Gold Bangle Set', actualPrice: 5999, discountedPrice: 3999, description: 'Handcrafted royal gold-plated bangle set with traditional motifs. Lightweight, premium finish, perfect for festivals and weddings.', category: 'Bangles', stock: 25, imageUrl: 'https://images.unsplash.com/photo-1762342345465-d021b8491309?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwzfHxoYW5kbWFkZSUyMGJhbmdsZXN8ZW58MHx8fHwxNzgyNTMyODY2fDA&ixlib=rb-4.1.0&q=85' },
    { name: 'Jade Stone Bracelet', actualPrice: 2999, discountedPrice: 1799, description: 'Genuine jade stone bracelet with smooth polished beads. Crafted by skilled artisans, brings calm and elegance to every outfit.', category: 'Bracelets', stock: 40, imageUrl: 'https://images.unsplash.com/photo-1767043004223-b2ccbefd98e9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHw0fHxoYW5kbWFkZSUyMGJhbmdsZXN8ZW58MHx8fHwxNzgyNTMyODY2fDA&ixlib=rb-4.1.0&q=85' },
    { name: 'Traditional Glass Bangles', actualPrice: 1499, discountedPrice: 899, description: 'Vibrant multicolor traditional glass bangles. Set of 12 pieces. Perfect for festive occasions and daily ethnic wear.', category: 'Bangles', stock: 100, imageUrl: 'https://images.pexels.com/photos/36738994/pexels-photo-36738994.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940' },
    { name: 'Premium Gold Ring', actualPrice: 7999, discountedPrice: 5499, description: 'Elegant handcrafted gold ring with intricate detailing. Hallmark certified premium finish — a timeless statement piece.', category: 'Rings', stock: 15, imageUrl: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwxfHxnb2xkJTIwamV3ZWxyeXxlbnwwfHx8fDE3ODI1MzI4NzN8MA&ixlib=rb-4.1.0&q=85' },
    { name: 'Gold Chain Bracelet', actualPrice: 4499, discountedPrice: 2999, description: 'Stylish gold chain bracelet handmade by traditional jewelers. Lightweight, durable, and perfect for both casual and formal looks.', category: 'Bracelets', stock: 20, imageUrl: 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwzfHxnb2xkJTIwamV3ZWxyeXxlbnwwfHx8fDE3ODI1MzI4NzN8MA&ixlib=rb-4.1.0&q=85' },
    { name: 'Colorful Handmade Bracelet Set', actualPrice: 999, discountedPrice: 599, description: 'Bohemian-inspired colorful handmade bracelet set. Mix-and-match designs perfect for everyday styling. Set of 5 bracelets.', category: 'Bracelets', stock: 60, imageUrl: 'https://images.unsplash.com/photo-1767040106633-e16852d8317a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwxfHxoYW5kbWFkZSUyMGJhbmdsZXN8ZW58MHx8fHwxNzgyNTMyODY2fDA&ixlib=rb-4.1.0&q=85' },
  ]
  const now = new Date()
  for (const s of samples) {
    const base = slugify(s.name)
    const slug = await ensureSlug(products, base)
    await products.insertOne({
      id: uuidv4(), slug, ...s, active: true, createdAt: now, updatedAt: now,
    })
  }
}

function withSecurityHeaders(res) {
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'SAMEORIGIN')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}

// ============== ROUTER ==============
async function router(request, { params }) {
  await ensureIndexes()
  const resolved = params && typeof params.then === 'function' ? await params : params
  const path = (resolved?.path || []).join('/')
  const method = request.method
  const ip = clientIp(request)

  // Rate limit (stricter on auth)
  const rlKey = `${ip}:${method}:${path}`
  let rlMax = 120
  if (path.startsWith('auth/login')) rlMax = 5
  else if (path === 'inquiries' && method === 'POST') rlMax = 10
  else if (path === 'contact-messages' && method === 'POST') rlMax = 10
  if (!rateLimit(rlKey, rlMax)) return bad('Too many requests', 429)

  if (path === 'init' && method === 'POST') {
    await ensureAdmin(); await ensureSamples()
    return json({ ok: true })
  }
  if (path === 'health' && method === 'GET') return json({ ok: true })

  // ---------- AUTH ----------
  if (path === 'auth/login' && method === 'POST') {
    await ensureAdmin()
    const body = await request.json().catch(() => ({}))
    const email = sanitize(body.email || '').toLowerCase()
    const password = body.password || ''
    if (!email || !password) return bad('Email and password required')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Invalid email')
    const db = await getDb()
    const admin = await db.collection('admins').findOne({ email })
    if (!admin) { await audit('login_failed', email, { ip }); return bad('Invalid credentials', 401) }
    const ok = await comparePassword(password, admin.passwordHash)
    if (!ok) { await audit('login_failed', email, { ip }); return bad('Invalid credentials', 401) }

    // SINGLE-SESSION ENFORCEMENT: rotate sessionId so any previous JWT becomes invalid
    const newSid = uuidv4()
    await db.collection('admins').updateOne({ id: admin.id }, { $set: { sessionId: newSid, lastLoginAt: new Date(), lastLoginIp: ip } })

    const accessToken = signAccessToken({ sub: admin.id, email: admin.email, role: admin.role, sid: newSid })
    const refreshToken = signRefreshToken({ sub: admin.id, sid: newSid })
    await audit('login_success', email, { ip, sid: newSid })
    return json({ accessToken, refreshToken, user: { id: admin.id, email: admin.email, role: admin.role } })
  }

  if (path === 'auth/refresh' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const decoded = verifyRefresh(body.refreshToken || '')
    if (!decoded) return bad('Invalid refresh token', 401)
    const db = await getDb()
    const admin = await db.collection('admins').findOne({ id: decoded.sub })
    if (!admin || admin.sessionId !== decoded.sid) return bad('Session expired (logged in elsewhere)', 401)
    return json({ accessToken: signAccessToken({ sub: admin.id, email: admin.email, role: admin.role, sid: decoded.sid }) })
  }

  if (path === 'auth/me' && method === 'GET') {
    const u = await requireActiveAdmin(request)
    if (!u) return bad('Unauthorized', 401)
    return json({ user: u })
  }

  if (path === 'auth/logout' && method === 'POST') {
    const u = getAuth(request)
    if (u) {
      const db = await getDb()
      await db.collection('admins').updateOne({ id: u.sub }, { $set: { sessionId: null } })
      await audit('logout', u.email, { ip })
    }
    return json({ ok: true })
  }

  // ---------- PRODUCTS ----------
  if (path === 'products' && method === 'GET') {
    await ensureSamples()
    const url = new URL(request.url)
    const q = sanitize(url.searchParams.get('q') || '')
    const category = sanitize(url.searchParams.get('category') || '')
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '12'))
    const wantsAdmin = url.searchParams.get('admin') === '1'
    let includeInactive = false
    if (wantsAdmin) {
      const u = await requireActiveAdmin(request)
      if (u) includeInactive = true
    }
    const db = await getDb()
    const filter = {}
    if (!includeInactive) filter.active = true
    if (q) filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
    if (category && category !== 'all') filter.category = category
    const total = await db.collection('products').countDocuments(filter)
    const items = await db.collection('products')
      .find(filter, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit).limit(limit).toArray()
    const categories = await db.collection('products').distinct('category', { active: true })
    return json(
      { items, total, page, limit, pages: Math.ceil(total / limit) || 1, categories },
      200,
      { 'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=60' }
    )
  }

  // /products/by-slug/:slug (public)
  if (path.startsWith('products/by-slug/') && method === 'GET') {
    const slug = decodeURIComponent(path.split('/')[2] || '')
    const db = await getDb()
    const p = await db.collection('products').findOne({ slug, active: true }, { projection: { _id: 0 } })
    if (!p) return bad('Not found', 404)
    return json(p)
  }

  if (path.startsWith('products/') && !path.endsWith('/toggle') && !path.includes('by-slug') && method === 'GET') {
    const id = path.split('/')[1]
    const db = await getDb()
    const p = await db.collection('products').findOne({ id }, { projection: { _id: 0 } })
    if (!p) return bad('Not found', 404)
    return json(p)
  }

  if (path === 'products' && method === 'POST') {
    const admin = await requireActiveAdmin(request); if (!admin) return bad('Unauthorized', 401)
    const body = await request.json().catch(() => ({}))
    const data = sanitizeObj(body, ['name', 'description', 'category', 'imageUrl'])
    data.actualPrice = Number(body.actualPrice ?? body.price)
    data.discountedPrice = body.discountedPrice !== undefined && body.discountedPrice !== '' ? Number(body.discountedPrice) : null
    data.stock = Number(body.stock || 0)
    if (!data.name || data.name.length < 2) return bad('Invalid name')
    if (!data.description || data.description.length < 5) return bad('Invalid description')
    if (!Number.isFinite(data.actualPrice) || data.actualPrice < 0) return bad('Invalid actual price')
    if (data.discountedPrice !== null && (!Number.isFinite(data.discountedPrice) || data.discountedPrice < 0 || data.discountedPrice > data.actualPrice))
      return bad('Discounted price must be ≤ actual price')
    if (!data.category) return bad('Category required')
    // Image URL is OPTIONAL — use placeholder if missing
    if (!data.imageUrl || data.imageUrl.trim() === '') {
      data.imageUrl = `https://placehold.co/600x600/fdf2f8/be185d?text=${encodeURIComponent(data.name.slice(0, 30))}`
    } else if (!/^https?:\/\//i.test(data.imageUrl)) {
      return bad('Image URL must start with http:// or https://')
    }
    const db = await getDb()
    const slug = await ensureSlug(db.collection('products'), slugify(data.name))
    const now = new Date()
    const doc = { id: uuidv4(), slug, ...data, active: true, createdAt: now, updatedAt: now }
    await db.collection('products').insertOne(doc)
    await audit('product_create', admin.email, { id: doc.id, slug, name: doc.name })
    const { _id, ...clean } = doc
    return json(clean)
  }

  if (path.startsWith('products/') && path.endsWith('/toggle') && method === 'PATCH') {
    const admin = await requireActiveAdmin(request); if (!admin) return bad('Unauthorized', 401)
    const id = path.split('/')[1]
    const db = await getDb()
    const p = await db.collection('products').findOne({ id })
    if (!p) return bad('Not found', 404)
    await db.collection('products').updateOne({ id }, { $set: { active: !p.active, updatedAt: new Date() } })
    await audit('product_toggle', admin.email, { id, active: !p.active })
    return json({ ok: true, active: !p.active })
  }

  if (path.startsWith('products/') && method === 'PUT') {
    const admin = await requireActiveAdmin(request); if (!admin) return bad('Unauthorized', 401)
    const id = path.split('/')[1]
    const body = await request.json().catch(() => ({}))
    const data = sanitizeObj(body, ['name', 'description', 'category', 'imageUrl'])
    if (body.actualPrice !== undefined) data.actualPrice = Number(body.actualPrice)
    if (body.discountedPrice !== undefined) data.discountedPrice = body.discountedPrice === null || body.discountedPrice === '' ? null : Number(body.discountedPrice)
    if (body.stock !== undefined) data.stock = Number(body.stock)
    if (body.active !== undefined) data.active = !!body.active
    if (data.discountedPrice != null && data.actualPrice != null && data.discountedPrice > data.actualPrice)
      return bad('Discounted price must be ≤ actual price')
    data.updatedAt = new Date()
    const db = await getDb()
    // If name changed, regenerate slug uniquely
    if (data.name) {
      const cur = await db.collection('products').findOne({ id })
      if (cur && cur.name !== data.name) {
        data.slug = await ensureSlug(db.collection('products'), slugify(data.name))
      }
    }
    const r = await db.collection('products').updateOne({ id }, { $set: data })
    if (!r.matchedCount) return bad('Not found', 404)
    await audit('product_update', admin.email, { id, fields: Object.keys(data) })
    const p = await db.collection('products').findOne({ id }, { projection: { _id: 0 } })
    return json(p)
  }

  if (path.startsWith('products/') && method === 'DELETE') {
    const admin = await requireActiveAdmin(request); if (!admin) return bad('Unauthorized', 401)
    const id = path.split('/')[1]
    const db = await getDb()
    const r = await db.collection('products').deleteOne({ id })
    if (!r.deletedCount) return bad('Not found', 404)
    await audit('product_delete', admin.email, { id })
    return json({ ok: true })
  }

  // ---------- INQUIRIES ----------
  if (path === 'inquiries' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const name = sanitize(body.name || '')
    const mobile = sanitize(body.mobile || '')
    const address = sanitize(body.address || '')
    const productId = sanitize(body.productId || '')
    if (!name || name.length < 2) return bad('Invalid name')
    if (!/^[0-9+\-\s]{10,15}$/.test(mobile)) return bad('Invalid mobile number')
    if (!address || address.length < 10) return bad('Address must be at least 10 characters')
    const db = await getDb()
    const product = await db.collection('products').findOne({ id: productId }, { projection: { _id: 0 } })
    if (!product) return bad('Product not found', 404)
    const inquiry = {
      id: uuidv4(), customerName: name, mobile, address,
      productId, productSlug: product.slug, productName: product.name,
      productActualPrice: product.actualPrice, productDiscountedPrice: product.discountedPrice,
      productImageUrl: product.imageUrl,
      status: 'new', createdAt: new Date(), ip,
    }
    await db.collection('inquiries').insertOne(inquiry)
    await audit('inquiry_create', name, { productId, mobile })
    const { _id, ...clean } = inquiry
    return json(clean)
  }
  if (path === 'inquiries' && method === 'GET') {
    const admin = await requireActiveAdmin(request); if (!admin) return bad('Unauthorized', 401)
    const db = await getDb()
    const items = await db.collection('inquiries')
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 }).limit(200).toArray()
    return json({ items })
  }
  if (path.startsWith('inquiries/') && method === 'PATCH') {
    const admin = await requireActiveAdmin(request); if (!admin) return bad('Unauthorized', 401)
    const id = path.split('/')[1]
    const body = await request.json().catch(() => ({}))
    const status = sanitize(body.status || '')
    if (!['new', 'contacted', 'confirmed', 'shipped', 'completed', 'cancelled'].includes(status))
      return bad('Invalid status')
    const db = await getDb()
    await db.collection('inquiries').updateOne({ id }, { $set: { status, updatedAt: new Date() } })
    await audit('inquiry_status', admin.email, { id, status })
    return json({ ok: true })
  }

  // ---------- CONTACT MESSAGES ----------
  if (path === 'contact-messages' && method === 'POST') {
    const body = await request.json().catch(() => ({}))
    const name = sanitize(body.name || '')
    const email = sanitize(body.email || '').toLowerCase()
    const message = sanitize(body.message || '')
    const phone = sanitize(body.phone || '')
    if (!name || name.length < 2) return bad('Invalid name')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Invalid email')
    if (!message || message.length < 5) return bad('Message too short')
    const db = await getDb()
    const doc = {
      id: uuidv4(), name, email, phone, message,
      status: 'new', createdAt: new Date(), ip,
    }
    await db.collection('contact_messages').insertOne(doc)
    await audit('contact_message', name, { email })
    const { _id, ...clean } = doc
    return json(clean)
  }
  if (path === 'contact-messages' && method === 'GET') {
    const admin = await requireActiveAdmin(request); if (!admin) return bad('Unauthorized', 401)
    const db = await getDb()
    const items = await db.collection('contact_messages')
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 }).limit(200).toArray()
    return json({ items })
  }

  // ---------- DASHBOARD ----------
  if (path === 'dashboard/stats' && method === 'GET') {
    const admin = await requireActiveAdmin(request); if (!admin) return bad('Unauthorized', 401)
    const db = await getDb()
    const [totalProducts, activeProducts, totalInquiries, newInquiries, totalContacts, newContacts, recent] = await Promise.all([
      db.collection('products').countDocuments(),
      db.collection('products').countDocuments({ active: true }),
      db.collection('inquiries').countDocuments(),
      db.collection('inquiries').countDocuments({ status: 'new' }),
      db.collection('contact_messages').countDocuments(),
      db.collection('contact_messages').countDocuments({ status: 'new' }),
      db.collection('inquiries').find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(5).toArray(),
    ])
    const byCategoryAgg = await db.collection('products').aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $project: { _id: 0, category: '$_id', count: 1 } },
    ]).toArray()
    return json({
      totalProducts, activeProducts, inactiveProducts: totalProducts - activeProducts,
      totalInquiries, newInquiries, totalContacts, newContacts,
      recentInquiries: recent, productsByCategory: byCategoryAgg,
    })
  }

  // ---------- AUDIT ----------
  if (path === 'audit-logs' && method === 'GET') {
    const admin = await requireActiveAdmin(request); if (!admin) return bad('Unauthorized', 401)
    const db = await getDb()
    const items = await db.collection('audit_logs')
      .find({}, { projection: { _id: 0 } })
      .sort({ createdAt: -1 }).limit(100).toArray()
    return json({ items })
  }

  return bad('Not found', 404)
}

async function handle(request, ctx) {
  try {
    const res = await router(request, ctx)
    return withSecurityHeaders(res)
  } catch (e) {
    console.error('API error', e)
    return withSecurityHeaders(json({ error: 'Internal server error' }, 500))
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
