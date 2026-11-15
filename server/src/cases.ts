import { supabaseAdmin } from './config.js'

export type CaseEvent = { id: string; stage: string; note: string | null; created_at: string; by_homeowner: boolean }
export type CaseDocument = {
  id: string
  label: string
  sort_order: number
  homeowner_note: string | null
  sent_at: string | null
  received_at: string | null
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Timeline + document checklist for a set of match requests. Returns null on a DB error.
export async function caseDetails(requests: { id: string; homeowner_id: string }[]):
  Promise<Map<string, { events: CaseEvent[]; documents: CaseDocument[] }> | null> {
  const result = new Map<string, { events: CaseEvent[]; documents: CaseDocument[] }>()
  if (requests.length === 0) return result
  const ids = requests.map(r => r.id)
  const homeownerOf = new Map(requests.map(r => [r.id, r.homeowner_id]))

  const [events, documents] = await Promise.all([
    supabaseAdmin
      .from('case_events')
      .select('id, match_request_id, stage, note, created_by, created_at')
      .in('match_request_id', ids)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('case_documents')
      .select('id, match_request_id, label, sort_order, homeowner_note, sent_at, received_at')
      .in('match_request_id', ids)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
  ])
  if (events.error || documents.error) {
    console.error('Failed to fetch case details:', events.error || documents.error)
    return null
  }

  for (const id of ids) result.set(id, { events: [], documents: [] })
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
    result.get(d.match_request_id)!.documents.push({
      id: d.id,
      label: d.label,
      sort_order: d.sort_order,
      homeowner_note: d.homeowner_note,
      sent_at: d.sent_at,
      received_at: d.received_at
    })
  }
  return result
}

export async function addCaseEvent(matchRequestId: string, stage: string, note: string | null, createdBy: string) {
  const { error } = await supabaseAdmin
    .from('case_events')
    .insert({ match_request_id: matchRequestId, stage, note, created_by: createdBy })
  if (error) console.error('Failed to add case event:', error)
  return !error
}
