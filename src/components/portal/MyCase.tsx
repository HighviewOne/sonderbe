import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { CaseDocument, CaseEvent, MatchedProfessional, MatchRequest } from '../../hooks/useMatch'
import { formatDate } from '../../lib/format'
import { StageProgress, CaseTimeline, ProfessionalHeader } from '../case/CaseParts'

type Props = {
  request: MatchRequest
  professional: MatchedProfessional | null
  events: CaseEvent[]
  documents: CaseDocument[]
  markSent: (docId: string, sent: boolean, note?: string) => Promise<void>
  withdraw: () => Promise<void>
}

export function MyCase({ request, professional, events, documents, markSent, withdraw }: Props) {
  const [withdrawing, setWithdrawing] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const proName = professional?.full_name || 'your professional'

  const handleWithdraw = async () => {
    setWithdrawing(true)
    setError(null)
    try {
      await withdraw()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to withdraw')
      setWithdrawing(false)
    }
  }

  const received = documents.filter(d => d.received_at).length

  return (
    <div className="my-case">
      <div className="page-header">
        <h1>My Case</h1>
        <p>Follow each step with {proName}. They update this page as your case moves forward.</p>
      </div>

      <div className="dashboard-card">
        {professional ? (
          <>
            <ProfessionalHeader pro={professional} />
            <ul className="match-contact">
              <li>Email: <a href={`mailto:${professional.email}`}>{professional.email}</a></li>
              {professional.phone && <li>Phone: <a href={`tel:${professional.phone}`}>{professional.phone}</a></li>}
              {professional.website && (
                <li><a href={professional.website} target="_blank" rel="noopener noreferrer">Website</a></li>
              )}
            </ul>
          </>
        ) : (
          <p>Your professional will contact you soon.</p>
        )}
      </div>

      <div className="dashboard-card">
        <div className="card-header">
          <h2>Where things stand</h2>
        </div>
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
          <h2>Documents to send</h2>
          {documents.length > 0 && <span className="lead-readiness">{received} of {documents.length} received</span>}
        </div>
        {documents.length === 0 ? (
          <p className="empty-state">
            {proName[0].toUpperCase() + proName.slice(1)} hasn't asked for any documents yet. Meanwhile, keep
            gathering what's on your <Link to="/portal/checklist">readiness checklist</Link>.
          </p>
        ) : (
          <>
            <p className="form-note">
              Send these straight to {proName} by email, fax or in person. SonderBe never receives your files.
              Check each one off when you've sent it, and {proName} will mark it received.
            </p>
            <ul className="doc-checklist">
              {documents.map(doc => <DocumentRow key={doc.id} doc={doc} markSent={markSent} />)}
            </ul>
          </>
        )}
      </div>

      <div className="dashboard-card">
        <div className="card-header">
          <h2>Updates</h2>
        </div>
        <CaseTimeline events={events} />
      </div>

      <div className="dashboard-card">
        {error && <div className="error-message">{error}</div>}
        {confirmWithdraw ? (
          <>
            <p>Withdraw from {proName}? They will no longer see your contact details or documents list.</p>
            <button className="btn btn-primary" onClick={handleWithdraw} disabled={withdrawing}>
              {withdrawing ? 'Withdrawing...' : 'Yes, withdraw'}
            </button>{' '}
            <button className="btn btn-secondary" onClick={() => setConfirmWithdraw(false)} disabled={withdrawing}>Cancel</button>
          </>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={() => setConfirmWithdraw(true)}>Withdraw / choose someone else</button>
            <p className="form-note">Withdrawing stops further contact and hides your details from the professional.</p>
          </>
        )}
      </div>
    </div>
  )
}

function DocumentRow({ doc, markSent }: { doc: CaseDocument; markSent: Props['markSent'] }) {
  const [note, setNote] = useState(doc.homeowner_note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          : 'To send'}
      </span>
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
      {error && <span className="error-message">{error}</span>}
    </li>
  )
}
