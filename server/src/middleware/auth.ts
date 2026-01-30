import type { Response, NextFunction } from 'express'
import { supabaseAdmin } from '../config.js'
import type { AuthenticatedRequest } from '../types.js'

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

    // Fetch profile to get role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    req.userId = user.id
    req.userRole = profile?.role ?? 'client'
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
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      req.userRole = profile?.role ?? 'client'
    }
  } catch {
    // Auth is optional — ignore errors
  }

  next()
}
