import type { CaseDocument } from '../hooks/useMatch'

// Where a requested document stands, from the professional's side
export function docStatus(doc: CaseDocument): 'review' | 'waiting' | 'stale' | 'received' {
  if (doc.received_at) return doc.stale ? 'stale' : 'received'
  return doc.sent_at ? 'review' : 'waiting'
}
