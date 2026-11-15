import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { DirectoryEntry, MatchInput, MatchRequest } from '../../hooks/useMatch'
import { apiGet } from '../../lib/api'
import { COUNTIES, situationOptions, professionalTypes } from '../../lib/constants'
import type { ProfessionalType } from '../../lib/constants'
import { ProfessionalHeader } from '../case/CaseParts'

type Props = {
  previous: MatchRequest | null
  consentText: string
  onChoose: (input: MatchInput) => Promise<void>
}

export function FindProfessional({ previous, consentText, onChoose }: Props) {
  const [county, setCounty] = useState(previous?.county ?? '')
  const [type, setType] = useState<ProfessionalType | ''>('')
  const [pros, setPros] = useState<DirectoryEntry[] | null>(null)
  const [loading, setLoading] = useState(Boolean(previous?.county))
  const [error, setError] = useState<string | null>(null)
  const [choosing, setChoosing] = useState<string | null>(null)

  // No synchronous setState here — it runs from an effect
  const fetchDirectory = useCallback((c: string, t: string) => {
    const params = new URLSearchParams({ county: c })
    if (t) params.set('type', t)
    apiGet<{ professionals: DirectoryEntry[] }>(`/directory?${params}`)
      .then(res => {
        setPros(res.professionals)
        setError(null)
      })
      .catch(err => {
        console.error('Error loading directory:', err)
        setError('Failed to load professionals. Please try again.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (county) fetchDirectory(county, type)
  }, [county, type, fetchDirectory])

  const changeCounty = (c: string) => {
    setCounty(c)
    setChoosing(null)
    setPros(null)
    if (c) setLoading(true)
  }

  const changeType = (t: ProfessionalType | '') => {
    setType(t)
    setChoosing(null)
    if (county) setLoading(true)
  }

  const selectedType = professionalTypes.find(t => t.value === type)

  return (
    <div className="find-professional">
      <div className="page-header">
        <h1>Find a Professional</h1>
        <p>
          Choose one professional in your county to help with your situation. It's free for homeowners, and only
          the professional you choose sees your contact details. You can withdraw at any time.
        </p>
        {previous?.status === 'withdrawn' && <p>You withdrew from your last professional. You can choose someone new below.</p>}
        {previous?.status === 'closed' && <p>Your last case was closed. You can choose a professional again below.</p>}
      </div>

      <div className="dashboard-card warning-card">
        <strong>Never pay anyone upfront for foreclosure help.</strong> In California it is illegal to charge you
        before the work is done. SonderBe lists professionals A–Z and does not recommend or guarantee any of them.
      </div>

      <div className="dashboard-card">
        <div className="form-group">
          <label htmlFor="find-county">Your county</label>
          <select id="find-county" value={county} onChange={e => changeCounty(e.target.value)}>
            <option value="">Select your county</option>
            {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="type-filter" role="group" aria-label="Type of professional">
          <button type="button" className={`type-chip ${type === '' ? 'active' : ''}`} onClick={() => changeType('')}>
            All
          </button>
          {professionalTypes.map(t => (
            <button
              key={t.value}
              type="button"
              className={`type-chip ${type === t.value ? 'active' : ''}`}
              aria-pressed={type === t.value}
              onClick={() => changeType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {selectedType ? (
          <p className="type-description">{selectedType.description}</p>
        ) : (
          <details className="type-help">
            <summary>Which kind of professional do I need?</summary>
            <dl>
              {professionalTypes.map(t => (
                <div key={t.value}>
                  <dt>{t.label}</dt>
                  <dd>{t.description}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>

      {!county ? (
        <p className="empty-state">Choose your county to see professionals who serve it.</p>
      ) : loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading professionals...</p>
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : pros && pros.length === 0 ? (
        <p className="empty-state">
          No {selectedType ? selectedType.label.toLowerCase() + 's' : 'professionals'} serve {county} County yet.
          Try another type, or call the free HOPE Hotline at <a href="tel:1-888-995-4673">1-888-995-4673</a>.
        </p>
      ) : (
        <ul className="directory-list">
          {pros?.map(pro => (
            <li key={pro.id} className="dashboard-card directory-card">
              <ProfessionalHeader pro={pro} />
              {pro.bio && <p className="pro-bio">{pro.bio}</p>}
              <div className="pro-meta">
                Serves: {pro.service_counties.join(', ')}
                {pro.website && <> · <a href={pro.website} target="_blank" rel="noopener noreferrer">Website</a></>}
              </div>

              {pro.direct_contact_only ? (
                <div className="direct-contact">
                  <p>Contact this professional directly. SonderBe does not share your details with them.</p>
                  <ul className="match-contact">
                    {pro.phone && <li>Phone: <a href={`tel:${pro.phone}`}>{pro.phone}</a></li>}
                    {pro.email && <li>Email: <a href={`mailto:${pro.email}`}>{pro.email}</a></li>}
                  </ul>
                </div>
              ) : !pro.accepting ? (
                <p className="form-note">Not taking new clients right now.</p>
              ) : choosing === pro.id ? (
                <ChooseForm
                  pro={pro}
                  county={county}
                  consentText={consentText}
                  previous={previous}
                  onCancel={() => setChoosing(null)}
                  onChoose={onChoose}
                />
              ) : (
                <button className="btn btn-primary" onClick={() => setChoosing(pro.id)}>
                  Choose {pro.full_name?.split(' ')[0] || 'this professional'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ChooseForm({ pro, county, consentText, previous, onCancel, onChoose }: {
  pro: DirectoryEntry
  county: string
  consentText: string
  previous: MatchRequest | null
  onCancel: () => void
  onChoose: (input: MatchInput) => Promise<void>
}) {
  const { profile } = useAuth()
  const [situation, setSituation] = useState(previous?.situation ?? '')
  const [name, setName] = useState(previous?.contact_name ?? profile?.full_name ?? '')
  const [phone, setPhone] = useState(previous?.contact_phone ?? profile?.phone ?? '')
  const [bestTime, setBestTime] = useState(previous?.best_time ?? '')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!situation) {
      setFormError('Please choose your situation.')
      return
    }
    if (!consent) {
      setFormError('Please check the box to share your details with this professional.')
      return
    }
    setSubmitting(true)
    try {
      await onChoose({
        professional_id: pro.id, county, situation,
        contact_name: name, contact_phone: phone, best_time: bestTime, consent
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to choose this professional')
      setSubmitting(false)
    }
  }

  return (
    <form className="choose-form" onSubmit={handleSubmit}>
      <h4>Share your details with {pro.full_name || pro.business_name}</h4>
      {formError && <div className="error-message">{formError}</div>}

      <div className="form-group">
        <label htmlFor={`sit-${pro.id}`}>Your situation</label>
        <select id={`sit-${pro.id}`} value={situation} onChange={e => setSituation(e.target.value)} required>
          {situationOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor={`name-${pro.id}`}>Your name</label>
        <input id={`name-${pro.id}`} value={name} onChange={e => setName(e.target.value)} maxLength={100} required />
      </div>
      <div className="form-group">
        <label htmlFor={`phone-${pro.id}`}>Phone (optional)</label>
        <input id={`phone-${pro.id}`} type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={30} />
      </div>
      <div className="form-group">
        <label htmlFor={`time-${pro.id}`}>Best time to reach you (optional)</label>
        <input id={`time-${pro.id}`} value={bestTime} onChange={e => setBestTime(e.target.value)} maxLength={200}
          placeholder="e.g. weekday evenings" />
      </div>

      <label className="consent-label">
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <span>{consentText}</span>
      </label>

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Sending...' : `Choose ${pro.full_name?.split(' ')[0] || 'this professional'}`}
      </button>{' '}
      <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
    </form>
  )
}
