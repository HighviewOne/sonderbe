import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { adminOnly } from '../middleware/adminOnly.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'

const router = Router()

// GET /api/checklist — own checklist
router.get('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('checklist_progress')
    .select('*')
    .eq('user_id', req.userId!)

  if (error) {
    console.error('Failed to fetch checklist:', error)
    res.status(500).json({ error: 'Failed to fetch checklist' })
    return
  }
  res.json(data)
}))

// PUT /api/checklist — toggle item (upsert)
router.put('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { category_index, item_index, is_checked } = req.body

  if (category_index === undefined || item_index === undefined || is_checked === undefined) {
    res.status(400).json({ error: 'category_index, item_index, and is_checked are required' })
    return
  }

  // Type validation
  if (typeof category_index !== 'number' || typeof item_index !== 'number' || typeof is_checked !== 'boolean') {
    res.status(400).json({ error: 'category_index and item_index must be numbers, is_checked must be boolean' })
    return
  }

  // Bounds checking (5 categories, reasonable item limit)
  if (category_index < 0 || category_index > 20 || item_index < 0 || item_index > 50) {
    res.status(400).json({ error: 'Index values out of range' })
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
    console.error('Failed to update checklist:', error)
    res.status(500).json({ error: 'Failed to update checklist' })
    return
  }
  res.json(data)
}))

// GET /api/checklist/:userId — client's checklist (admin only)
router.get('/:userId', requireAuth, adminOnly, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('checklist_progress')
    .select('*')
    .eq('user_id', req.params.userId)

  if (error) {
    console.error('Failed to fetch client checklist:', error)
    res.status(500).json({ error: 'Failed to fetch checklist' })
    return
  }
  res.json(data)
}))

export default router
