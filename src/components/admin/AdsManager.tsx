import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import { COUNTIES, adCategoryLabels } from '../../lib/constants'

type Ad = {
  id: string
  business_name: string
  category: string
  headline: string
  description: string | null
  phone: string | null
  website: string | null
  license_label: string | null
  license_number: string | null
  counties: string[]
  active: boolean
  starts_on: string | null
  ends_on: string | null
  view_count: number
  click_count: number
  contact_name: string | null
  contact_email: string | null
  monthly_price: number | null
  internal_notes: string | null
  report_token: string | null
}

type Draft = Omit<Ad, 'id' | 'view_count' | 'click_count' | 'report_token' | 'monthly_price'> & { monthly_price: string }

const blank: Draft = {
  business_name: '', category: 'movers', headline: '', description: '', phone: '', website: '', license_label: 'Cal-T',
  license_number: '', counties: [], active: false, starts_on: '', ends_on: '', contact_name: '', contact_email: '',
  monthly_price: '', internal_notes: ''
}

const reportLink = (token: string) => `${window.location.origin}${window.location.pathname}#/ad-report/${token}`

// SonderBe staff set up and manage service ads (movers, storage...) for advertisers
export function AdsManager() {
  const [ads, setAds] = useState<Ad[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // No synchronous setState here — it runs from the mount effect
  const fetchAds = useCallback(() => {
    apiGet<{ ads: Ad[] }>('/admin/ads')
      .then(res => {
        setAds(res.ads)
        setError(null)
      })
      .catch(err => {
        console.error('Error loading ads:', err)
        setError('Failed to load ads')
      })
  }, [])

  useEffect(() => {
    fetchAds()
  }, [fetchAds])

  const copyReport = async (ad: Ad) => {
    let token = ad.report_token
    if (!token) token = (await apiPost<{ report_token: string }>(`/admin/ads/${ad.id}/report-link`)).report_token
    try {
      await navigator.clipboard.writeText(reportLink(token))
      setCopied(ad.id)
    } catch {
      setCopied(null)
    }
    if (!ad.report_token) fetchAds()
  }

  if (error) return <div className="error-message">{error}</div>
  if (!ads) return <p>Loading ads...</p>

  const totals = ads.reduce((t, a) => ({ views: t.views + a.view_count, clicks: t.clicks + a.click_count }), { views: 0, clicks: 0 })

  return (
    <div className="ads-manager">
      <div className="page-header">
        <h1>Service Ads</h1>
        <p>
          Paid listings on the homeowner "Moving Forward" page. Advertisers never get homeowner data; send them their
          report link to see views and clicks. No loans, debt relief, credit repair or cash home buyers.
        </p>
      </div>

      <div className="stat-tiles">
        <div className="stat-tile"><span className="stat-num">{ads.filter(a => a.active).length}</span><span>Live ads</span></div>
        <div className="stat-tile"><span className="stat-num">{totals.views}</span><span>Views</span></div>
        <div className="stat-tile"><span className="stat-num">{totals.clicks}</span><span>Clicks</span></div>
      </div>

      {editing === 'new' ? (
        <AdForm initial={blank} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); fetchAds() }} />
      ) : (
        <button className="btn btn-primary btn-small" onClick={() => setEditing('new')}>+ New ad</button>
      )}

      <ul className="ad-admin-list">
        {ads.map(ad => (
          <li key={ad.id} className="dashboard-card">
            {editing === ad.id ? (
              <AdForm
                id={ad.id}
                initial={{
                  ...ad,
                  description: ad.description ?? '', phone: ad.phone ?? '', website: ad.website ?? '',
                  license_label: ad.license_label ?? '', license_number: ad.license_number ?? '',
                  starts_on: ad.starts_on ?? '', ends_on: ad.ends_on ?? '', contact_name: ad.contact_name ?? '',
                  contact_email: ad.contact_email ?? '', internal_notes: ad.internal_notes ?? '',
                  monthly_price: ad.monthly_price === null ? '' : String(ad.monthly_price)
                }}
                onCancel={() => setEditing(null)}
                onSaved={() => { setEditing(null); fetchAds() }}
              />
            ) : (
              <>
                <div className="card-header">
                  <div>
                    <span className="ad-category">{adCategoryLabels[ad.category] ?? ad.category}</span>
                    <h3>{ad.business_name}</h3>
                  </div>
                  <span className={`license-badge ${ad.active ? 'verified' : 'pending'}`}>{ad.active ? 'Live' : 'Off'}</span>
                </div>
                <p className="ad-headline">{ad.headline}</p>
                <p className="pro-subtitle">
                  {ad.counties.length ? ad.counties.join(', ') : 'No counties'}
                  {ad.starts_on || ad.ends_on ? ` · ${ad.starts_on ?? '…'} to ${ad.ends_on ?? 'open-ended'}` : ''}
                  {ad.monthly_price !== null ? ` · $${ad.monthly_price}/month` : ''}
                  {ad.license_number ? ` · ${ad.license_label ?? 'License'} #${ad.license_number}` : ''}
                </p>
                <p>
                  {ad.view_count} views · {ad.click_count} clicks
                  {ad.view_count > 0 ? ` (${((ad.click_count / ad.view_count) * 100).toFixed(1)}% clicked)` : ''}
                </p>
                {ad.contact_name || ad.contact_email ? (
                  <p className="pro-subtitle">Contact: {ad.contact_name}{ad.contact_email ? ` <${ad.contact_email}>` : ''}</p>
                ) : null}
                <div className="save-row">
                  <button className="btn btn-secondary btn-small" onClick={() => setEditing(ad.id)}>Edit</button>
                  <button className="btn-link" onClick={() => copyReport(ad)}>{copied === ad.id ? '✓ Report link copied' : 'Copy report link'}</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function AdForm({ id, initial, onCancel, onSaved }: { id?: string; initial: Draft; onCancel: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }))
  const fid = id ?? 'new'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (id) await apiPut(`/admin/ads/${id}`, d)
      else await apiPost('/admin/ads', d)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!id) return
    setBusy(true)
    try {
      await apiDelete(`/admin/ads/${id}`)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setBusy(false)
    }
  }

  const input = (k: keyof Draft, label: string, props: Record<string, unknown> = {}) => (
    <div className="form-group">
      <label htmlFor={`ad-${fid}-${k}`}>{label}</label>
      <input id={`ad-${fid}-${k}`} value={(d[k] as string) ?? ''} onChange={e => set(k, e.target.value as never)} {...props} />
    </div>
  )

  return (
    <form className="dashboard-card ad-form" onSubmit={submit}>
      <h3>{id ? 'Edit ad' : 'New ad'}</h3>
      <div className="form-row">
        {input('business_name', 'Business name', { maxLength: 120, required: true })}
        <div className="form-group">
          <label htmlFor={`ad-${fid}-category`}>Category</label>
          <select id={`ad-${fid}-category`} value={d.category} onChange={e => set('category', e.target.value)}>
            {Object.entries(adCategoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      {input('headline', 'Headline (what homeowners see first)', { maxLength: 120, required: true })}
      <div className="form-group">
        <label htmlFor={`ad-${fid}-description`}>Description</label>
        <textarea id={`ad-${fid}-description`} rows={2} maxLength={500} value={d.description ?? ''} onChange={e => set('description', e.target.value)} />
      </div>
      <div className="form-row">
        {input('phone', 'Phone', { type: 'tel', maxLength: 30 })}
        {input('website', 'Website', { type: 'url', maxLength: 200, placeholder: 'https://' })}
      </div>
      <div className="form-row">
        {input('license_label', 'License type', { maxLength: 30, placeholder: d.category === 'movers' ? 'Cal-T' : 'e.g. Business license' })}
        {input('license_number', d.category === 'movers' ? 'Cal-T permit number (required to go live)' : 'License number', { maxLength: 40 })}
      </div>
      <fieldset className="income-fieldset">
        <legend>Counties</legend>
        <div className="chip-checks">
          {COUNTIES.map(c => (
            <label key={c} className={`chip-check ${d.counties.includes(c) ? 'checked' : ''}`}>
              <input type="checkbox" checked={d.counties.includes(c)}
                onChange={e => set('counties', e.target.checked ? [...d.counties, c] : d.counties.filter(x => x !== c))} />
              {c}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form-row">
        {input('starts_on', 'Starts', { type: 'date' })}
        {input('ends_on', 'Ends (optional)', { type: 'date' })}
        {input('monthly_price', 'Monthly price ($)', { type: 'number', min: 0, step: '0.01' })}
      </div>
      <h4>Advertiser contact (internal)</h4>
      <div className="form-row">
        {input('contact_name', 'Contact name', { maxLength: 120 })}
        {input('contact_email', 'Contact email', { type: 'email', maxLength: 254 })}
      </div>
      <div className="form-group">
        <label htmlFor={`ad-${fid}-notes`}>Internal notes</label>
        <textarea id={`ad-${fid}-notes`} rows={2} maxLength={2000} value={d.internal_notes ?? ''} onChange={e => set('internal_notes', e.target.value)} />
      </div>
      <label className="consent-label">
        <input type="checkbox" checked={d.active} onChange={e => set('active', e.target.checked)} />
        <span>Live (shown to homeowners in the chosen counties between the dates)</span>
      </label>
      <div className="save-row">
        <button type="submit" className="btn btn-primary btn-small" disabled={busy}>{busy ? 'Saving...' : 'Save ad'}</button>
        {error && <div className="error-message" role="alert">{error}</div>}
        <button type="button" className="btn btn-secondary btn-small" onClick={onCancel} disabled={busy}>Cancel</button>
        {id && <button type="button" className="btn-link" onClick={remove} disabled={busy}>Delete ad</button>}
      </div>
    </form>
  )
}
