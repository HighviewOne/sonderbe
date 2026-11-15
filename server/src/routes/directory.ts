import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'
import { professionalsWithAccess } from '../access.js'
import {
  COUNTIES, PROFESSIONAL_TYPES, LICENSED_TYPES, DIRECT_CONTACT_ONLY_TYPES, MAX_ACTIVE_CLAIMS,
  type ProfessionalType
} from '../matching.js'

// Homeowner-facing professional directory. Order is deliberately neutral (A–Z by
// business name): professionals can never pay for a higher spot (RESPA §8 / CFPB 2023).
const router = Router()

export type DirectoryEntry = {
  id: string
  full_name: string | null
  business_name: string | null
  professional_type: ProfessionalType
  bio: string | null
  website: string | null
  license_number: string | null
  license_verified: boolean
  licensed_profession: boolean
  direct_contact_only: boolean
  service_counties: string[]
  avatar_url: string | null
  brokerage: { name: string; logo_url: string | null } | null
  accepting: boolean
  // Only for direct-contact-only types (plain directory ads)
  email?: string
  phone?: string | null
}

// Professionals who are listed, have a type and pledge, and hold an active subscription.
// Returns null on a database error.
export async function listedProfessionals(filter: { county?: string; type?: string; id?: string; ids?: string[] }): Promise<DirectoryEntry[] | null> {
  let query = supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, phone, business_name, professional_type, bio, website, license_number, license_verified, service_counties, avatar_url, brokerage_id')
    .eq('role', 'investor')
    .eq('listed', true)
    .not('professional_type', 'is', null)
    .not('no_upfront_fee_pledged_at', 'is', null)
  if (filter.county) query = query.contains('service_counties', [filter.county])
  if (filter.type) query = query.eq('professional_type', filter.type)
  if (filter.id) query = query.eq('id', filter.id)
  if (filter.ids) query = query.in('id', filter.ids)

  const { data: pros, error } = await query
  if (error) {
    console.error('Failed to fetch directory:', error)
    return null
  }
  if (!pros || pros.length === 0) return []

  const ids = pros.map(p => p.id)
  const brokerageIds = [...new Set(pros.map(p => p.brokerage_id).filter((b): b is string => Boolean(b)))]
  const [active, claims, brokerages] = await Promise.all([
    professionalsWithAccess(ids),
    supabaseAdmin.from('match_requests').select('claimed_by').in('claimed_by', ids).eq('status', 'claimed'),
    brokerageIds.length
      ? supabaseAdmin.from('brokerages').select('id, name, logo_url').in('id', brokerageIds)
      : Promise.resolve({ data: [] as { id: string; name: string; logo_url: string | null }[], error: null })
  ])
  if (active === null || claims.error || brokerages.error) {
    console.error('Failed to fetch directory access/claims/brokerages:', claims.error || brokerages.error)
    return null
  }
  const brokerageById = new Map(brokerages.data.map(b => [b.id, { name: b.name, logo_url: b.logo_url }]))
  const claimCount = new Map<string, number>()
  for (const c of claims.data) claimCount.set(c.claimed_by, (claimCount.get(c.claimed_by) ?? 0) + 1)

  return pros
    .filter(p => active.has(p.id))
    .map(p => {
      const type = p.professional_type as ProfessionalType
      const direct = DIRECT_CONTACT_ONLY_TYPES.includes(type)
      const entry: DirectoryEntry = {
        id: p.id,
        full_name: p.full_name,
        business_name: p.business_name,
        professional_type: type,
        bio: p.bio,
        website: p.website,
        license_number: p.license_number,
        license_verified: LICENSED_TYPES.includes(type) && p.license_verified,
        licensed_profession: LICENSED_TYPES.includes(type),
        direct_contact_only: direct,
        service_counties: p.service_counties ?? [],
        avatar_url: p.avatar_url,
        brokerage: p.brokerage_id ? brokerageById.get(p.brokerage_id) ?? null : null,
        accepting: direct || (claimCount.get(p.id) ?? 0) < MAX_ACTIVE_CLAIMS
      }
      if (direct) {
        entry.email = p.email
        entry.phone = p.phone
      }
      return entry
    })
    .sort((a, b) =>
      (a.business_name || a.full_name || '').localeCompare(b.business_name || b.full_name || '') ||
      a.id.localeCompare(b.id))
}

// GET /api/directory?county=Los Angeles&type=agent
router.get('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const county = typeof req.query.county === 'string' ? req.query.county : ''
  const type = typeof req.query.type === 'string' && req.query.type ? req.query.type : undefined

  if (!COUNTIES.includes(county)) {
    res.status(400).json({ error: 'Please choose a supported county' })
    return
  }
  if (type && !(PROFESSIONAL_TYPES as readonly string[]).includes(type)) {
    res.status(400).json({ error: 'Unknown professional type' })
    return
  }

  const professionals = await listedProfessionals({ county, type })
  if (professionals === null) {
    res.status(500).json({ error: 'Failed to load the directory' })
    return
  }
  res.json({ professionals })
}))

export default router
