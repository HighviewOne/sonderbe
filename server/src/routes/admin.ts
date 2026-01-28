import { Router } from 'express'
import { supabaseAdmin } from '../config.js'
import { requireAuth } from '../middleware/auth.js'
import { adminOnly } from '../middleware/adminOnly.js'
import type { Profile, ContactSubmission, Document } from '../types.js'

const router = Router()

// All admin routes require auth + admin role
router.use(requireAuth, adminOnly)

// GET /api/admin/stats — dashboard counts + recent data
router.get('/stats', async (_req, res) => {
  const [clientsResult, submissionsResult, documentsResult] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('documents')
      .select('*')
      .eq('status', 'uploaded')
  ])

  const clients = (clientsResult.data || []) as Profile[]
  const submissions = (submissionsResult.data || []) as ContactSubmission[]
  const pendingDocs = documentsResult.data?.length || 0
  const newSubs = submissions.filter(s => s.status === 'new').length

  res.json({
    totalClients: clients.length,
    newSubmissions: newSubs,
    pendingDocuments: pendingDocs,
    recentClients: clients.slice(0, 5),
    recentSubmissions: submissions.slice(0, 5)
  })
})

// GET /api/admin/clients — all client profiles
router.get('/clients', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json(data)
})

// GET /api/admin/clients/:id — full client detail
router.get('/clients/:id', async (req, res) => {
  const clientId = req.params.id

  const [profileResult, submissionsResult, documentsResult, checklistResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', clientId).single(),
    supabaseAdmin.from('contact_submissions').select('*').eq('user_id', clientId).order('created_at', { ascending: false }),
    supabaseAdmin.from('documents').select('*').eq('user_id', clientId).order('created_at', { ascending: false }),
    supabaseAdmin.from('checklist_progress').select('*').eq('user_id', clientId)
  ])

  if (profileResult.error) {
    res.status(404).json({ error: 'Client not found' })
    return
  }

  res.json({
    profile: profileResult.data,
    submissions: submissionsResult.data || [],
    documents: documentsResult.data || [],
    checklist: checklistResult.data || []
  })
})

// GET /api/admin/documents — all documents with client names
router.get('/documents', async (_req, res) => {
  const { data: docs, error: docsError } = await supabaseAdmin
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (docsError) {
    res.status(500).json({ error: docsError.message })
    return
  }

  const typedDocs = docs as Document[]
  const userIds = [...new Set(typedDocs.map(d => d.user_id))]

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .in('id', userIds)

  const profileMap = new Map((profiles as Profile[] || []).map(p => [p.id, p]))

  const docsWithClients = typedDocs.map(doc => ({
    ...doc,
    client: profileMap.get(doc.user_id) || null
  }))

  res.json(docsWithClients)
})

export default router
