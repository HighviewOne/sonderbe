import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPut } from '../../lib/api'
import { checklistData, COUNTIES, situationLabel } from '../../lib/constants'

type OpenLead = {
  id: string
  county: string
  situation: string
  first_name: string
  created_at: string
  category_counts: Record<string, number>
}

type MyLead = {
  id: string
  county: string
  situation: string
  contact_name: string
  contact_email: string | null
  contact_phone: string | null
  best_time: string | null
  status: 'claimed' | 'closed' | 'withdrawn'
  claimed_at: string | null
  created_at: string
  checked_items: [number, number][]
}

type LeadsResponse = {
  service_counties: string[]
  open: OpenLead[]
  mine: MyLead[]
}

const TOTAL_ITEMS = checklistData.reduce((sum, c) => sum + c.items.length, 0)

function readinessPercent(checkedCount: number) {
  return TOTAL_ITEMS > 0 ? Math.round((checkedCount / TOTAL_ITEMS) * 100) : 0
}

export function Leads() {
  const [data, setData] = useState<LeadsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingArea, setEditingArea] = useState(false)
  const [areaDraft, setAreaDraft] = useState<string[]>([])

  // No synchronous setState here — it runs from the mount effect
  const fetchLeads = useCallback(() => {
    apiGet<LeadsResponse>('/leads')
      .then((res) => {
        setData(res)
        setError(null)
      })
      .catch((err) => {
        console.error('Error loading leads:', err)
        setError('Failed to load leads. Please refresh.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const reload = () => {
    setLoading(true)
    fetchLeads()
  }

  const act = async (id: string, action: 'claim' | 'release' | 'close') => {
    setBusyId(id)
    setActionError(null)
    try {
      await apiPost(`/leads/${id}/${action}`)
      fetchLeads()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : `Failed to ${action} lead`)
      fetchLeads()
    } finally {
      setBusyId(null)
    }
  }

  const startEditingArea = () => {
    setAreaDraft(data?.service_counties ?? [])
    setEditingArea(true)
  }

  const saveArea = async () => {
    setActionError(null)
    try {
      await apiPut('/leads/service-area', { counties: areaDraft })
      setEditingArea(false)
      reload()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to save service area')
    }
  }

  if (loading && !data) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading leads...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="leads">
        <div className="error-message">{error}</div>
        <button className="btn btn-secondary" onClick={reload}>Retry</button>
      </div>
    )
  }

  const active = data.mine.filter(l => l.status === 'claimed')
  const past = data.mine.filter(l => l.status !== 'claimed')

  return (
    <div className="leads">
      <div className="page-header">
        <h1>Homeowner Leads</h1>
        <p>
          Homeowners in your counties who asked to be contacted. Accept a lead to see their contact details and
          which documents they have ready. Each homeowner is matched with one professional at a time.
        </p>
      </div>

      {actionError && <div className="error-message">{actionError}</div>}

      <div className="dashboard-card">
        <div className="card-header">
          <h2>Service Area</h2>
          {!editingArea && <button className="btn btn-secondary btn-small" onClick={startEditingArea}>Edit</button>}
        </div>
        {editingArea ? (
          <>
            <div className="county-checkboxes">
              {COUNTIES.map(c => (
                <label key={c} className="consent-label">
                  <input
                    type="checkbox"
                    checked={areaDraft.includes(c)}
                    onChange={e => setAreaDraft(e.target.checked ? [...areaDraft, c] : areaDraft.filter(x => x !== c))}
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
            <button className="btn btn-primary btn-small" onClick={saveArea}>Save</button>{' '}
            <button className="btn btn-secondary btn-small" onClick={() => setEditingArea(false)}>Cancel</button>
          </>
        ) : data.service_counties.length === 0 ? (
          <p className="empty-state">Choose the counties you serve to start seeing leads.</p>
        ) : (
          <p>{data.service_counties.join(', ')}</p>
        )}
      </div>

      <div className="dashboard-card">
        <div className="card-header">
          <h2>My Active Leads ({active.length})</h2>
        </div>
        {active.length === 0 ? (
          <p className="empty-state">No active leads. Accept one below.</p>
        ) : (
          <ul className="lead-list">
            {active.map(lead => (
              <li key={lead.id} className="lead-item">
                <div className="lead-summary">
                  <strong>{lead.contact_name}</strong> · {lead.county} · {situationLabel(lead.situation)}
                  <span className="lead-readiness">{readinessPercent(lead.checked_items.length)}% ready</span>
                </div>
                <div className="lead-contact">
                  {lead.contact_email && <a href={`mailto:${lead.contact_email}`}>{lead.contact_email}</a>}
                  {lead.contact_phone && <> · <a href={`tel:${lead.contact_phone}`}>{lead.contact_phone}</a></>}
                  {lead.best_time && <> · Best time: {lead.best_time}</>}
                </div>
                <details>
                  <summary>Checklist detail</summary>
                  {checklistData.map((cat, ci) => {
                    const ready = cat.items.filter((_, ii) => lead.checked_items.some(([c, i]) => c === ci && i === ii))
                    const missing = cat.items.filter((_, ii) => !lead.checked_items.some(([c, i]) => c === ci && i === ii))
                    return (
                      <div key={ci} className="lead-category">
                        <h4>{cat.title} ({ready.length}/{cat.items.length})</h4>
                        {ready.length > 0 && <p><strong>Ready:</strong> {ready.join('; ')}</p>}
                        {missing.length > 0 && <p><strong>Still needed:</strong> {missing.join('; ')}</p>}
                      </div>
                    )
                  })}
                </details>
                <div className="lead-actions">
                  <button className="btn btn-primary btn-small" disabled={busyId === lead.id} onClick={() => act(lead.id, 'close')}>
                    Mark closed
                  </button>{' '}
                  <button className="btn btn-secondary btn-small" disabled={busyId === lead.id} onClick={() => act(lead.id, 'release')}>
                    Release to others
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="dashboard-card">
        <div className="card-header">
          <h2>Available Leads ({data.open.length})</h2>
          <button className="btn btn-secondary btn-small" onClick={reload} disabled={loading}>Refresh</button>
        </div>
        {data.open.length === 0 ? (
          <p className="empty-state">No open leads in your counties right now.</p>
        ) : (
          <ul className="lead-list">
            {data.open.map(lead => {
              const total = Object.values(lead.category_counts).reduce((a, b) => a + b, 0)
              return (
                <li key={lead.id} className="lead-item">
                  <div className="lead-summary">
                    <strong>{lead.first_name}</strong> · {lead.county} · {situationLabel(lead.situation)}
                    <span className="lead-readiness">{readinessPercent(total)}% ready</span>
                  </div>
                  <div className="lead-categories">
                    {checklistData.map((cat, ci) => (
                      <span key={ci} className="lead-chip">
                        {cat.title}: {lead.category_counts[ci] ?? 0}/{cat.items.length}
                      </span>
                    ))}
                  </div>
                  <div className="lead-meta">Requested {new Date(lead.created_at).toLocaleDateString()}</div>
                  <button className="btn btn-primary btn-small" disabled={busyId === lead.id} onClick={() => act(lead.id, 'claim')}>
                    {busyId === lead.id ? 'Accepting...' : 'Accept lead'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {past.length > 0 && (
        <div className="dashboard-card">
          <div className="card-header">
            <h2>Past Leads</h2>
          </div>
          <ul className="lead-list">
            {past.map(lead => (
              <li key={lead.id} className="lead-item">
                <strong>{lead.contact_name}</strong> · {lead.county} ·{' '}
                {lead.status === 'withdrawn' ? 'Withdrawn by homeowner — please stop contact' : 'Closed'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
