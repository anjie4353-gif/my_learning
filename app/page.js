'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  ShoppingBag, Search, MessageCircle, Shield, Package, Users, ClipboardList,
  TrendingUp, LogOut, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Star,
  Truck, Award, Lock, Heart, Sparkles, Gem, Mail, Phone, MapPin, Share2, Tag, X, Mailbox
} from 'lucide-react'

const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919553951918'
const STORE = process.env.NEXT_PUBLIC_STORE_NAME || 'UN Mart'
const TAGLINE = process.env.NEXT_PUBLIC_STORE_TAGLINE || 'Handmade art with a touch of heart'
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'anjieu4353@gmail.com'

// Client-side image compression for upload (resize + JPEG re-encode)
async function compressImage(file, maxDim = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Please select an image file')); return
    }
    if (file.size > 25 * 1024 * 1024) {
      reject(new Error('File too large (max 25 MB before compression)')); return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Could not load image'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

const apiFetch = async (path, opts = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`/api${path}`, { ...opts, headers })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = { error: text } }
  if (!res.ok) {
    if (res.status === 401 && token) {
      // session invalidated (another admin logged in)
      localStorage.removeItem('token'); localStorage.removeItem('refresh'); localStorage.removeItem('user')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:invalidated', { detail: { reason: data?.error } }))
      }
    }
    throw new Error(data?.error || `HTTP ${res.status}`)
  }
  return data
}

const fmtPrice = (n) => '₹' + Number(n).toLocaleString('en-IN')
const computeDiscount = (actual, discounted) => {
  if (!discounted || !actual || discounted >= actual) return 0
  return Math.round(((actual - discounted) / actual) * 100)
}
const effectivePrice = (p) => (p.discountedPrice && p.discountedPrice > 0 ? p.discountedPrice : p.actualPrice)
const productUrl = (slug) => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/?p=${encodeURIComponent(slug)}`
}

// ---------------- Header ----------------
function Header({ view, setView, authed, onLogout }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="container flex h-16 items-center justify-between">
        <button onClick={() => setView('store')} className="flex items-center gap-2 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-amber-500 text-white shadow-md group-hover:scale-105 transition">
            <Gem className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold tracking-tight text-slate-900">{STORE}</span>
            <span className="text-[10px] text-rose-600 -mt-0.5 font-medium italic">{TAGLINE}</span>
          </div>
        </button>
        <nav className="flex items-center gap-1 md:gap-3">
          {view === 'store' && (
            <>
              <a href="#catalog" className="hidden sm:block text-sm font-medium text-slate-700 hover:text-rose-600 px-2">Shop</a>
              <a href="#about" className="hidden sm:block text-sm font-medium text-slate-700 hover:text-rose-600 px-2">About</a>
              <a href="#contact" className="hidden sm:block text-sm font-medium text-slate-700 hover:text-rose-600 px-2">Contact</a>
            </>
          )}
          {view !== 'store' && (
            <Button variant="ghost" size="sm" onClick={() => setView('store')}>Storefront</Button>
          )}
          {authed ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setView('admin')}>Dashboard</Button>
              <Button variant="outline" size="sm" onClick={onLogout}><LogOut className="h-4 w-4 mr-1" />Logout</Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView('login')}
              className="border-rose-400 text-rose-700 hover:bg-rose-50"
            >
              <Lock className="h-4 w-4 mr-1" /> ADMIN
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}

// ---------------- Hero ----------------
function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-rose-50 via-amber-50 to-pink-100">
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_70%_30%,#f9a8d4,transparent_60%)]" />
      <div className="container relative py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <Badge className="mb-4 bg-rose-100 hover:bg-rose-200 text-rose-700 border-rose-200">
            <Sparkles className="h-3 w-3 mr-1" /> Handcrafted with love
          </Badge>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight text-slate-900">
            {STORE}
            <span className="block text-2xl md:text-3xl font-medium text-rose-600 mt-2 italic">
              {TAGLINE}
            </span>
          </h1>
          <p className="mt-5 text-lg text-slate-700 max-w-xl">
            Discover exquisite handmade bangles, bracelets, and jewelry — each piece meticulously crafted to bring a radiant smile to your face.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#catalog">
              <Button size="lg" className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white shadow-lg">
                <ShoppingBag className="mr-2 h-4 w-4" /> Shop Collection
              </Button>
            </a>
            <a href="#about">
              <Button size="lg" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50">
                Our Story
              </Button>
            </a>
          </div>
          <div className="mt-6 flex items-center gap-4 text-xs text-slate-600 flex-wrap">
            <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-rose-500" /> Handmade</span>
            <span className="flex items-center gap-1"><Award className="h-3.5 w-3.5 text-amber-600" /> Premium quality</span>
            <span className="flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-emerald-600" /> Pan-India delivery</span>
          </div>
        </div>
        <div className="hidden md:block">
          <div className="relative">
            <img
              src="https://images.pexels.com/photos/7314466/pexels-photo-7314466.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
              alt="Handmade jewelry"
              className="rounded-3xl shadow-2xl w-full object-cover h-[420px] ring-4 ring-white/50"
            />
            <div className="absolute -bottom-4 -left-4 bg-white text-slate-900 rounded-xl p-3 shadow-lg flex items-center gap-2">
              <div className="flex">{[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}</div>
              <div className="text-xs">
                <div className="font-semibold">4.9 / 5</div>
                <div className="text-muted-foreground">10k+ happy customers</div>
              </div>
            </div>
            <div className="absolute -top-3 -right-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg font-semibold">
              ✨ New Collection
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------- Product Card ----------------
function ProductCard({ p, onOrder, onView, onShare }) {
  const discount = computeDiscount(p.actualPrice, p.discountedPrice)
  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-rose-100">
      <button onClick={() => onView(p)} className="block w-full text-left">
        <div className="aspect-square overflow-hidden bg-rose-50/50 relative">
          <img
            src={p.imageUrl}
            alt={p.name}
            className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
          />
          {discount > 0 && (
            <div className="absolute top-2 left-2 bg-rose-600 text-white text-xs font-bold px-2 py-1 rounded-md shadow">
              {discount}% OFF
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onShare(p) }}
            title="Share product"
            className="absolute top-2 right-2 h-9 w-9 rounded-full bg-white text-rose-700 flex items-center justify-center shadow-md hover:bg-rose-50 hover:scale-110 transition"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </button>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base line-clamp-2 leading-tight">{p.name}</CardTitle>
          <Badge variant="secondary" className="shrink-0 text-[10px] bg-rose-50 text-rose-700">{p.category}</Badge>
        </div>
        <CardDescription className="line-clamp-2 text-xs">{p.description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-3 pt-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-bold text-slate-900">{fmtPrice(effectivePrice(p))}</span>
          {discount > 0 && (
            <span className="text-sm text-muted-foreground line-through">{fmtPrice(p.actualPrice)}</span>
          )}
        </div>
        <div className="mt-1 text-[11px]">
          {p.stock > 0 ? <span className="text-emerald-600 font-medium">In stock</span> : <span className="text-red-600 font-medium">Out of stock</span>}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          onClick={() => onOrder(p)}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
        </Button>
        <Button
          variant="outline"
          onClick={() => onShare(p)}
          className="border-rose-300 text-rose-700 hover:bg-rose-50"
          title="Share product link"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}

// ---------------- Product Detail Dialog ----------------
function ProductDetailDialog({ product, open, onClose, onOrder, onShare }) {
  if (!product) return null
  const discount = computeDiscount(product.actualPrice, product.discountedPrice)
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="aspect-square md:aspect-auto bg-rose-50">
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          </div>
          <div className="p-6 flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Badge variant="secondary" className="bg-rose-50 text-rose-700">{product.category}</Badge>
                <h2 className="text-2xl font-bold mt-2">{product.name}</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
            </div>
            <div className="mt-4 flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl font-bold text-rose-700">{fmtPrice(effectivePrice(product))}</span>
              {discount > 0 && (
                <>
                  <span className="text-lg text-muted-foreground line-through">{fmtPrice(product.actualPrice)}</span>
                  <Badge className="bg-rose-600 hover:bg-rose-700">{discount}% OFF</Badge>
                </>
              )}
            </div>
            <p className="mt-4 text-slate-700 text-sm leading-relaxed">{product.description}</p>
            <div className="mt-4 text-xs text-slate-600 space-y-1">
              <div>Availability: {product.stock > 0 ? <span className="text-emerald-700 font-medium">{product.stock} in stock</span> : <span className="text-red-700 font-medium">Out of stock</span>}</div>
              <div className="font-mono break-all">URL: {productUrl(product.slug)}</div>
            </div>
            <div className="mt-auto pt-5 flex gap-2 flex-wrap">
              <Button onClick={() => onOrder(product)} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                <MessageCircle className="mr-2 h-4 w-4" /> Order on WhatsApp
              </Button>
              <Button variant="outline" onClick={() => onShare(product)}>
                <Share2 className="h-4 w-4 mr-1" /> Share
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Order Modal ----------------
function OrderModal({ product, open, onClose }) {
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [waReady, setWaReady] = useState(null)

  useEffect(() => { if (!open) { setName(''); setMobile(''); setAddress(''); setWaReady(null) } }, [open])
  if (!product) return null

  const buildMessage = () => {
    const url = productUrl(product.slug)
    const price = effectivePrice(product)
    const mrp = product.actualPrice
    const hasDisc = product.discountedPrice && product.discountedPrice < mrp
    return (
      `*Customer Order Request — ${STORE}*\n\n` +
      `*Name:* ${name}\n` +
      `*Phone:* ${mobile}\n` +
      `*Address:* ${address}\n\n` +
      `*Product:* ${product.name}\n` +
      (hasDisc
        ? `*Price:* ${fmtPrice(price)} (MRP ${fmtPrice(mrp)})\n`
        : `*Price:* ${fmtPrice(price)}\n`) +
      `*Image:* ${product.imageUrl}\n` +
      `*Product URL:* ${url}\n\n` +
      `Please contact customer for order confirmation.`
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    if (name.trim().length < 2) return toast.error('Please enter your full name')
    if (!/^[0-9+\-\s]{10,15}$/.test(mobile)) return toast.error('Please enter a valid mobile number')
    if (address.trim().length < 10) return toast.error('Address must be at least 10 characters')
    setLoading(true)
    try {
      await apiFetch('/inquiries', {
        method: 'POST',
        body: JSON.stringify({ name, mobile, address, productId: product.id }),
      })
      const message = buildMessage()
      const encoded = encodeURIComponent(message)
      const webUrl = `https://web.whatsapp.com/send?phone=${WA_NUMBER}&text=${encoded}`
      const appUrl = `whatsapp://send?phone=${WA_NUMBER}&text=${encoded}`
      const waUrl = `https://wa.me/${WA_NUMBER}?text=${encoded}`
      setWaReady({ webUrl, appUrl, waUrl, message })
      toast.success('Order saved! Choose how to send your WhatsApp message.')
    } catch (err) {
      toast.error(err.message || 'Failed to submit')
    } finally { setLoading(false) }
  }

  const copyMessage = async () => {
    try { await navigator.clipboard.writeText(waReady.message); toast.success('Message copied!') }
    catch { toast.error('Could not copy — please select manually.') }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" /> Place Order via WhatsApp
          </DialogTitle>
          <DialogDescription>
            {waReady ? 'Your order is saved. Choose how to open WhatsApp:' : "Fill in your details — we'll handle the rest."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 p-3 bg-rose-50 rounded-lg border border-rose-100">
          <img src={product.imageUrl} alt="" className="h-16 w-16 rounded-md object-cover" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm line-clamp-1">{product.name}</div>
            <div className="text-xs text-muted-foreground line-clamp-1">{product.description}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-lg font-bold text-rose-700">{fmtPrice(effectivePrice(product))}</div>
              {product.discountedPrice && product.discountedPrice < product.actualPrice && (
                <div className="text-xs text-muted-foreground line-through">{fmtPrice(product.actualPrice)}</div>
              )}
            </div>
          </div>
        </div>

        {!waReady ? (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required maxLength={80} />
            </div>
            <div>
              <Label htmlFor="mobile">Mobile Number *</Label>
              <Input id="mobile" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="9876543210" required inputMode="tel" maxLength={15} />
            </div>
            <div>
              <Label htmlFor="addr">Delivery Address *</Label>
              <Textarea id="addr" value={address} onChange={e => setAddress(e.target.value)} placeholder="House no., street, city, state, pincode" rows={3} required maxLength={500} />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                {loading ? 'Saving...' : 'Continue'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border bg-emerald-50 p-3 text-xs text-emerald-900 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
              {waReady.message}
            </div>
            <div className="grid gap-2">
              <a href={waReady.webUrl} target="_blank" rel="noopener noreferrer">
                <Button type="button" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  <MessageCircle className="mr-2 h-4 w-4" /> Open WhatsApp Web (Desktop)
                </Button>
              </a>
              <a href={waReady.appUrl}>
                <Button type="button" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
                  <MessageCircle className="mr-2 h-4 w-4" /> Open WhatsApp App (Mobile)
                </Button>
              </a>
              <Button type="button" variant="outline" onClick={copyMessage} className="w-full">
                📋 Copy Message (Always Works)
              </Button>
            </div>
            <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-900">
              If WhatsApp doesn't open, copy the message and send manually to <strong>+91 {WA_NUMBER.slice(2)}</strong>.
            </div>
            <Button type="button" variant="ghost" onClick={onClose} className="w-full">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------- About Us ----------------
function AboutSection() {
  return (
    <section id="about" className="bg-gradient-to-br from-rose-50/40 to-amber-50/30 py-16">
      <div className="container grid md:grid-cols-2 gap-10 items-center">
        <div>
          <img
            src="https://images.pexels.com/photos/34735228/pexels-photo-34735228.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
            alt="Artisan crafting"
            className="rounded-2xl shadow-xl w-full h-[420px] object-cover"
          />
        </div>
        <div>
          <Badge className="mb-3 bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200">About Us</Badge>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
            Crafted with Love,<br />Designed for Your Smile.
          </h2>
          <div className="mt-5 space-y-4 text-slate-700 text-[15px] leading-relaxed">
            <p>
              At <strong>{STORE}</strong>, our journey began with a simple yet passionate vision: to blend the
              timeless beauty of natural aesthetics with premium, high-quality craftsmanship. We believe that
              jewelry is not just an accessory, but a reflection of your unique grace. That is why every single
              piece in our collection is meticulously <strong>handmade</strong>, infusing pure love, dedication,
              and precision into every design.
            </p>
            <p>
              For us, success isn't just measured by the premium quality or the durability of our bangles — it
              is defined by the moment you wear them. Our ultimate reward is seeing the genuine smile and the
              radiant, charming glow that lights up your face the moment you adorn a {STORE} creation. We don't
              just manufacture; we craft <strong>experiences that celebrate you</strong>.
            </p>
            <p className="text-rose-700 italic font-medium">
              Welcome to {STORE} — where exceptional handmade quality meets a luxury that feels natural.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------- Contact Us ----------------
function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    if (form.name.length < 2) return toast.error('Name too short')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error('Invalid email')
    if (form.message.length < 5) return toast.error('Message too short')
    setLoading(true)
    try {
      await apiFetch('/contact-messages', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Message sent! We\'ll get back to you soon.')
      setForm({ name: '', email: '', phone: '', message: '' })
    } catch (err) { toast.error(err.message) } finally { setLoading(false) }
  }
  return (
    <section id="contact" className="py-16 bg-white">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <Badge className="mb-3 bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200">Contact Us</Badge>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Let's Connect</h2>
          <p className="mt-3 text-slate-600">
            Questions about a piece? Custom orders? Drop us a message — or reach us directly via WhatsApp, phone, or email.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Card className="border-rose-100">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-11 w-11 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center"><MessageCircle className="h-5 w-5" /></div>
                <div>
                  <div className="font-semibold">WhatsApp</div>
                  <div className="text-sm text-muted-foreground">Quick replies, order help</div>
                  <a
                    href={`https://web.whatsapp.com/send?phone=${WA_NUMBER}&text=${encodeURIComponent('Hi ' + STORE + ', I have a question about your products.')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-emerald-700 font-medium text-sm hover:underline"
                  >+91 {WA_NUMBER.slice(2)}</a>
                </div>
              </CardContent>
            </Card>
            <Card className="border-rose-100">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-11 w-11 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center"><Mail className="h-5 w-5" /></div>
                <div>
                  <div className="font-semibold">Email</div>
                  <div className="text-sm text-muted-foreground">For inquiries & bulk orders</div>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-rose-700 font-medium text-sm hover:underline">{CONTACT_EMAIL}</a>
                </div>
              </CardContent>
            </Card>
            <Card className="border-rose-100">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-11 w-11 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center"><Phone className="h-5 w-5" /></div>
                <div>
                  <div className="font-semibold">Phone</div>
                  <div className="text-sm text-muted-foreground">Call us during business hours</div>
                  <a href={`tel:+${WA_NUMBER}`} className="text-amber-700 font-medium text-sm hover:underline">+91 {WA_NUMBER.slice(2)}</a>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="border-rose-100 shadow-md">
            <CardHeader>
              <CardTitle>Send us a message</CardTitle>
              <CardDescription>We'll reply within 24 hours.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={set('name')} maxLength={80} required /></div>
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={set('email')} maxLength={120} required /></div>
                </div>
                <div><Label>Phone (optional)</Label><Input value={form.phone} onChange={set('phone')} maxLength={15} /></div>
                <div><Label>Message</Label><Textarea rows={4} value={form.message} onChange={set('message')} maxLength={1000} required /></div>
                <Button type="submit" disabled={loading} className="w-full bg-rose-600 hover:bg-rose-700">
                  <Mailbox className="h-4 w-4 mr-1" /> {loading ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

// ---------------- Share Dialog (Power Link) ----------------
function ShareDialog({ product, open, onClose }) {
  const [hasNativeShare, setHasNativeShare] = useState(false)
  useEffect(() => {
    setHasNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])
  if (!product) return null
  const url = productUrl(product.slug)
  const text = `✨ Check out *${product.name}* at ${STORE} — ${TAGLINE}\n${fmtPrice(effectivePrice(product))}\n${url}`

  const copyToClipboard = async (content) => {
    try {
      await navigator.clipboard.writeText(content)
      return true
    } catch {
      // fallback for older browsers / iframes
      const ta = document.createElement('textarea')
      ta.value = content; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy'); document.body.removeChild(ta); return true }
      catch { document.body.removeChild(ta); return false }
    }
  }

  const copyLink = async () => {
    const ok = await copyToClipboard(url)
    ok ? toast.success('Link copied! Paste it anywhere — WhatsApp, Insta, anywhere.') : toast.error('Could not copy.')
  }
  const copyFullMessage = async () => {
    const ok = await copyToClipboard(text)
    ok ? toast.success('Full message copied!') : toast.error('Could not copy.')
  }

  const nativeShare = async () => {
    try { await navigator.share({ title: `${product.name} — ${STORE}`, text, url }) }
    catch (e) { if (e?.name !== 'AbortError') toast.error('Share cancelled') }
  }

  // Auto-copy + open platform — handles iframe blocking gracefully
  const openWithCopy = async (label, openUrl, copyContent = text) => {
    await copyToClipboard(copyContent)
    // Open in new tab; if blocked, user already has link in clipboard
    try {
      const w = window.open(openUrl, '_blank', 'noopener,noreferrer')
      if (!w) {
        toast.info(`📋 Link copied! Open ${label} manually and paste it.`, { duration: 5000 })
      } else {
        toast.success(`📋 Link copied + opening ${label}. If blocked, just paste the link.`, { duration: 4000 })
      }
    } catch {
      toast.info(`📋 Link copied! Open ${label} manually and paste it.`, { duration: 5000 })
    }
  }

  const shareWA = `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`
  const shareTG = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Check out ' + product.name + ' at ' + STORE)}`
  const shareFB = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
  const shareEmail = `mailto:?subject=${encodeURIComponent(product.name + ' at ' + STORE)}&body=${encodeURIComponent(text)}`
  const shareSMS = `sms:?body=${encodeURIComponent(text)}`
  const shareInsta = `https://www.instagram.com/`

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="h-5 w-5 text-rose-600" /> Share this product</DialogTitle>
          <DialogDescription>Share the unique link anywhere — link auto-copies when you tap a platform.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 p-3 bg-rose-50 rounded-lg border border-rose-100">
          <img src={product.imageUrl} alt="" className="h-14 w-14 rounded-md object-cover" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm line-clamp-1">{product.name}</div>
            <div className="text-lg font-bold text-rose-700">{fmtPrice(effectivePrice(product))}</div>
          </div>
        </div>

        {/* PRIMARY ACTION: Always-works Copy Link */}
        <Button
          onClick={copyLink}
          size="lg"
          className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white"
        >
          📋 Copy Link (Works Everywhere)
        </Button>

        <div className="rounded-md bg-slate-50 p-2 text-[11px] break-all border font-mono text-slate-700">{url}</div>

        {hasNativeShare && (
          <Button onClick={nativeShare} variant="outline" className="w-full border-rose-300 text-rose-700 hover:bg-rose-50">
            <Share2 className="h-4 w-4 mr-2" /> Open Native Share Sheet (Mobile)
          </Button>
        )}

        <Button onClick={copyFullMessage} variant="outline" className="w-full">📝 Copy Full Message (with name, price & link)</Button>

        <div>
          <div className="text-xs font-semibold text-slate-700 mb-2 mt-2">Or tap a platform (link auto-copies):</div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => openWithCopy('WhatsApp', shareWA)} className="flex flex-col items-center p-3 rounded-md border hover:bg-emerald-50 hover:border-emerald-300 transition">
              <span className="text-2xl">💬</span><span className="text-[10px] font-medium mt-1">WhatsApp</span>
            </button>
            <button onClick={() => openWithCopy('Instagram', shareInsta)} className="flex flex-col items-center p-3 rounded-md border hover:bg-pink-50 hover:border-pink-300 transition">
              <span className="text-2xl">📸</span><span className="text-[10px] font-medium mt-1">Instagram</span>
            </button>
            <button onClick={() => openWithCopy('SMS', shareSMS)} className="flex flex-col items-center p-3 rounded-md border hover:bg-blue-50 hover:border-blue-300 transition">
              <span className="text-2xl">💬</span><span className="text-[10px] font-medium mt-1">SMS</span>
            </button>
            <button onClick={() => openWithCopy('Telegram', shareTG)} className="flex flex-col items-center p-3 rounded-md border hover:bg-sky-50 hover:border-sky-300 transition">
              <span className="text-2xl">✈️</span><span className="text-[10px] font-medium mt-1">Telegram</span>
            </button>
            <button onClick={() => openWithCopy('Facebook', shareFB)} className="flex flex-col items-center p-3 rounded-md border hover:bg-indigo-50 hover:border-indigo-300 transition">
              <span className="text-2xl">👍</span><span className="text-[10px] font-medium mt-1">Facebook</span>
            </button>
            <button onClick={() => openWithCopy('Email', shareEmail)} className="flex flex-col items-center p-3 rounded-md border hover:bg-amber-50 hover:border-amber-300 transition">
              <span className="text-2xl">✉️</span><span className="text-[10px] font-medium mt-1">Email</span>
            </button>
          </div>
        </div>

        <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-900">
          💡 <strong>Preview tip:</strong> If a platform window gets blocked, the link is already in your clipboard —
          just open WhatsApp/Instagram/etc. manually and paste it. On your real website, all buttons open directly.
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Storefront ----------------
function Storefront({ onOrder, onView, onShare }) {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch(`/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&page=${page}&limit=12`)
      setItems(data.items); setPages(data.pages); setCategories(data.categories || [])
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }, [q, category, page])

  useEffect(() => { load() }, [load])

  return (
    <>
      <Hero />
      <section id="catalog" className="container py-12">
        <div className="flex flex-col md:flex-row gap-3 mb-6 items-stretch md:items-center justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Our Collection</h2>
            <p className="text-sm text-muted-foreground">Discover handpicked handmade pieces from talented artisans.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 w-64"
                placeholder="Search products..."
                value={q}
                onChange={(e) => { setPage(1); setQ(e.target.value) }}
              />
            </div>
            <Select value={category} onValueChange={(v) => { setPage(1); setCategory(v) }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (<div key={i} className="h-80 rounded-lg bg-rose-50 animate-pulse" />))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
            No products found.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map(p => <ProductCard key={p.id} p={p} onOrder={onOrder} onView={onView} onShare={onShare} />)}
          </div>
        )}

        {pages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm">Page {page} of {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        )}
      </section>

      <AboutSection />
      <ContactSection />

      <footer className="border-t bg-gradient-to-br from-slate-50 to-rose-50/40 mt-4">
        <div className="container py-10 grid md:grid-cols-3 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 text-white"><Gem className="h-4 w-4" /></div>
              <div className="font-bold text-base">{STORE}</div>
            </div>
            <p className="text-muted-foreground italic">{TAGLINE}</p>
          </div>
          <div>
            <div className="font-semibold mb-2">Contact</div>
            <div className="space-y-1 text-muted-foreground">
              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> +91 {WA_NUMBER.slice(2)}</div>
              <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {CONTACT_EMAIL}</div>
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">Quality & Security</div>
            <p className="text-muted-foreground">Premium handcrafted • OWASP-compliant • JWT • Bcrypt • Rate limited • Audit logged • HSTS</p>
          </div>
        </div>
        <div className="border-t py-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} {STORE}. All rights reserved.</div>
      </footer>
    </>
  )
}

// ---------------- Admin Login ----------------
function AdminLogin({ onLoggedIn, goStore }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      localStorage.setItem('token', data.accessToken)
      localStorage.setItem('refresh', data.refreshToken)
      localStorage.setItem('user', JSON.stringify(data.user))
      toast.success('Welcome back, admin!')
      onLoggedIn(data.user)
    } catch (err) { toast.error(err.message || 'Login failed') } finally { setLoading(false) }
  }
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-rose-50 to-amber-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-rose-200">
        <CardHeader className="text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center mb-2"><Shield className="h-7 w-7" /></div>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>Secure access to {STORE} ERP dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></div>
            <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
            <Button type="submit" disabled={loading} className="w-full bg-rose-600 hover:bg-rose-700">{loading ? 'Signing in...' : 'Sign In'}</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={goStore}>Back to Storefront</Button>
          </form>
          <div className="mt-4 text-[11px] text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
            🔒 Only one admin session is allowed at a time. Logging in here will sign out any other active session.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------- Stat Card ----------------
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${color}`}><Icon className="h-6 w-6 text-white" /></div>
        <div><div className="text-2xl font-bold">{value ?? '—'}</div><div className="text-xs text-muted-foreground">{label}</div></div>
      </CardContent>
    </Card>
  )
}

// ---------------- Product Form ----------------
function ProductForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', description: '', actualPrice: '', discountedPrice: '', stock: '', category: '', imageUrl: '' })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imgMode, setImgMode] = useState(initial?.imageUrl?.startsWith('data:') ? 'upload' : 'url')
  const [generatedUrl, setGeneratedUrl] = useState(initial?.slug ? productUrl(initial.slug) : '')
  const fileInputRef = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await compressImage(file, 1200, 0.82)
      setForm(f => ({ ...f, imageUrl: dataUrl }))
      toast.success('Image ready! Click Save Product to publish.')
    } catch (err) { toast.error(err.message || 'Could not process image') }
    finally { setUploading(false); if (e.target) e.target.value = '' }
  }

  const submit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      let saved
      if (initial?.id) {
        saved = await apiFetch(`/products/${initial.id}`, { method: 'PUT', body: JSON.stringify(form) })
        toast.success('Product updated')
      } else {
        saved = await apiFetch('/products', { method: 'POST', body: JSON.stringify(form) })
        toast.success('Product created')
      }
      if (saved?.slug) setGeneratedUrl(productUrl(saved.slug))
      setTimeout(() => onSaved(saved), 800)
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const copyUrl = async () => { try { await navigator.clipboard.writeText(generatedUrl); toast.success('URL copied!') } catch {} }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Product Name *</Label><Input value={form.name} onChange={set('name')} maxLength={120} required /></div>
        <div className="col-span-2"><Label>Description *</Label><Textarea rows={3} value={form.description} onChange={set('description')} maxLength={1000} required /></div>
        <div><Label>Actual Price (MRP) ₹ *</Label><Input type="number" min="0" step="0.01" value={form.actualPrice} onChange={set('actualPrice')} required /></div>
        <div><Label>Discounted Price ₹</Label><Input type="number" min="0" step="0.01" value={form.discountedPrice} onChange={set('discountedPrice')} placeholder="(optional)" /></div>
        <div><Label>Stock</Label><Input type="number" min="0" value={form.stock} onChange={set('stock')} /></div>
        <div><Label>Category *</Label><Input value={form.category} onChange={set('category')} placeholder="Bangles" maxLength={50} required /></div>
      </div>

      {/* Image — Upload OR URL */}
      <div className="rounded-lg border p-3 bg-slate-50/50">
        <Label className="text-sm font-semibold">Product Image <span className="text-muted-foreground text-xs font-normal">(optional — placeholder used if blank)</span></Label>
        <div className="flex gap-1 mt-2 mb-3 bg-white rounded-md p-1 border w-fit">
          <button type="button" onClick={() => setImgMode('upload')} className={`px-3 py-1 text-xs rounded ${imgMode === 'upload' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>📷 Upload from Phone</button>
          <button type="button" onClick={() => setImgMode('url')} className={`px-3 py-1 text-xs rounded ${imgMode === 'url' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>🔗 Paste URL</button>
        </div>
        {imgMode === 'upload' ? (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              className="block w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-rose-600 file:text-white hover:file:bg-rose-700 file:cursor-pointer"
            />
            {uploading && <p className="text-xs text-amber-600">⏳ Processing image...</p>}
            <p className="text-[11px] text-muted-foreground">
              Tap to choose from gallery or take a photo. Auto-resized & optimized (max ~3 MB).
            </p>
          </div>
        ) : (
          <Input value={form.imageUrl?.startsWith('data:') ? '' : (form.imageUrl || '')} onChange={set('imageUrl')} placeholder="https://example.com/image.jpg" />
        )}
        {form.imageUrl && (
          <div className="mt-2 flex items-center gap-2">
            <img src={form.imageUrl} alt="" className="h-20 w-20 object-cover rounded border" />
            <div className="text-xs text-muted-foreground">
              {form.imageUrl.startsWith('data:') ? '✅ Uploaded' : '✅ URL set'}
              <button type="button" onClick={() => setForm(f => ({ ...f, imageUrl: '' }))} className="ml-2 text-red-600 hover:underline">Remove</button>
            </div>
          </div>
        )}
      </div>

      {generatedUrl && (
        <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 p-4 text-xs shadow-sm">
          <div className="font-bold text-emerald-900 mb-2 flex items-center gap-2 text-sm">
            <Share2 className="h-4 w-4" /> Unique Product URL Generated!
          </div>
          <div className="font-mono break-all text-emerald-900 bg-white p-2 rounded border border-emerald-200 mb-2">
            {generatedUrl}
          </div>
          <p className="text-emerald-700 mb-2">Share this link on Instagram, WhatsApp, Facebook, or anywhere — clicking it opens this product directly.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={copyUrl} className="h-8 text-xs border-emerald-300">📋 Copy Link</Button>
            <a href={`https://web.whatsapp.com/send?text=${encodeURIComponent('Check out this product at ' + STORE + ': ' + generatedUrl)}`} target="_blank" rel="noopener noreferrer">
              <Button type="button" size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"><MessageCircle className="h-3 w-3 mr-1" /> Share on WhatsApp</Button>
            </a>
            <a href={generatedUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs">🔗 Open Product Page</Button>
            </a>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving || uploading} className="bg-rose-600 hover:bg-rose-700">{saving ? 'Saving...' : 'Save Product'}</Button>
      </div>
    </form>
  )
}

// ---------------- Admin Dashboard ----------------
function AdminDashboard({ user }) {
  const [stats, setStats] = useState(null)
  const [products, setProducts] = useState([])
  const [inquiries, setInquiries] = useState([])
  const [contacts, setContacts] = useState([])
  const [logs, setLogs] = useState([])
  const [tab, setTab] = useState('overview')
  const [editProduct, setEditProduct] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      const [s, p, i, c, l] = await Promise.all([
        apiFetch('/dashboard/stats'),
        apiFetch('/products?admin=1&limit=50'),
        apiFetch('/inquiries'),
        apiFetch('/contact-messages'),
        apiFetch('/audit-logs'),
      ])
      setStats(s); setProducts(p.items); setInquiries(i.items); setContacts(c.items); setLogs(l.items)
    } catch (e) { /* handled globally */ }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const del = async (id) => {
    if (!confirm('Delete this product?')) return
    try { await apiFetch(`/products/${id}`, { method: 'DELETE' }); toast.success('Deleted'); loadAll() } catch (e) { toast.error(e.message) }
  }
  const toggle = async (id) => { try { await apiFetch(`/products/${id}/toggle`, { method: 'PATCH' }); loadAll() } catch (e) { toast.error(e.message) } }
  const setInqStatus = async (id, status) => { try { await apiFetch(`/inquiries/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); loadAll() } catch (e) { toast.error(e.message) } }
  const copyProductUrl = async (slug) => { try { await navigator.clipboard.writeText(productUrl(slug)); toast.success('URL copied!') } catch {} }

  return (
    <div className="container py-8">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{STORE} ERP Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back, {user?.email}</p>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{user?.role?.toUpperCase()} · SINGLE SESSION</Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Package} label="Total Products" value={stats?.totalProducts} color="bg-rose-600" />
            <StatCard icon={TrendingUp} label="Active Products" value={stats?.activeProducts} color="bg-emerald-600" />
            <StatCard icon={Users} label="Total Inquiries" value={stats?.totalInquiries} color="bg-indigo-600" />
            <StatCard icon={ClipboardList} label="New Inquiries" value={stats?.newInquiries} color="bg-amber-500" />
          </div>
          <Card>
            <CardHeader><CardTitle>Recent Inquiries</CardTitle></CardHeader>
            <CardContent>
              {stats?.recentInquiries?.length ? (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>Product</TableHead><TableHead>Status</TableHead><TableHead>When</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {stats.recentInquiries.map(i => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.customerName}</TableCell>
                        <TableCell>{i.mobile}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{i.productName}</TableCell>
                        <TableCell><Badge variant="outline">{i.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(i.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground">No recent inquiries.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Products by Category</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(stats?.productsByCategory || []).map(c => (
                  <Badge key={c.category} variant="secondary" className="text-sm py-1 px-3 bg-rose-50 text-rose-700">{c.category}: {c.count}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 className="text-xl font-semibold">Product Management</h2>
            <Button onClick={() => setShowCreate(true)} className="bg-rose-600 hover:bg-rose-700"><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-16">Image</TableHead>
                  <TableHead>Name & URL</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {products.map(p => (
                    <TableRow key={p.id}>
                      <TableCell><img src={p.imageUrl} alt="" className="h-10 w-10 rounded object-cover" /></TableCell>
                      <TableCell>
                        <div className="font-medium max-w-[220px] truncate">{p.name}</div>
                        <button onClick={() => copyProductUrl(p.slug)} className="text-[10px] text-emerald-700 hover:underline font-mono max-w-[260px] truncate flex items-center gap-1">
                          <Share2 className="h-3 w-3" /> /?p={p.slug}
                        </button>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                      <TableCell>
                        <div className="font-medium">{fmtPrice(effectivePrice(p))}</div>
                        {p.discountedPrice && p.discountedPrice < p.actualPrice && (
                          <div className="text-xs text-muted-foreground line-through">{fmtPrice(p.actualPrice)}</div>
                        )}
                      </TableCell>
                      <TableCell>{p.stock}</TableCell>
                      <TableCell><Switch checked={p.active} onCheckedChange={() => toggle(p.id)} /></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditProduct(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => del(p.id)} className="text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Product</DialogTitle><DialogDescription>A unique shareable URL will be auto-generated on save.</DialogDescription></DialogHeader>
              <ProductForm onSaved={() => { setShowCreate(false); loadAll() }} onCancel={() => setShowCreate(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={!!editProduct} onOpenChange={(v) => !v && setEditProduct(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
              {editProduct && <ProductForm initial={editProduct} onSaved={() => { setEditProduct(null); loadAll() }} onCancel={() => setEditProduct(null)} />}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="inquiries">
          <Card>
            <CardHeader><CardTitle>Customer Inquiries</CardTitle><CardDescription>Track and update order status</CardDescription></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>Product</TableHead><TableHead>Address</TableHead><TableHead>Status</TableHead><TableHead>When</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {inquiries.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.customerName}</TableCell>
                      <TableCell><a className="text-emerald-700 hover:underline" target="_blank" rel="noopener noreferrer" href={`https://web.whatsapp.com/send?phone=${i.mobile.replace(/\D/g, '')}`}>{i.mobile}</a></TableCell>
                      <TableCell className="max-w-[180px] truncate">{i.productName}<div className="text-xs text-muted-foreground">{fmtPrice(i.productDiscountedPrice || i.productActualPrice)}</div></TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs">{i.address}</TableCell>
                      <TableCell>
                        <Select value={i.status} onValueChange={(v) => setInqStatus(i.id, v)}>
                          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['new','contacted','confirmed','shipped','completed','cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(i.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {inquiries.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No inquiries yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader><CardTitle>Contact Messages</CardTitle><CardDescription>Public contact form submissions</CardDescription></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Message</TableHead><TableHead>When</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {contacts.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><a className="text-rose-700 hover:underline" href={`mailto:${c.email}`}>{c.email}</a></TableCell>
                      <TableCell>{c.phone || '—'}</TableCell>
                      <TableCell className="max-w-[360px] truncate text-xs">{c.message}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {contacts.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No messages yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader><CardTitle>Audit Logs</CardTitle><CardDescription>Security and admin action trail</CardDescription></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Action</TableHead><TableHead>Actor</TableHead><TableHead>Details</TableHead><TableHead>When</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {logs.map(l => (
                    <TableRow key={l.id}>
                      <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                      <TableCell className="text-xs">{l.actor}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate font-mono">{JSON.stringify(l.meta)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------- App Root ----------------
function App() {
  const [view, setView] = useState('store')
  const [user, setUser] = useState(null)
  const [orderProduct, setOrderProduct] = useState(null)
  const [viewProduct, setViewProduct] = useState(null)
  const [shareProduct, setShareProduct] = useState(null)

  // Restore session
  useEffect(() => {
    const u = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    if (u) try { setUser(JSON.parse(u)) } catch {}
  }, [])

  // Handle session invalidation event (another admin logged in elsewhere)
  useEffect(() => {
    const handler = (e) => {
      setUser(null); setView('store')
      toast.error(e?.detail?.reason || 'Session expired — another admin may have logged in.')
    }
    window.addEventListener('auth:invalidated', handler)
    return () => window.removeEventListener('auth:invalidated', handler)
  }, [])

  // Periodically verify session is still active
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      apiFetch('/auth/me').catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [user])

  // Deep-link: read ?p=slug from URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const slug = params.get('p')
    if (slug) {
      apiFetch(`/products/by-slug/${encodeURIComponent(slug)}`)
        .then(p => setViewProduct(p))
        .catch(() => toast.error('Product not found'))
    }
  }, [])

  const logout = async () => {
    try { await apiFetch('/auth/logout', { method: 'POST' }) } catch {}
    localStorage.removeItem('token'); localStorage.removeItem('refresh'); localStorage.removeItem('user')
    setUser(null); setView('store'); toast.success('Logged out')
  }

  const handleLoggedIn = (u) => { setUser(u); setView('admin') }

  return (
    <div className="min-h-screen bg-white">
      <Header view={view} setView={setView} authed={!!user} onLogout={logout} />
      {view === 'store' && (
        <Storefront
          onOrder={(p) => { setViewProduct(null); setOrderProduct(p) }}
          onView={(p) => setViewProduct(p)}
          onShare={(p) => setShareProduct(p)}
        />
      )}
      {view === 'login' && <AdminLogin onLoggedIn={handleLoggedIn} goStore={() => setView('store')} />}
      {view === 'admin' && (user ? <AdminDashboard user={user} /> : <AdminLogin onLoggedIn={handleLoggedIn} goStore={() => setView('store')} />)}
      <ProductDetailDialog
        product={viewProduct}
        open={!!viewProduct}
        onClose={() => setViewProduct(null)}
        onOrder={(p) => { setViewProduct(null); setOrderProduct(p) }}
        onShare={(p) => setShareProduct(p)}
      />
      <OrderModal product={orderProduct} open={!!orderProduct} onClose={() => setOrderProduct(null)} />
      <ShareDialog product={shareProduct} open={!!shareProduct} onClose={() => setShareProduct(null)} />
    </div>
  )
}

export default App
