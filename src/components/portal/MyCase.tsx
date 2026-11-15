import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { CaseDocument, CaseNote, MatchCase } from '../../hooks/useMatch'
import { formatDate } from '../../lib/format'
import { categoryLabels } from '../../lib/constants'
import { StageProgress, CaseTimeline, ProfessionalHeader } from '../case/CaseParts'
import { DocumentExample } from '../case/DocumentExample'
import { NotesThread } from '../case/NotesThread'

type Props = {
  caseData: MatchCase
  markSent: (docId: string, sent: boolean, note?: string) => Promise<void>
  withdraw: (requestId: string) => Promise<void>
  sendNote: (requestId: string, body: string, documentId: string | null) => Promise<void>
  markNotesRead: (requestId: string) => Promise<void>
}

// One active case: professional, stage, next step, documents and timeline
export function MyCase({ caseData, markSent, withdraw, sendNote, markNotesRead }: Props) {
  const { request, professional, events, documents, notes, unread_notes } = caseData
  const office = professional?.office
  const [withdrawing, setWithdrawing] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const proName = professional?.full_name || 'your professional'
  const ProName = proName[0].toUpperCase() + proName.slice(1)

  const handleWithdraw = async () => {
    setWithdrawing(true)
    setError(null)
    try {
      await withdraw(request.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to withdraw')
      setWithdrawing(false)
    }
  }

  const received = documents.filter(d => d.received_at).length
  const toSend = documents.filter(d => !d.sent_at && !d.received_at).length
  const generalNotes = notes.filter(n => !n.document_id)

  return (
    <section className="case-section" aria-label={categoryLabels[request.category]}>
      <div className="dashboard-card">
        <div className="case-kicker">{categoryLabels[request.category]}</div>
        {professional ? (
          <>
            <ProfessionalHeader pro={professional} />
            <ul className="match-contact">
              <li>Email: <a href={`mailto:${professional.email}`}>{professional.email}</a></li>
              {professional.phone && <li>Phone: <a href={`tel:${professional.phone}`}>{professional.phone}</a></li>}
              {office?.office_phone && <li>Office: <a href={`tel:${office.office_phone}`}>{office.office_phone}</a></li>}
              {office?.office_street && (
                <li>{office.office_street}{office.office_unit ? ` ${office.office_unit}` : ''}, {office.office_city}{office.office_state ? `, ${office.office_state}` : ''} {office.office_zip}</li>
              )}
              {office?.office_hours && <li>Hours: {office.office_hours}</li>}
              {professional.website && (
                <li><a href={professional.website} target="_blank" rel="noopener noreferrer">Website</a></li>
              )}
            </ul>
          </>
        ) : (
          <p>Your professional will contact you soon.</p>
        )}
        <StageProgress stage={request.stage} outcome={request.outcome} />
        {request.next_step && (
          <div className="next-step">
            <span className="next-step-label">Next step</span>
            <p>{request.next_step}</p>
          </div>
        )}
      </div>

      <div className="dashboard-card">
        <div className="card-header">
          <h2>Documents for {proName}</h2>
          {documents.length > 0 && (
            <span className="lead-readiness">
              {toSend > 0 ? `${toSend} to send · ` : ''}{received} of {documents.length} received
            </span>
          )}
        </div>
        {documents.length === 0 ? (
          <p className="empty-state">
            {ProName} hasn't asked for any documents yet. Filling in <Link to="/portal/info">My Information</Link> lets
            them build your list in one click.
          </p>
        ) : (
          <>
            <div className="how-to-send">
              <strong>How to send them to {proName}:</strong>{' '}
              {office?.document_email || office?.fax ? (
                <>
                  {office.document_email && <>email <a href={`mailto:${office.document_email}`}>{office.document_email}</a></>}
                  {office.document_email && office.fax && ' or '}
                  {office.fax && <>fax {office.fax}</>}.
                </>
              ) : professional?.email ? (
                <>email <a href={`mailto:${professional.email}`}>{professional.email}</a>.</>
              ) : 'ask them how they prefer to receive documents.'}
              {office?.document_instructions && <p>{office.document_instructions}</p>}
              <p className="form-note">
                SonderBe never receives your files. Check each one off when you've sent it. Not sure what something
                is? Tap <em>See an example</em>. Questions? Use <em>Ask a question</em>.
              </p>
            </div>
            <ul className="doc-checklist">
              {documents.map(doc => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  markSent={markSent}
                  proName={proName}
                  notes={notes.filter(n => n.document_id === doc.id)}
                  onNote={body => sendNote(request.id, body, doc.id)}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="dashboard-card">
        <details className="case-notes" open={unread_notes > 0}
          onToggle={e => { if ((e.target as HTMLDetailsElement).open && unread_notes > 0) markNotesRead(request.id).catch(() => {}) }}>
          <summary>
            <strong>Notes with {proName} ({notes.length})</strong>
            {unread_notes > 0 && <span className="unread-badge">{unread_notes} new</span>}
          </summary>
          <NotesThread notes={generalNotes} viewer="homeowner" otherName={proName} onSend={body => sendNote(request.id, body, null)} />
          {notes.length > generalNotes.length && <p className="form-note">Notes about a document are next to that document.</p>}
        </details>
        <details>
          <summary><strong>Updates ({events.length})</strong></summary>
          <CaseTimeline events={events} />
        </details>
        {error && <div className="error-message">{error}</div>}
        {confirmWithdraw ? (
          <div className="withdraw-confirm">
            <p>Withdraw from {proName}? They will no longer see your contact details, information or document list.</p>
            <button className="btn btn-primary btn-small" onClick={handleWithdraw} disabled={withdrawing}>
              {withdrawing ? 'Withdrawing...' : 'Yes, withdraw'}
            </button>{' '}
            <button className="btn btn-secondary btn-small" onClick={() => setConfirmWithdraw(false)} disabled={withdrawing}>Cancel</button>
          </div>
        ) : (
          <button className="btn-link" onClick={() => setConfirmWithdraw(true)}>Withdraw / choose someone else</button>
        )}
      </div>
    </section>
  )
}

function DocumentRow({ doc, markSent, proName, notes, onNote }: {
  doc: CaseDocument
  markSent: Props['markSent']
  proName: string
  notes: CaseNote[]
  onNote: (body: string) => Promise<void>
}) {
  const [note, setNote] = useState(doc.homeowner_note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showExample, setShowExample] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  const save = async (sent: boolean, newNote?: string) => {
    setBusy(true)
    setError(null)
    try {
      await markSent(doc.id, sent, newNote)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  const status = doc.received_at ? 'received' : doc.sent_at ? 'sent' : 'todo'

  return (
    <li className={`doc-row doc-${status}`}>
      <label className="doc-check">
        <input
          type="checkbox"
          checked={Boolean(doc.sent_at)}
          disabled={busy || Boolean(doc.received_at)}
          onChange={e => save(e.target.checked, note)}
        />
        <span className="doc-label">{doc.label}</span>
      </label>
      <span className={`doc-status-chip ${status}`}>
        {status === 'received' ? `✓ Received ${formatDate(doc.received_at!)}`
          : status === 'sent' ? `Sent ${formatDate(doc.sent_at!)}`
          : doc.round > 1 ? 'Send a new copy' : 'To send'}
      </span>
      {doc.request_reason && !doc.received_at && (
        <span className="doc-reason">{proName} asked: “{doc.request_reason}”</span>
      )}
      <div className="doc-actions">
        <button type="button" className="btn-link" onClick={() => setShowExample(v => !v)} aria-expanded={showExample}>
          {showExample ? 'Hide example' : 'See an example'}
        </button>
        <button type="button" className="btn-link" onClick={() => setShowNotes(v => !v)} aria-expanded={showNotes}>
          {notes.length ? `Notes (${notes.length})` : 'Ask a question'}
        </button>
      </div>
      {doc.sent_at && !doc.received_at && (
        <input
          className="doc-note"
          aria-label={`How you sent: ${doc.label}`}
          placeholder="How did you send it? (optional)"
          value={note}
          maxLength={300}
          onChange={e => setNote(e.target.value)}
          onBlur={() => { if (note !== (doc.homeowner_note ?? '')) save(true, note) }}
        />
      )}
      {doc.received_at && doc.homeowner_note && <span className="form-note">{doc.homeowner_note}</span>}
      {showNotes && (
        <div className="doc-panel">
          <NotesThread notes={notes} viewer="homeowner" otherName={proName} compact
            placeholder={`Ask ${proName} about this document`} onSend={onNote} />
        </div>
      )}
      {showExample && <DocumentExample type={doc.doc_type} />}
      {error && <span className="error-message">{error}</span>}
    </li>
  )
}
