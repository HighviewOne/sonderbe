import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost } from '../../lib/api'
import { docStatus } from '../../lib/docStatus'
import type { CaseDocument, CaseNote } from '../../hooks/useMatch'
import { ProDocumentRow } from './ProDocumentRow'

type ClientCase = {
  id: string
  contact_name: string
  status: string
  documents: CaseDocument[]
  notes: CaseNote[]
  unread_notes: number
}

type Filter = 'review' | 'waiting' | 'stale' | 'received' | 'all'
const FILTERS: { value: Filter; label: string; empty: string }[] = [
  { value: 'review', label: 'To review', empty: 'Nothing to review. When a client marks a document sent, it shows up here.' },
  { value: 'waiting', label: 'Waiting on clients', empty: 'No documents waiting on clients.' },
  { value: 'stale', label: 'Due for update', empty: 'No documents are due for an update.' },
  { value: 'received', label: 'Received', empty: 'Nothing received yet.' },
  { value: 'all', label: 'All', empty: 'No documents requested yet. Open a client to build their list.' }
]

// Every client's document checklist in one place, so a professional with many clients
// can work through what needs attention instead of opening each case
export function ProDocuments() {
  const [cases, setCases] = useState<ClientCase[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('review')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  // No synchronous setState here — it runs from the mount effect
  const fetchCases = useCallback(() => {
    apiGet<{ mine: ClientCase[] }>('/leads')
      .then(res => {
        setCases(res.mine.filter(c => c.status === 'claimed'))
        setError(null)
      })
      .catch(err => {
        console.error('Error loading documents:', err)
        setError('Failed to load documents. Please refresh.')
      })
  }, [])

  useEffect(() => {
    fetchCases()
  }, [fetchCases])

  if (error) return <div className="error-message">{error}</div>
  if (!cases) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading documents...</p>
      </div>
    )
  }

  const all = cases.flatMap(c => c.documents)
  const counts: Record<Filter, number> = {
    review: all.filter(d => docStatus(d) === 'review').length,
    waiting: all.filter(d => docStatus(d) === 'waiting').length,
    stale: all.filter(d => docStatus(d) === 'stale').length,
    received: all.filter(d => docStatus(d) === 'received').length,
    all: all.length
  }
  const q = search.trim().toLowerCase()
  const groups = cases
    .filter(c => !q || c.contact_name.toLowerCase().includes(q))
    .map(c => ({ c, docs: c.documents.filter(d => filter === 'all' || docStatus(d) === filter) }))
    .filter(g => g.docs.length > 0)

  const requestUpdates = async (caseId: string) => {
    setBusy(caseId)
    try {
      await apiPost(`/leads/${caseId}/documents/request-updates`)
      fetchCases()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to request updates')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="pro-documents">
      <div className="page-header">
        <h1>Documents</h1>
        <p>
          Every client's checklist in one place. Check off what you receive, ask again when you need a fresh or
          corrected copy, and leave a note when something needs clarifying.
        </p>
      </div>

      <div className="dashboard-card">
        <div className="type-filter" role="tablist" aria-label="Show documents">
          {FILTERS.map(f => (
            <button key={f.value} type="button" role="tab" aria-selected={filter === f.value}
              className={`type-chip ${filter === f.value ? 'active' : ''}`} onClick={() => setFilter(f.value)}>
              {f.label} ({counts[f.value]})
            </button>
          ))}
        </div>
        {cases.length > 3 && (
          <input className="client-search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Find a client" aria-label="Find a client" />
        )}
      </div>

      {cases.length === 0 ? (
        <p className="empty-state">No active clients yet.</p>
      ) : groups.length === 0 ? (
        <p className="empty-state">{FILTERS.find(f => f.value === filter)!.empty}</p>
      ) : (
        groups.map(({ c, docs }) => {
          const first = c.contact_name.split(/\s+/)[0]
          const stale = c.documents.filter(d => d.stale).length
          return (
            <section key={c.id} className="dashboard-card client-docs">
              <div className="card-header">
                <h2>{c.contact_name}{c.unread_notes > 0 && <span className="unread-badge">{c.unread_notes} new note{c.unread_notes === 1 ? '' : 's'}</span>}</h2>
                <Link to={`/investor/clients#case-${c.id}`} className="card-link">Open client</Link>
              </div>
              {stale > 0 && (filter === 'stale' || filter === 'all') && (
                <button type="button" className="btn btn-primary btn-small" disabled={busy === c.id} onClick={() => requestUpdates(c.id)}>
                  Ask {first} for all updated copies ({stale})
                </button>
              )}
              <ul className="doc-checklist">
                {docs.map(doc => (
                  <ProDocumentRow
                    key={doc.id}
                    caseId={c.id}
                    doc={doc}
                    firstName={first}
                    notes={c.notes.filter(n => n.document_id === doc.id)}
                    unread={c.unread_notes > 0 && c.notes.some(n => n.document_id === doc.id && n.author_role === 'homeowner')}
                    onChanged={fetchCases}
                    onNote={async (body, documentId) => {
                      await apiPost(`/leads/${c.id}/notes`, { body, document_id: documentId })
                      fetchCases()
                    }}
                  />
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
