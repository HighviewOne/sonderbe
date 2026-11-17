import { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet, apiPatch } from '../../lib/api'
import { professionalTypeLabel } from '../../lib/constants'
import { formatDate } from '../../lib/format'

type Pro = {
  id: string
  full_name: string | null
  email: string
  business_name: string | null
  professional_type: 'agent' | 'broker' | 'attorney'
  license_number: string | null
  license_verified: boolean
  license_verified_at: string | null
  verified_by_name: string | null
  listed: boolean
  created_at: string
}

type Check = {
  id: string
  license_number: string | null
  professional_type: string | null
  action: 'verified' | 'removed' | 'cleared'
  admin_name: string | null
  created_at: string
}

const ACTION_LABEL: Record<Check['action'], string> = {
  verified: 'Verified',
  removed: 'Verification removed',
  cleared: 'Cleared: the professional changed their number or type'
}

type Filter = 'pending' | 'verified' | 'missing' | 'all'

const FILTERS: { value: Filter; label: string; empty: string }[] = [
  { value: 'pending', label: 'To check', empty: 'Nothing to check. Every license number on file is verified.' },
  { value: 'verified', label: 'Verified', empty: 'No verified licenses yet.' },
  { value: 'missing', label: 'No number', empty: 'Every licensed professional has entered a number.' },
  { value: 'all', label: 'All', empty: 'No licensed professionals yet.' }
]

// The state's public lookup for this license: DRE for agents and brokers, State Bar for attorneys
function lookup(pro: Pro): { href: string; label: string } | null {
  if (!pro.license_number) return null
  const n = encodeURIComponent(pro.license_number.replace(/\s+/g, ''))
  return pro.professional_type === 'attorney'
    ? { href: `https://apps.calbar.ca.gov/attorney/Licensee/Detail/${n}`, label: 'Look up on the State Bar site' }
    : { href: `https://www2.dre.ca.gov/PublicASP/pplinfo.asp?License_id=${n}`, label: 'Look up on the DRE site' }
}

// Every check of one professional's license, newest first, loaded when opened
function LicenseHistory({ proId }: { proId: string }) {
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<{ checks: Check[] }>(`/admin/licenses/${proId}/history`)
      .then(res => setChecks(res.checks))
      .catch(err => {
        console.error('Error loading license history:', err)
        setError('Failed to load the history.')
      })
  }, [proId])

  if (error) return <div className="error-message">{error}</div>
  if (!checks) return <p>Loading...</p>
  if (checks.length === 0) return <p className="empty-state">No checks recorded yet.</p>
  return (
    <ul className="license-history">
      {checks.map(c => (
        <li key={c.id}>
          {formatDate(c.created_at)} · {ACTION_LABEL[c.action]}
          {c.license_number && <> · {c.license_number}</>}
          {c.admin_name && <> · by {c.admin_name}</>}
        </li>
      ))}
    </ul>
  )
}

// Staff check each professional's license on the state's site, then mark it verified. Homeowners
// see "License verified" only after this; a professional changing their number or type clears it.
export function LicenseManager() {
  const [filter, setFilter] = useState<Filter>('pending')
  // The tab showing when a save finishes, which may differ from the one it started on
  const filterRef = useRef<Filter>(filter)
  const [pros, setPros] = useState<Pro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)
  const [historyOpen, setHistoryOpen] = useState<string | null>(null)

  // Only the latest request may update the list: switching tabs while a reload is in
  // flight must not show the old tab's results under the new one
  const latest = useRef(0)

  // No synchronous setState here — it runs from the effect
  const fetchPros = useCallback((f: Filter) => {
    const request = ++latest.current
    apiGet<{ professionals: Pro[] }>(`/admin/licenses?status=${f}`)
      .then(res => {
        if (request !== latest.current) return
        setPros(res.professionals)
        setError(null)
      })
      .catch(err => {
        if (request !== latest.current) return
        console.error('Error loading licenses:', err)
        setError('Failed to load licenses. Please refresh.')
      })
      .finally(() => {
        if (request === latest.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchPros(filter)
  }, [filter, fetchPros])

  const changeFilter = (f: Filter) => {
    if (f === filter) return
    setLoading(true)
    setRowError(null)
    filterRef.current = f
    setFilter(f)
  }

  const setVerified = async (pro: Pro, verified: boolean) => {
    setBusy(pro.id)
    setRowError(null)
    try {
      await apiPatch(`/admin/licenses/${pro.id}`, { verified, license_number: pro.license_number })
      fetchPros(filterRef.current)
    } catch (e) {
      setRowError({ id: pro.id, message: e instanceof Error ? e.message : 'Failed to update the license' })
      // Their number may have changed: show what's on file now
      fetchPros(filterRef.current)
    } finally {
      setBusy(null)
    }
  }

  const current = FILTERS.find(f => f.value === filter)!

  return (
    <div className="license-manager">
      <div className="page-header">
        <h1>Licenses</h1>
        <p>
          Check each number on the state's public lookup. The name and license status there must match before you
          mark it verified. Homeowners see "License verified" only after this.
        </p>
      </div>

      <div className="filter-tabs">
        {FILTERS.map(f => (
          <button key={f.value} type="button" className={`filter-tab ${filter === f.value ? 'active' : ''}`}
            onClick={() => changeFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {error ? <div className="error-message">{error}</div>
        : loading ? <p>Loading...</p>
        : pros.length === 0 ? <p className="empty-state">{current.empty}</p>
        : (
          <ul className="ad-admin-list">
            {pros.map(pro => {
              const link = lookup(pro)
              return (
                <li key={pro.id} className="dashboard-card">
                  <div className="card-header">
                    <div>
                      <span className="ad-category">{professionalTypeLabel(pro.professional_type)}</span>
                      <h3>{pro.full_name || pro.email}</h3>
                    </div>
                    <span className={`license-badge ${pro.license_verified ? 'verified' : 'pending'}`}>
                      {pro.license_verified ? '✓ Verified' : 'Not verified'}
                    </span>
                  </div>
                  <p className="pro-subtitle">
                    {pro.business_name || 'No business name'} · {pro.email} · joined {formatDate(pro.created_at)}
                    {pro.listed ? ' · listed' : ' · not listed'}
                  </p>
                  <p>
                    {pro.professional_type === 'attorney' ? 'State Bar number' : 'DRE license number'}:{' '}
                    <strong>{pro.license_number ?? 'not entered'}</strong>
                  </p>
                  {pro.license_verified && pro.license_verified_at && (
                    <p className="pro-subtitle">
                      Verified {formatDate(pro.license_verified_at)}
                      {pro.verified_by_name ? ` by ${pro.verified_by_name}` : ''}
                    </p>
                  )}
                  <div className="save-row">
                    {link && (
                      <a className="btn-link" href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
                    )}
                    {pro.license_number && (pro.license_verified ? (
                      <button type="button" className="btn btn-secondary btn-small" disabled={busy === pro.id}
                        onClick={() => setVerified(pro, false)}>
                        Remove verification
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary btn-small" disabled={busy === pro.id}
                        onClick={() => setVerified(pro, true)}>
                        {busy === pro.id ? 'Saving...' : 'Mark verified'}
                      </button>
                    ))}
                    <button type="button" className="btn-link" aria-expanded={historyOpen === pro.id}
                      onClick={() => setHistoryOpen(historyOpen === pro.id ? null : pro.id)}>
                      {historyOpen === pro.id ? 'Hide history' : 'History'}
                    </button>
                  </div>
                  {historyOpen === pro.id && <LicenseHistory key={`${pro.id}-${pro.license_verified_at}`} proId={pro.id} />}
                  {rowError?.id === pro.id && <div className="error-message" role="alert">{rowError.message}</div>}
                </li>
              )
            })}
          </ul>
        )}
    </div>
  )
}
