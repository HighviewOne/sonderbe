import { useState, useEffect } from 'react'
import { apiGet } from '../../lib/api'
import type { Profile, InvestorSubscription } from '../../lib/supabase'

interface InvestorWithSub extends Profile {
  subscription: InvestorSubscription | null
}

export function InvestorList() {
  const [investors, setInvestors] = useState<InvestorWithSub[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet<InvestorWithSub[]>('/admin/investors')
      .then(setInvestors)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="loading-container"><div className="loading-spinner"></div></div>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Investors</h1>
        <p>{investors.length} registered investors</p>
      </div>

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Subscription</th>
              <th>Period End</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {investors.map(inv => (
              <tr key={inv.id}>
                <td>{inv.full_name || '-'}</td>
                <td>{inv.email}</td>
                <td>
                  <span className={`status-badge ${inv.subscription?.status === 'active' ? 'badge-success' : inv.subscription?.status === 'past_due' ? 'badge-warning' : 'badge-default'}`}>
                    {inv.subscription?.status || 'none'}
                  </span>
                </td>
                <td>{inv.subscription?.current_period_end ? new Date(inv.subscription.current_period_end).toLocaleDateString() : '-'}</td>
                <td>{new Date(inv.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {investors.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>No investors yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
