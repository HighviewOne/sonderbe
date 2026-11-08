import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { investorOnly } from '../middleware/investorOnly.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'
import { COUNTIES, MAX_ACTIVE_CLAIMS } from '../matching.js'

// Professional-facing matching routes. "investor" is the DB role for any subscribed
// professional; investorOnly checks the role and an active subscription.
const router = Router()
router.use(requireAuth, investorOnly)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function getServiceCounties(userId: string): Promise<string[] | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('service_counties')
    .eq('id', userId)
    .single()
  if (error) {
    console.error('Failed to fetch service counties:', error)
    return null
  }
  return data?.service_counties ?? []
}

type CheckedRow = { user_id: string; category_index: number; item_index: number }

async function getCheckedItems(homeownerIds: string[]): Promise<CheckedRow[] | null> {
  if (homeownerIds.length === 0) return []
  const { data, error } = await supabaseAdmin
    .from('checklist_progress')
    .select('user_id, category_index, item_index')
    .in('user_id', homeownerIds)
    .eq('is_checked', true)
  if (error) {
    console.error('Failed to fetch checklist progress for leads:', error)
    return null
  }
  return data
}

// GET /api/leads — open requests in my counties (summary only) + requests I've claimed (full detail)
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const counties = await getServiceCounties(req.userId!)
  if (counties === null) {
    res.status(500).json({ error: 'Failed to load leads' })
    return
  }

  const openQuery = counties.length > 0
    ? supabaseAdmin
        .from('match_requests')
        .select('id, homeowner_id, county, situation, contact_name, created_at')
        .eq('status', 'open')
        .in('county', counties)
        .order('created_at', { ascending: false })
        .limit(100)
    : null

  const mineQuery = supabaseAdmin
    .from('match_requests')
    .select('id, homeowner_id, county, situation, contact_name, contact_email, contact_phone, best_time, status, claimed_at, created_at')
    .eq('claimed_by', req.userId!)
    .in('status', ['claimed', 'closed', 'withdrawn'])
    .order('claimed_at', { ascending: false })
    .limit(100)

  const [openResult, mineResult] = await Promise.all([openQuery, mineQuery])
  if (openResult?.error || mineResult.error) {
    console.error('Failed to fetch leads:', openResult?.error || mineResult.error)
    res.status(500).json({ error: 'Failed to load leads' })
    return
  }

  const openRows = openResult?.data ?? []
  const mineRows = mineResult.data ?? []
  const checked = await getCheckedItems([...openRows, ...mineRows].map(r => r.homeowner_id))
  if (checked === null) {
    res.status(500).json({ error: 'Failed to load leads' })
    return
  }

  // Open leads get per-category counts only: item-level detail (e.g. "divorce decree",
  // "death certificate") reveals the hardship and is shown only after a claim
  const open = openRows.map(({ homeowner_id, contact_name, ...rest }) => {
    const counts: Record<number, number> = {}
    for (const c of checked) {
      if (c.user_id === homeowner_id) counts[c.category_index] = (counts[c.category_index] ?? 0) + 1
    }
    return { ...rest, first_name: contact_name.split(/\s+/)[0], category_counts: counts }
  })

  // A withdrawn homeowner has revoked consent — drop their contact details
  const mine = mineRows.map(({ homeowner_id, ...rest }) => {
    if (rest.status === 'withdrawn') {
      return { ...rest, contact_email: null, contact_phone: null, best_time: null, checked_items: [] }
    }
    return {
      ...rest,
      checked_items: checked
        .filter(c => c.user_id === homeowner_id)
        .map(c => [c.category_index, c.item_index])
    }
  })

  res.json({ service_counties: counties, open, mine })
}))

// PUT /api/leads/service-area — set the counties I serve
router.put('/service-area', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { counties } = req.body ?? {}
  if (!Array.isArray(counties) || counties.some(c => typeof c !== 'string' || !COUNTIES.includes(c))) {
    res.status(400).json({ error: 'counties must be a list of supported counties' })
    return
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ service_counties: [...new Set(counties)] })
    .eq('id', req.userId!)

  if (error) {
    console.error('Failed to update service area:', error)
    res.status(500).json({ error: 'Failed to update service area' })
    return
  }
  res.json({ service_counties: [...new Set(counties)] })
}))

// POST /api/leads/:id/claim — take an open request in one of my counties
router.post('/:id/claim', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid lead id' })
    return
  }

  const counties = await getServiceCounties(req.userId!)
  if (counties === null) {
    res.status(500).json({ error: 'Failed to claim lead' })
    return
  }
  if (counties.length === 0) {
    res.status(400).json({ error: 'Set your service area first' })
    return
  }

  const { count, error: countError } = await supabaseAdmin
    .from('match_requests')
    .select('id', { count: 'exact', head: true })
    .eq('claimed_by', req.userId!)
    .eq('status', 'claimed')
  if (countError) {
    console.error('Failed to count active claims:', countError)
    res.status(500).json({ error: 'Failed to claim lead' })
    return
  }
  if ((count ?? 0) >= MAX_ACTIVE_CLAIMS) {
    res.status(409).json({ error: `You can hold up to ${MAX_ACTIVE_CLAIMS} active leads. Close or release one first.` })
    return
  }

  // Conditional update = atomic claim: only one professional can win an open request
  const { data, error } = await supabaseAdmin
    .from('match_requests')
    .update({ status: 'claimed', claimed_by: req.userId!, claimed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open')
    .in('county', counties)
    .select('id, status')
    .maybeSingle()

  if (error) {
    console.error('Failed to claim lead:', error)
    res.status(500).json({ error: 'Failed to claim lead' })
    return
  }
  if (!data) {
    res.status(409).json({ error: 'This lead is no longer available' })
    return
  }
  res.json(data)
}))

// POST /api/leads/:id/release — give a claimed request back to the open pool
// POST /api/leads/:id/close   — mark my claimed request as finished
for (const [action, nextStatus] of [['release', 'open'], ['close', 'closed']] as const) {
  router.post(`/:id/${action}`, asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id)
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: 'Invalid lead id' })
      return
    }

    const update = nextStatus === 'open'
      ? { status: 'open', claimed_by: null, claimed_at: null }
      : { status: 'closed' }

    const { data, error } = await supabaseAdmin
      .from('match_requests')
      .update(update)
      .eq('id', id)
      .eq('claimed_by', req.userId!)
      .eq('status', 'claimed')
      .select('id, status')
      .maybeSingle()

    if (error) {
      console.error(`Failed to ${action} lead:`, error)
      res.status(500).json({ error: `Failed to ${action} lead` })
      return
    }
    if (!data) {
      res.status(404).json({ error: 'No active claim on this lead' })
      return
    }
    res.json(data)
  }))
}

export default router
