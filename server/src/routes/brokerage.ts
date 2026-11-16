import { Router } from 'express'
import type { Response } from 'express'
import { randomBytes } from 'node:crypto'
import multer from 'multer'
import { supabaseAdmin } from '../config.js'
import { requireAuth, invalidateRoleCache } from '../middleware/auth.js'
import { investorOnly } from '../middleware/investorOnly.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AuthenticatedRequest } from '../types.js'
import { UUID_RE, closeCasesOfEnded } from '../cases.js'
import { uploadProfileImage, removeProfileImage } from '../images.js'

// Brokerages: a broker owns one and pays for it; agents join by invite link and are covered
// by the broker's subscription (see access.ts). The broker sees every client of the team.
const router = Router()
router.use(requireAuth)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BROKERAGE_FIELDS = 'id, owner_id, name, website, dre_number, logo_url'
const MAX_PENDING_INVITES = 50

async function myProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('profiles').select('id, email, full_name, role, professional_type, brokerage_id').eq('id', userId).single()
  if (error) console.error('Failed to load profile for brokerage:', error)
  return data
}

async function inviteByToken(token: unknown) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null
  const { data } = await supabaseAdmin
    .from('brokerage_invites').select('id, brokerage_id, email, accepted_at, revoked').eq('token', token).maybeSingle()
  return data && !data.revoked && !data.accepted_at ? data : null
}

// GET /api/brokerage/invite/:token — what the join page shows before accepting
router.get('/invite/:token', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const invite = await inviteByToken(req.params.token)
  if (!invite) {
    res.status(404).json({ error: 'This invite link is no longer valid. Ask your broker for a new one.' })
    return
  }
  const [{ data: brokerage }, me] = await Promise.all([
    supabaseAdmin.from('brokerages').select('name, logo_url').eq('id', invite.brokerage_id).single(),
    myProfile(req.userId!)
  ])
  res.json({
    brokerage,
    invited_email: invite.email,
    email_matches: me?.email?.toLowerCase() === invite.email.toLowerCase()
  })
}))

// POST /api/brokerage/join — { token } accept an invite with the account it was sent to
router.post('/join', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const invite = await inviteByToken(req.body?.token)
  if (!invite) {
    res.status(404).json({ error: 'This invite link is no longer valid. Ask your broker for a new one.' })
    return
  }
  const me = await myProfile(req.userId!)
  if (!me) {
    res.status(500).json({ error: 'Failed to join the brokerage' })
    return
  }
  if (me.email.toLowerCase() !== invite.email.toLowerCase()) {
    res.status(403).json({ error: `This invite was sent to ${invite.email}. Log in with that email to accept it.` })
    return
  }
  if (me.role === 'admin') {
    res.status(400).json({ error: 'Admin accounts cannot join a brokerage' })
    return
  }
  const { data: owned } = await supabaseAdmin.from('brokerages').select('id').eq('owner_id', me.id).maybeSingle()
  if (owned) {
    res.status(400).json({ error: 'You already run your own brokerage' })
    return
  }
  const { count: activeHomeownerCases } = await supabaseAdmin.from('match_requests')
    .select('id', { count: 'exact', head: true }).eq('homeowner_id', me.id).in('status', ['open', 'claimed'])
  if ((activeHomeownerCases ?? 0) > 0) {
    res.status(400).json({ error: 'This account has an active homeowner case. Use a separate account for your professional work.' })
    return
  }

  // Joining gives access through the broker: close cases from before this agent's access ended first
  if (await closeCasesOfEnded([me.id]) === null) {
    res.status(500).json({ error: 'Failed to join the brokerage' })
    return
  }

  // Claim the invite first so one link can't be used twice
  const { data: claimed, error: claimError } = await supabaseAdmin.from('brokerage_invites')
    .update({ accepted_by: me.id, accepted_at: new Date().toISOString() })
    .eq('id', invite.id).is('accepted_at', null).eq('revoked', false).select('id').maybeSingle()
  if (claimError || !claimed) {
    res.status(409).json({ error: 'This invite was just used. Ask your broker for a new one.' })
    return
  }
  const { error } = await supabaseAdmin.from('profiles').update({
    role: 'investor',
    brokerage_id: invite.brokerage_id,
    left_brokerage_at: null,
    professional_type: me.professional_type ?? 'agent'
  }).eq('id', me.id)
  if (error) {
    console.error('Failed to join brokerage:', error)
    res.status(500).json({ error: 'Failed to join the brokerage' })
    return
  }
  invalidateRoleCache(me.id)
  res.json({ ok: true })
}))

// Everything below: subscribed professionals (own subscription or covered by a brokerage)
router.use(investorOnly)

async function ownedBrokerage(userId: string) {
  const { data, error } = await supabaseAdmin.from('brokerages').select(BROKERAGE_FIELDS).eq('owner_id', userId).maybeSingle()
  if (error) console.error('Failed to load brokerage:', error)
  return { data, error }
}

async function requireOwner(req: AuthenticatedRequest, res: Response) {
  const { data, error } = await ownedBrokerage(req.userId!)
  if (error) {
    res.status(500).json({ error: 'Failed to load your brokerage' })
    return null
  }
  if (!data) {
    res.status(403).json({ error: 'Only the broker who runs the brokerage can do this' })
    return null
  }
  return data
}

// GET /api/brokerage — my brokerage as owner (with agents + invites) or as member
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const me = await myProfile(req.userId!)
  if (!me) {
    res.status(500).json({ error: 'Failed to load your brokerage' })
    return
  }
  const { data: owned, error } = await ownedBrokerage(me.id)
  if (error) {
    res.status(500).json({ error: 'Failed to load your brokerage' })
    return
  }
  if (owned) {
    const [agents, invites] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name, email, professional_type, avatar_url, listed')
        .eq('brokerage_id', owned.id).neq('id', me.id).order('full_name'),
      supabaseAdmin.from('brokerage_invites').select('id, email, token, created_at')
        .eq('brokerage_id', owned.id).is('accepted_at', null).eq('revoked', false).order('created_at', { ascending: false })
    ])
    if (agents.error || invites.error) {
      console.error('Failed to load brokerage team:', agents.error || invites.error)
      res.status(500).json({ error: 'Failed to load your brokerage' })
      return
    }
    res.json({ role: 'owner', brokerage: owned, agents: agents.data, invites: invites.data, can_create: false })
    return
  }
  if (me.brokerage_id) {
    const { data: brokerage } = await supabaseAdmin.from('brokerages').select(BROKERAGE_FIELDS).eq('id', me.brokerage_id).maybeSingle()
    res.json({ role: 'member', brokerage, agents: [], invites: [], can_create: false })
    return
  }
  res.json({ role: null, brokerage: null, agents: [], invites: [], can_create: me.professional_type === 'broker' })
}))

function brokerageInput(b: Record<string, unknown>): { error: string } | { row: Record<string, string | null> } {
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  if (!name || name.length > 120) return { error: 'Please enter the brokerage name (120 characters max)' }
  const website = typeof b.website === 'string' && b.website.trim() ? b.website.trim() : null
  if (website && (website.length > 200 || !/^https?:\/\/\S+$/i.test(website))) return { error: 'Website must start with http:// or https://' }
  const dre = typeof b.dre_number === 'string' && b.dre_number.trim() ? b.dre_number.trim() : null
  if (dre && dre.length > 40) return { error: 'DRE number must be 40 characters or fewer' }
  return { row: { name, website, dre_number: dre } }
}

// POST /api/brokerage — a broker creates their brokerage
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const me = await myProfile(req.userId!)
  if (!me || me.professional_type !== 'broker') {
    res.status(403).json({ error: 'Set your listing type to Real Estate Broker first' })
    return
  }
  if (me.brokerage_id) {
    res.status(400).json({ error: 'You already belong to a brokerage' })
    return
  }
  const parsed = brokerageInput(req.body ?? {})
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const { data, error } = await supabaseAdmin.from('brokerages').insert({ ...parsed.row, owner_id: me.id }).select(BROKERAGE_FIELDS).single()
  if (error) {
    console.error('Failed to create brokerage:', error)
    res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'You already run a brokerage' : 'Failed to create the brokerage' })
    return
  }
  await supabaseAdmin.from('profiles').update({ brokerage_id: data.id, left_brokerage_at: null }).eq('id', me.id)
  res.status(201).json(data)
}))

// PUT /api/brokerage
router.put('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const owned = await requireOwner(req, res)
  if (!owned) return
  const parsed = brokerageInput(req.body ?? {})
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error })
    return
  }
  const { data, error } = await supabaseAdmin.from('brokerages').update(parsed.row).eq('id', owned.id).select(BROKERAGE_FIELDS).single()
  if (error) {
    console.error('Failed to update brokerage:', error)
    res.status(500).json({ error: 'Failed to save the brokerage' })
    return
  }
  res.json(data)
}))

const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } })

// POST /api/brokerage/logo — multipart "file"
router.post('/logo', imageUpload.single('file'), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const owned = await requireOwner(req, res)
  if (!owned) return
  const url = await uploadProfileImage(req, res, `brokerages/${owned.id}/logo`)
  if (!url) return
  const { error } = await supabaseAdmin.from('brokerages').update({ logo_url: url }).eq('id', owned.id)
  if (error) {
    console.error('Failed to save logo url:', error)
    await removeProfileImage(url, `brokerages/${owned.id}/`)
    res.status(500).json({ error: 'Failed to save the logo' })
    return
  }
  await removeProfileImage(owned.logo_url, `brokerages/${owned.id}/`)
  res.json({ logo_url: url })
}))

// POST /api/brokerage/invites — { email } returns the invite (the broker sends the link)
router.post('/invites', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const owned = await requireOwner(req, res)
  if (!owned) return
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : ''
  if (!EMAIL_RE.test(email) || email.length > 254) {
    res.status(400).json({ error: "Please enter the agent's email address" })
    return
  }
  const { count } = await supabaseAdmin.from('brokerage_invites').select('id', { count: 'exact', head: true })
    .eq('brokerage_id', owned.id).is('accepted_at', null).eq('revoked', false)
  if ((count ?? 0) >= MAX_PENDING_INVITES) {
    res.status(400).json({ error: `You can have up to ${MAX_PENDING_INVITES} open invites` })
    return
  }
  const { data, error } = await supabaseAdmin.from('brokerage_invites')
    .insert({ brokerage_id: owned.id, email, token: randomBytes(24).toString('base64url') })
    .select('id, email, token, created_at').single()
  if (error) {
    console.error('Failed to create invite:', error)
    res.status(500).json({ error: 'Failed to create the invite' })
    return
  }
  res.status(201).json(data)
}))

// DELETE /api/brokerage/invites/:id — revoke an unused invite
router.delete('/invites/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid id' })
    return
  }
  const owned = await requireOwner(req, res)
  if (!owned) return
  const { data, error } = await supabaseAdmin.from('brokerage_invites').update({ revoked: true })
    .eq('id', id).eq('brokerage_id', owned.id).is('accepted_at', null).select('id').maybeSingle()
  if (error || !data) {
    res.status(error ? 500 : 404).json({ error: error ? 'Failed to revoke' : 'Invite not found' })
    return
  }
  res.json({ ok: true })
}))

// DELETE /api/brokerage/agents/:id — remove an agent from the team (they keep their account;
// without their own subscription they lose professional access)
router.delete('/agents/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = String(req.params.id)
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid id' })
    return
  }
  const owned = await requireOwner(req, res)
  if (!owned) return
  if (id === req.userId) {
    res.status(400).json({ error: "You can't remove yourself" })
    return
  }
  // Removed agents keep read-only access for 14 days to hand over their clients (access.ts)
  const { data, error } = await supabaseAdmin.from('profiles').update({ brokerage_id: null, left_brokerage_at: new Date().toISOString() })
    .eq('id', id).eq('brokerage_id', owned.id).select('id').maybeSingle()
  if (error || !data) {
    res.status(error ? 500 : 404).json({ error: error ? 'Failed to remove the agent' : 'Agent not found' })
    return
  }
  res.json({ ok: true })
}))

// POST /api/brokerage/leave — an agent leaves their brokerage
router.post('/leave', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { data: owned } = await ownedBrokerage(req.userId!)
  if (owned) {
    res.status(400).json({ error: 'You run this brokerage, so you cannot leave it' })
    return
  }
  const { error } = await supabaseAdmin.from('profiles').update({ brokerage_id: null, left_brokerage_at: new Date().toISOString() }).eq('id', req.userId!)
  if (error) {
    console.error('Failed to leave brokerage:', error)
    res.status(500).json({ error: 'Failed to leave the brokerage' })
    return
  }
  res.json({ ok: true })
}))

// GET /api/brokerage/clients — the broker's team overview: counts per agent, never homeowner names
// or details. Homeowners consented to share with the one professional they chose, not the brokerage.
router.get('/clients', asyncHandler(async (req: AuthenticatedRequest, res) => {
  const owned = await requireOwner(req, res)
  if (!owned) return
  const { data: team, error: teamError } = await supabaseAdmin.from('profiles')
    .select('id, full_name, email').eq('brokerage_id', owned.id).order('full_name')
  if (teamError) {
    console.error('Failed to load team:', teamError)
    res.status(500).json({ error: 'Failed to load team clients' })
    return
  }
  if (team.length === 0) {
    res.json({ agents: [] })
    return
  }
  const { data: cases, error } = await supabaseAdmin.from('match_requests')
    .select('id, claimed_by, stage').in('claimed_by', team.map(t => t.id)).eq('status', 'claimed')
  if (error) {
    console.error('Failed to load team clients:', error)
    res.status(500).json({ error: 'Failed to load team clients' })
    return
  }
  const { data: docs, error: docError } = cases.length
    ? await supabaseAdmin.from('case_documents').select('match_request_id, sent_at, received_at').in('match_request_id', cases.map(c => c.id))
    : { data: [] as { match_request_id: string; sent_at: string | null; received_at: string | null }[], error: null }
  if (docError) {
    console.error('Failed to load team documents:', docError)
    res.status(500).json({ error: 'Failed to load team clients' })
    return
  }
  const ownerOfCase = new Map(cases.map(c => [c.id, c.claimed_by as string]))
  res.json({
    agents: team.map(t => {
      const mine = cases.filter(c => c.claimed_by === t.id)
      const myDocs = (docs ?? []).filter(d => ownerOfCase.get(d.match_request_id) === t.id)
      const by_stage: Record<string, number> = {}
      for (const c of mine) by_stage[c.stage] = (by_stage[c.stage] ?? 0) + 1
      return {
        agent_id: t.id,
        agent_name: t.full_name || t.email,
        agent_is_me: t.id === req.userId,
        clients: mine.length,
        by_stage,
        documents_total: myDocs.length,
        documents_to_review: myDocs.filter(d => d.sent_at && !d.received_at).length,
        documents_received: myDocs.filter(d => d.received_at).length
      }
    })
  })
}))

export default router
