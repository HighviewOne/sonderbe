import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../types.js'

export function adminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}
