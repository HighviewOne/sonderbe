import { Routes, Route, NavLink } from 'react-router-dom'
import { Dashboard, MyChecklist, DocumentUpload } from '../components/portal'

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
          <NavLink to="/portal/documents" className={({ isActive }) => isActive ? 'active' : ''}>
            Documents
          </NavLink>
        </nav>

        <div className="portal-content">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="checklist" element={<MyChecklist />} />
            <Route path="documents" element={<DocumentUpload />} />
          </Routes>
        </div>
      </div>
    </main>
  )
}
