import type { Response, NextFunction } from 'express'
import { supabaseAdmin } from '../config.js'
import type { AuthenticatedRequest } from '../types.js'

type Role = 'client' | 'admin' | 'investor'
interface CacheEntry { role: Role; expiresAt: number }
const roleCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30_000

function getCachedRole(userId: string): Role | undefined {
  const entry = roleCache.get(userId)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) { roleCache.delete(userId); return undefined }
  return entry.role
}

function setCachedRole(userId: string, role: Role) {
  roleCache.set(userId, { role, expiresAt: Date.now() + CACHE_TTL_MS })
}

// Call after changing profiles.role so the new role takes effect immediately
export function invalidateRoleCache(userId: string) {
  roleCache.delete(userId)
}

async function resolveRole(userId: string): Promise<Role> {
  const cached = getCachedRole(userId)
  if (cached) return cached

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  // Don't cache on lookup failure — a transient error shouldn't pin the user to 'client'
  if (error || !profile) return 'client'

  const role = profile.role as Role
  setCachedRole(userId, role)
  return role
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' })
    return
  }

  const token = authHeader.slice(7)

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    req.userId = user.id
    req.userRole = await resolveRole(user.id)
    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    res.status(401).json({ error: 'Authentication failed' })
  }
}

export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    next()
    return
  }

  const token = authHeader.slice(7)

  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (user) {
      req.userId = user.id
      req.userRole = await resolveRole(user.id)
    }
  } catch {
    // Auth is optional — ignore errors
  }

  next()
}
