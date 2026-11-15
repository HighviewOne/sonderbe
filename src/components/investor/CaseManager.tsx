import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiPost, apiPatch, apiDelete } from '../../lib/api'
import { stages, outcomes } from '../../lib/constants'
import type { Stage } from '../../lib/constants'
import { formatDate } from '../../lib/format'
import type { CaseDocument, CaseEvent } from '../../hooks/useMatch'
import { StageProgress, CaseTimeline } from '../case/CaseParts'

export type ManagedCase = {
  id: string
  contact_name: string
  stage: Stage
  next_step: string | null
  outcome: string | null
  events: CaseEvent[]
  documents: CaseDocument[]
}

// The professional's controls for one active case: move the stage, set the next step the
// homeowner sees, and keep the document list (homeowner marks sent, professional marks received).
export function CaseManager({ lead, onChanged }: { lead: ManagedCase; onChanged: () => void }) {
  const firstName = lead.contact_name.split(/\s+/)[0]
  const [stage, setStage] = useState<Stage>(lead.stage)
  const [outcome, setOutcome] = useState(lead.outcome ?? '')
  const [nextStep, setNextStep] = useState(lead.next_step ?? '')
  const [note, setNote] = useState('')
  const [newDoc, setNewDoc] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    setSaved(false)
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

  const postUpdate = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await run(() => apiPost(`/leads/${lead.id}/stage`, {
      stage, next_step: nextStep, note, outcome: stage === 'outcome' ? outcome : undefined
    }))
    if (ok) {
      setNote('')
      setSaved(true)
    }
  }

  const addDoc = async (e: FormEvent) => {
    e.preventDefault()
    if (!newDoc.trim()) return
    if (await run(() => apiPost(`/leads/${lead.id}/documents`, { label: newDoc }))) setNewDoc('')
  }

  const received = lead.documents.filter(d => d.received_at).length

  return (
    <div className="case-manager">
      <StageProgress stage={lead.stage} outcome={lead.outcome} />
      {error && <div className="error-message">{error}</div>}

      <form className="case-update" onSubmit={postUpdate}>
        <h4>Post an update for {firstName}</h4>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor={`stage-${lead.id}`}>Stage</label>
            <select id={`stage-${lead.id}`} value={stage} onChange={e => setStage(e.target.value as Stage)}>
              {stages.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {stage === 'outcome' && (
            <div className="form-group">
              <label htmlFor={`outcome-${lead.id}`}>Outcome</label>
              <select id={`outcome-${lead.id}`} value={outcome} onChange={e => setOutcome(e.target.value)} required>
                <option value="">Choose the outcome</option>
                {outcomes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="form-group">
          <label htmlFor={`next-${lead.id}`}>Next step ({firstName} sees this at the top of their case)</label>
          <input id={`next-${lead.id}`} value={nextStep} onChange={e => setNextStep(e.target.value)} maxLength={300}
            placeholder="e.g. Send the remaining documents by Friday" />
        </div>
        <div className="form-group">
          <label htmlFor={`note-${lead.id}`}>Note for the timeline (optional)</label>
          <textarea id={`note-${lead.id}`} value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={2}
            placeholder="e.g. Spoke with the lender's negotiator today" />
        </div>
        <button type="submit" className="btn btn-primary btn-small" disabled={busy}>
          {busy ? 'Saving...' : 'Post update'}
        </button>
        {saved && <span className="form-note"> Saved. {firstName} can see it now.</span>}
      </form>

      <div className="case-docs">
        <h4>
          Documents {lead.documents.length > 0 && <span className="lead-readiness">{received} of {lead.documents.length} received</span>}
        </h4>
        {lead.documents.length === 0 ? (
          <p className="empty-state">
            No documents requested yet.{' '}
            <button type="button" className="btn btn-secondary btn-small" disabled={busy}
              onClick={() => run(() => apiPost(`/leads/${lead.id}/documents`, { standard: true }))}>
              Add the standard short-sale list
            </button>
          </p>
        ) : (
          <ul className="doc-checklist">
            {lead.documents.map(doc => (
              <li key={doc.id} className={`doc-row doc-${doc.received_at ? 'received' : doc.sent_at ? 'sent' : 'todo'}`}>
                <label className="doc-check">
                  <input
                    type="checkbox"
                    checked={Boolean(doc.received_at)}
                    disabled={busy}
                    onChange={e => run(() => apiPatch(`/leads/${lead.id}/documents/${doc.id}`, { received: e.target.checked }))}
                  />
                  <span className="doc-label">{doc.label}</span>
                </label>
                <span className={`doc-status-chip ${doc.received_at ? 'received' : doc.sent_at ? 'sent' : 'todo'}`}>
                  {doc.received_at ? `✓ Received ${formatDate(doc.received_at)}`
                    : doc.sent_at ? `${firstName} sent it ${formatDate(doc.sent_at)}`
                    : 'Waiting'}
                </span>
                {doc.homeowner_note && <span className="form-note">“{doc.homeowner_note}”</span>}
                {!doc.sent_at && !doc.received_at && (
                  <button type="button" className="btn-link" disabled={busy}
                    onClick={() => run(() => apiDelete(`/leads/${lead.id}/documents/${doc.id}`))}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form className="add-doc" onSubmit={addDoc}>
          <input value={newDoc} onChange={e => setNewDoc(e.target.value)} maxLength={200}
            placeholder="Add a document, e.g. HOA statement" aria-label="New document" />
          <button type="submit" className="btn btn-secondary btn-small" disabled={busy || !newDoc.trim()}>Add</button>
        </form>
        <p className="form-note">Check a document off once you have it. Ask {firstName} to send files to you directly, not through SonderBe.</p>
      </div>

      <details>
        <summary>Timeline ({lead.events.length})</summary>
        <CaseTimeline events={lead.events} homeownerLabel={firstName} />
      </details>
    </div>
  )
}
