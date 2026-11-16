import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '../../lib/api'
import { COUNTIES, adCategoryLabels } from '../../lib/constants'
import { useMatch } from '../../hooks/useMatch'

type ServiceAd = {
  id: string
  business_name: string
  category: string
  headline: string
  description: string | null
  phone: string | null
  website: string | null
  license_label: string | null
  license_number: string | null
}

// Sponsored local services for the move (movers, storage, cleaning, rentals). Kept on its
// own page, apart from the professional directory. Advertisers never get homeowner data.
export function MovingForward() {
  const { cases, loading: matchLoading } = useMatch()
  if (matchLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }
  return <ServiceList initialCounty={cases[0]?.request.county ?? ''} />
}

function ServiceList({ initialCounty }: { initialCounty: string }) {
  const [county, setCounty] = useState(initialCounty)
  const [ads, setAds] = useState<ServiceAd[] | null>(null)
  const [loading, setLoading] = useState(Boolean(initialCounty))
  const [error, setError] = useState<string | null>(null)

  // No synchronous setState here — it runs from an effect
  const fetchAds = useCallback((c: string) => {
    apiGet<{ ads: ServiceAd[] }>(`/services?county=${encodeURIComponent(c)}`)
      .then(res => {
        setAds(res.ads)
        setError(null)
      })
      .catch(err => {
        console.error('Error loading services:', err)
        setError('Failed to load services. Please try again.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (county) fetchAds(county)
  }, [county, fetchAds])

  const changeCounty = (c: string) => {
    setCounty(c)
    setAds(null)
    if (c) setLoading(true)
  }

  // Counted for the advertiser's report; never blocks the link
  const trackClick = (id: string) => {
    apiPost(`/services/${id}/click`).catch(() => {})
  }

  return (
    <div className="moving-forward">
      <div className="page-header">
        <h1>Moving Forward</h1>
        <p>
          Local services that can help if you're moving: movers, storage, cleaning and rentals. These are paid
          listings. SonderBe doesn't share your information with them; contact them only if you want to.
        </p>
      </div>

      <div className="dashboard-card">
        <div className="form-group">
          <label htmlFor="services-county">County</label>
          <select id="services-county" value={county} onChange={e => changeCounty(e.target.value)}>
            <option value="">Select your county</option>
            {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {!county ? (
        <p className="empty-state">Choose your county to see local services.</p>
      ) : loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading services...</p>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : !ads || ads.length === 0 ? (
        <p className="empty-state">No services listed for {county} County yet.</p>
      ) : (
        <ul className="ad-list">
          {ads.map(ad => (
            <li key={ad.id} className="dashboard-card ad-card">
              <div className="ad-top">
                <span className="ad-category">{adCategoryLabels[ad.category] ?? ad.category}</span>
                <span className="ad-sponsored">Sponsored</span>
              </div>
              <h3>{ad.business_name}</h3>
              <p className="ad-headline">{ad.headline}</p>
              {ad.description && <p>{ad.description}</p>}
              {ad.license_number && (
                <p className="form-note">{ad.license_label ? `${ad.license_label} ` : 'License '}#{ad.license_number}</p>
              )}
              <div className="ad-actions">
                {ad.phone && (
                  <a className="btn btn-secondary btn-small" href={`tel:${ad.phone}`} onClick={() => trackClick(ad.id)}>
                    Call {ad.phone}
                  </a>
                )}
                {ad.website && (
                  <a className="btn btn-secondary btn-small" href={ad.website} target="_blank" rel="noopener noreferrer sponsored"
                    onClick={() => trackClick(ad.id)}>
                    Website
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
