import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Profile, ContactSubmission } from '../../lib/supabase'

interface Stats {
  totalClients: number
  newSubmissions: number
  pendingDocuments: number
  recentClients: Profile[]
  recentSubmissions: ContactSubmission[]
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    newSubmissions: 0,
    pendingDocuments: 0,
    recentClients: [],
    recentSubmissions: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)

    const [clientsResult, submissionsResult, documentsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('created_at', { ascending: false }),
      supabase
        .from('contact_submissions')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('documents')
        .select('*')
        .eq('status', 'uploaded')
    ])

    const clients = (clientsResult.data || []) as Profile[]
    const submissions = (submissionsResult.data || []) as ContactSubmission[]
    const pendingDocs = documentsResult.data?.length || 0
    const newSubs = submissions.filter(s => s.status === 'new').length

    setStats({
      totalClients: clients.length,
      newSubmissions: newSubs,
      pendingDocuments: pendingDocs,
      recentClients: clients.slice(0, 5),
      recentSubmissions: submissions.slice(0, 5)
    })

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading admin dashboard...</p>
      </div>
    )
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <p>Manage clients, submissions, and documents</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.totalClients}</div>
          <div className="stat-label">Total Clients</div>
          <Link to="/admin/clients" className="stat-link">View All</Link>
        </div>
        <div className="stat-card highlight">
          <div className="stat-number">{stats.newSubmissions}</div>
          <div className="stat-label">New Submissions</div>
          <Link to="/admin/submissions" className="stat-link">Review</Link>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.pendingDocuments}</div>
          <div className="stat-label">Documents to Review</div>
          <Link to="/admin/documents" className="stat-link">Review</Link>
        </div>
      </div>

      <div className="admin-grid">
        <div className="admin-card">
          <div className="card-header">
            <h2>Recent Clients</h2>
            <Link to="/admin/clients" className="card-link">View All</Link>
          </div>
          {stats.recentClients.length === 0 ? (
            <p className="empty-state">No clients yet</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentClients.map(client => (
                  <tr key={client.id}>
                    <td>
                      <Link to={`/admin/clients/${client.id}`}>
                        {client.full_name || 'No name'}
                      </Link>
                    </td>
                    <td>{client.email}</td>
                    <td>{new Date(client.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="admin-card">
          <div className="card-header">
            <h2>Recent Submissions</h2>
            <Link to="/admin/submissions" className="card-link">View All</Link>
          </div>
          {stats.recentSubmissions.length === 0 ? (
            <p className="empty-state">No submissions yet</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Situation</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSubmissions.map(sub => (
                  <tr key={sub.id} className={sub.status === 'new' ? 'highlight-row' : ''}>
                    <td>{sub.name}</td>
                    <td>{sub.situation}</td>
                    <td>
                      <span className={`status-badge status-${sub.status}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td>{new Date(sub.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
