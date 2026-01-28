import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { adminOnly } from '../middleware/adminOnly.js'
import type { AuthenticatedRequest } from '../types.js'

const router = Router()

// GET /api/checklist — own checklist
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('checklist_progress')
    .select('*')
    .eq('user_id', req.userId!)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json(data)
})

// PUT /api/checklist — toggle item (upsert)
router.put('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { category_index, item_index, is_checked } = req.body

  if (category_index === undefined || item_index === undefined || is_checked === undefined) {
    res.status(400).json({ error: 'category_index, item_index, and is_checked are required' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('checklist_progress')
    .upsert({
      user_id: req.userId!,
      category_index,
      item_index,
      is_checked,
      checked_at: is_checked ? new Date().toISOString() : null
    }, {
      onConflict: 'user_id,category_index,item_index'
    })
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json(data)
})

// GET /api/checklist/:userId — client's checklist (admin only)
router.get('/:userId', requireAuth, adminOnly, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('checklist_progress')
    .select('*')
    .eq('user_id', req.params.userId)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json(data)
})

export default router
