import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { investorOnly } from '../middleware/investorOnly.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'
import {
  COUNTIES, MAX_ACTIVE_CLAIMS, STAGES, OUTCOMES, PROFESSIONAL_TYPES, LICENSED_TYPES, STANDARD_DOCUMENTS
} from '../matching.js'
import { caseDetails, addCaseEvent } from '../cases.js'

// Professional-facing matching routes. "investor" is the DB role for any subscribed
// professional; investorOnly checks the role and an active subscription.
const router = Router()
router.use(requireAuth, investorOnly)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_DOCUMENTS_PER_CASE = 40

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
    .select('id, homeowner_id, county, situation, contact_name, contact_email, contact_phone, best_time, status, claimed_at, created_at, stage, next_step, outcome, stage_updated_at')
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

  const details = await caseDetails(mineRows.filter(r => r.status === 'claimed'))
  if (details === null) {
    res.status(500).json({ error: 'Failed to load leads' })
    return
  }

  // A withdrawn homeowner has revoked consent — drop their contact details
  const mine = mineRows.map(({ homeowner_id, ...rest }) => {
    if (rest.status === 'withdrawn') {
      return { ...rest, contact_email: null, contact_phone: null, best_time: null, checked_items: [], events: [], documents: [] }
    }
    return {
      ...rest,
      checked_items: checked
        .filter(c => c.user_id === homeowner_id)
        .map(c => [c.category_index, c.item_index]),
      events: details.get(rest.id)?.events ?? [],
      documents: details.get(rest.id)?.documents ?? []
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

// ---------------------------------------------------------------------------
// My directory listing
// ---------------------------------------------------------------------------
const LISTING_FIELDS = 'full_name, phone, business_name, professional_type, bio, website, license_number, license_verified, no_upfront_fee_pledged_at, listed, service_counties'

// GET /api/leads/profile — my listing as homeowners see it (plus pledge / listed flags)
router.get('/profile', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin.from('profiles').select(LISTING_FIELDS).eq('id', req.userId!).single()
  if (error) {
    console.error('Failed to fetch listing:', error)
    res.status(500).json({ error: 'Failed to load your listing' })
    return
  }
  res.json(data)
}))

const optionalText = (v: unknown, max: number) =>
  v === undefined || v === null || (typeof v === 'string' && v.length <= max)

// PUT /api/leads/profile — edit my listing. Changing the license number clears verification.
router.put('/profile', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { business_name, professional_type, bio, website, license_number, pledge, listed } = req.body ?? {}

  if (typeof professional_type !== 'string' || !(PROFESSIONAL_TYPES as readonly string[]).includes(professional_type)) {
    res.status(400).json({ error: 'Please choose what kind of professional you are' })
    return
  }
  if (typeof business_name !== 'string' || !business_name.trim() || business_name.length > 120) {
    res.status(400).json({ error: 'Please enter your business name (120 characters max)' })
    return
  }
  if (!optionalText(bio, 600)) {
    res.status(400).json({ error: 'Your description must be 600 characters or fewer' })
    return
  }
  if (!optionalText(website, 200) || (website && !/^https?:\/\/\S+$/i.test(website))) {
    res.status(400).json({ error: 'Website must start with http:// or https://' })
    return
  }
  if (!optionalText(license_number, 40)) {
    res.status(400).json({ error: 'License number must be 40 characters or fewer' })
    return
  }
  const licensed = (LICENSED_TYPES as readonly string[]).includes(professional_type)
  if (licensed && !license_number?.trim()) {
    res.status(400).json({ error: 'Please enter your license number (DRE for agents and brokers, State Bar for attorneys)' })
    return
  }
  if (typeof listed !== 'boolean' || typeof pledge !== 'boolean') {
    res.status(400).json({ error: 'listed and pledge must be true or false' })
    return
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('profiles').select('license_number, professional_type, no_upfront_fee_pledged_at').eq('id', req.userId!).single()
  if (currentError || !current) {
    console.error('Failed to fetch listing for update:', currentError)
    res.status(500).json({ error: 'Failed to save your listing' })
    return
  }
  if (listed && !pledge) {
    res.status(400).json({ error: 'You must agree to the no-upfront-fee pledge to be listed' })
    return
  }

  const newLicense = license_number?.trim() || null
  const update: Record<string, unknown> = {
    business_name: business_name.trim(),
    professional_type,
    bio: bio?.trim() || null,
    website: website?.trim() || null,
    license_number: newLicense,
    listed,
    no_upfront_fee_pledged_at: pledge ? (current.no_upfront_fee_pledged_at ?? new Date().toISOString()) : null
  }
  // Verification is for a specific number and type; an admin re-checks after a change
  if (newLicense !== current.license_number || professional_type !== current.professional_type) {
    update.license_verified = false
  }

  const { data, error } = await supabaseAdmin.from('profiles').update(update).eq('id', req.userId!).select(LISTING_FIELDS).single()
  if (error) {
    console.error('Failed to save listing:', error)
    res.status(500).json({ error: 'Failed to save your listing' })
    return
  }
  res.json(data)
}))

// ---------------------------------------------------------------------------
// Case tracker: stage, next step, document checklist (my active cases only)
// ---------------------------------------------------------------------------
async function ownActiveCase(id: string, userId: string): Promise<'ok' | 'missing' | 'error'> {
  const { data, error } = await supabaseAdmin
    .from('match_requests').select('id').eq('id', id).eq('claimed_by', userId).eq('status', 'claimed').maybeSingle()
  if (error) {
    console.error('Failed to check case ownership:', error)
    return 'error'
  }
  return data ? 'ok' : 'missing'
}

async function guardCase(req: AuthenticatedRequest, res: import('express').Response): Promise<string | null> {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid case id' })
    return null
  }
  const owned = await ownActiveCase(id, req.userId!)
  if (owned !== 'ok') {
    res.status(owned === 'error' ? 500 : 404).json({ error: owned === 'error' ? 'Failed to load case' : 'No active case with this id' })
    return null
  }
  return id
}

// POST /api/leads/:id/stage — { stage, next_step?, note?, outcome? }
router.post('/:id/stage', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { stage, next_step, note, outcome } = req.body ?? {}
  if (typeof stage !== 'string' || !(STAGES as readonly string[]).includes(stage)) {
    res.status(400).json({ error: 'Unknown stage' })
    return
  }
  if (!optionalText(next_step, 300) || !optionalText(note, 500)) {
    res.status(400).json({ error: 'Next step must be 300 characters or fewer and the note 500 or fewer' })
    return
  }
  if (stage === 'outcome' && (typeof outcome !== 'string' || !(OUTCOMES as readonly string[]).includes(outcome))) {
    res.status(400).json({ error: 'Please choose the outcome' })
    return
  }
  const id = await guardCase(req, res)
  if (!id) return

  const { data, error } = await supabaseAdmin
    .from('match_requests')
    .update({
      stage,
      next_step: next_step?.trim() || null,
      outcome: stage === 'outcome' ? outcome : null,
      stage_updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('id, stage, next_step, outcome, stage_updated_at')
    .single()
  if (error) {
    console.error('Failed to update stage:', error)
    res.status(500).json({ error: 'Failed to update the case' })
    return
  }
  await addCaseEvent(id, stage, note?.trim() || null, req.userId!)
  res.json(data)
}))

// POST /api/leads/:id/documents — { label } adds one item, { standard: true } adds the usual short-sale set
router.post('/:id/documents', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { label, standard } = req.body ?? {}
  const labels: string[] = standard === true
    ? STANDARD_DOCUMENTS
    : typeof label === 'string' && label.trim() && label.length <= 200 ? [label.trim()] : []
  if (labels.length === 0) {
    res.status(400).json({ error: 'Please enter the document name (200 characters max)' })
    return
  }
  const id = await guardCase(req, res)
  if (!id) return

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('case_documents').select('label, sort_order').eq('match_request_id', id)
  if (existingError) {
    console.error('Failed to read documents:', existingError)
    res.status(500).json({ error: 'Failed to add document' })
    return
  }
  const have = new Set(existing.map(d => d.label.toLowerCase()))
  const toAdd = labels.filter(l => !have.has(l.toLowerCase()))
  if (existing.length + toAdd.length > MAX_DOCUMENTS_PER_CASE) {
    res.status(400).json({ error: `A case can have up to ${MAX_DOCUMENTS_PER_CASE} documents` })
    return
  }
  if (toAdd.length === 0) {
    res.status(409).json({ error: 'Already on the list' })
    return
  }
  let order = existing.reduce((m, d) => Math.max(m, d.sort_order), -1)
  const { data, error } = await supabaseAdmin
    .from('case_documents')
    .insert(toAdd.map(l => ({ match_request_id: id, label: l, sort_order: ++order })))
    .select('id, label, sort_order, homeowner_note, sent_at, received_at')
  if (error) {
    console.error('Failed to add documents:', error)
    res.status(500).json({ error: 'Failed to add document' })
    return
  }
  res.status(201).json(data)
}))

// PATCH /api/leads/:id/documents/:docId — { received: boolean }
router.patch('/:id/documents/:docId', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const docId = String(req.params.docId)
  const { received } = req.body ?? {}
  if (!UUID_RE.test(docId) || typeof received !== 'boolean') {
    res.status(400).json({ error: 'Invalid document update' })
    return
  }
  const id = await guardCase(req, res)
  if (!id) return

  const { data, error } = await supabaseAdmin
    .from('case_documents')
    .update({ received_at: received ? new Date().toISOString() : null })
    .eq('id', docId)
    .eq('match_request_id', id)
    .select('id, label, sort_order, homeowner_note, sent_at, received_at')
    .maybeSingle()
  if (error) {
    console.error('Failed to update document:', error)
    res.status(500).json({ error: 'Failed to update document' })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Document not found' })
    return
  }
  res.json(data)
}))

// DELETE /api/leads/:id/documents/:docId
router.delete('/:id/documents/:docId', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const docId = String(req.params.docId)
  if (!UUID_RE.test(docId)) {
    res.status(400).json({ error: 'Invalid document id' })
    return
  }
  const id = await guardCase(req, res)
  if (!id) return

  const { data, error } = await supabaseAdmin
    .from('case_documents').delete().eq('id', docId).eq('match_request_id', id).select('id').maybeSingle()
  if (error) {
    console.error('Failed to delete document:', error)
    res.status(500).json({ error: 'Failed to remove document' })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Document not found' })
    return
  }
  res.json({ ok: true })
}))

export default router
