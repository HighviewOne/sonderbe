import type { Response, NextFunction } from 'express'
import { supabaseAdmin } from '../config.js'
import type { AuthenticatedRequest } from '../types.js'

export async function investorOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'investor') {
    res.status(403).json({ error: 'Investor access required' })
    return
  }

  // Check for active subscription
  const { data: subscription } = await supabaseAdmin
    .from('investor_subscriptions')
    .select('status')
    .eq('user_id', req.userId!)
    .single()

  if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trialing')) {
    res.status(403).json({ error: 'Active subscription required' })
    return
  }

  next()
}
