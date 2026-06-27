# UN Mart — Enterprise E-Commerce

> **Handmade art with a touch of heart.**

A production-grade Next.js 15 + MongoDB e-commerce storefront for handmade jewelry with WhatsApp-based ordering, ERP admin panel, and ironclad security.

## ✨ Features

### Public Storefront
- Modern, mobile-first responsive UI (Tailwind + shadcn/ui)
- Curated product catalog with **search, category filters, pagination**
- **Dual pricing**: actual MRP + discounted price + "X% OFF" badge
- **Auto-generated unique shareable product URLs** (slug-based)
- Click any product → instant detail dialog with full info + share buttons
- **WhatsApp click-to-chat** ordering — no signup, no friction
- Share product link on Instagram, WhatsApp, Facebook, or anywhere
- About Us and Contact Us sections with functional contact form

### Admin Panel (ERP-grade)
- **Single-session enforcement** — only ONE admin can be logged in at any time. New login automatically invalidates the previous session.
- **JWT auth** (access 2h + refresh 7d) with **bcrypt** password hashing (cost 12)
- Dashboard: product/inquiry/contact statistics, category breakdown, recent orders
- Product management: full CRUD, activate/deactivate toggle, auto-generated unique URLs (slug)
- Inquiry management with status workflow (new → contacted → confirmed → shipped → completed → cancelled)
- Contact message inbox (from public contact form)
- **Immutable audit log** of every admin action and security event

### Security (OWASP-aligned)
- ✅ JWT access + refresh tokens, rotated session IDs
- ✅ Bcrypt password hashing
- ✅ Role-based access control (RBAC)
- ✅ Per-IP+route rate limiting (login 5/min, inquiry/contact 10/min, default 120/min)
- ✅ Input sanitization (HTML stripping) + strict validation
- ✅ Security headers: HSTS, X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Permissions-Policy, Referrer-Policy
- ✅ Audit logging on every sensitive action
- ✅ Mongo $regex escaping (no NoSQL injection)
- ✅ Single-session enforcement (no two simultaneous admins)

### Performance
- MongoDB indexes auto-created on first request (products.id, slug, category, active+createdAt, name text; inquiries.createdAt; audit_logs.createdAt; admins.email/id)
- HTTP `Cache-Control` on public product listings
- Connection pooling (single shared MongoClient)
- In-memory rate limiter with periodic eviction

## 🏗️ Tech Stack
- **Frontend**: Next.js 15 (App Router), React 18, Tailwind CSS, shadcn/ui, lucide-react, sonner
- **Backend**: Next.js API routes (catch-all `[[...path]]`)
- **Database**: MongoDB (with UUIDs, no ObjectIDs in payloads)
- **Auth**: jsonwebtoken + bcryptjs
- **State**: React hooks + localStorage for admin token

## 📁 Project Structure

```
/app
├── app/
│   ├── api/[[...path]]/route.js   # All backend APIs (catch-all router)
│   ├── layout.js                  # Root layout + Toaster
│   ├── page.js                    # Single-page app: storefront, admin login, admin dashboard
│   └── globals.css                # Tailwind base
├── components/ui/                 # shadcn components
├── lib/
│   ├── auth.js                    # JWT + bcrypt helpers + single-session enforcement
│   └── db.js                      # MongoDB singleton
├── .env.example                   # Copy to .env and fill in
├── .gitignore
├── package.json
└── README.md
```

## 🚀 Local Setup

```bash
# 1) Install deps
yarn install

# 2) Copy env template & fill in real values
cp .env.example .env
# Edit .env: MONGO_URL, JWT_SECRET, JWT_REFRESH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, NEXT_PUBLIC_WHATSAPP_NUMBER, NEXT_PUBLIC_BASE_URL

# 3) Run MongoDB locally (or use Atlas — update MONGO_URL)

# 4) Start dev server
yarn dev

# 5) Seed admin + sample products (one-time)
curl -X POST http://localhost:3000/api/init

# 6) Visit
open http://localhost:3000
```

## 🔑 Default Admin (seeded from .env on first request)
- Email: value of `ADMIN_EMAIL`
- Password: value of `ADMIN_PASSWORD` (stored bcrypt-hashed, never plain)

Click **ADMIN** at the top-right of the storefront to log in.

## 📜 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/init` | — | Seed admin + sample products |
| GET | `/api/health` | — | Health check |
| POST | `/api/auth/login` | — | Admin login (returns access + refresh JWTs, rotates session) |
| POST | `/api/auth/refresh` | — | Refresh access token (only if session is still active) |
| GET | `/api/auth/me` | Bearer | Get current admin |
| POST | `/api/auth/logout` | Bearer | Logout (nulls session ID) |
| GET | `/api/products` | — | Public product list with `q`, `category`, `page`, `limit` |
| GET | `/api/products/by-slug/:slug` | — | Public product lookup by shareable slug |
| GET | `/api/products/:id` | — | Get single product |
| POST | `/api/products` | Admin | Create product (auto-generates slug) |
| PUT | `/api/products/:id` | Admin | Update product (regenerates slug if name changed) |
| PATCH | `/api/products/:id/toggle` | Admin | Activate/deactivate |
| DELETE | `/api/products/:id` | Admin | Delete product |
| POST | `/api/inquiries` | — | Submit WhatsApp order inquiry (validates + snapshots product) |
| GET | `/api/inquiries` | Admin | List all inquiries |
| PATCH | `/api/inquiries/:id` | Admin | Update inquiry status |
| POST | `/api/contact-messages` | — | Public contact form |
| GET | `/api/contact-messages` | Admin | List all messages |
| GET | `/api/dashboard/stats` | Admin | Dashboard counts + recent activity |
| GET | `/api/audit-logs` | Admin | Last 100 audit events |

## 🛒 WhatsApp Order Flow

1. Customer clicks "WhatsApp" on a product card or detail page.
2. Modal opens with product summary; customer enters Name, Mobile, Address.
3. On submit:
   - Inquiry is saved to DB with product snapshot (name, prices, image, slug).
   - Modal shows the pre-formatted WhatsApp message including the **unique product URL**.
   - Customer chooses: **Open WhatsApp Web**, **Open WhatsApp App**, or **Copy Message**.
4. The store owner receives a structured message with all order details + a clickable product link.

## 🔐 Single-Session Enforcement (How It Works)

1. On every successful login, the server generates a new random `sessionId` and stores it on the admin document.
2. The JWT access + refresh tokens carry this `sid` claim.
3. Every admin-only API call calls `requireActiveAdmin()` which:
   - Verifies the JWT signature.
   - Looks up the admin in MongoDB.
   - Returns 401 unless `JWT.sid === admin.sessionId`.
4. **Effect**: when a new login happens, the sessionId rotates and all previously-issued tokens become invalid instantly.
5. The frontend polls `/api/auth/me` every 30s, so an admin elsewhere will be auto-logged-out within 30 seconds with a notification.

## 🧪 Testing

Backend has been comprehensively tested: **37/37 endpoint tests passed**, including the critical single-session enforcement (6 sub-tests) and dual-pricing validation (5 sub-tests).

## 📜 License

Proprietary. © UN Mart.
