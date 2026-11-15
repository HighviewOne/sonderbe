import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Dashboard, MyChecklist, DocumentUpload, GetMatched, MovingForward, MyInformation, HardshipLetter } from '../components/portal'
import { DOCUMENT_UPLOADS_ENABLED } from '../lib/constants'

export function PortalPage() {
  const { isInvestor } = useAuth()
  // The homeowner portal isn't for professionals: send them to theirs
  if (isInvestor) return <Navigate to="/investor" replace />
  return (
    <main className="portal-page">
      <div className="portal-container">
        <nav className="portal-nav">
          <NavLink to="/portal" end className={({ isActive }) => isActive ? 'active' : ''}>
            Dashboard
          </NavLink>
          <NavLink to="/portal/info" className={({ isActive }) => isActive ? 'active' : ''}>
            My Information
          </NavLink>
          <NavLink to="/portal/checklist" className={({ isActive }) => isActive ? 'active' : ''}>
            My Checklist
          </NavLink>
          <NavLink to="/portal/match" className={({ isActive }) => isActive ? 'active' : ''}>
            My Professionals
          </NavLink>
          <NavLink to="/portal/moving" className={({ isActive }) => isActive ? 'active' : ''}>
            Moving Forward
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
            <Route path="info" element={<MyInformation />} />
            <Route path="hardship-letter" element={<HardshipLetter />} />
            <Route path="moving" element={<MovingForward />} />
            {DOCUMENT_UPLOADS_ENABLED && <Route path="documents" element={<DocumentUpload />} />}
          </Routes>
        </div>
      </div>
    </main>
  )
}
