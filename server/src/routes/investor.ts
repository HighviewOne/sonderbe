import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { investorOnly } from '../middleware/investorOnly.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest, DistressedProperty } from '../types.js'

const router = Router()

router.use(requireAuth, investorOnly)

const ALLOWED_SORT_COLUMNS = new Set([
  'created_at', 'updated_at', 'property_address', 'city', 'zip',
  'county', 'lead_type', 'estimated_value', 'estimated_equity',
  'outstanding_debt', 'opening_bid', 'recording_date', 'sale_date'
])

// GET /api/investor/properties — search/filter with pagination
router.get('/properties', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 25), 100)
  const offset = (page - 1) * limit

  let query = supabaseAdmin.from('distressed_properties').select('*', { count: 'exact' })

  // Only show active properties to investors
  query = query.eq('status', 'active')

  if (req.query.county) query = query.eq('county', req.query.county)
  if (req.query.lead_type) query = query.eq('lead_type', req.query.lead_type)
  if (req.query.city) query = query.ilike('city', `%${req.query.city}%`)
  if (req.query.zip) query = query.eq('zip', req.query.zip)
  if (req.query.min_equity) {
    const val = parseFloat(req.query.min_equity as string)
    if (!isNaN(val)) query = query.gte('estimated_equity', val)
  }
  if (req.query.max_equity) {
    const val = parseFloat(req.query.max_equity as string)
    if (!isNaN(val)) query = query.lte('estimated_equity', val)
  }
  if (req.query.date_from) query = query.gte('recording_date', req.query.date_from)
  if (req.query.date_to) query = query.lte('recording_date', req.query.date_to)
  if (req.query.search) {
    const search = (req.query.search as string).replace(/[,%]/g, '').slice(0, 200)
    query = query.or(`property_address.ilike.%${search}%,owner_name.ilike.%${search}%,apn.ilike.%${search}%,city.ilike.%${search}%`)
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

// GET /api/investor/properties/:id — single property detail
router.get('/properties/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('distressed_properties')
    .select('*')
    .eq('id', req.params.id)
    .eq('status', 'active')
    .single()

  if (error) {
    res.status(404).json({ error: 'Property not found' })
    return
  }

  res.json(data)
}))

const LEAD_TYPES = ['foreclosure_nod', 'foreclosure_not', 'probate', 'tax_lien', 'tax_sale'] as const

// GET /api/investor/stats — dashboard counts
router.get('/stats', asyncHandler(async (_req, res) => {
  const countQueries = LEAD_TYPES.map(lt =>
    supabaseAdmin.from('distressed_properties').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('lead_type', lt)
  )

  const [totalResult, ...typeResults] = await Promise.all([
    supabaseAdmin.from('distressed_properties').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ...countQueries,
    // recent is last — but we need to handle it separately
  ])

  if (totalResult.error) {
    console.error('Failed to fetch property stats:', totalResult.error)
    res.status(500).json({ error: 'Failed to fetch stats' })
    return
  }

  const counts: Record<string, number> = { total: totalResult.count || 0 }
  LEAD_TYPES.forEach((lt, i) => { counts[lt] = typeResults[i].count || 0 })

  const { data: recent } = await supabaseAdmin
    .from('distressed_properties')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10)

  res.json({ counts, recent: recent || [] })
}))

// GET /api/investor/subscription — current subscription status
router.get('/subscription', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data } = await supabaseAdmin
    .from('investor_subscriptions')
    .select('*')
    .eq('user_id', req.userId!)
    .single()

  res.json(data || { status: 'inactive' })
}))

export default router
