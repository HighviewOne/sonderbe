import { supabaseAdmin } from './config.js'
import { accessFor } from './access.js'
import type { Access } from './access.js'

export type CaseEvent = { id: string; stage: string; note: string | null; created_at: string; by_homeowner: boolean }
export type CaseDocument = {
  id: string
  label: string
  sort_order: number
  homeowner_note: string | null
  sent_at: string | null
  received_at: string | null
  doc_type: string | null
  household_member_id: string | null
  round: number
  refresh_days: number | null
  request_reason: string | null
  due_date: string | null
  last_received_at: string | null
  // Computed: the received copy is older than refresh_days
  stale: boolean
  expires_on: string | null
}

export type CaseNote = {
  id: string
  document_id: string | null
  author_role: 'homeowner' | 'professional'
  body: string
  created_at: string
}

export const DOC_FIELDS = 'id, match_request_id, label, sort_order, homeowner_note, sent_at, received_at, doc_type, household_member_id, round, refresh_days, request_reason, due_date, last_received_at'

type DocRow = {
  id: string; label: string; sort_order: number; homeowner_note: string | null; sent_at: string | null
  received_at: string | null; doc_type: string | null; household_member_id: string | null; round: number
  refresh_days: number | null; request_reason: string | null; due_date: string | null; last_received_at: string | null
}

// Shape a document row for the API, with its "due for an update" status
export function presentDocument(d: DocRow): CaseDocument {
  let expires: Date | null = null
  if (d.received_at && d.refresh_days) {
    expires = new Date(new Date(d.received_at).getTime() + d.refresh_days * 86_400_000)
  }
  return {
    id: d.id, label: d.label, sort_order: d.sort_order, homeowner_note: d.homeowner_note,
    sent_at: d.sent_at, received_at: d.received_at, doc_type: d.doc_type, household_member_id: d.household_member_id,
    round: d.round, refresh_days: d.refresh_days, request_reason: d.request_reason, due_date: d.due_date,
    last_received_at: d.last_received_at,
    stale: expires !== null && expires.getTime() < Date.now(),
    expires_on: expires ? expires.toISOString().slice(0, 10) : null
  }
}

export async function addDocHistory(
  documentId: string, matchRequestId: string, round: number,
  action: 'requested' | 'sent' | 'unsent' | 'received' | 'unreceived' | 'requested_again',
  actorId: string, reason: string | null = null
) {
  const { error } = await supabaseAdmin.from('case_document_history')
    .insert({ document_id: documentId, match_request_id: matchRequestId, round, action, actor_id: actorId, reason })
  if (error) console.error('Failed to record document history:', error)
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Timeline + document checklist for a set of match requests. Returns null on a DB error.
type Details = { events: CaseEvent[]; documents: CaseDocument[]; notes: CaseNote[] }

export async function caseDetails(requests: { id: string; homeowner_id: string }[]):
  Promise<Map<string, Details> | null> {
  const result = new Map<string, Details>()
  if (requests.length === 0) return result
  const ids = requests.map(r => r.id)
  const homeownerOf = new Map(requests.map(r => [r.id, r.homeowner_id]))

  const [events, documents, notes] = await Promise.all([
    supabaseAdmin
      .from('case_events')
      .select('id, match_request_id, stage, note, created_by, created_at')
      .in('match_request_id', ids)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('case_documents')
      .select(DOC_FIELDS)
      .in('match_request_id', ids)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('case_notes')
      .select('id, match_request_id, document_id, author_role, body, created_at')
      .in('match_request_id', ids)
      .order('created_at', { ascending: true })
  ])
  if (events.error || documents.error || notes.error) {
    console.error('Failed to fetch case details:', events.error || documents.error || notes.error)
    return null
  }

  for (const id of ids) result.set(id, { events: [], documents: [], notes: [] })
  for (const e of events.data) {
    result.get(e.match_request_id)!.events.push({
      id: e.id,
      stage: e.stage,
      note: e.note,
      created_at: e.created_at,
      by_homeowner: e.created_by === homeownerOf.get(e.match_request_id)
    })
  }
  for (const d of documents.data) {
    result.get(d.match_request_id)!.documents.push(presentDocument(d))
  }
  for (const n of notes.data) {
    result.get(n.match_request_id)!.notes.push({
      id: n.id, document_id: n.document_id, author_role: n.author_role, body: n.body, created_at: n.created_at
    })
  }
  return result
}

export async function addCaseEvent(matchRequestId: string, stage: string, note: string | null, createdBy: string | null) {
  const { error } = await supabaseAdmin
    .from('case_events')
    .insert({ match_request_id: matchRequestId, stage, note, created_by: createdBy })
  if (error) console.error('Failed to add case event:', error)
  return !error
}

// What the chosen professional sees from the homeowner's "My Information". Only for requests
// whose stored consent wording covers it (requests made before 004 agreed to less).
export const MY_INFORMATION_CONSENT_MARKER = 'My Information'

export async function homeownerDetails(homeownerIds: string[]) {
  const result = new Map<string, unknown>()
  if (homeownerIds.length === 0) return result
  const [info, emails, members] = await Promise.all([
    supabaseAdmin.from('homeowner_info')
      .select('user_id, property_street, property_unit, property_city, property_zip, property_county, mailing_same, mailing_street, mailing_unit, mailing_city, mailing_state, mailing_zip, alt_phone, preferred_contact, best_time, servicer_name, hardship_reasons, hardship_details')
      .in('user_id', homeownerIds),
    supabaseAdmin.from('homeowner_emails').select('user_id, email, label').in('user_id', homeownerIds).order('created_at'),
    supabaseAdmin.from('household_members')
      .select('user_id, id, is_self, full_name, relationship, on_mortgage, income_types, employer')
      .in('user_id', homeownerIds).order('is_self', { ascending: false }).order('sort_order')
  ])
  if (info.error || emails.error || members.error) {
    console.error('Failed to load homeowner details:', info.error || emails.error || members.error)
    return null
  }
  for (const id of homeownerIds) {
    const i = info.data.find(r => r.user_id === id)
    result.set(id, {
      info: i ? { ...i, user_id: undefined } : null,
      emails: emails.data.filter(e => e.user_id === id).map(({ email, label }) => ({ email, label })),
      household: members.data.filter(m => m.user_id === id).map(({ user_id: _u, ...m }) => m)
    })
  }
  return result
}

// Professional contact details a client sees on their case (from professional_info)
export async function professionalContact(ids: string[]) {
  const result = new Map<string, unknown>()
  if (ids.length === 0) return result
  const { data, error } = await supabaseAdmin.from('professional_info')
    .select('user_id, office_street, office_unit, office_city, office_state, office_zip, office_phone, fax, document_email, document_instructions, office_hours')
    .in('user_id', ids)
  if (error) {
    console.error('Failed to load professional contact info:', error)
    return result
  }
  for (const row of data) {
    const { user_id, ...rest } = row
    result.set(user_id, rest)
  }
  return result
}

// Close the open cases of professionals whose access is over (past read-only, or never subscribed).
// The policy is that these cases close when read-only ends. Nothing runs on a timer, so this is called
// wherever it matters: on homeowner and professional reads, and BEFORE anything that can restore a
// professional's access (a renewal, joining a brokerage), so a renewed professional never gets back
// a homeowner who consented while they were active. Agents of a broker among `ids` are included.
// `known` = access already looked up for these ids. Returns the closed request ids, or null on a DB error.
export async function closeCasesOfEnded(ids: string[], known?: Map<string, Access>): Promise<Set<string> | null> {
  const closed = new Set<string>()
  if (ids.length === 0) return closed
  const { data: owned, error: ownedError } = await supabaseAdmin.from('brokerages').select('id').in('owner_id', ids)
  if (ownedError) {
    console.error('Failed to load brokerages for case closing:', ownedError)
    return null
  }
  let all = ids
  if (owned.length) {
    const { data: agents, error: agentsError } = await supabaseAdmin.from('profiles').select('id').in('brokerage_id', owned.map(b => b.id))
    if (agentsError) {
      console.error('Failed to load agents for case closing:', agentsError)
      return null
    }
    all = [...new Set([...ids, ...agents.map(a => a.id as string)])]
  }
  const access = known && all.every(id => known.has(id)) ? known : await accessFor(all)
  if (access === null) return null
  const ended = all.filter(id => {
    const state = access.get(id)?.state
    return state === 'ended' || state === 'none'
  })
  if (ended.length === 0) return closed
  const { data: open, error } = await supabaseAdmin.from('match_requests')
    .select('id, stage').in('claimed_by', ended).eq('status', 'claimed')
  if (error) {
    console.error('Failed to load cases to close:', error)
    return null
  }
  await Promise.all(open.map(async r => {
    const { data: updated, error: closeError } = await supabaseAdmin.from('match_requests')
      .update({ status: 'closed', closed_reason: 'professional_inactive' })
      .eq('id', r.id).eq('status', 'claimed').select('id')
    if (closeError) {
      console.error('Failed to close case for inactive professional:', closeError)
      return
    }
    if (!updated?.length) return // closed by someone else in the meantime
    closed.add(r.id)
    // Written by SonderBe, not by either side
    await addCaseEvent(r.id, r.stage, 'Your professional is no longer on SonderBe, so this case was closed. You can choose someone new.', null)
  }))
  return closed
}
