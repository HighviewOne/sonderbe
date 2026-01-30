import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth, optionalAuth } from '../middleware/auth.js'
import { adminOnly } from '../middleware/adminOnly.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'

const router = Router()

// GET /api/submissions — own (client) or all (admin)
router.get('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  let query = supabaseAdmin
    .from('contact_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  if (req.userRole !== 'admin') {
    query = query.eq('user_id', req.userId!)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch submissions:', error)
    res.status(500).json({ error: 'Failed to fetch submissions' })
    return
  }
  res.json(data)
}))

// POST /api/submissions — create submission (auth optional)
router.post('/', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { name, email, phone, situation, message } = req.body

  if (!name || !email || !phone || !situation) {
    res.status(400).json({ error: 'name, email, phone, and situation are required' })
    return
  }

  // Input validation
  if (typeof name !== 'string' || name.length > 200) {
    res.status(400).json({ error: 'Invalid name' })
    return
  }
  if (typeof email !== 'string' || email.length > 254 || !email.includes('@')) {
    res.status(400).json({ error: 'Invalid email' })
    return
  }
  if (typeof phone !== 'string' || phone.length > 30) {
    res.status(400).json({ error: 'Invalid phone' })
    return
  }
  if (typeof situation !== 'string' || situation.length > 500) {
    res.status(400).json({ error: 'Invalid situation' })
    return
  }
  if (message !== undefined && message !== null && (typeof message !== 'string' || message.length > 5000)) {
    res.status(400).json({ error: 'Invalid message' })
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
    console.error('Failed to create submission:', error)
    res.status(500).json({ error: 'Failed to create submission' })
    return
  }
  res.status(201).json(data)
}))

// PATCH /api/submissions/:id — update status/notes (admin only)
router.patch('/:id', requireAuth, adminOnly, asyncHandler(async (req: AuthenticatedRequest, res) => {
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
    console.error('Failed to update submission:', error)
    res.status(500).json({ error: 'Failed to update submission' })
    return
  }
  res.json(data)
}))

export default router
