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
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    next()
    return
  }

  const token = authHeader.slice(7)

  supabaseAdmin.auth.getUser(token).then(({ data: { user } }) => {
    if (user) {
      req.userId = user.id
      // Fetch role
      supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data: profile }) => {
          req.userRole = profile?.role ?? 'client'
          next()
        })
    } else {
      next()
    }
  }).catch(() => {
    next()
  })
}
