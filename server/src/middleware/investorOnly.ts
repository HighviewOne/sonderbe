import type { Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../types.js'
import { accessFor, canWork } from '../access.js'
import { closeCasesOfEnded } from '../cases.js'

// Subscribed professionals (role 'investor'). Access comes from their own subscription or
// their broker's (see access.ts):
// - active / grace: everything
// - read_only: GET only, so they can wrap up with clients but not change anything
// - ended / none: no access (the frontend sends them to the renew page)
export async function investorOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'investor') {
    res.status(403).json({ error: 'Professional access required', code: 'not_professional' })
    return
  }

  try {
    const access = (await accessFor([req.userId!]))?.get(req.userId!)
    if (!access) {
      res.status(500).json({ error: 'Failed to verify subscription' })
      return
    }
    if (canWork(access)) {
      next()
      return
    }
    if (access.state === 'read_only') {
      if (req.method === 'GET') {
        next()
        return
      }
      res.status(402).json({
        error: 'Your subscription has ended, so your account is read-only. Renew to make changes.',
        code: 'read_only'
      })
      return
    }
    // Access is over: close their cases now rather than waiting for each homeowner to visit
    await closeCasesOfEnded([req.userId!])
    res.status(403).json({ error: 'Active subscription required', code: 'subscription_required' })
  } catch (err) {
    console.error('Investor check error:', err)
    res.status(500).json({ error: 'Failed to verify subscription' })
  }
}
