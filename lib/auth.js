import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { getDb } from './db'

export function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' })
}
export function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' })
}
export function verifyAccess(token) {
  try { return jwt.verify(token, process.env.JWT_SECRET) } catch { return null }
}
export function verifyRefresh(token) {
  try { return jwt.verify(token, process.env.JWT_REFRESH_SECRET) } catch { return null }
}
export async function hashPassword(pw) {
  return bcrypt.hash(pw, 12)
}
export async function comparePassword(pw, hash) {
  return bcrypt.compare(pw, hash)
}
export function getAuth(request) {
  const h = request.headers.get('authorization') || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return null
  return verifyAccess(token)
}

// Single-session enforcement: verify JWT sid matches admin.sessionId in DB
export async function requireActiveAdmin(request) {
  const u = getAuth(request)
  if (!u || u.role !== 'admin' || !u.sid) return null
  const db = await getDb()
  const admin = await db.collection('admins').findOne({ id: u.sub })
  if (!admin || admin.sessionId !== u.sid) return null
  return u
}
