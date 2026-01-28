import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'
import { adminOnly } from '../middleware/adminOnly.js'
import type { AuthenticatedRequest } from '../types.js'

const router = Router()

// GET /api/submissions — own (client) or all (admin)
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  let query = supabaseAdmin
    .from('contact_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  if (req.userRole !== 'admin') {
    query = query.eq('user_id', req.userId!)
  }

  const { data, error } = await query

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json(data)
})

// POST /api/submissions — create submission (auth optional)
router.post('/', optionalAuth, async (req: AuthenticatedRequest, res) => {
  const { name, email, phone, situation, message } = req.body

  if (!name || !email || !phone || !situation) {
    res.status(400).json({ error: 'name, email, phone, and situation are required' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('contact_submissions')
    .insert({
      user_id: req.userId || null,
      name,
      email,
      phone,
      situation,
      message: message || null,
      status: 'new'
    })
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.status(201).json(data)
})

// PATCH /api/submissions/:id — update status/notes (admin only)
router.patch('/:id', requireAuth, adminOnly, async (req: AuthenticatedRequest, res) => {
  const { status, admin_notes } = req.body

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  }
  if (status !== undefined) updateData.status = status
  if (admin_notes !== undefined) updateData.admin_notes = admin_notes

  const { data, error } = await supabaseAdmin
    .from('contact_submissions')
    .update(updateData)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json(data)
})

export default router
