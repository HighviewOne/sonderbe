import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../lib/api'
import type { DistressedProperty } from '../../lib/supabase'

const LEAD_TYPE_LABELS: Record<string, string> = {
  foreclosure_nod: 'NOD (Notice of Default)',
  foreclosure_not: 'NOT (Notice of Trustee Sale)',
  probate: 'Probate',
  tax_lien: 'Tax Lien',
  tax_sale: 'Tax Sale'
}

interface StatsResponse {
  counts: Record<string, number>
  recent: DistressedProperty[]
}

export function InvestorDashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<StatsResponse>('/investor/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    )
  }

  const counts = stats?.counts || {}

  return (
    <div className="investor-dashboard">
      <div className="dashboard-header">
        <h1>Investor Dashboard</h1>
        <p>Distressed property leads across Southern California</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card highlight">
          <div className="stat-number">{counts.total || 0}</div>
          <div className="stat-label">Total Active Leads</div>
          <Link to="/investor/search" className="stat-link">Search All</Link>
        </div>
        {Object.entries(LEAD_TYPE_LABELS).map(([key, label]) => (
          <div className="stat-card" key={key}>
            <div className="stat-number">{counts[key] || 0}</div>
            <div className="stat-label">{label}</div>
            <Link to={`/investor/search?lead_type=${key}`} className="stat-link">View</Link>
          </div>
        ))}
      </div>

      {stats?.recent && stats.recent.length > 0 && (
        <div className="admin-card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h2>Recently Added</h2>
            <Link to="/investor/search" className="card-link">View All</Link>
          </div>
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Address</th>
                  <th>County</th>
                  <th>Est. Equity</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.slice(0, 5).map(p => (
                  <tr key={p.id}>
                    <td><span className={`lead-type-badge lead-type-${p.lead_type}`}>{LEAD_TYPE_LABELS[p.lead_type]?.split(' ')[0]}</span></td>
                    <td><Link to={`/investor/properties/${p.id}`}>{p.property_address || p.apn || 'N/A'}</Link></td>
                    <td>{p.county}</td>
                    <td>{p.estimated_equity ? `$${p.estimated_equity.toLocaleString()}` : '-'}</td>
                    <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
