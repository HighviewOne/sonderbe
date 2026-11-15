import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'
import { COUNTIES, SITUATIONS, CHOSEN_CONSENT_TEXT, MAX_ACTIVE_CLAIMS, CATEGORY_OF } from '../matching.js'
import { listedProfessionals } from './directory.js'
import { accessFor, canWork } from '../access.js'
import { caseDetails, addCaseEvent, UUID_RE, DOC_FIELDS, presentDocument, addDocHistory, professionalContact } from '../cases.js'

// Homeowner side of matching: the homeowner picks one professional from the directory,
// then follows the case (stage, next step, timeline, document checklist).
const router = Router()

// GET /api/match — the homeowner's cases (one per category: real estate, legal), the consent
// wording, and for each active case the professional's listing + contact, timeline and documents
router.get('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data: requests, error } = await supabaseAdmin
    .from('match_requests')
    .select('id, homeowner_id, category, county, situation, contact_name, contact_phone, best_time, status, claimed_by, claimed_at, created_at, stage, next_step, outcome, stage_updated_at, homeowner_notes_read_at, closed_reason')
    .eq('homeowner_id', req.userId!)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch match requests:', error)
    res.status(500).json({ error: 'Failed to fetch your cases' })
    return
  }

  // A professional whose read-only period is over has left: close the case for the homeowner
  const claimedPros = requests.filter(r => r.status === 'claimed' && r.claimed_by).map(r => r.claimed_by as string)
  const access = await accessFor(claimedPros)
  if (access === null) {
    res.status(500).json({ error: 'Failed to fetch your cases' })
    return
  }
  for (const r of requests) {
    const a = r.claimed_by ? access.get(r.claimed_by) : undefined
    if (r.status === 'claimed' && a && (a.state === 'ended' || a.state === 'none')) {
      const { error: closeError } = await supabaseAdmin.from('match_requests')
        .update({ status: 'closed', closed_reason: 'professional_inactive' }).eq('id', r.id).eq('status', 'claimed')
      if (closeError) console.error('Failed to close case for inactive professional:', closeError)
      else {
        r.status = 'closed'
        r.closed_reason = 'professional_inactive'
        // Written by SonderBe, not by either side
        await addCaseEvent(r.id, r.stage, 'Your professional is no longer on SonderBe, so this case was closed. You can choose someone new.', null)
      }
    }
  }

  const active = requests.filter(r => r.status === 'claimed' && r.claimed_by)
  const proIds = [...new Set(active.map(r => r.claimed_by as string))]
  // One query each for every case's professional, not one set per case
  const [details, contacts, profiles, listings] = await Promise.all([
    caseDetails(active.map(r => ({ id: r.id, homeowner_id: r.homeowner_id }))),
    professionalContact(proIds),
    proIds.length
      ? supabaseAdmin.from('profiles')
          .select('id, full_name, email, phone, business_name, professional_type, website, license_number, license_verified, avatar_url')
          .in('id', proIds)
      : Promise.resolve({ data: [], error: null }),
    proIds.length ? listedProfessionals({ ids: proIds }) : Promise.resolve([])
  ])
  if (details === null) {
    res.status(500).json({ error: 'Failed to fetch your cases' })
    return
  }
  if (profiles.error) console.error('Failed to fetch matched professionals:', profiles.error)
  const profileOf = new Map((profiles.data ?? []).map(p => [p.id as string, p]))
  const listingOf = new Map((listings ?? []).map(l => [l.id, l]))

  const cases = requests.map(r => {
    let professional = null
    if (r.status === 'claimed' && r.claimed_by) {
      const profile = profileOf.get(r.claimed_by)
      // Contact details come from the profile even if the listing was since unpublished
      if (profile) {
        const contact = { ...profile } as Partial<typeof profile>
        delete contact.id
        professional = { ...(listingOf.get(r.claimed_by) ?? {}), ...contact, office: contacts.get(r.claimed_by) ?? null }
      }
    }
    const publicRequest = { ...r } as Partial<typeof r>
    delete publicRequest.claimed_by
    delete publicRequest.homeowner_id
    delete publicRequest.homeowner_notes_read_at
    const notes = details.get(r.id)?.notes ?? []
    const proAccess = r.status === 'claimed' && r.claimed_by ? access.get(r.claimed_by) : undefined
    return {
      category: r.category,
      request: publicRequest,
      professional,
      events: details.get(r.id)?.events ?? [],
      documents: details.get(r.id)?.documents ?? [],
      notes,
      // 'inactive' = their subscription ended; they can still read but not update the case
      professional_status: proAccess ? (canWork(proAccess) ? 'active' : 'inactive') : null,
      unread_notes: notes.filter(n => n.author_role === 'professional' &&
        (!r.homeowner_notes_read_at || n.created_at > r.homeowner_notes_read_at)).length
    }
  })

  res.json({ cases, consent_text: CHOSEN_CONSENT_TEXT })
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

  const category = CATEGORY_OF[pro.professional_type]
  const [{ data: profile, error: profileError }, { data: existing, error: existingError }] = await Promise.all([
    supabaseAdmin.from('profiles').select('email').eq('id', req.userId!).single(),
    supabaseAdmin.from('match_requests').select('*').eq('homeowner_id', req.userId!).eq('category', category).maybeSingle()
  ])
  if (profileError || !profile || existingError) {
    console.error('Failed to prepare match request:', profileError || existingError)
    res.status(500).json({ error: 'Failed to choose this professional' })
    return
  }
  // Replacing a professional whose account is inactive is allowed without withdrawing first
  let replacingInactive = false
  if (existing?.status === 'claimed' && existing.claimed_by) {
    const a = (await accessFor([existing.claimed_by]))?.get(existing.claimed_by)
    replacingInactive = Boolean(a && !canWork(a))
  }
  if (existing?.status === 'claimed' && !replacingInactive) {
    res.status(409).json({
      error: category === 'legal'
        ? 'You already have a legal professional. Withdraw first to choose someone new.'
        : 'You already have a real estate professional. Withdraw first to choose someone new.'
    })
    return
  }

  const now = new Date().toISOString()
  const proName = [pro.full_name, pro.business_name].filter(Boolean).join(', ')
  const row = {
    homeowner_id: req.userId!,
    category,
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
    stage_updated_at: now,
    closed_reason: null,
    homeowner_notes_read_at: null,
    professional_notes_read_at: null
  }

  // The status filter on the update keeps a concurrent pick from being overwritten
  const query = existing
    ? (replacingInactive
        ? supabaseAdmin.from('match_requests').update(row).eq('id', existing.id).eq('claimed_by', existing.claimed_by!).eq('status', 'claimed')
        : supabaseAdmin.from('match_requests').update(row).eq('id', existing.id).neq('status', 'claimed'))
    : supabaseAdmin.from('match_requests').insert(row)
  const { data, error } = await query.select('id, category, county, situation, status, stage, created_at').maybeSingle()

  if (error) {
    console.error('Failed to save match request:', error)
    res.status(500).json({ error: 'Failed to choose this professional' })
    return
  }
  if (!data) {
    res.status(409).json({ error: 'You already have a professional. Refresh to see their details.' })
    return
  }

  // Two homeowners choosing the same professional at once can both pass the "accepting" check.
  // Afterwards, the earliest MAX_ACTIVE_CLAIMS cases keep their place; a later one is undone.
  const { data: held, error: heldError } = await supabaseAdmin.from('match_requests').select('id')
    .eq('claimed_by', pro.id).eq('status', 'claimed').order('claimed_at').order('id').limit(MAX_ACTIVE_CLAIMS + 50)
  if (heldError) console.error('Failed to recheck client limit:', heldError)
  else if (held.findIndex(h => h.id === data.id) >= MAX_ACTIVE_CLAIMS) {
    const { error: undoError } = existing
      ? await supabaseAdmin.from('match_requests').update(restorable(existing)).eq('id', existing.id)
      : await supabaseAdmin.from('match_requests').delete().eq('id', data.id)
    if (undoError) console.error('Failed to undo over-limit pick:', undoError)
    res.status(409).json({ error: `This professional has ${MAX_ACTIVE_CLAIMS} active clients and isn't taking new ones right now` })
    return
  }

  // Only now that the change is saved: a new professional starts a fresh case. The document list
  // carries over (reset to "to send") so nobody retypes it; the timeline, notes and document history
  // were with the previous professional and are removed.
  if (existing) {
    const results = await Promise.all([
      supabaseAdmin.from('case_events').delete().eq('match_request_id', existing.id),
      supabaseAdmin.from('case_notes').delete().eq('match_request_id', existing.id),
      supabaseAdmin.from('case_document_history').delete().eq('match_request_id', existing.id),
      supabaseAdmin.from('case_documents').update({
        sent_at: null, received_at: null, homeowner_note: null, round: 1, request_reason: null, last_received_at: null, due_date: null
      }).eq('match_request_id', existing.id)
    ])
    for (const r of results) if (r.error) console.error('Failed to clear previous professional\'s case data:', r.error)
  }
  await addCaseEvent(data.id, 'matched', `You chose ${pro.full_name || pro.business_name}.`, req.userId!)
  res.status(existing ? 200 : 201).json(data)
}))

// The columns POST /api/match overwrites, as they were, for undoing an over-limit pick
function restorable(previous: Record<string, unknown>) {
  const copy = { ...previous }
  for (const k of ['id', 'homeowner_id', 'created_at']) delete copy[k]
  return copy
}

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

  // Only documents on the homeowner's own active cases
  const { data: requests, error: reqError } = await supabaseAdmin
    .from('match_requests')
    .select('id')
    .eq('homeowner_id', req.userId!)
    .eq('status', 'claimed')
  if (reqError) {
    console.error('Failed to fetch match requests for document update:', reqError)
    res.status(500).json({ error: 'Failed to update document' })
    return
  }
  if (requests.length === 0) {
    res.status(404).json({ error: 'No active case' })
    return
  }

  const update: Record<string, unknown> = { sent_at: sent ? new Date().toISOString() : null }
  if (note !== undefined) update.homeowner_note = note ? note.trim() : null
  const { data, error } = await supabaseAdmin
    .from('case_documents')
    .update(update)
    .eq('id', docId)
    .in('match_request_id', requests.map(r => r.id))
    .is('received_at', null)
    .select(DOC_FIELDS)
    .maybeSingle()
  if (error) {
    console.error('Failed to update document:', error)
    res.status(500).json({ error: 'Failed to update document' })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Document not found, or already received' })
    return
  }
  await addDocHistory(data.id, data.match_request_id, data.round, sent ? 'sent' : 'unsent', req.userId!)
  res.json(presentDocument(data))
}))

async function ownActiveRequest(homeownerId: string, id: string) {
  const { data } = await supabaseAdmin.from('match_requests').select('id')
    .eq('id', id).eq('homeowner_id', homeownerId).eq('status', 'claimed').maybeSingle()
  return data
}

// POST /api/match/:id/notes — { body, document_id? } note to the professional
router.post('/:id/notes', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
  const documentId = req.body?.document_id ?? null
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid case id' })
    return
  }
  if (!body || body.length > 2000) {
    res.status(400).json({ error: 'Write a note (2000 characters max)' })
    return
  }
  if (documentId !== null && (typeof documentId !== 'string' || !UUID_RE.test(documentId))) {
    res.status(400).json({ error: 'Invalid document' })
    return
  }
  if (!(await ownActiveRequest(req.userId!, id))) {
    res.status(404).json({ error: 'No active case with this id' })
    return
  }
  if (documentId) {
    const { data: doc } = await supabaseAdmin.from('case_documents').select('id').eq('id', documentId).eq('match_request_id', id).maybeSingle()
    if (!doc) {
      res.status(404).json({ error: 'Document not found' })
      return
    }
  }
  const { data, error } = await supabaseAdmin.from('case_notes')
    .insert({ match_request_id: id, document_id: documentId, author_id: req.userId!, author_role: 'homeowner', body })
    .select('id, document_id, author_role, body, created_at').single()
  if (error) {
    console.error('Failed to add note:', error)
    res.status(500).json({ error: 'Failed to send the note' })
    return
  }
  await supabaseAdmin.from('match_requests').update({ homeowner_notes_read_at: data.created_at }).eq('id', id)
  res.status(201).json(data)
}))

// POST /api/match/:id/notes/read
router.post('/:id/notes/read', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id) || !(await ownActiveRequest(req.userId!, id))) {
    res.status(404).json({ error: 'No active case with this id' })
    return
  }
  await supabaseAdmin.from('match_requests').update({ homeowner_notes_read_at: new Date().toISOString() }).eq('id', id)
  res.json({ ok: true })
}))

// DELETE /api/match/:id — withdraw one case (stops contact; hides details from that professional)
router.delete('/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid case id' })
    return
  }
  const { data, error } = await supabaseAdmin
    .from('match_requests')
    .update({ status: 'withdrawn' })
    .eq('id', id)
    .eq('homeowner_id', req.userId!)
    .in('status', ['open', 'claimed'])
    .select('id, status')
    .maybeSingle()

  if (error) {
    console.error('Failed to withdraw match request:', error)
    res.status(500).json({ error: 'Failed to withdraw' })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'No active case to withdraw' })
    return
  }
  res.json(data)
}))

export default router
