import { Router } from 'express'
import multer from 'multer'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { adminOnly } from '../middleware/adminOnly.js'
import type { AuthenticatedRequest } from '../types.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})

// GET /api/documents — own documents
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('user_id', req.userId!)
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json(data)
})

// POST /api/documents/upload — upload file
router.post('/upload', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file provided' })
    return
  }

  const category = req.body.category || null
  const fileName = `${req.userId}/${Date.now()}-${req.file.originalname}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('client-documents')
    .upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype
    })

  if (uploadError) {
    res.status(500).json({ error: 'Failed to upload file' })
    return
  }

  const { data: docData, error: docError } = await supabaseAdmin
    .from('documents')
    .insert({
      user_id: req.userId!,
      file_name: req.file.originalname,
      file_path: fileName,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      category,
      status: 'uploaded'
    })
    .select()
    .single()

  if (docError) {
    res.status(500).json({ error: 'Failed to save document metadata' })
    return
  }
  res.status(201).json(docData)
})

// DELETE /api/documents/:id — delete own document
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  // Fetch the document first to verify ownership and get file_path
  const { data: doc, error: fetchError } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)
    .single()

  if (fetchError || !doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  // Delete from storage
  await supabaseAdmin.storage
    .from('client-documents')
    .remove([doc.file_path])

  // Delete from database
  const { error: deleteError } = await supabaseAdmin
    .from('documents')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.userId!)

  if (deleteError) {
    res.status(500).json({ error: 'Failed to delete document' })
    return
  }
  res.json({ success: true })
})

// GET /api/documents/:id/download — signed download URL
router.get('/:id/download', requireAuth, async (req: AuthenticatedRequest, res) => {
  // Fetch document — allow own documents or admin
  let query = supabaseAdmin
    .from('documents')
    .select('*')
    .eq('id', req.params.id)

  if (req.userRole !== 'admin') {
    query = query.eq('user_id', req.userId!)
  }

  const { data: doc, error } = await query.single()

  if (error || !doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  const { data: urlData, error: urlError } = await supabaseAdmin.storage
    .from('client-documents')
    .createSignedUrl(doc.file_path, 3600)

  if (urlError || !urlData) {
    res.status(500).json({ error: 'Failed to generate download URL' })
    return
  }

  res.json({ url: urlData.signedUrl })
})

// GET /api/documents/user/:userId — client's documents (admin only)
router.get('/user/:userId', requireAuth, adminOnly, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('user_id', req.params.userId)
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json(data)
})

// PATCH /api/documents/:id — update status/notes (admin only)
router.patch('/:id', requireAuth, adminOnly, async (req, res) => {
  const { status, admin_notes } = req.body

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  }
  if (status !== undefined) updateData.status = status
  if (admin_notes !== undefined) updateData.admin_notes = admin_notes

  const { data, error } = await supabaseAdmin
    .from('documents')
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
