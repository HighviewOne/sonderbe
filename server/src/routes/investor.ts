import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { investorOnly } from '../middleware/investorOnly.js'
import type { AuthenticatedRequest, DistressedProperty } from '../types.js'

const router = Router()

router.use(requireAuth, investorOnly)

// GET /api/investor/properties — search/filter with pagination
router.get('/properties', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = Math.min(parseInt(req.query.limit as string) || 25, 100)
  const offset = (page - 1) * limit

  let query = supabaseAdmin.from('distressed_properties').select('*', { count: 'exact' })

  // Only show active properties to investors
  query = query.eq('status', 'active')

  if (req.query.county) query = query.eq('county', req.query.county)
  if (req.query.lead_type) query = query.eq('lead_type', req.query.lead_type)
  if (req.query.city) query = query.ilike('city', `%${req.query.city}%`)
  if (req.query.zip) query = query.eq('zip', req.query.zip)
  if (req.query.min_equity) query = query.gte('estimated_equity', parseFloat(req.query.min_equity as string))
  if (req.query.max_equity) query = query.lte('estimated_equity', parseFloat(req.query.max_equity as string))
  if (req.query.date_from) query = query.gte('recording_date', req.query.date_from)
  if (req.query.date_to) query = query.lte('recording_date', req.query.date_to)
  if (req.query.search) {
    query = query.or(`property_address.ilike.%${req.query.search}%,owner_name.ilike.%${req.query.search}%,apn.ilike.%${req.query.search}%,city.ilike.%${req.query.search}%`)
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

// GET /api/investor/properties/:id — single property detail
router.get('/properties/:id', async (req, res) => {
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
})

// GET /api/investor/stats — dashboard counts
router.get('/stats', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('distressed_properties')
    .select('lead_type')
    .eq('status', 'active')

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const counts: Record<string, number> = {
    foreclosure_nod: 0,
    foreclosure_not: 0,
    probate: 0,
    tax_lien: 0,
    tax_sale: 0,
    total: 0
  }

  for (const row of data) {
    counts[row.lead_type] = (counts[row.lead_type] || 0) + 1
    counts.total++
  }

  // Get recent additions
  const { data: recent } = await supabaseAdmin
    .from('distressed_properties')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10)

  res.json({ counts, recent: recent || [] })
})

// GET /api/investor/subscription — current subscription status
router.get('/subscription', async (req: AuthenticatedRequest, res) => {
  const { data } = await supabaseAdmin
    .from('investor_subscriptions')
    .select('*')
    .eq('user_id', req.userId!)
    .single()

  res.json(data || { status: 'inactive' })
})

export default router
