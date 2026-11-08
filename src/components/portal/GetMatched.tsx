import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useMatch } from '../../hooks/useMatch'
import { Link } from 'react-router-dom'
import { COUNTIES, situationOptions } from '../../lib/constants'

export function GetMatched() {
  const { profile } = useAuth()
  const { request, professional, consentText, loading, error, requestMatch, withdraw, reload } = useMatch()

  const [county, setCounty] = useState('')
  const [situation, setSituation] = useState('')
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [bestTime, setBestTime] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="get-matched">
        <div className="error-message">{error}</div>
        <button className="btn btn-secondary" onClick={reload}>Retry</button>
      </div>
    )
  }

  const handleWithdraw = async () => {
    setSubmitting(true)
    setFormError(null)
    try {
      await withdraw()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to withdraw')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!county || !situation) {
      setFormError('Please choose your county and situation.')
      return
    }
    if (!consent) {
      setFormError('Please check the box to agree to be contacted.')
      return
    }
    setSubmitting(true)
    try {
      await requestMatch({ county, situation, contact_name: name, contact_phone: phone, best_time: bestTime, consent })
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to send request')
    } finally {
      setSubmitting(false)
    }
  }

  const active = request && (request.status === 'open' || request.status === 'claimed')

  if (active) {
    return (
      <div className="get-matched">
        <div className="page-header">
          <h1>Get Matched</h1>
        </div>
        <div className="dashboard-card">
          {request.status === 'open' ? (
            <>
              <h2>Your request is in</h2>
              <p>
                We're looking for a professional who serves <strong>{request.county} County</strong>.
                Once one accepts, their name and contact details will appear here, and they'll reach out to you.
              </p>
              <p>While you wait, keep working on your <Link to="/portal/checklist">readiness checklist</Link> — it helps them help you faster.</p>
            </>
          ) : (
            <>
              <h2>You've been matched</h2>
              {professional ? (
                <ul className="match-contact">
                  <li><strong>{professional.full_name || 'Your professional'}</strong></li>
                  <li>Email: <a href={`mailto:${professional.email}`}>{professional.email}</a></li>
                  {professional.phone && <li>Phone: <a href={`tel:${professional.phone}`}>{professional.phone}</a></li>}
                </ul>
              ) : (
                <p>A professional has accepted your request and will contact you soon.</p>
              )}
              <p>
                They'll ask for your documents directly. Only send them through a method you trust,
                and never pay anyone upfront for foreclosure help.
              </p>
            </>
          )}
          {formError && <div className="error-message">{formError}</div>}
          <button className="btn btn-secondary" onClick={handleWithdraw} disabled={submitting}>
            {submitting ? 'Withdrawing...' : 'Withdraw my request'}
          </button>
          <p className="form-note">Withdrawing stops further contact and hides your details from the professional.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="get-matched">
      <div className="page-header">
        <h1>Get Matched with a Professional</h1>
        <p>
          Ask to be connected with one real estate professional in your county who works with homeowners facing
          foreclosure. It's free for homeowners and you can withdraw at any time.
        </p>
        {request?.status === 'withdrawn' && <p>You withdrew your last request. You can send a new one below.</p>}
        {request?.status === 'closed' && <p>Your last match was closed. You can request a new one below.</p>}
      </div>

      <form className="dashboard-card match-form" onSubmit={handleSubmit}>
        {formError && <div className="error-message">{formError}</div>}

        <div className="form-group">
          <label htmlFor="match-county">County</label>
          <select id="match-county" value={county} onChange={e => setCounty(e.target.value)} required>
            <option value="">Select your county</option>
            {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="match-situation">Your situation</label>
          <select id="match-situation" value={situation} onChange={e => setSituation(e.target.value)} required>
            {situationOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="match-name">Your name</label>
          <input id="match-name" value={name} onChange={e => setName(e.target.value)} maxLength={100} required />
        </div>

        <div className="form-group">
          <label htmlFor="match-phone">Phone (optional)</label>
          <input id="match-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={30} />
        </div>

        <div className="form-group">
          <label htmlFor="match-time">Best time to reach you (optional)</label>
          <input id="match-time" value={bestTime} onChange={e => setBestTime(e.target.value)} maxLength={200}
            placeholder="e.g. weekday evenings" />
        </div>

        <label className="consent-label">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
          <span>{consentText}</span>
        </label>

        <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
          {submitting ? 'Sending...' : 'Request a match'}
        </button>
      </form>
    </div>
  )
}
