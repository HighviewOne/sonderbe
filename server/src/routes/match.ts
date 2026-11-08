import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'
import { COUNTIES, SITUATIONS, CONSENT_TEXT } from '../matching.js'

const router = Router()

// GET /api/match — own match request (or null), the consent wording, and the
// matched professional's contact details once a professional has claimed it
router.get('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data: request, error } = await supabaseAdmin
    .from('match_requests')
    .select('id, county, situation, contact_name, contact_phone, best_time, status, claimed_by, claimed_at, created_at')
    .eq('homeowner_id', req.userId!)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch match request:', error)
    res.status(500).json({ error: 'Failed to fetch match request' })
    return
  }

  let professional = null
  if (request?.status === 'claimed' && request.claimed_by) {
    const { data: pro, error: proError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email, phone')
      .eq('id', request.claimed_by)
      .maybeSingle()
    if (proError) console.error('Failed to fetch matched professional:', proError)
    professional = pro
  }

  let publicRequest = null
  if (request) {
    // claimed_by is an internal profile id; the homeowner gets `professional` instead
    publicRequest = { ...request } as Partial<typeof request>
    delete publicRequest.claimed_by
  }
  res.json({
    request: publicRequest,
    professional,
    consent_text: CONSENT_TEXT
  })
}))

// POST /api/match — create or reopen own match request
router.post('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'client') {
    res.status(403).json({ error: 'Only homeowner accounts can request a match' })
    return
  }

  const { county, situation, contact_name, contact_phone, best_time, consent } = req.body ?? {}

  if (consent !== true) {
    res.status(400).json({ error: 'You must agree to be contacted to request a match' })
    return
  }
  if (typeof county !== 'string' || !COUNTIES.includes(county)) {
    res.status(400).json({ error: 'Please choose a supported county' })
    return
  }
  if (typeof situation !== 'string' || !SITUATIONS.includes(situation)) {
    res.status(400).json({ error: 'Please choose your situation' })
    return
  }
  if (typeof contact_name !== 'string' || !contact_name.trim() || contact_name.length > 100) {
    res.status(400).json({ error: 'Please enter your name (100 characters max)' })
    return
  }
  if (contact_phone !== undefined && contact_phone !== null && contact_phone !== '' &&
      (typeof contact_phone !== 'string' || contact_phone.replace(/\D/g, '').length < 10 || contact_phone.length > 30)) {
    res.status(400).json({ error: 'Please enter a valid phone number, or leave it blank' })
    return
  }
  if (best_time !== undefined && best_time !== null && (typeof best_time !== 'string' || best_time.length > 200)) {
    res.status(400).json({ error: 'Best time to reach you must be 200 characters or fewer' })
    return
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', req.userId!)
    .single()
  if (profileError || !profile) {
    console.error('Failed to fetch profile for match request:', profileError)
    res.status(500).json({ error: 'Failed to create match request' })
    return
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('match_requests')
    .select('status')
    .eq('homeowner_id', req.userId!)
    .maybeSingle()
  if (existingError) {
    console.error('Failed to check existing match request:', existingError)
    res.status(500).json({ error: 'Failed to create match request' })
    return
  }
  if (existing?.status === 'claimed') {
    res.status(409).json({ error: 'You are already matched with a professional. Withdraw first to request someone new.' })
    return
  }

  const row = {
    homeowner_id: req.userId!,
    county,
    situation,
    contact_name: contact_name.trim(),
    contact_email: profile.email,
    contact_phone: contact_phone ? contact_phone.trim() : null,
    best_time: best_time ? best_time.trim() : null,
    consent_text: CONSENT_TEXT,
    consented_at: new Date().toISOString(),
    status: 'open',
    claimed_by: null,
    claimed_at: null
  }

  // The status filter on the update keeps a claim that lands between the check
  // above and this write from being silently overwritten
  const query = existing
    ? supabaseAdmin.from('match_requests').update(row).eq('homeowner_id', req.userId!).neq('status', 'claimed')
    : supabaseAdmin.from('match_requests').insert(row)
  const { data, error } = await query.select('id, county, situation, status, created_at').maybeSingle()

  if (error) {
    console.error('Failed to save match request:', error)
    res.status(500).json({ error: 'Failed to create match request' })
    return
  }
  if (!data) {
    res.status(409).json({ error: 'You were just matched with a professional. Refresh to see their details.' })
    return
  }
  res.status(existing ? 200 : 201).json(data)
}))

// DELETE /api/match — withdraw own request (stops contact; hides details from the professional)
router.delete('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('match_requests')
    .update({ status: 'withdrawn' })
    .eq('homeowner_id', req.userId!)
    .in('status', ['open', 'claimed'])
    .select('id, status')
    .maybeSingle()

  if (error) {
    console.error('Failed to withdraw match request:', error)
    res.status(500).json({ error: 'Failed to withdraw request' })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'No active request to withdraw' })
    return
  }
  res.json(data)
}))

export default router
