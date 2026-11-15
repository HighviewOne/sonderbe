import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiGet, apiPatch, apiPost, apiDelete } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { CaseDocument, CaseNote } from '../../hooks/useMatch'
import { NotesThread } from '../case/NotesThread'
import { DocumentExample } from '../case/DocumentExample'
import { docStatus } from '../../lib/docStatus'

const REASONS = ["This month's copy, please", 'Some pages are missing', "It's hard to read", 'It needs your signature']
const REFRESH_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Doesn't expire" },
  { value: 30, label: 'Good for 30 days' },
  { value: 60, label: 'Good for 60 days' },
  { value: 90, label: 'Good for 90 days' },
  { value: 120, label: 'Good for 120 days' },
  { value: 365, label: 'Good for 1 year' }
]

type HistoryItem = { id: string; round: number; action: string; reason: string | null; created_at: string; by_me: boolean }
const ACTION_LABEL: Record<string, string> = {
  requested: 'Requested', sent: 'Client marked sent', unsent: 'Client unmarked sent',
  received: 'Marked received', unreceived: 'Unmarked received', requested_again: 'Requested again'
}

// One requested document, as the professional manages it
export function ProDocumentRow({ caseId, doc, firstName, notes, unread, onChanged, onNote, showClient }: {
  caseId: string
  doc: CaseDocument
  firstName: string
  notes: CaseNote[]
  unread: boolean
  onChanged: () => void
  onNote: (body: string, documentId: string) => Promise<void>
  showClient?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<'again' | 'notes' | 'history' | 'example' | 'settings' | null>(null)
  const [reason, setReason] = useState('')
  const [history, setHistory] = useState<HistoryItem[] | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChanged()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      return false
    } finally {
      setBusy(false)
    }
  }

  const toggle = (p: typeof panel) => {
    const next = panel === p ? null : p
    setPanel(next)
    if (next === 'history') {
      apiGet<{ history: HistoryItem[] }>(`/leads/${caseId}/documents/${doc.id}/history`)
        .then(res => setHistory(res.history))
        .catch(() => setHistory([]))
    }
  }

  const requestAgain = async (e: FormEvent) => {
    e.preventDefault()
    if (await run(() => apiPost(`/leads/${caseId}/documents/${doc.id}/request-again`, { reason }))) {
      setReason('')
      setPanel(null)
    }
  }

  const status = docStatus(doc)
  const chip = status === 'received' ? `✓ Received ${formatDate(doc.received_at!)}`
    : status === 'stale' ? `Due for update (received ${formatDate(doc.received_at!)})`
    : status === 'review' ? `${firstName} sent it ${formatDate(doc.sent_at!)}`
    : doc.round > 1 ? 'Waiting for new copy' : 'Waiting'

  return (
    <li className={`doc-row pro-doc doc-${status}`}>
      <label className="doc-check">
        <input
          type="checkbox"
          checked={Boolean(doc.received_at)}
          disabled={busy}
          onChange={e => run(() => apiPatch(`/leads/${caseId}/documents/${doc.id}`, { received: e.target.checked }))}
          aria-label={`Received: ${doc.label}`}
        />
        <span className="doc-label">
          {showClient && <span className="doc-client">{showClient}</span>}
          {doc.label}
          {doc.round > 1 && <span className="round-badge">Round {doc.round}</span>}
        </span>
      </label>
      <span className={`doc-status-chip ${status}`}>{chip}</span>
      {doc.request_reason && !doc.received_at && (
        <span className="doc-reason">Asked: “{doc.request_reason}”{doc.last_received_at ? ` · last copy ${formatDate(doc.last_received_at)}` : ''}</span>
      )}
      {doc.homeowner_note && <span className="form-note">{firstName}: “{doc.homeowner_note}”</span>}

      <div className="doc-actions">
        {(doc.received_at || doc.sent_at) && (
          <button type="button" className="btn-link" onClick={() => toggle('again')}>Request again</button>
        )}
        <button type="button" className={`btn-link ${unread ? 'has-unread' : ''}`} onClick={() => toggle('notes')}>
          Notes{notes.length ? ` (${notes.length})` : ''}{unread ? ' •' : ''}
        </button>
        <button type="button" className="btn-link" onClick={() => toggle('settings')}>
          {doc.refresh_days ? `Good for ${doc.refresh_days} days` : 'Set refresh'}
        </button>
        <button type="button" className="btn-link" onClick={() => toggle('history')}>History</button>
        <button type="button" className="btn-link" onClick={() => toggle('example')}>Example</button>
        {!doc.sent_at && !doc.received_at && doc.round === 1 && (
          <button type="button" className="btn-link" disabled={busy}
            onClick={() => run(() => apiDelete(`/leads/${caseId}/documents/${doc.id}`))}>Remove</button>
        )}
      </div>

      {panel === 'again' && (
        <form className="doc-panel" onSubmit={requestAgain}>
          <div className="quick-reasons">
            {REASONS.map(r => (
              <button key={r} type="button" className={`type-chip ${reason === r ? 'active' : ''}`} onClick={() => setReason(r)}>{r}</button>
            ))}
          </div>
          <div className="add-doc">
            <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300}
              placeholder={`What does ${firstName} need to send?`} aria-label="Why you need it again" />
            <button type="submit" className="btn btn-primary btn-small" disabled={busy || !reason.trim()}>Request</button>
          </div>
          <p className="form-note">{firstName} sees your reason. The copy you already have stays in the history.</p>
        </form>
      )}
      {panel === 'notes' && (
        <div className="doc-panel">
          <NotesThread notes={notes} viewer="professional" otherName={firstName} compact
            placeholder={`Ask ${firstName} about this document`} onSend={body => onNote(body, doc.id)} />
        </div>
      )}
      {panel === 'settings' && (
        <div className="doc-panel">
          <label htmlFor={`refresh-${doc.id}`}>How long a copy stays current for the lender</label>{' '}
          <select id={`refresh-${doc.id}`} value={doc.refresh_days ?? ''} disabled={busy}
            onChange={e => run(() => apiPatch(`/leads/${caseId}/documents/${doc.id}`, { refresh_days: e.target.value ? Number(e.target.value) : null }))}>
            {REFRESH_OPTIONS.map(o => <option key={o.label} value={o.value ?? ''}>{o.label}</option>)}
          </select>
          {doc.expires_on && <p className="form-note">The current copy is due for an update on {formatDate(doc.expires_on)}.</p>}
        </div>
      )}
      {panel === 'history' && (
        <div className="doc-panel">
          {history === null ? <p>Loading...</p> : history.length === 0 ? <p className="form-note">No history yet.</p> : (
            <ul className="history-list">
              {history.map(h => (
                <li key={h.id}>
                  {formatDate(h.created_at)} · Round {h.round} · {ACTION_LABEL[h.action] ?? h.action}
                  {h.reason ? ` — “${h.reason}”` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {panel === 'example' && <DocumentExample type={doc.doc_type} />}
      {error && <span className="error-message">{error}</span>}
    </li>
  )
}
