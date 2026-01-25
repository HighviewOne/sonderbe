import { Routes, Route, NavLink } from 'react-router-dom'
import {
  AdminDashboard,
  ClientList,
  ClientDetail,
  SubmissionsList,
  DocumentsReview
} from '../components/admin'

export function AdminPage() {
  return (
    <main className="admin-page">
      <div className="admin-container">
        <nav className="admin-nav">
          <NavLink to="/admin" end className={({ isActive }) => isActive ? 'active' : ''}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/clients" className={({ isActive }) => isActive ? 'active' : ''}>
            Clients
          </NavLink>
          <NavLink to="/admin/submissions" className={({ isActive }) => isActive ? 'active' : ''}>
            Submissions
          </NavLink>
          <NavLink to="/admin/documents" className={({ isActive }) => isActive ? 'active' : ''}>
            Documents
          </NavLink>
        </nav>

        <div className="admin-content">
          <Routes>
            <Route index element={<AdminDashboard />} />
            <Route path="clients" element={<ClientList />} />
            <Route path="clients/:clientId" element={<ClientDetail />} />
            <Route path="submissions" element={<SubmissionsList />} />
            <Route path="documents" element={<DocumentsReview />} />
          </Routes>
        </div>
      </div>
    </main>
  )
}
