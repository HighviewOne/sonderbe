import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../lib/api'
import { stageLabel } from '../../lib/constants'
import { formatDate } from '../../lib/format'
import { useAuth } from '../../hooks/useAuth'

type ClientSummary = {
  id: string
  contact_name: string
  stage: string
  next_step: string | null
  stage_updated_at: string | null
  to_review: number
  waiting_on_client: number
  due_for_update: number
  received: number
  total: number
  unread_notes: number
}

// The professional's home: what needs attention across every client
export function ProDashboard() {
  const { profile } = useAuth()
  const [clients, setClients] = useState<ClientSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<{ clients: ClientSummary[] }>('/leads/summary')
      .then(res => setClients(res.clients))
      .catch(err => {
        console.error('Error loading dashboard:', err)
        setError('Failed to load your dashboard. Please refresh.')
      })
  }, [])

  if (error) return <div className="error-message">{error}</div>
  if (!clients) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  const sum = (k: keyof ClientSummary) => clients.reduce((n, c) => n + (c[k] as number), 0)
  const attention = clients
    .filter(c => c.to_review || c.due_for_update || c.unread_notes)
    .sort((a, b) => (b.unread_notes + b.to_review + b.due_for_update) - (a.unread_notes + a.to_review + a.due_for_update))
  const quiet = clients.filter(c => !attention.includes(c))

  return (
    <div className="pro-dashboard">
      <div className="page-header">
        <h1>Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
        <p>Here's what needs you across your {clients.length} active client{clients.length === 1 ? '' : 's'}.</p>
      </div>

      <div className="stat-tiles">
        <Link to="/investor/clients" className="stat-tile"><span className="stat-num">{clients.length}</span><span>Active clients</span></Link>
        <Link to="/investor/documents" className="stat-tile highlight"><span className="stat-num">{sum('to_review')}</span><span>Documents to review</span></Link>
        <Link to="/investor/documents" className="stat-tile"><span className="stat-num">{sum('due_for_update')}</span><span>Due for update</span></Link>
        <Link to="/investor/clients" className="stat-tile"><span className="stat-num">{sum('unread_notes')}</span><span>New notes</span></Link>
      </div>

      <div className="dashboard-card">
        <div className="card-header"><h2>Needs your attention</h2></div>
        {attention.length === 0 ? (
          <p className="empty-state">You're caught up. Nothing to review and no new notes.</p>
        ) : (
          <ul className="attention-list">
            {attention.map(c => (
              <li key={c.id}>
                <div>
                  <strong>{c.contact_name}</strong> · {stageLabel(c.stage)}
                  <div className="attention-items">
                    {c.unread_notes > 0 && <span className="unread-badge">{c.unread_notes} new note{c.unread_notes === 1 ? '' : 's'}</span>}
                    {c.to_review > 0 && <span className="doc-status-chip review">{c.to_review} to review</span>}
                    {c.due_for_update > 0 && <span className="doc-status-chip stale">{c.due_for_update} due for update</span>}
                  </div>
                </div>
                <Link to={`/investor/clients#case-${c.id}`} className="btn btn-secondary btn-small">Open</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {quiet.length > 0 && (
        <div className="dashboard-card">
          <div className="card-header"><h2>Other clients</h2></div>
          <ul className="attention-list">
            {quiet.map(c => (
              <li key={c.id}>
                <div>
                  <strong>{c.contact_name}</strong> · {stageLabel(c.stage)}
                  <div className="pro-subtitle">
                    {c.total ? `${c.received} of ${c.total} documents current` : 'No documents requested yet'}
                    {c.waiting_on_client ? ` · waiting on ${c.waiting_on_client}` : ''}
                    {c.stage_updated_at ? ` · updated ${formatDate(c.stage_updated_at)}` : ''}
                  </div>
                </div>
                <Link to={`/investor/clients#case-${c.id}`} className="btn btn-secondary btn-small">Open</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
