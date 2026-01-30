import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { adminOnly } from '../middleware/adminOnly.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'

const router = Router()

// GET /api/profile — own profile
router.get('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.userId!)
    .single()

  if (error) {
    console.error('Failed to fetch profile:', error)
    res.status(error.code === 'PGRST116' ? 404 : 500).json({
      error: error.code === 'PGRST116' ? 'Profile not found' : 'Failed to fetch profile'
    })
    return
  }
  res.json(data)
}))

// GET /api/profile/:id — any profile (admin only)
router.get('/:id', requireAuth, adminOnly, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.params.id)
    .single()

  if (error) {
    console.error('Failed to fetch profile:', error)
    res.status(error.code === 'PGRST116' ? 404 : 500).json({
      error: error.code === 'PGRST116' ? 'Profile not found' : 'Failed to fetch profile'
    })
    return
  }
  res.json(data)
}))

export default router
