import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'
import { COUNTIES, SITUATIONS, CHOSEN_CONSENT_TEXT, MAX_ACTIVE_CLAIMS } from '../matching.js'
import { listedProfessionals } from './directory.js'
import { caseDetails, addCaseEvent, UUID_RE } from '../cases.js'

// Homeowner side of matching: the homeowner picks one professional from the directory,
// then follows the case (stage, next step, timeline, document checklist).
const router = Router()

// GET /api/match — own match request (or null), the consent wording, and once matched:
// the professional's listing + contact details, the case timeline and document checklist
router.get('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data: request, error } = await supabaseAdmin
    .from('match_requests')
    .select('id, homeowner_id, county, situation, contact_name, contact_phone, best_time, status, claimed_by, claimed_at, created_at, stage, next_step, outcome, stage_updated_at')
    .eq('homeowner_id', req.userId!)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch match request:', error)
    res.status(500).json({ error: 'Failed to fetch match request' })
    return
  }

  let professional = null
  let events: unknown[] = []
  let documents: unknown[] = []
  if (request?.status === 'claimed' && request.claimed_by) {
    const [{ data: contact, error: proError }, listing, details] = await Promise.all([
      supabaseAdmin.from('profiles')
        .select('full_name, email, phone, business_name, professional_type, website, license_number, license_verified')
        .eq('id', request.claimed_by).maybeSingle(),
      listedProfessionals({ id: request.claimed_by }),
      caseDetails([{ id: request.id, homeowner_id: request.homeowner_id }])
    ])
    if (proError) console.error('Failed to fetch matched professional:', proError)
    // Contact details come from the profile even if the listing was since unpublished
    professional = contact ? { ...(listing?.[0] ?? {}), ...contact } : null
    if (details) {
      events = details.get(request.id)!.events
      documents = details.get(request.id)!.documents
    }
  }

  let publicRequest = null
  if (request) {
    // internal profile ids stay server-side; the homeowner gets `professional` instead
    publicRequest = { ...request } as Partial<typeof request>
    delete publicRequest.claimed_by
    delete publicRequest.homeowner_id
  }
  res.json({
    request: publicRequest,
    professional,
    events,
    documents,
    consent_text: CHOSEN_CONSENT_TEXT
  })
}))

// POST /api/match — choose a professional from the directory (creates or reopens own request)
router.post('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (req.userRole !== 'client') {
    res.status(403).json({ error: 'Only homeowner accounts can choose a professional' })
    return
  }

  const { professional_id, county, situation, contact_name, contact_phone, best_time, consent } = req.body ?? {}

  if (consent !== true) {
    res.status(400).json({ error: 'You must agree to share your details with this professional' })
    return
  }
  if (typeof professional_id !== 'string' || !UUID_RE.test(professional_id)) {
    res.status(400).json({ error: 'Please choose a professional' })
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

  // The professional must be listed, subscribed, serve this county, take requests
  // through SonderBe (not direct-contact-only) and have room for another client
  const listing = await listedProfessionals({ id: professional_id, county })
  if (listing === null) {
    res.status(500).json({ error: 'Failed to choose this professional' })
    return
  }
  const pro = listing[0]
  if (!pro) {
    res.status(400).json({ error: 'This professional is not available in your county' })
    return
  }
  if (pro.direct_contact_only) {
    res.status(400).json({ error: 'Please contact this professional directly using the details on their listing' })
    return
  }
  if (!pro.accepting) {
    res.status(409).json({ error: `This professional has ${MAX_ACTIVE_CLAIMS} active clients and isn't taking new ones right now` })
    return
  }

  const [{ data: profile, error: profileError }, { data: existing, error: existingError }] = await Promise.all([
    supabaseAdmin.from('profiles').select('email').eq('id', req.userId!).single(),
    supabaseAdmin.from('match_requests').select('status').eq('homeowner_id', req.userId!).maybeSingle()
  ])
  if (profileError || !profile || existingError) {
    console.error('Failed to prepare match request:', profileError || existingError)
    res.status(500).json({ error: 'Failed to choose this professional' })
    return
  }
  if (existing?.status === 'claimed') {
    res.status(409).json({ error: 'You already have a professional. Withdraw first to choose someone new.' })
    return
  }

  const now = new Date().toISOString()
  const proName = [pro.full_name, pro.business_name].filter(Boolean).join(', ')
  const row = {
    homeowner_id: req.userId!,
    county,
    situation,
    contact_name: contact_name.trim(),
    contact_email: profile.email,
    contact_phone: contact_phone ? contact_phone.trim() : null,
    best_time: best_time ? best_time.trim() : null,
    consent_text: `${CHOSEN_CONSENT_TEXT} Professional chosen: ${proName}.`,
    consented_at: now,
    status: 'claimed',
    claimed_by: pro.id,
    claimed_at: now,
    stage: 'matched',
    next_step: `${pro.full_name || 'Your professional'} will contact you.`,
    outcome: null,
    stage_updated_at: now
  }

  // A reopened request starts a fresh case: clear the old timeline and documents
  if (existing) {
    const { data: old } = await supabaseAdmin.from('match_requests').select('id').eq('homeowner_id', req.userId!).single()
    if (old) {
      await Promise.all([
        supabaseAdmin.from('case_events').delete().eq('match_request_id', old.id),
        supabaseAdmin.from('case_documents').delete().eq('match_request_id', old.id)
      ])
    }
  }

  // The status filter on the update keeps a concurrent pick from being overwritten
  const query = existing
    ? supabaseAdmin.from('match_requests').update(row).eq('homeowner_id', req.userId!).neq('status', 'claimed')
    : supabaseAdmin.from('match_requests').insert(row)
  const { data, error } = await query.select('id, county, situation, status, stage, created_at').maybeSingle()

  if (error) {
    console.error('Failed to save match request:', error)
    res.status(500).json({ error: 'Failed to choose this professional' })
    return
  }
  if (!data) {
    res.status(409).json({ error: 'You already have a professional. Refresh to see their details.' })
    return
  }
  await addCaseEvent(data.id, 'matched', `You chose ${pro.full_name || pro.business_name}.`, req.userId!)
  res.status(existing ? 200 : 201).json(data)
}))

// PATCH /api/match/documents/:docId — homeowner marks a requested document sent (or not)
router.patch('/documents/:docId', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const docId = String(req.params.docId)
  if (!UUID_RE.test(docId)) {
    res.status(400).json({ error: 'Invalid document id' })
    return
  }
  const { sent, note } = req.body ?? {}
  if (typeof sent !== 'boolean') {
    res.status(400).json({ error: 'sent must be true or false' })
    return
  }
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 300)) {
    res.status(400).json({ error: 'Note must be 300 characters or fewer' })
    return
  }

  // Only documents on the homeowner's own active case
  const { data: request, error: reqError } = await supabaseAdmin
    .from('match_requests')
    .select('id')
    .eq('homeowner_id', req.userId!)
    .eq('status', 'claimed')
    .maybeSingle()
  if (reqError) {
    console.error('Failed to fetch match request for document update:', reqError)
    res.status(500).json({ error: 'Failed to update document' })
    return
  }
  if (!request) {
    res.status(404).json({ error: 'No active case' })
    return
  }

  const update: Record<string, unknown> = { sent_at: sent ? new Date().toISOString() : null }
  if (note !== undefined) update.homeowner_note = note ? note.trim() : null
  const { data, error } = await supabaseAdmin
    .from('case_documents')
    .update(update)
    .eq('id', docId)
    .eq('match_request_id', request.id)
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
