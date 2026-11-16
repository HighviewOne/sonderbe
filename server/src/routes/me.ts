import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'
import { COUNTIES, RELATIONSHIPS, INCOME_TYPES, HARDSHIP_REASONS, TEAM_STATUSES } from '../matching.js'
import { loadHousehold, documentsForHousehold } from '../household.js'
import { UUID_RE } from '../cases.js'
import { EMAIL_RE } from '../validation.js'

// Homeowner "My Information": entered once, reused everywhere (document lists, hardship
// letter, what the chosen professional sees). Homeowner accounts only.
const router = Router()
router.use(requireAuth, (req: AuthenticatedRequest, res, next) => {
  if (req.userRole !== 'client') {
    res.status(403).json({ error: 'Only homeowner accounts have this information' })
    return
  }
  next()
})

const INFO_FIELDS = 'property_street, property_unit, property_city, property_zip, property_county, mailing_same, ' +
  'mailing_street, mailing_unit, mailing_city, mailing_state, mailing_zip, alt_phone, preferred_contact, best_time, ' +
  'servicer_name, hardship_reasons, hardship_details, updated_at'
const MEMBER_FIELDS = 'id, is_self, full_name, relationship, on_mortgage, income_types, employer'
const TEAM_FIELDS = 'id, role, directory_profile_id, name, firm, phone, email, status, notes, created_at'

type Check = { ok: true; value: string | null } | { ok: false }
function text(v: unknown, max: number): Check {
  if (v === undefined || v === null || v === '') return { ok: true, value: null }
  if (typeof v !== 'string' || v.length > max) return { ok: false }
  return { ok: true, value: v.trim() || null }
}

// GET /api/me — everything on the My Information page in one call
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles').select('email, full_name, phone').eq('id', req.userId!).single()
  if (profileError || !profile) {
    console.error('Failed to load profile for My Information:', profileError)
    res.status(500).json({ error: 'Failed to load your information' })
    return
  }
  const [info, emails, team, household] = await Promise.all([
    supabaseAdmin.from('homeowner_info').select(INFO_FIELDS).eq('user_id', req.userId!).maybeSingle(),
    supabaseAdmin.from('homeowner_emails').select('id, email, label').eq('user_id', req.userId!).order('created_at'),
    supabaseAdmin.from('team_contacts').select(TEAM_FIELDS).eq('user_id', req.userId!).order('created_at'),
    loadHousehold(req.userId!, profile.full_name ?? '')
  ])
  if (info.error || emails.error || team.error || household === null) {
    console.error('Failed to load My Information:', info.error || emails.error || team.error)
    res.status(500).json({ error: 'Failed to load your information' })
    return
  }
  res.json({ profile, info: info.data, emails: emails.data, household, team: team.data })
}))

// GET /api/me/documents — the documents a professional will likely ask for, built from the household
router.get('/documents', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data: profile } = await supabaseAdmin.from('profiles').select('full_name').eq('id', req.userId!).single()
  const household = await loadHousehold(req.userId!, profile?.full_name ?? '')
  if (household === null) {
    res.status(500).json({ error: 'Failed to build your document list' })
    return
  }
  res.json({ documents: documentsForHousehold(household) })
}))

// PUT /api/me/info — name, phone, addresses, contact preferences, servicer, hardship
router.put('/info', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const b = req.body ?? {}
  const fields: Record<string, [unknown, number]> = {
    property_street: [b.property_street, 120], property_unit: [b.property_unit, 30],
    property_city: [b.property_city, 60], property_zip: [b.property_zip, 10],
    mailing_street: [b.mailing_street, 120], mailing_unit: [b.mailing_unit, 30],
    mailing_city: [b.mailing_city, 60], mailing_state: [b.mailing_state, 30], mailing_zip: [b.mailing_zip, 10],
    alt_phone: [b.alt_phone, 30], best_time: [b.best_time, 200], servicer_name: [b.servicer_name, 120],
    hardship_details: [b.hardship_details, 2000]
  }
  const row: Record<string, unknown> = { user_id: req.userId! }
  for (const [key, [value, max]] of Object.entries(fields)) {
    const c = text(value, max)
    if (!c.ok) {
      res.status(400).json({ error: `${key.replace(/_/g, ' ')} is too long` })
      return
    }
    row[key] = c.value
  }
  for (const zip of ['property_zip', 'mailing_zip']) {
    if (row[zip] && !/^\d{5}(-\d{4})?$/.test(row[zip] as string)) {
      res.status(400).json({ error: 'ZIP code must be 5 digits' })
      return
    }
  }
  if (b.property_county && !COUNTIES.includes(b.property_county)) {
    res.status(400).json({ error: 'Please choose a supported county' })
    return
  }
  row.property_county = b.property_county || null
  row.mailing_same = b.mailing_same !== false
  if (row.mailing_same) {
    for (const k of ['mailing_street', 'mailing_unit', 'mailing_city', 'mailing_state', 'mailing_zip']) row[k] = null
  }
  if (b.preferred_contact && !['phone', 'text', 'email'].includes(b.preferred_contact)) {
    res.status(400).json({ error: 'Unknown contact preference' })
    return
  }
  row.preferred_contact = b.preferred_contact || null
  const reasons = Array.isArray(b.hardship_reasons) ? b.hardship_reasons : []
  if (reasons.some((r: unknown) => typeof r !== 'string' || !(HARDSHIP_REASONS as readonly string[]).includes(r))) {
    res.status(400).json({ error: 'Unknown hardship reason' })
    return
  }
  row.hardship_reasons = [...new Set(reasons)]

  // Name and main phone live on the profile
  const name = text(b.full_name, 100)
  const phone = text(b.phone, 30)
  if (!name.ok || !name.value) {
    res.status(400).json({ error: 'Please enter your name' })
    return
  }
  if (!phone.ok || (phone.value && phone.value.replace(/\D/g, '').length < 10)) {
    res.status(400).json({ error: 'Please enter a valid phone number, or leave it blank' })
    return
  }
  if (row.alt_phone && (row.alt_phone as string).replace(/\D/g, '').length < 10) {
    res.status(400).json({ error: 'Please enter a valid second phone number, or leave it blank' })
    return
  }

  const [infoResult, profileResult] = await Promise.all([
    supabaseAdmin.from('homeowner_info').upsert(row).select(INFO_FIELDS).single(),
    supabaseAdmin.from('profiles').update({ full_name: name.value, phone: phone.value }).eq('id', req.userId!)
  ])
  if (infoResult.error || profileResult.error) {
    console.error('Failed to save My Information:', infoResult.error || profileResult.error)
    res.status(500).json({ error: 'Failed to save your information' })
    return
  }
  // Keep the household "self" row's name in step with the profile
  await supabaseAdmin.from('household_members').update({ full_name: name.value }).eq('user_id', req.userId!).eq('is_self', true)
  res.json(infoResult.data)
}))

// POST /api/me/emails — { email, label }
router.post('/emails', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { email, label } = req.body ?? {}
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim()) || email.length > 254) {
    res.status(400).json({ error: 'Please enter a valid email address' })
    return
  }
  if (label !== undefined && label !== null && !['personal', 'work', 'other'].includes(label)) {
    res.status(400).json({ error: 'Unknown email label' })
    return
  }
  const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('id', req.userId!).single()
  if (profile?.email?.toLowerCase() === email.trim().toLowerCase()) {
    res.status(409).json({ error: 'That is already your main (login) email' })
    return
  }
  const { count } = await supabaseAdmin.from('homeowner_emails').select('id', { count: 'exact', head: true }).eq('user_id', req.userId!)
  if ((count ?? 0) >= 5) {
    res.status(400).json({ error: 'You can add up to 5 extra emails' })
    return
  }
  const { data, error } = await supabaseAdmin.from('homeowner_emails')
    .insert({ user_id: req.userId!, email: email.trim(), label: label ?? null }).select('id, email, label').single()
  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'You already added that email' })
      return
    }
    console.error('Failed to add email:', error)
    res.status(500).json({ error: 'Failed to add email' })
    return
  }
  res.status(201).json(data)
}))

// DELETE /api/me/emails/:id
router.delete('/emails/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid id' })
    return
  }
  const { data, error } = await supabaseAdmin.from('homeowner_emails').delete().eq('id', id).eq('user_id', req.userId!).select('id').maybeSingle()
  if (error) {
    console.error('Failed to remove email:', error)
    res.status(500).json({ error: 'Failed to remove email' })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Email not found' })
    return
  }
  res.json({ ok: true })
}))

function memberInput(b: Record<string, unknown>, isSelf: boolean): { error: string } | { row: Record<string, unknown> } {
  const name = text(b.full_name, 100)
  if (!name.ok || !name.value) return { error: 'Please enter their name' }
  const employer = text(b.employer, 120)
  if (!employer.ok) return { error: 'Employer must be 120 characters or fewer' }
  const relationship = isSelf ? 'self' : b.relationship
  if (typeof relationship !== 'string' || !(RELATIONSHIPS as readonly string[]).includes(relationship) || (!isSelf && relationship === 'self')) {
    return { error: 'Please choose how they are related to you' }
  }
  const incomes = Array.isArray(b.income_types) ? b.income_types : []
  if (incomes.some(t => typeof t !== 'string' || !(INCOME_TYPES as readonly string[]).includes(t))) {
    return { error: 'Unknown income type' }
  }
  return {
    row: {
      full_name: name.value,
      relationship,
      on_mortgage: b.on_mortgage === true,
      income_types: [...new Set(incomes)],
      employer: incomes.includes('employment') ? employer.value : null
    }
  }
}

// POST /api/me/household — add someone living in the home
router.post('/household', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const parsed = memberInput(req.body ?? {}, false)
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const { count } = await supabaseAdmin.from('household_members').select('id', { count: 'exact', head: true }).eq('user_id', req.userId!)
  if ((count ?? 0) >= 12) {
    res.status(400).json({ error: 'You can list up to 12 people' })
    return
  }
  const { data, error } = await supabaseAdmin.from('household_members')
    .insert({ ...parsed.row, user_id: req.userId!, sort_order: count ?? 0 }).select(MEMBER_FIELDS).single()
  if (error) {
    console.error('Failed to add household member:', error)
    res.status(500).json({ error: 'Failed to add this person' })
    return
  }
  res.status(201).json(data)
}))

// PUT /api/me/household/:id
router.put('/household/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid id' })
    return
  }
  const { data: existing } = await supabaseAdmin.from('household_members').select('is_self').eq('id', id).eq('user_id', req.userId!).maybeSingle()
  if (!existing) {
    res.status(404).json({ error: 'Person not found' })
    return
  }
  const parsed = memberInput(req.body ?? {}, existing.is_self)
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const { data, error } = await supabaseAdmin.from('household_members').update(parsed.row).eq('id', id).eq('user_id', req.userId!)
    .select(MEMBER_FIELDS).single()
  if (error) {
    console.error('Failed to update household member:', error)
    res.status(500).json({ error: 'Failed to save this person' })
    return
  }
  if (existing.is_self) {
    await supabaseAdmin.from('profiles').update({ full_name: parsed.row.full_name }).eq('id', req.userId!)
  }
  res.json(data)
}))

// DELETE /api/me/household/:id (not the homeowner themselves)
router.delete('/household/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid id' })
    return
  }
  const { data, error } = await supabaseAdmin.from('household_members').delete()
    .eq('id', id).eq('user_id', req.userId!).eq('is_self', false).select('id').maybeSingle()
  if (error) {
    console.error('Failed to remove household member:', error)
    res.status(500).json({ error: 'Failed to remove this person' })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Person not found' })
    return
  }
  res.json({ ok: true })
}))

// ---------------------------------------------------------------------------
// My team: professionals outside SonderBe matching (their lawyer). Never contacted by us.
// ---------------------------------------------------------------------------
async function teamInput(b: Record<string, unknown>): Promise<{ error: string } | { row: Record<string, unknown> }> {
  const name = text(b.name, 120)
  const firm = text(b.firm, 120)
  const phone = text(b.phone, 30)
  const email = text(b.email, 254)
  const notes = text(b.notes, 2000)
  if (!name.ok || !name.value) return { error: 'Please enter their name' }
  if (!firm.ok || !phone.ok || !email.ok || !notes.ok) return { error: 'One of the fields is too long' }
  if (email.value && !EMAIL_RE.test(email.value)) return { error: 'Please enter a valid email, or leave it blank' }
  if (b.role !== 'attorney' && b.role !== 'other') return { error: 'Please choose what they do' }
  const status = b.status ?? 'contacted'
  if (typeof status !== 'string' || !(TEAM_STATUSES as readonly string[]).includes(status)) return { error: 'Unknown status' }
  let directoryId: string | null = null
  if (b.directory_profile_id) {
    if (typeof b.directory_profile_id !== 'string' || !UUID_RE.test(b.directory_profile_id)) return { error: 'Invalid listing' }
    const { data } = await supabaseAdmin.from('profiles').select('id').eq('id', b.directory_profile_id).eq('listed', true).maybeSingle()
    if (!data) return { error: 'That listing is no longer available' }
    directoryId = data.id
  }
  return {
    row: {
      role: b.role, name: name.value, firm: firm.value, phone: phone.value, email: email.value,
      status, notes: notes.value, directory_profile_id: directoryId
    }
  }
}

// POST /api/me/team
router.post('/team', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const parsed = await teamInput(req.body ?? {})
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const { count } = await supabaseAdmin.from('team_contacts').select('id', { count: 'exact', head: true }).eq('user_id', req.userId!)
  if ((count ?? 0) >= 10) {
    res.status(400).json({ error: 'You can list up to 10 people on your team' })
    return
  }
  const { data, error } = await supabaseAdmin.from('team_contacts').insert({ ...parsed.row, user_id: req.userId! }).select(TEAM_FIELDS).single()
  if (error) {
    console.error('Failed to add team contact:', error)
    res.status(500).json({ error: 'Failed to add to your team' })
    return
  }
  res.status(201).json(data)
}))

// PUT /api/me/team/:id
router.put('/team/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid id' })
    return
  }
  const parsed = await teamInput(req.body ?? {})
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const { data, error } = await supabaseAdmin.from('team_contacts').update(parsed.row).eq('id', id).eq('user_id', req.userId!)
    .select(TEAM_FIELDS).maybeSingle()
  if (error) {
    console.error('Failed to update team contact:', error)
    res.status(500).json({ error: 'Failed to save' })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  res.json(data)
}))

// DELETE /api/me/team/:id
router.delete('/team/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid id' })
    return
  }
  const { data, error } = await supabaseAdmin.from('team_contacts').delete().eq('id', id).eq('user_id', req.userId!).select('id').maybeSingle()
  if (error) {
    console.error('Failed to remove team contact:', error)
    res.status(500).json({ error: 'Failed to remove' })
    return
  }
  if (!data) {
    res.status(404).json({ error: 'Not found' })
    return
  }
  res.json({ ok: true })
}))

export default router
