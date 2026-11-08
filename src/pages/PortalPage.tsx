import { Routes, Route, NavLink } from 'react-router-dom'
import { Dashboard, MyChecklist, DocumentUpload, GetMatched } from '../components/portal'
import { DOCUMENT_UPLOADS_ENABLED } from '../lib/constants'

export function PortalPage() {
  return (
    <main className="portal-page">
      <div className="portal-container">
        <nav className="portal-nav">
          <NavLink to="/portal" end className={({ isActive }) => isActive ? 'active' : ''}>
            Dashboard
          </NavLink>
          <NavLink to="/portal/checklist" className={({ isActive }) => isActive ? 'active' : ''}>
            My Checklist
          </NavLink>
          <NavLink to="/portal/match" className={({ isActive }) => isActive ? 'active' : ''}>
            Get Matched
          </NavLink>
          {DOCUMENT_UPLOADS_ENABLED && (
            <NavLink to="/portal/documents" className={({ isActive }) => isActive ? 'active' : ''}>
              Documents
            </NavLink>
          )}
        </nav>

        <div className="portal-content">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="checklist" element={<MyChecklist />} />
            <Route path="match" element={<GetMatched />} />
            {DOCUMENT_UPLOADS_ENABLED && <Route path="documents" element={<DocumentUpload />} />}
          </Routes>
        </div>
      </div>
    </main>
  )
}
