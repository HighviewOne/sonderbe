import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { adCategoryLabels } from '../lib/constants'
import { formatDate } from '../lib/format'

type Report = {
  business_name: string
  category: string
  headline: string
  counties: string[]
  active: boolean
  starts_on: string | null
  ends_on: string | null
  view_count: number
  click_count: number
  created_at: string
}

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

// /ad-report/:token — an advertiser's private report (no login; the link is the key)
export function AdReportPage() {
  const { token = '' } = useParams()
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${BASE_URL}/ads/report/${encodeURIComponent(token)}`)
      .then(async r => {
        if (!r.ok) throw new Error('This report link is not valid. Ask SonderBe for a new one.')
        setReport(await r.json())
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load the report'))
  }, [token])

  return (
    <main className="portal-page">
      <div className="portal-container">
        <div className="portal-content">
          {error ? <div className="error-message">{error}</div> : !report ? <p>Loading...</p> : (
            <>
              <div className="page-header">
                <h1>{report.business_name}</h1>
                <p>Your SonderBe ad report · {adCategoryLabels[report.category] ?? report.category}</p>
              </div>
              <div className="stat-tiles">
                <div className="stat-tile"><span className="stat-num">{report.view_count}</span><span>Times shown</span></div>
                <div className="stat-tile"><span className="stat-num">{report.click_count}</span><span>Calls or website visits</span></div>
                <div className="stat-tile">
                  <span className="stat-num">{report.view_count ? `${((report.click_count / report.view_count) * 100).toFixed(1)}%` : '—'}</span>
                  <span>Of views that clicked</span>
                </div>
              </div>
              <div className="dashboard-card">
                <p><strong>Headline:</strong> {report.headline}</p>
                <p><strong>Counties:</strong> {report.counties.join(', ') || 'None'}</p>
                <p><strong>Status:</strong> {report.active ? 'Live' : 'Paused'}
                  {report.starts_on ? ` · from ${formatDate(report.starts_on)}` : ` · since ${formatDate(report.created_at)}`}
                  {report.ends_on ? ` to ${formatDate(report.ends_on)}` : ''}</p>
                <p className="form-note">
                  Counts are totals since the ad started. SonderBe does not share homeowners' names or contact details
                  with advertisers.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
