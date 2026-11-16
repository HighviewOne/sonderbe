import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { investorOnly } from '../middleware/investorOnly.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'
import {
  COUNTIES, MAX_ACTIVE_CLAIMS, STAGES, OUTCOMES, PROFESSIONAL_TYPES, LICENSED_TYPES, STANDARD_DOCUMENTS,
  DIRECT_CONTACT_ONLY_TYPES, CATEGORY_OF
} from '../matching.js'
import type { ProfessionalType } from '../matching.js'
import {
  caseDetails, addCaseEvent, homeownerDetails, UUID_RE, MY_INFORMATION_CONSENT_MARKER, DOC_FIELDS, presentDocument, addDocHistory
} from '../cases.js'
import { documentsForHousehold, guessDocType, loadHousehold, DEFAULT_REFRESH_DAYS } from '../household.js'
import type { DocType } from '../household.js'
import multer from 'multer'
import { uploadProfileImage, removeProfileImage } from '../images.js'

// Professional-facing matching routes. "investor" is the DB role for any subscribed
// professional; investorOnly checks the role and an active subscription.
const router = Router()
router.use(requireAuth, investorOnly)

const MAX_DOCUMENTS_PER_CASE = 40

// Which open requests (legacy pool) this professional may see and take: their counties, and only
// requests in their own category. Attorneys are direct-contact only (SonderBe never sends them
// homeowner details), so category is null for them. Professionals from before types existed
// (type not set) count as real estate.
async function getClaimScope(userId: string): Promise<{ counties: string[]; category: 'real_estate' | 'legal' | null } | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('service_counties, professional_type')
    .eq('id', userId)
    .single()
  if (error) {
    console.error('Failed to fetch service counties:', error)
    return null
  }
  const type = data?.professional_type as ProfessionalType | null
  const category = type && DIRECT_CONTACT_ONLY_TYPES.includes(type) ? null : type ? CATEGORY_OF[type] : 'real_estate'
  return { counties: data?.service_counties ?? [], category }
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
  const scope = await getClaimScope(req.userId!)
  if (scope === null) {
    res.status(500).json({ error: 'Failed to load leads' })
    return
  }
  const { counties, category } = scope

  const openQuery = counties.length > 0 && category
    ? supabaseAdmin
        .from('match_requests')
        .select('id, homeowner_id, county, situation, contact_name, created_at')
        .eq('status', 'open')
        .eq('category', category)
        .in('county', counties)
        .order('created_at', { ascending: false })
        .limit(100)
    : null

  const mineQuery = supabaseAdmin
    .from('match_requests')
    .select('id, homeowner_id, category, county, situation, contact_name, contact_email, contact_phone, best_time, status, claimed_at, created_at, stage, next_step, outcome, stage_updated_at, consent_text, professional_notes_read_at')
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

  const claimedRows = mineRows.filter(r => r.status === 'claimed')
  const sharingRows = claimedRows.filter(r => r.consent_text.includes(MY_INFORMATION_CONSENT_MARKER))
  const [details, homeowners] = await Promise.all([
    caseDetails(claimedRows),
    homeownerDetails(sharingRows.map(r => r.homeowner_id))
  ])
  if (details === null || homeowners === null) {
    res.status(500).json({ error: 'Failed to load leads' })
    return
  }

  // A withdrawn homeowner has revoked consent — drop their contact details
  const mine = mineRows.map(({ homeowner_id, consent_text, professional_notes_read_at, ...rest }) => {
    if (rest.status === 'withdrawn') {
      return { ...rest, contact_email: null, contact_phone: null, best_time: null, checked_items: [], events: [], documents: [], notes: [], unread_notes: 0, homeowner: null }
    }
    const notes = details.get(rest.id)?.notes ?? []
    const shares = rest.status === 'claimed' && consent_text.includes(MY_INFORMATION_CONSENT_MARKER)
    return {
      ...rest,
      checked_items: checked
        .filter(c => c.user_id === homeowner_id)
        .map(c => [c.category_index, c.item_index]),
      events: details.get(rest.id)?.events ?? [],
      documents: details.get(rest.id)?.documents ?? [],
      notes,
      unread_notes: notes.filter(n => n.author_role === 'homeowner' && (!professional_notes_read_at || n.created_at > professional_notes_read_at)).length,
      homeowner: shares ? homeowners.get(homeowner_id) ?? null : null
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

  const scope = await getClaimScope(req.userId!)
  if (scope === null) {
    res.status(500).json({ error: 'Failed to claim lead' })
    return
  }
  const { counties, category: myCategory } = scope
  if (!myCategory) {
    res.status(403).json({ error: 'Homeowners contact attorneys directly, so attorneys cannot take requests here.' })
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
    res.status(409).json({ error: `You can hold up to ${MAX_ACTIVE_CLAIMS} active leads. Close one first.` })
    return
  }

  // Conditional update = atomic claim: only one professional can win an open request
  const { data, error } = await supabaseAdmin
    .from('match_requests')
    .update({ status: 'claimed', claimed_by: req.userId!, claimed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open')
    .eq('category', myCategory)
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

// POST /api/leads/:id/close — mark my claimed request as finished.
// There is deliberately no "release": the homeowner consented to share with the one professional
// they chose, so a case is never handed back to an open pool for someone else to pick up.
router.post('/:id/close', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid lead id' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('match_requests')
    .update({ status: 'closed' })
    .eq('id', id)
    .eq('claimed_by', req.userId!)
    .eq('status', 'claimed')
    .select('id, status')
    .maybeSingle()

  if (error) {
    console.error('Failed to close lead:', error)
    res.status(500).json({ error: 'Failed to close lead' })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'No active claim on this lead' })
    return
  }
  res.json(data)
}))

// ---------------------------------------------------------------------------
// My directory listing
// ---------------------------------------------------------------------------
const LISTING_FIELDS = 'full_name, phone, business_name, professional_type, bio, website, license_number, license_verified, no_upfront_fee_pledged_at, listed, service_counties, avatar_url, brokerage_id'

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
  // Homeowners chose this professional as a particular kind (e.g. real estate, not legal help).
  // Switching category mid-case would change what they agreed to share with, so finish those cases
  // first. Same-category changes (agent → broker) and setting a first type are fine.
  const currentType = current.professional_type as ProfessionalType | null
  if (currentType && CATEGORY_OF[professional_type as ProfessionalType] !== CATEGORY_OF[currentType]) {
    const { count, error: countError } = await supabaseAdmin.from('match_requests')
      .select('id', { count: 'exact', head: true }).eq('claimed_by', req.userId!).eq('status', 'claimed')
    if (countError) {
      console.error('Failed to count active cases:', countError)
      res.status(500).json({ error: 'Failed to save your listing' })
      return
    }
    if ((count ?? 0) > 0) {
      res.status(409).json({
        error: `You have ${count} active client${count === 1 ? '' : 's'}. Close those cases before changing what kind of professional you are.`,
        code: 'type_locked'
      })
      return
    }
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

const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } })

// POST /api/leads/avatar — profile picture (multipart "file": PNG, JPEG or WebP, 2 MB max)
router.post('/avatar', imageUpload.single('file'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data: before } = await supabaseAdmin.from('profiles').select('avatar_url').eq('id', req.userId!).single()
  const url = await uploadProfileImage(req, res, `${req.userId}/avatar`)
  if (!url) return
  const { error } = await supabaseAdmin.from('profiles').update({ avatar_url: url }).eq('id', req.userId!)
  if (error) {
    console.error('Failed to save avatar url:', error)
    await removeProfileImage(url, `${req.userId}/`)
    res.status(500).json({ error: 'Failed to save your photo' })
    return
  }
  // The replaced photo is public: delete it so the old link stops working
  await removeProfileImage(before?.avatar_url, `${req.userId}/`)
  res.json({ avatar_url: url })
}))

// DELETE /api/leads/avatar
router.delete('/avatar', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data: before } = await supabaseAdmin.from('profiles').select('avatar_url').eq('id', req.userId!).single()
  const { error } = await supabaseAdmin.from('profiles').update({ avatar_url: null }).eq('id', req.userId!)
  if (error) {
    console.error('Failed to remove avatar:', error)
    res.status(500).json({ error: 'Failed to remove your photo' })
    return
  }
  // Removing a photo for privacy has to delete the public file, not just the link
  await removeProfileImage(before?.avatar_url, `${req.userId}/`)
  res.json({ avatar_url: null })
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

// POST /api/leads/:id/documents — { label } adds one item, { standard: true } adds the usual
// short-sale set, { fromHousehold: true } builds the list from the homeowner's household
router.post('/:id/documents', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { label, standard, fromHousehold } = req.body ?? {}
  const id = await guardCase(req, res)
  if (!id) return

  let wanted: { label: string; doc_type: DocType; household_member_id: string | null }[] = []
  if (fromHousehold === true) {
    const { data: request } = await supabaseAdmin.from('match_requests').select('homeowner_id, contact_name, consent_text').eq('id', id).single()
    if (!request?.consent_text.includes(MY_INFORMATION_CONSENT_MARKER)) {
      res.status(400).json({ error: "This homeowner hasn't shared their household with you" })
      return
    }
    const household = await loadHousehold(request.homeowner_id, request.contact_name)
    if (household === null) {
      res.status(500).json({ error: 'Failed to add documents' })
      return
    }
    // Labels say "Your ..." for the homeowner; the professional's list should name them
    const first = request.contact_name.split(/\s+/)[0]
    wanted = documentsForHousehold(household).map(d => ({ ...d, label: d.label.replace(/^Your /, `${first}'s `) }))
  } else if (standard === true) {
    wanted = STANDARD_DOCUMENTS.map(l => ({ label: l, doc_type: guessDocType(l), household_member_id: null }))
  } else if (typeof label === 'string' && label.trim() && label.length <= 200) {
    wanted = [{ label: label.trim(), doc_type: guessDocType(label), household_member_id: null }]
  }
  if (wanted.length === 0) {
    res.status(400).json({ error: 'Please enter the document name (200 characters max)' })
    return
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('case_documents').select('label, sort_order').eq('match_request_id', id)
  if (existingError) {
    console.error('Failed to read documents:', existingError)
    res.status(500).json({ error: 'Failed to add document' })
    return
  }
  const have = new Set(existing.map(d => d.label.toLowerCase()))
  const toAdd = wanted.filter(d => !have.has(d.label.toLowerCase()))
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
    .insert(toAdd.map(d => ({ match_request_id: id, ...d, sort_order: ++order, refresh_days: DEFAULT_REFRESH_DAYS[d.doc_type] })))
    .select(DOC_FIELDS)
  if (error) {
    console.error('Failed to add documents:', error)
    res.status(500).json({ error: 'Failed to add document' })
    return
  }
  await Promise.all(data.map(d => addDocHistory(d.id, id, 1, 'requested', req.userId!)))
  res.status(201).json(data.map(presentDocument))
}))

// PATCH /api/leads/:id/documents/:docId — { received?: boolean, refresh_days?: number|null, due_date?: string|null }
router.patch('/:id/documents/:docId', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const docId = String(req.params.docId)
  const { received, refresh_days, due_date } = req.body ?? {}
  const update: Record<string, unknown> = {}
  if (received !== undefined) {
    if (typeof received !== 'boolean') {
      res.status(400).json({ error: 'received must be true or false' })
      return
    }
    update.received_at = received ? new Date().toISOString() : null
  }
  if (refresh_days !== undefined) {
    if (refresh_days !== null && (!Number.isInteger(refresh_days) || refresh_days < 1 || refresh_days > 730)) {
      res.status(400).json({ error: 'Refresh period must be 1 to 730 days, or none' })
      return
    }
    update.refresh_days = refresh_days
  }
  if (due_date !== undefined) {
    if (due_date !== null && (typeof due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(due_date))) {
      res.status(400).json({ error: 'Due date must be a date' })
      return
    }
    update.due_date = due_date
  }
  if (!UUID_RE.test(docId) || Object.keys(update).length === 0) {
    res.status(400).json({ error: 'Invalid document update' })
    return
  }
  const id = await guardCase(req, res)
  if (!id) return

  const { data, error } = await supabaseAdmin
    .from('case_documents')
    .update(update)
    .eq('id', docId)
    .eq('match_request_id', id)
    .select(DOC_FIELDS)
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
  if (received !== undefined) await addDocHistory(docId, id, data.round, received ? 'received' : 'unreceived', req.userId!)
  res.json(presentDocument(data))
}))

// Start a new round: the homeowner sends a fresh or corrected copy. The last received date is kept.
async function requestAgain(caseId: string, docIds: string[], reason: string | null, actorId: string) {
  const { data: docs, error } = await supabaseAdmin.from('case_documents')
    .select('id, round, received_at, last_received_at').eq('match_request_id', caseId).in('id', docIds)
  if (error) {
    console.error('Failed to load documents to request again:', error)
    return null
  }
  // One conditional update per document (each guarded by its own round), all at once
  const results = await Promise.all(docs.map(d => supabaseAdmin.from('case_documents').update({
    round: d.round + 1,
    sent_at: null,
    received_at: null,
    homeowner_note: null,
    request_reason: reason,
    last_received_at: d.received_at ?? d.last_received_at
  }).eq('id', d.id).eq('round', d.round).select(DOC_FIELDS).maybeSingle()))
  const failed = results.find(r => r.error)
  if (failed) {
    console.error('Failed to request document again:', failed.error)
    return null
  }
  const rows = results.map(r => r.data).filter((d): d is NonNullable<typeof d> => Boolean(d))
  if (rows.length) {
    const { error: historyError } = await supabaseAdmin.from('case_document_history').insert(rows.map(d => ({
      document_id: d.id, match_request_id: caseId, round: d.round, action: 'requested_again', actor_id: actorId, reason
    })))
    if (historyError) console.error('Failed to record document history:', historyError)
  }
  const updated = rows.map(presentDocument)
  return updated
}

// POST /api/leads/:id/documents/:docId/request-again — { reason } fresh copy or a fix
router.post('/:id/documents/:docId/request-again', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const docId = String(req.params.docId)
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
  if (!UUID_RE.test(docId)) {
    res.status(400).json({ error: 'Invalid document id' })
    return
  }
  if (!reason || reason.length > 300) {
    res.status(400).json({ error: "Tell your client what you need (300 characters max), e.g. \"This month's statement\"" })
    return
  }
  const id = await guardCase(req, res)
  if (!id) return
  const updated = await requestAgain(id, [docId], reason, req.userId!)
  if (updated === null) {
    res.status(500).json({ error: 'Failed to request the document again' })
    return
  }
  if (updated.length === 0) {
    res.status(404).json({ error: 'Document not found' })
    return
  }
  res.json(updated[0])
}))

// POST /api/leads/:id/documents/request-updates — new round for every document that is due for an update
router.post('/:id/documents/request-updates', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = await guardCase(req, res)
  if (!id) return
  const { data, error } = await supabaseAdmin.from('case_documents').select(DOC_FIELDS).eq('match_request_id', id)
  if (error) {
    console.error('Failed to load documents for updates:', error)
    res.status(500).json({ error: 'Failed to request updates' })
    return
  }
  const stale = data.map(presentDocument).filter(d => d.stale)
  if (stale.length === 0) {
    res.status(409).json({ error: 'Nothing is due for an update' })
    return
  }
  const updated = await requestAgain(id, stale.map(d => d.id), 'Please send an updated copy. The last one is too old for the lender.', req.userId!)
  if (updated === null) {
    res.status(500).json({ error: 'Failed to request updates' })
    return
  }
  res.json(updated)
}))

// GET /api/leads/:id/documents/:docId/history
router.get('/:id/documents/:docId/history', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const docId = String(req.params.docId)
  if (!UUID_RE.test(docId)) {
    res.status(400).json({ error: 'Invalid document id' })
    return
  }
  const id = await guardCase(req, res)
  if (!id) return
  const { data, error } = await supabaseAdmin.from('case_document_history')
    .select('id, round, action, reason, created_at, actor_id').eq('document_id', docId).eq('match_request_id', id).order('created_at')
  if (error) {
    console.error('Failed to load document history:', error)
    res.status(500).json({ error: 'Failed to load history' })
    return
  }
  res.json({ history: data.map(({ actor_id, ...h }) => ({ ...h, by_me: actor_id === req.userId })) })
}))

// POST /api/leads/:id/notes — { body, document_id? }
router.post('/:id/notes', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
  const documentId = req.body?.document_id ?? null
  if (!body || body.length > 2000) {
    res.status(400).json({ error: 'Write a note (2000 characters max)' })
    return
  }
  if (documentId !== null && (typeof documentId !== 'string' || !UUID_RE.test(documentId))) {
    res.status(400).json({ error: 'Invalid document' })
    return
  }
  const id = await guardCase(req, res)
  if (!id) return
  if (documentId) {
    const { data: doc } = await supabaseAdmin.from('case_documents').select('id').eq('id', documentId).eq('match_request_id', id).maybeSingle()
    if (!doc) {
      res.status(404).json({ error: 'Document not found' })
      return
    }
  }
  const { data, error } = await supabaseAdmin.from('case_notes')
    .insert({ match_request_id: id, document_id: documentId, author_id: req.userId!, author_role: 'professional', body })
    .select('id, document_id, author_role, body, created_at').single()
  if (error) {
    console.error('Failed to add note:', error)
    res.status(500).json({ error: 'Failed to send the note' })
    return
  }
  // Writing a note means the professional has read the thread
  await supabaseAdmin.from('match_requests').update({ professional_notes_read_at: data.created_at }).eq('id', id)
  res.status(201).json(data)
}))

// POST /api/leads/:id/notes/read — mark the client's notes as read
router.post('/:id/notes/read', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = await guardCase(req, res)
  if (!id) return
  const { error } = await supabaseAdmin.from('match_requests').update({ professional_notes_read_at: new Date().toISOString() }).eq('id', id)
  if (error) {
    console.error('Failed to mark notes read:', error)
    res.status(500).json({ error: 'Failed to update' })
    return
  }
  res.json({ ok: true })
}))

// GET /api/leads/summary — counts for the professional's dashboard
router.get('/summary', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data: cases, error } = await supabaseAdmin.from('match_requests')
    .select('id, contact_name, stage, next_step, stage_updated_at, professional_notes_read_at')
    .eq('claimed_by', req.userId!).eq('status', 'claimed').order('stage_updated_at', { ascending: true })
  if (error) {
    console.error('Failed to load summary:', error)
    res.status(500).json({ error: 'Failed to load your dashboard' })
    return
  }
  const ids = cases.map(c => c.id)
  const [docs, notes] = ids.length ? await Promise.all([
    supabaseAdmin.from('case_documents').select(DOC_FIELDS).in('match_request_id', ids),
    supabaseAdmin.from('case_notes').select('match_request_id, author_role, created_at').in('match_request_id', ids).eq('author_role', 'homeowner')
  ]) : [{ data: [], error: null }, { data: [], error: null }]
  if (docs.error || notes.error) {
    console.error('Failed to load summary details:', docs.error || notes.error)
    res.status(500).json({ error: 'Failed to load your dashboard' })
    return
  }
  const presented = (docs.data ?? []).map(d => ({ ...presentDocument(d), case_id: d.match_request_id }))
  res.json({
    clients: cases.map(c => {
      const mine = presented.filter(d => d.case_id === c.id)
      return {
        id: c.id,
        contact_name: c.contact_name,
        stage: c.stage,
        next_step: c.next_step,
        stage_updated_at: c.stage_updated_at,
        to_review: mine.filter(d => d.sent_at && !d.received_at).length,
        waiting_on_client: mine.filter(d => !d.sent_at && !d.received_at).length,
        due_for_update: mine.filter(d => d.stale).length,
        received: mine.filter(d => d.received_at && !d.stale).length,
        total: mine.length,
        unread_notes: (notes.data ?? []).filter(n => n.match_request_id === c.id &&
          (!c.professional_notes_read_at || n.created_at > c.professional_notes_read_at)).length
      }
    })
  })
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

// ---------------------------------------------------------------------------
// My Information (private contact details clients see once they work with me)
// ---------------------------------------------------------------------------
const PRO_INFO_FIELDS = 'office_street, office_unit, office_city, office_state, office_zip, office_phone, fax, document_email, document_instructions, office_hours'

// GET /api/leads/info
router.get('/info', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const [profile, info] = await Promise.all([
    supabaseAdmin.from('profiles').select('email, full_name, phone').eq('id', req.userId!).single(),
    supabaseAdmin.from('professional_info').select(PRO_INFO_FIELDS).eq('user_id', req.userId!).maybeSingle()
  ])
  if (profile.error || info.error) {
    console.error('Failed to load professional info:', profile.error || info.error)
    res.status(500).json({ error: 'Failed to load your information' })
    return
  }
  res.json({ profile: profile.data, info: info.data })
}))

// PUT /api/leads/info
router.put('/info', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const b = req.body ?? {}
  const limits: Record<string, number> = {
    office_street: 120, office_unit: 30, office_city: 60, office_state: 30, office_zip: 10,
    office_phone: 30, fax: 30, document_email: 254, document_instructions: 1000, office_hours: 200
  }
  const row: Record<string, unknown> = { user_id: req.userId! }
  for (const [k, max] of Object.entries(limits)) {
    const v = b[k]
    if (v !== undefined && v !== null && (typeof v !== 'string' || v.length > max)) {
      res.status(400).json({ error: `${k.replace(/_/g, ' ')} is too long` })
      return
    }
    row[k] = typeof v === 'string' && v.trim() ? v.trim() : null
  }
  if (row.office_zip && !/^\d{5}(-\d{4})?$/.test(row.office_zip as string)) {
    res.status(400).json({ error: 'ZIP code must be 5 digits' })
    return
  }
  if (row.document_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.document_email as string)) {
    res.status(400).json({ error: 'Please enter a valid email for documents, or leave it blank' })
    return
  }
  for (const k of ['office_phone', 'fax']) {
    if (row[k] && (row[k] as string).replace(/\D/g, '').length < 10) {
      res.status(400).json({ error: `Please enter a valid ${k === 'fax' ? 'fax' : 'office phone'} number, or leave it blank` })
      return
    }
  }
  const name = typeof b.full_name === 'string' ? b.full_name.trim() : ''
  const phone = typeof b.phone === 'string' ? b.phone.trim() : ''
  if (!name || name.length > 100) {
    res.status(400).json({ error: 'Please enter your name' })
    return
  }
  if (phone && (phone.length > 30 || phone.replace(/\D/g, '').length < 10)) {
    res.status(400).json({ error: 'Please enter a valid mobile number, or leave it blank' })
    return
  }
  const [info, profile] = await Promise.all([
    supabaseAdmin.from('professional_info').upsert(row).select(PRO_INFO_FIELDS).single(),
    supabaseAdmin.from('profiles').update({ full_name: name, phone: phone || null }).eq('id', req.userId!)
  ])
  if (info.error || profile.error) {
    console.error('Failed to save professional info:', info.error || profile.error)
    res.status(500).json({ error: 'Failed to save your information' })
    return
  }
  res.json(info.data)
}))

export default router
