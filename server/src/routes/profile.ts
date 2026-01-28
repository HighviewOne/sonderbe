import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { adminOnly } from '../middleware/adminOnly.js'
import type { AuthenticatedRequest } from '../types.js'

const router = Router()

// GET /api/profile — own profile
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.userId!)
    .single()

  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message })
    return
  }
  res.json(data)
})

// GET /api/profile/:id — any profile (admin only)
router.get('/:id', requireAuth, adminOnly, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.params.id)
    .single()

  if (error) {
    res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message })
    return
  }
  res.json(data)
})

export default router
