import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { adminOnly } from '../middleware/adminOnly.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest, Profile, Document, DistressedProperty, County, LeadType } from '../types.js'
import { COUNTIES, LICENSED_TYPES } from '../matching.js'
import { UUID_RE } from '../cases.js'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import { EMAIL_RE } from '../validation.js'

const router = Router()

// All admin routes require auth + admin role
router.use(requireAuth, adminOnly)

const ALLOWED_SORT_COLUMNS = new Set([
  'created_at', 'updated_at', 'property_address', 'city', 'zip',
  'county', 'lead_type', 'estimated_value', 'estimated_equity',
  'outstanding_debt', 'opening_bid', 'recording_date', 'sale_date', 'status'
])

const PROPERTY_FIELDS = [
  'lead_type', 'county', 'property_address', 'city', 'zip', 'apn',
  'owner_name', 'owner_mailing_address', 'estimated_value', 'outstanding_debt',
  'estimated_equity', 'opening_bid', 'recording_date', 'document_number',
  'case_number', 'sale_date', 'notes', 'source', 'status'
] as const

function pickPropertyFields(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of PROPERTY_FIELDS) {
    if (body[field] !== undefined) {
      result[field] = body[field]
    }
  }
  return result
}

// GET /api/admin/stats — dashboard counts + recent data
router.get('/stats', asyncHandler(async (_req, res) => {
  const [clientCountResult, newSubsResult, pendingDocsResult, recentClientsResult, recentSubsResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
    supabaseAdmin.from('contact_submissions').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    supabaseAdmin.from('documents').select('*', { count: 'exact', head: true }).eq('status', 'uploaded'),
    supabaseAdmin.from('profiles').select('id, email, full_name, created_at').eq('role', 'client').order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('contact_submissions').select('*').order('created_at', { ascending: false }).limit(5)
  ])

  res.json({
    totalClients: clientCountResult.count || 0,
    newSubmissions: newSubsResult.count || 0,
    pendingDocuments: pendingDocsResult.count || 0,
    recentClients: recentClientsResult.data || [],
    recentSubmissions: recentSubsResult.data || []
  })
}))

// GET /api/admin/clients — all client profiles
router.get('/clients', asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch clients:', error)
    res.status(500).json({ error: 'Failed to fetch clients' })
    return
  }
  res.json(data)
}))

// GET /api/admin/clients/:id — full client detail
router.get('/clients/:id', asyncHandler(async (req, res) => {
  const clientId = req.params.id

  const [profileResult, submissionsResult, documentsResult, checklistResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', clientId).single(),
    supabaseAdmin.from('contact_submissions').select('*').eq('user_id', clientId).order('created_at', { ascending: false }),
    supabaseAdmin.from('documents').select('*').eq('user_id', clientId).order('created_at', { ascending: false }),
    supabaseAdmin.from('checklist_progress').select('*').eq('user_id', clientId)
  ])

  if (profileResult.error || !profileResult.data) {
    res.status(404).json({ error: 'Client not found' })
    return
  }

  // Investors are former clients and keep their documents/submissions — only hide admins
  if (profileResult.data.role === 'admin') {
    res.status(404).json({ error: 'Client not found' })
    return
  }

  res.json({
    profile: profileResult.data,
    submissions: submissionsResult.data || [],
    documents: documentsResult.data || [],
    checklist: checklistResult.data || []
  })
}))

// GET /api/admin/documents — all documents with client names
router.get('/documents', asyncHandler(async (_req, res) => {
  const { data: docs, error: docsError } = await supabaseAdmin
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (docsError) {
    console.error('Failed to fetch documents:', docsError)
    res.status(500).json({ error: 'Failed to fetch documents' })
    return
  }

  const typedDocs = docs as Document[]
  const userIds = [...new Set(typedDocs.map(d => d.user_id))]

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .in('id', userIds)

  const profileMap = new Map((profiles as Profile[] || []).map(p => [p.id, p]))

  const docsWithClients = typedDocs.map(doc => ({
    ...doc,
    client: profileMap.get(doc.user_id) || null
  }))

  res.json(docsWithClients)
}))

// ============================================
// PROPERTY MANAGEMENT
// ============================================

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const VALID_COUNTIES: County[] = ['Los Angeles', 'Orange', 'Riverside', 'San Bernardino', 'San Diego', 'Ventura']
const VALID_LEAD_TYPES: LeadType[] = ['foreclosure_nod', 'foreclosure_not', 'probate', 'tax_lien', 'tax_sale']

// GET /api/admin/properties — list with pagination/filters
router.get('/properties', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 25), 100)
  const offset = (page - 1) * limit

  let query = supabaseAdmin.from('distressed_properties').select('*', { count: 'exact' })

  if (req.query.county) query = query.eq('county', req.query.county)
  if (req.query.lead_type) query = query.eq('lead_type', req.query.lead_type)
  if (req.query.status) query = query.eq('status', req.query.status)
  if (req.query.city) query = query.ilike('city', `%${req.query.city}%`)
  if (req.query.zip) query = query.eq('zip', req.query.zip)
  if (req.query.search) {
    const search = (req.query.search as string).replace(/[,%]/g, '').slice(0, 200)
    query = query.or(`property_address.ilike.%${search}%,owner_name.ilike.%${search}%,apn.ilike.%${search}%`)
  }

  const sortBy = (req.query.sort_by as string) || 'created_at'
  if (!ALLOWED_SORT_COLUMNS.has(sortBy)) {
    res.status(400).json({ error: 'Invalid sort column' })
    return
  }
  const sortOrder = req.query.sort_order === 'asc'

  query = query.order(sortBy, { ascending: sortOrder }).range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('Failed to fetch properties:', error)
    res.status(500).json({ error: 'Failed to fetch properties' })
    return
  }

  res.json({
    properties: data as DistressedProperty[],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  })
}))

// GET /api/admin/properties/:id — single property (used by the edit form)
router.get('/properties/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('distressed_properties')
    .select('*')
    .eq('id', req.params.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      res.status(404).json({ error: 'Property not found' })
      return
    }
    console.error('Failed to fetch property:', error)
    res.status(500).json({ error: 'Failed to fetch property' })
    return
  }

  res.json(data as DistressedProperty)
}))

// POST /api/admin/properties — create single property
router.post('/properties', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const property = pickPropertyFields(req.body)
  property.uploaded_by = req.userId

  if (!property.lead_type || !VALID_LEAD_TYPES.includes(property.lead_type as LeadType)) {
    res.status(400).json({ error: 'Invalid or missing lead_type' })
    return
  }
  if (!property.county || !VALID_COUNTIES.includes(property.county as County)) {
    res.status(400).json({ error: 'Invalid or missing county' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('distressed_properties')
    .insert(property)
    .select()
    .single()

  if (error) {
    console.error('Failed to create property:', error)
    res.status(500).json({ error: 'Failed to create property' })
    return
  }

  res.status(201).json(data)
}))

// PUT /api/admin/properties/:id — update property
router.put('/properties/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const updates = pickPropertyFields(req.body)
  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('distressed_properties')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      res.status(404).json({ error: 'Property not found' })
      return
    }
    console.error('Failed to update property:', error)
    res.status(500).json({ error: 'Failed to update property' })
    return
  }

  res.json(data)
}))

// DELETE /api/admin/properties/:id
router.delete('/properties/:id', asyncHandler(async (req, res) => {
  const { id } = req.params

  const { error, count } = await supabaseAdmin
    .from('distressed_properties')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) {
    console.error('Failed to delete property:', error)
    res.status(500).json({ error: 'Failed to delete property' })
    return
  }

  if (count === 0) {
    res.status(404).json({ error: 'Property not found' })
    return
  }

  res.json({ success: true })
}))

// POST /api/admin/properties/csv-upload — bulk import from CSV
router.post('/properties/csv-upload', csvUpload.single('file'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }

  const lead_type = req.body.lead_type as LeadType
  const county = req.body.county as County

  if (!lead_type || !VALID_LEAD_TYPES.includes(lead_type)) {
    res.status(400).json({ error: 'Invalid or missing lead_type' })
    return
  }
  if (!county || !VALID_COUNTIES.includes(county)) {
    res.status(400).json({ error: 'Invalid or missing county' })
    return
  }

  let records: Record<string, string>[]
  try {
    records = parse(req.file.buffer.toString(), {
      columns: true,
      skip_empty_lines: true,
      trim: true
    })
  } catch {
    res.status(400).json({ error: 'Failed to parse CSV file' })
    return
  }

  if (records.length === 0) {
    res.status(400).json({ error: 'CSV file is empty' })
    return
  }

  if (records.length > 5000) {
    res.status(400).json({ error: 'CSV exceeds maximum of 5000 rows' })
    return
  }

  const errors: { row: number; message: string }[] = []
  const properties: Partial<DistressedProperty>[] = []

  for (let i = 0; i < records.length; i++) {
    const row = records[i]
    const property: Partial<DistressedProperty> = {
      lead_type,
      county,
      uploaded_by: req.userId,
      property_address: row.property_address || row.address || null,
      city: row.city || null,
      zip: row.zip || row.zip_code || null,
      apn: row.apn || null,
      owner_name: row.owner_name || row.owner || null,
      owner_mailing_address: row.owner_mailing_address || row.mailing_address || null,
      estimated_value: row.estimated_value ? parseFloat(row.estimated_value) : null,
      outstanding_debt: row.outstanding_debt ? parseFloat(row.outstanding_debt) : null,
      estimated_equity: row.estimated_equity ? parseFloat(row.estimated_equity) : null,
      opening_bid: row.opening_bid ? parseFloat(row.opening_bid) : null,
      recording_date: row.recording_date || null,
      document_number: row.document_number || null,
      case_number: row.case_number || null,
      sale_date: row.sale_date || null,
      notes: row.notes || null,
      source: row.source || null,
      status: 'active'
    }

    if (!property.property_address && !property.apn) {
      errors.push({ row: i + 2, message: 'Missing property_address and apn' })
      continue
    }

    properties.push(property)
  }

  let insertedCount = 0
  if (properties.length > 0) {
    const { error: insertError, data: insertedData } = await supabaseAdmin
      .from('distressed_properties')
      .insert(properties)
      .select('id')

    if (insertError) {
      console.error('CSV property insert failed:', insertError)
      res.status(500).json({ error: 'Failed to insert properties' })
      return
    }
    insertedCount = insertedData?.length || properties.length
  }

  // Log the upload
  await supabaseAdmin.from('csv_uploads').insert({
    uploaded_by: req.userId,
    file_name: req.file.originalname,
    lead_type,
    county,
    row_count: insertedCount,
    error_count: errors.length,
    errors: errors.length > 0 ? errors : null
  })

  res.json({
    inserted: insertedCount,
    errors: errors.length,
    errorDetails: errors,
    total: records.length
  })
}))

// GET /api/admin/investors — list investors with subscription status
router.get('/investors', asyncHandler(async (_req, res) => {
  const { data: investors, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('role', 'investor')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch investors:', error)
    res.status(500).json({ error: 'Failed to fetch investors' })
    return
  }

  const userIds = (investors as Profile[]).map(p => p.id)
  let subscriptions: Record<string, unknown>[] = []
  if (userIds.length > 0) {
    const { data: subs } = await supabaseAdmin
      .from('investor_subscriptions')
      .select('*')
      .in('user_id', userIds)
    subscriptions = subs || []
  }

  const subMap = new Map(subscriptions.map(s => [s.user_id as string, s]))

  const result = (investors as Profile[]).map(inv => ({
    ...inv,
    subscription: subMap.get(inv.id) || null
  }))

  res.json(result)
}))

// GET /api/admin/csv-uploads — upload history
router.get('/csv-uploads', asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('csv_uploads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Failed to fetch CSV uploads:', error)
    res.status(500).json({ error: 'Failed to fetch upload history' })
    return
  }

  res.json(data)
}))

// ---------------------------------------------------------------------------
// Service ads (movers, storage, ...): SonderBe staff set these up for advertisers
// ---------------------------------------------------------------------------
const AD_ADMIN_FIELDS = 'id, business_name, category, headline, description, phone, website, license_label, license_number, counties, active, starts_on, ends_on, view_count, click_count, contact_name, contact_email, monthly_price, internal_notes, report_token, created_at, updated_at'
const AD_CATEGORIES = ['movers', 'storage', 'cleaning', 'rental_housing', 'other']
// Ads homeowners must never see on a foreclosure site
const BLOCKED_AD_WORDS = /\b(loan|refinanc|debt relief|we buy houses|cash for (your )?home|stop (your )?foreclosure|credit repair)/i

function adInput(b: Record<string, unknown>): { error: string } | { row: Record<string, unknown> } {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const row: Record<string, unknown> = {
    business_name: str(b.business_name),
    category: b.category,
    headline: str(b.headline),
    description: str(b.description),
    phone: str(b.phone),
    website: str(b.website),
    license_label: str(b.license_label),
    license_number: str(b.license_number),
    counties: Array.isArray(b.counties) ? [...new Set(b.counties)] : [],
    active: b.active === true,
    starts_on: b.starts_on || null,
    ends_on: b.ends_on || null,
    contact_name: str(b.contact_name),
    contact_email: str(b.contact_email),
    monthly_price: b.monthly_price === '' || b.monthly_price === null || b.monthly_price === undefined ? null : Number(b.monthly_price),
    internal_notes: str(b.internal_notes)
  }
  if (!row.business_name) return { error: 'Business name is required' }
  if (!row.headline) return { error: 'Headline is required' }
  // Too long = an error, never silently cut off
  for (const [k, max] of [
    ['business_name', 120], ['headline', 120], ['description', 500], ['phone', 30], ['website', 200], ['license_label', 30],
    ['license_number', 40], ['contact_name', 120], ['contact_email', 254], ['internal_notes', 2000]
  ] as const) {
    if (typeof row[k] === 'string' && (row[k] as string).length > max) return { error: `${k.replace(/_/g, ' ')} is too long (${max} max)` }
  }
  if (typeof row.category !== 'string' || !AD_CATEGORIES.includes(row.category)) return { error: 'Choose a category' }
  if ((row.counties as unknown[]).some(c => typeof c !== 'string' || !COUNTIES.includes(c))) return { error: 'Unknown county' }
  if (row.active && (row.counties as unknown[]).length === 0) return { error: 'Choose at least one county before turning the ad on' }
  if (row.website && !/^https?:\/\/\S+$/i.test(row.website as string)) return { error: 'Website must start with http:// or https://' }
  if (row.contact_email && !EMAIL_RE.test(row.contact_email as string)) return { error: 'Contact email is not valid' }
  if (row.monthly_price !== null && (!Number.isFinite(row.monthly_price) || (row.monthly_price as number) < 0)) return { error: 'Monthly price must be a number' }
  for (const d of ['starts_on', 'ends_on']) {
    if (row[d] && (typeof row[d] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row[d] as string))) return { error: 'Dates must be YYYY-MM-DD' }
  }
  if (row.starts_on && row.ends_on && (row.ends_on as string) < (row.starts_on as string)) return { error: 'End date is before the start date' }
  if (row.category === 'movers' && row.active && !row.license_number) {
    return { error: 'Movers need their Cal-T permit number before the ad can go live' }
  }
  if (row.category === 'movers' && !row.license_label) row.license_label = 'Cal-T'
  const text = `${row.business_name} ${row.headline} ${row.description ?? ''}`
  if (BLOCKED_AD_WORDS.test(text)) return { error: 'SonderBe does not run ads for loans, debt relief, credit repair, cash home buyers or "stop foreclosure" services' }
  return { row }
}

// GET /api/admin/ads
router.get('/ads', asyncHandler(async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('service_ads').select(AD_ADMIN_FIELDS).order('created_at', { ascending: false })
  if (error) {
    console.error('Failed to load ads:', error)
    res.status(500).json({ error: 'Failed to load ads' })
    return
  }
  res.json({ ads: data })
}))

// POST /api/admin/ads
router.post('/ads', asyncHandler(async (req, res) => {
  const parsed = adInput(req.body ?? {})
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const { data, error } = await supabaseAdmin.from('service_ads')
    .insert({ ...parsed.row, report_token: randomBytes(18).toString('base64url') }).select(AD_ADMIN_FIELDS).single()
  if (error) {
    console.error('Failed to create ad:', error)
    res.status(500).json({ error: 'Failed to create the ad' })
    return
  }
  res.status(201).json(data)
}))

// PUT /api/admin/ads/:id
router.put('/ads/:id', asyncHandler(async (req, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(404).json({ error: 'Ad not found' })
    return
  }
  const parsed = adInput(req.body ?? {})
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const { data, error } = await supabaseAdmin.from('service_ads').update(parsed.row).eq('id', id).select(AD_ADMIN_FIELDS).maybeSingle()
  if (error || !data) {
    if (error) console.error('Failed to update ad:', error)
    res.status(error ? 500 : 404).json({ error: error ? 'Failed to save the ad' : 'Ad not found' })
    return
  }
  res.json(data)
}))

// POST /api/admin/ads/:id/report-link — create or replace the advertiser's private report link
router.post('/ads/:id/report-link', asyncHandler(async (req, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(404).json({ error: 'Ad not found' })
    return
  }
  const { data, error } = await supabaseAdmin.from('service_ads')
    .update({ report_token: randomBytes(18).toString('base64url') }).eq('id', id).select('report_token').maybeSingle()
  if (error || !data) {
    if (error) console.error('Failed to create report link:', error)
    res.status(error ? 500 : 404).json({ error: error ? 'Failed to create the link' : 'Ad not found' })
    return
  }
  res.json(data)
}))

// DELETE /api/admin/ads/:id
router.delete('/ads/:id', asyncHandler(async (req, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(404).json({ error: 'Ad not found' })
    return
  }
  const { data, error } = await supabaseAdmin.from('service_ads').delete().eq('id', id).select('id').maybeSingle()
  if (error || !data) {
    if (error) console.error('Failed to delete ad:', error)
    res.status(error ? 500 : 404).json({ error: error ? 'Failed to delete the ad' : 'Ad not found' })
    return
  }
  res.json({ ok: true })
}))

// ---------------------------------------------------------------------------
// License verification: staff check a professional's number on the state's public lookup
// (DRE for agents and brokers, State Bar for attorneys), then mark it verified. Homeowners see
// "License verified" only after this. A professional changing their number or type clears it.
// ---------------------------------------------------------------------------
const LICENSE_FIELDS = 'id, full_name, email, business_name, professional_type, license_number, license_verified, license_verified_at, license_verified_by, listed, created_at'

type LicenseRow = { license_verified_by: string | null } & Record<string, unknown>

// Adds verified_by_name (the staff member's name or email) to each row
async function withVerifierNames<T extends LicenseRow>(rows: T[]): Promise<(T & { verified_by_name: string | null })[]> {
  const ids = [...new Set(rows.map(r => r.license_verified_by).filter((id): id is string => Boolean(id)))]
  const names = await adminNames(ids)
  return rows.map(r => ({ ...r, verified_by_name: r.license_verified_by ? names.get(r.license_verified_by) ?? 'Removed admin' : null }))
}

async function adminNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', ids)
  if (error) throw error
  return new Map((data ?? []).map(p => [p.id as string, (p.full_name as string | null) || (p.email as string)]))
}

// GET /api/admin/licenses?status=pending|verified|missing|all
router.get('/licenses', asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending'
  let query = supabaseAdmin.from('profiles').select(LICENSE_FIELDS)
    .eq('role', 'investor').in('professional_type', LICENSED_TYPES as string[])
    .order('created_at', { ascending: true }).limit(500)
  if (status === 'pending') query = query.eq('license_verified', false).not('license_number', 'is', null)
  else if (status === 'verified') query = query.eq('license_verified', true)
  else if (status === 'missing') query = query.is('license_number', null)
  else if (status !== 'all') {
    res.status(400).json({ error: 'Unknown status filter' })
    return
  }
  const { data, error } = await query
  if (error) {
    console.error('Failed to load licenses:', error)
    res.status(500).json({ error: 'Failed to load licenses' })
    return
  }
  res.json({ professionals: await withVerifierNames(data as LicenseRow[]) })
}))

// GET /api/admin/licenses/:id/history — every check of this professional's license, newest first
router.get('/licenses/:id/history', asyncHandler(async (req, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }
  const { data, error } = await supabaseAdmin.from('license_checks')
    .select('id, license_number, professional_type, action, admin_id, created_at')
    .eq('professional_id', id).order('created_at', { ascending: false }).limit(100)
  if (error) {
    console.error('Failed to load license history:', error)
    res.status(500).json({ error: 'Failed to load the history' })
    return
  }
  const names = await adminNames([...new Set(data.map(c => c.admin_id).filter((a): a is string => Boolean(a)))])
  res.json({
    checks: data.map(c => ({ ...c, admin_name: c.admin_id ? names.get(c.admin_id) ?? 'Removed admin' : null }))
  })
}))

// PATCH /api/admin/licenses/:id { verified, license_number } — license_number is the number the
// admin looked up; if the professional changed it meanwhile, the check is refused (409).
// set_license_verification (migration 008) records who and when, and writes the history row
// in the same transaction.
router.patch('/licenses/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  const { verified, license_number } = req.body ?? {}
  if (!UUID_RE.test(id) || typeof verified !== 'boolean' || typeof license_number !== 'string') {
    res.status(400).json({ error: 'Invalid request' })
    return
  }
  const { data: pro, error: proError } = await supabaseAdmin.from('profiles')
    .select('role, professional_type, license_number').eq('id', id).maybeSingle()
  if (proError) {
    console.error('Failed to load professional for license check:', proError)
    res.status(500).json({ error: 'Failed to update the license' })
    return
  }
  if (!pro || pro.role !== 'investor' || !LICENSED_TYPES.includes(pro.professional_type)) {
    res.status(404).json({ error: 'Licensed professional not found' })
    return
  }
  const changed = () => res.status(409).json({ error: 'Their license number changed while you were checking. Reload and check the new one.', code: 'license_changed' })
  if (!pro.license_number || pro.license_number !== license_number) {
    changed()
    return
  }
  // Conditional on the same number, so a change made at this moment isn't marked verified
  const { data: applied, error } = await supabaseAdmin.rpc('set_license_verification', {
    p_professional: id, p_license_number: license_number, p_verified: verified, p_admin: req.userId!
  })
  if (error) {
    console.error('Failed to update license verification:', error)
    res.status(500).json({ error: 'Failed to update the license' })
    return
  }
  if (!applied) {
    changed()
    return
  }
  const { data, error: readError } = await supabaseAdmin.from('profiles').select(LICENSE_FIELDS).eq('id', id).single()
  if (readError) {
    console.error('Failed to reload license after update:', readError)
    res.status(500).json({ error: 'Saved, but failed to reload. Please refresh.' })
    return
  }
  res.json((await withVerifierNames([data as LicenseRow]))[0])
}))

export default router
