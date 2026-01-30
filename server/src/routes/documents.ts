import { Router } from 'express'
import multer from 'multer'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { adminOnly } from '../middleware/adminOnly.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain'
])

function sanitizeFilename(name: string): string {
  return name
    .replace(/\\/g, '')
    .replace(/\//g, '')
    .replace(/\.\./g, '')
    .replace(/\0/g, '')
}

// GET /api/documents — own documents
router.get('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('user_id', req.userId!)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch documents:', error)
    res.status(500).json({ error: 'Failed to fetch documents' })
    return
  }
  res.json(data)
}))

// POST /api/documents/upload — upload file
router.post('/upload', requireAuth, upload.single('file'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file provided' })
    return
  }

  if (!ALLOWED_MIME_TYPES.has(req.file.mimetype)) {
    res.status(400).json({ error: 'File type not allowed' })
    return
  }

  const category = req.body.category || null
  const sanitized = sanitizeFilename(req.file.originalname)
  const fileName = `${req.userId}/${Date.now()}-${sanitized}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('client-documents')
    .upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype
    })

  if (uploadError) {
    console.error('Storage upload failed:', uploadError)
    res.status(500).json({ error: 'Failed to upload file' })
    return
  }

  const { data: docData, error: docError } = await supabaseAdmin
    .from('documents')
    .insert({
      user_id: req.userId!,
      file_name: sanitized,
      file_path: fileName,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      category,
      status: 'uploaded'
    })
    .select()
    .single()

  if (docError) {
    console.error('Document metadata save failed:', docError)
    res.status(500).json({ error: 'Failed to save document metadata' })
    return
  }
  res.status(201).json(docData)
}))

// DELETE /api/documents/:id — delete own document
router.delete('/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
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
    console.error('Document delete failed:', deleteError)
    res.status(500).json({ error: 'Failed to delete document' })
    return
  }
  res.json({ success: true })
}))

// GET /api/documents/:id/download — signed download URL
router.get('/:id/download', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
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
    console.error('Signed URL generation failed:', urlError)
    res.status(500).json({ error: 'Failed to generate download URL' })
    return
  }

  res.json({ url: urlData.signedUrl })
}))

// GET /api/documents/user/:userId — client's documents (admin only)
router.get('/user/:userId', requireAuth, adminOnly, asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('*')
    .eq('user_id', req.params.userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch user documents:', error)
    res.status(500).json({ error: 'Failed to fetch documents' })
    return
  }
  res.json(data)
}))

// PATCH /api/documents/:id — update status/notes (admin only)
router.patch('/:id', requireAuth, adminOnly, asyncHandler(async (req, res) => {
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
    console.error('Document update failed:', error)
    res.status(500).json({ error: 'Failed to update document' })
    return
  }
  res.json(data)
}))

export default router
