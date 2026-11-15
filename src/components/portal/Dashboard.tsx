import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useChecklist } from '../../hooks/useChecklist'
import { useDocuments } from '../../hooks/useDocuments'
import { useSubmissions } from '../../hooks/useSubmissions'
import { useMatch } from '../../hooks/useMatch'
import { useMyInfo, infoProgress } from '../../hooks/useMyInfo'
import { DOCUMENT_UPLOADS_ENABLED, stageLabel } from '../../lib/constants'

export function Dashboard() {
  const { profile } = useAuth()
  const { getTotalProgress, loading: checklistLoading } = useChecklist()
  const { submissions, loading: subsLoading } = useSubmissions()

  const progress = getTotalProgress()
  const recentSubmissions = submissions.slice(0, 3)

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome, {profile?.full_name || 'there'}!</h1>
        <p>Get ready, then get matched with a professional who can help</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card checklist-overview">
          <div className="card-header">
            <h2>Readiness Checklist</h2>
            <Link to="/portal/checklist" className="card-link">View All</Link>
          </div>
          {checklistLoading ? (
            <p>Loading...</p>
          ) : (
            <>
              <div className="progress-circle-container">
                <div className="progress-circle" style={{ '--progress': progress.percentage } as React.CSSProperties}>
                  <span className="progress-text">{progress.percentage}%</span>
                </div>
              </div>
              <p className="progress-label">
                {progress.checked} of {progress.total} items ready
              </p>
              <Link to="/portal/checklist" className="btn btn-secondary btn-full">
                Continue Checklist
              </Link>
            </>
          )}
        </div>

        <InfoCard />

        {DOCUMENT_UPLOADS_ENABLED ? <DocumentsCard /> : <MatchCard />}

        <div className="dashboard-card submissions-overview">
          <div className="card-header">
            <h2>My Submissions</h2>
          </div>
          {subsLoading ? (
            <p>Loading...</p>
          ) : submissions.length === 0 ? (
            <>
              <p className="empty-state">No contact submissions yet</p>
              <Link to="/#contact" className="btn btn-secondary btn-full">
                Request Consultation
              </Link>
            </>
          ) : (
            <ul className="submissions-list">
              {recentSubmissions.map(sub => (
                <li key={sub.id} className="submission-item">
                  <div className="submission-info">
                    <span className="submission-date">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </span>
                    <span className="submission-situation">{sub.situation}</span>
                  </div>
                  <span className={`submission-status status-${sub.status}`}>{sub.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-card quick-links">
          <h2>Quick Links</h2>
          <div className="quick-links-grid">
            <a href="https://www.hud.gov/findacounselor" target="_blank" rel="noopener noreferrer" className="quick-link">
              <span className="quick-link-icon">HUD</span>
              <span>Find a HUD Counselor</span>
            </a>
            <a href="https://camortgagerelief.org/" target="_blank" rel="noopener noreferrer" className="quick-link">
              <span className="quick-link-icon">CAL</span>
              <span>CA Mortgage Relief</span>
            </a>
            <a href="tel:1-888-995-4673" className="quick-link">
              <span className="quick-link-icon">HOPE</span>
              <span>HOPE Hotline</span>
            </a>
            <Link to="/#resources" className="quick-link">
              <span className="quick-link-icon">+</span>
              <span>More Resources</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function MatchCard() {
  const { activeCases, loading } = useMatch()

  return (
    <div className="dashboard-card match-overview">
      <div className="card-header">
        <h2>My Professionals</h2>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : activeCases.length === 0 ? (
        <>
          <p className="empty-state">Choose a real estate professional or find legal help in your county. Free for homeowners.</p>
          <Link to="/portal/match" className="btn btn-secondary btn-full">Find a Professional</Link>
        </>
      ) : (
        <>
          {activeCases.map(c => {
            const toSend = c.documents.filter(d => !d.sent_at && !d.received_at).length
            return (
              <div key={c.request.id} className="dash-case">
                <p>
                  <strong>{c.professional?.full_name || 'Your professional'}</strong>
                  {c.professional?.business_name && <> · {c.professional.business_name}</>}
                </p>
                <p>Stage: <strong>{stageLabel(c.request.stage)}</strong>{toSend > 0 && <> · {toSend} document{toSend === 1 ? '' : 's'} to send</>}</p>
                {c.unread_notes > 0 && <p><span className="unread-badge">{c.unread_notes} new note{c.unread_notes === 1 ? '' : 's'}</span></p>}
                {c.request.next_step && <p>Next step: {c.request.next_step}</p>}
              </div>
            )
          })}
          <Link to="/portal/match" className="btn btn-secondary btn-full">View My Cases</Link>
        </>
      )}
    </div>
  )
}

function InfoCard() {
  const { data, loading } = useMyInfo()
  const progress = infoProgress(data)
  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2>My Information</h2>
      </div>
      {loading ? <p>Loading...</p> : (
        <>
          <p>{progress.done} of {progress.total} sections done</p>
          <div className="progress-bar-container" aria-hidden="true">
            <div className="progress-bar" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <p className="form-note">Enter it once; it fills your document list and hardship letter.</p>
          <Link to="/portal/info" className="btn btn-secondary btn-full">
            {progress.done === progress.total ? 'Review My Information' : 'Continue'}
          </Link>
        </>
      )}
    </div>
  )
}

function DocumentsCard() {
  const { documents, loading: docsLoading } = useDocuments()
  const recentDocs = documents.slice(0, 3)

  return (
    <div className="dashboard-card documents-overview">
      <div className="card-header">
        <h2>My Documents</h2>
        <Link to="/portal/documents" className="card-link">View All</Link>
      </div>
      {docsLoading ? (
        <p>Loading...</p>
      ) : documents.length === 0 ? (
        <>
          <p className="empty-state">No documents uploaded yet</p>
          <Link to="/portal/documents" className="btn btn-secondary btn-full">
            Upload Documents
          </Link>
        </>
      ) : (
        <>
          <ul className="document-list">
            {recentDocs.map(doc => (
              <li key={doc.id} className="document-item">
                <span className="doc-icon">📄</span>
                <span className="doc-name">{doc.file_name}</span>
                <span className={`doc-status status-${doc.status}`}>{doc.status}</span>
              </li>
            ))}
          </ul>
          <Link to="/portal/documents" className="btn btn-secondary btn-full">
            Manage Documents
          </Link>
        </>
      )}
    </div>
  )
}
