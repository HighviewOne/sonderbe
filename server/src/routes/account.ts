import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth, invalidateRoleCache } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'
import { accessFor } from '../access.js'

const router = Router()
router.use(requireAuth)

const LIVE_PROJECT_REF = 'gfeeiyjhjapysiqxwiqi'

// Demo/test environments only: lets test accounts skip Stripe. Never on the live project,
// whatever DEMO_MODE says.
export function demoMode() {
  return process.env.DEMO_MODE === 'true' && !(process.env.SUPABASE_URL ?? '').includes(LIVE_PROJECT_REF)
}

// GET /api/account/access — the signed-in professional's subscription state for the portal
router.get('/access', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const access = (await accessFor([req.userId!]))?.get(req.userId!)
  if (!access) {
    res.status(500).json({ error: 'Failed to check your subscription' })
    return
  }
  let brokerage_name: string | null = null
  if (access.via === 'brokerage') {
    const { data } = await supabaseAdmin.from('profiles').select('brokerage_id').eq('id', req.userId!).single()
    if (data?.brokerage_id) {
      const { data: b } = await supabaseAdmin.from('brokerages').select('name').eq('id', data.brokerage_id).single()
      brokerage_name = b?.name ?? null
    }
  }
  res.json({ ...access, brokerage_name, demo_mode: demoMode() })
}))

// POST /api/account/demo-subscription — test environment only: activate without paying
router.post('/demo-subscription', asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!demoMode()) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  if (req.userRole === 'admin') {
    res.status(400).json({ error: 'Admin accounts do not need a subscription' })
    return
  }
  const now = new Date()
  const { error } = await supabaseAdmin.from('investor_subscriptions').upsert({
    user_id: req.userId!,
    stripe_customer_id: `cus_demo_${req.userId!.slice(0, 8)}`,
    status: 'active',
    past_due_since: null,
    ended_at: null,
    current_period_start: now.toISOString(),
    current_period_end: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
    plan_id: 'demo'
  }, { onConflict: 'user_id' })
  if (error) {
    console.error('Failed to activate demo subscription:', error)
    res.status(500).json({ error: 'Failed to activate' })
    return
  }
  const { error: roleError } = await supabaseAdmin.from('profiles').update({ role: 'investor' }).eq('id', req.userId!)
  if (roleError) {
    console.error('Failed to set professional role:', roleError)
    res.status(500).json({ error: 'Failed to activate' })
    return
  }
  invalidateRoleCache(req.userId!)
  res.json({ ok: true })
}))

export default router
