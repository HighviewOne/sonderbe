import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useChecklist } from '../../hooks/useChecklist'
import { useDocuments } from '../../hooks/useDocuments'
import { useSubmissions } from '../../hooks/useSubmissions'
import { useMatch } from '../../hooks/useMatch'
import { DOCUMENT_UPLOADS_ENABLED } from '../../lib/constants'

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
  const { request, loading } = useMatch()
  const active = request && (request.status === 'open' || request.status === 'claimed')

  return (
    <div className="dashboard-card match-overview">
      <div className="card-header">
        <h2>Get Matched</h2>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : !active ? (
        <>
          <p className="empty-state">Connect with one real estate professional in your county. Free for homeowners.</p>
          <Link to="/portal/match" className="btn btn-secondary btn-full">Request a Match</Link>
        </>
      ) : (
        <>
          <p>
            {request.status === 'open'
              ? `Request sent for ${request.county} County — waiting for a professional to accept.`
              : 'You have been matched with a professional.'}
          </p>
          <Link to="/portal/match" className="btn btn-secondary btn-full">View Details</Link>
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
