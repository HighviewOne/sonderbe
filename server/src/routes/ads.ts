import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'
import { COUNTIES } from '../matching.js'
import { UUID_RE } from '../cases.js'

// Service ads (movers, storage, ...) on the homeowner "Moving forward" page.
// Advertisers pay a flat per-county fee; they never receive homeowner data — we only
// count views and clicks. Order is shuffled on every load so no advertiser is favored.
const router = Router()

const AD_FIELDS = 'id, business_name, category, headline, description, phone, website, license_label, license_number, starts_on, ends_on'

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// GET /api/services/report/:token — the advertiser's private report (no login; the link is the key)
router.get('/report/:token', asyncHandler(async (req, res) => {
  const token = String(req.params.token)
  if (token.length < 20 || token.length > 60) {
    res.status(404).json({ error: 'Report not found' })
    return
  }
  const { data, error } = await supabaseAdmin.from('service_ads')
    .select('business_name, category, headline, counties, active, starts_on, ends_on, view_count, click_count, created_at')
    .eq('report_token', token).maybeSingle()
  if (error || !data) {
    res.status(404).json({ error: 'Report not found' })
    return
  }
  res.json(data)
}))

// GET /api/services?county=Los Angeles
router.get('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const county = typeof req.query.county === 'string' ? req.query.county : ''
  if (!COUNTIES.includes(county)) {
    res.status(400).json({ error: 'Please choose a supported county' })
    return
  }
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabaseAdmin
    .from('service_ads')
    .select(AD_FIELDS)
    .eq('active', true)
    .contains('counties', [county])
  if (error) {
    console.error('Failed to fetch ads:', error)
    res.status(500).json({ error: 'Failed to load services' })
    return
  }

  const ads = data
    .filter(ad => (!ad.starts_on || ad.starts_on <= today) && (!ad.ends_on || ad.ends_on >= today))
    .map(ad => {
      const out: Partial<typeof ad> = { ...ad }
      delete out.starts_on
      delete out.ends_on
      return out as Omit<typeof ad, 'starts_on' | 'ends_on'>
    })

  // View counts are best-effort; a failure never blocks the page
  Promise.all(ads.map(ad => supabaseAdmin.rpc('increment_ad_counter', { ad_id: ad.id, counter: 'view' })))
    .catch(err => console.error('Failed to count ad views:', err))

  res.json({ ads: shuffle(ads) })
}))

// POST /api/services/:id/click — counted when a homeowner taps call / website
router.post('/:id/click', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid ad id' })
    return
  }
  const { error } = await supabaseAdmin.rpc('increment_ad_counter', { ad_id: id, counter: 'click' })
  if (error) console.error('Failed to count ad click:', error)
  res.json({ ok: true })
}))

export default router
