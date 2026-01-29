import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { adminOnly } from '../middleware/adminOnly.js'
import type { AuthenticatedRequest, Profile, ContactSubmission, Document, DistressedProperty, County, LeadType } from '../types.js'
import multer from 'multer'
import { parse } from 'csv-parse/sync'

const router = Router()

// All admin routes require auth + admin role
router.use(requireAuth, adminOnly)

// GET /api/admin/stats — dashboard counts + recent data
router.get('/stats', async (_req, res) => {
  const [clientsResult, submissionsResult, documentsResult] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('documents')
      .select('*')
      .eq('status', 'uploaded')
  ])

  const clients = (clientsResult.data || []) as Profile[]
  const submissions = (submissionsResult.data || []) as ContactSubmission[]
  const pendingDocs = documentsResult.data?.length || 0
  const newSubs = submissions.filter(s => s.status === 'new').length

  res.json({
    totalClients: clients.length,
    newSubmissions: newSubs,
    pendingDocuments: pendingDocs,
    recentClients: clients.slice(0, 5),
    recentSubmissions: submissions.slice(0, 5)
  })
})

// GET /api/admin/clients — all client profiles
router.get('/clients', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json(data)
})

// GET /api/admin/clients/:id — full client detail
router.get('/clients/:id', async (req, res) => {
  const clientId = req.params.id

  const [profileResult, submissionsResult, documentsResult, checklistResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', clientId).single(),
    supabaseAdmin.from('contact_submissions').select('*').eq('user_id', clientId).order('created_at', { ascending: false }),
    supabaseAdmin.from('documents').select('*').eq('user_id', clientId).order('created_at', { ascending: false }),
    supabaseAdmin.from('checklist_progress').select('*').eq('user_id', clientId)
  ])

  if (profileResult.error) {
    res.status(404).json({ error: 'Client not found' })
    return
  }

  res.json({
    profile: profileResult.data,
    submissions: submissionsResult.data || [],
    documents: documentsResult.data || [],
    checklist: checklistResult.data || []
  })
})

// GET /api/admin/documents — all documents with client names
router.get('/documents', async (_req, res) => {
  const { data: docs, error: docsError } = await supabaseAdmin
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (docsError) {
    res.status(500).json({ error: docsError.message })
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
})

// ============================================
// PROPERTY MANAGEMENT
// ============================================

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const VALID_COUNTIES: County[] = ['Los Angeles', 'Orange', 'Riverside', 'San Bernardino', 'San Diego', 'Ventura']
const VALID_LEAD_TYPES: LeadType[] = ['foreclosure_nod', 'foreclosure_not', 'probate', 'tax_lien', 'tax_sale']

// GET /api/admin/properties — list with pagination/filters
router.get('/properties', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100)
  const offset = (page - 1) * limit

  let query = supabaseAdmin.from('distressed_properties').select('*', { count: 'exact' })

  if (req.query.county) query = query.eq('county', req.query.county)
  if (req.query.lead_type) query = query.eq('lead_type', req.query.lead_type)
  if (req.query.status) query = query.eq('status', req.query.status)
  if (req.query.city) query = query.ilike('city', `%${req.query.city}%`)
  if (req.query.zip) query = query.eq('zip', req.query.zip)
  if (req.query.search) {
    query = query.or(`property_address.ilike.%${req.query.search}%,owner_name.ilike.%${req.query.search}%,apn.ilike.%${req.query.search}%`)
  }

  const sortBy = (req.query.sort_by as string) || 'created_at'
  const sortOrder = req.query.sort_order === 'asc'

  query = query.order(sortBy, { ascending: sortOrder }).range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({
    properties: data as DistressedProperty[],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
  })
})

// POST /api/admin/properties — create single property
router.post('/properties', async (req: AuthenticatedRequest, res) => {
  const property = req.body
  property.uploaded_by = req.userId

  if (!property.lead_type || !VALID_LEAD_TYPES.includes(property.lead_type)) {
    res.status(400).json({ error: 'Invalid or missing lead_type' })
    return
  }
  if (!property.county || !VALID_COUNTIES.includes(property.county)) {
    res.status(400).json({ error: 'Invalid or missing county' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('distressed_properties')
    .insert(property)
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(201).json(data)
})

// PUT /api/admin/properties/:id — update property
router.put('/properties/:id', async (req, res) => {
  const { id } = req.params
  const updates = { ...req.body, updated_at: new Date().toISOString() }
  delete updates.id
  delete updates.created_at

  const { data, error } = await supabaseAdmin
    .from('distressed_properties')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json(data)
})

// DELETE /api/admin/properties/:id
router.delete('/properties/:id', async (req, res) => {
  const { id } = req.params

  const { error } = await supabaseAdmin
    .from('distressed_properties')
    .delete()
    .eq('id', id)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({ success: true })
})

// POST /api/admin/properties/csv-upload — bulk import from CSV
router.post('/properties/csv-upload', csvUpload.single('file'), async (req: AuthenticatedRequest, res) => {
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
  } catch (e) {
    res.status(400).json({ error: 'Failed to parse CSV file' })
    return
  }

  if (records.length === 0) {
    res.status(400).json({ error: 'CSV file is empty' })
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
      res.status(500).json({ error: insertError.message })
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
})

// GET /api/admin/investors — list investors with subscription status
router.get('/investors', async (_req, res) => {
  const { data: investors, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('role', 'investor')
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
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

  const subMap = new Map(subscriptions.map((s: any) => [s.user_id, s]))

  const result = (investors as Profile[]).map(inv => ({
    ...inv,
    subscription: subMap.get(inv.id) || null
  }))

  res.json(result)
})

// GET /api/admin/csv-uploads — upload history
router.get('/csv-uploads', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('csv_uploads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json(data)
})

export default router
