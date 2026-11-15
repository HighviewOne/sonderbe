import type { Response, NextFunction } from 'express'
import { professionalsWithAccess } from '../access.js'
import type { AuthenticatedRequest } from '../types.js'

export async function investorOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'investor') {
    res.status(403).json({ error: 'Investor access required' })
    return
  }

  try {
    // Own subscription, or a brokerage whose broker pays for the team
    const allowed = await professionalsWithAccess([req.userId!])
    if (allowed === null) {
      res.status(500).json({ error: 'Failed to verify subscription' })
      return
    }
    if (!allowed.has(req.userId!)) {
      res.status(403).json({ error: 'Active subscription required' })
      return
    }

    next()
  } catch (err) {
    console.error('Investor check error:', err)
    res.status(500).json({ error: 'Failed to verify subscription' })
  }
}
