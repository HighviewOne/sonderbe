import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiGet, apiPut } from '../../lib/api'
import type { ProfessionalOffice } from '../../hooks/useMatch'
import { MyListing } from './MyListing'

type Loaded = { profile: { email: string; full_name: string | null; phone: string | null }; info: ProfessionalOffice | null }
type Form = ProfessionalOffice & { full_name: string; phone: string }

const blank: ProfessionalOffice = {
  office_street: '', office_unit: '', office_city: '', office_state: 'CA', office_zip: '', office_phone: '', fax: '',
  document_email: '', document_instructions: '', office_hours: ''
}

// The professional's own details: private contact info clients see once they work together,
// then the public directory listing
export function ProInformation() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiGet<Loaded>('/leads/info')
      .then(setLoaded)
      .catch(err => {
        console.error('Error loading your information:', err)
        setError('Failed to load your information. Please refresh.')
      })
  }, [])

  return (
    <div className="pro-information">
      <div className="page-header">
        <h1>My Information</h1>
        <p>Your contact details go to clients you work with. Your listing is what homeowners see in the directory.</p>
      </div>
      {error ? <div className="error-message">{error}</div> : !loaded ? <p>Loading...</p> : <ContactForm loaded={loaded} />}
      <MyListing embedded />
    </div>
  )
}

function ContactForm({ loaded }: { loaded: Loaded }) {
  const [f, setF] = useState<Form>(() => ({
    ...blank,
    ...Object.fromEntries(Object.entries(loaded.info ?? {}).map(([k, v]) => [k, v ?? ''])),
    full_name: loaded.profile.full_name ?? '',
    phone: loaded.profile.phone ?? ''
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const set = (k: keyof Form, v: string) => {
    setF(prev => ({ ...prev, [k]: v }))
    setSaved(false)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await apiPut('/leads/info', f)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  const field = (k: keyof Form, label: string, props: Record<string, unknown> = {}) => (
    <div className="form-group">
      <label htmlFor={`pi-${k}`}>{label}</label>
      <input id={`pi-${k}`} value={f[k] ?? ''} onChange={e => set(k, e.target.value)} {...props} />
    </div>
  )

  return (
    <form className="dashboard-card" onSubmit={submit}>
      <h2>Contact details</h2>
      <p className="form-note">Shown to clients who chose you, on their case page. Not shown in the public directory.</p>
      {error && <div className="error-message">{error}</div>}
      <div className="form-row">
        {field('full_name', 'Full name', { maxLength: 100, required: true, autoComplete: 'name' })}
        <div className="form-group">
          <label htmlFor="pi-email">Login email</label>
          <input id="pi-email" value={loaded.profile.email} disabled />
        </div>
      </div>
      <div className="form-row">
        {field('phone', 'Mobile phone', { type: 'tel', maxLength: 30 })}
        {field('office_phone', 'Office phone', { type: 'tel', maxLength: 30 })}
        {field('fax', 'Fax (for documents)', { type: 'tel', maxLength: 30 })}
      </div>
      <h3>Office</h3>
      <div className="form-row">
        <div className="form-group grow-2">
          <label htmlFor="pi-office_street">Street address</label>
          <input id="pi-office_street" value={f.office_street ?? ''} onChange={e => set('office_street', e.target.value)} maxLength={120} autoComplete="address-line1" />
        </div>
        {field('office_unit', 'Suite', { maxLength: 30 })}
      </div>
      <div className="form-row">
        {field('office_city', 'City', { maxLength: 60 })}
        {field('office_state', 'State', { maxLength: 30 })}
        {field('office_zip', 'ZIP', { maxLength: 10, inputMode: 'numeric' })}
      </div>
      {field('office_hours', 'Office hours', { maxLength: 200, placeholder: 'e.g. Mon–Fri 9–6, Sat by appointment' })}
      <h3>How clients send you documents</h3>
      {field('document_email', 'Email for documents', { type: 'email', maxLength: 254, placeholder: 'e.g. docs@yourbrokerage.com' })}
      <div className="form-group">
        <label htmlFor="pi-instructions">Instructions for clients (optional)</label>
        <textarea id="pi-instructions" rows={3} maxLength={1000} value={f.document_instructions ?? ''}
          onChange={e => set('document_instructions', e.target.value)}
          placeholder="e.g. Email PDFs with your last name in the subject line, or drop paper copies at the front desk." />
      </div>
      <button type="submit" className="btn btn-primary btn-small" disabled={busy}>{busy ? 'Saving...' : 'Save contact details'}</button>
      {saved && <span className="form-note"> ✓ Saved</span>}
    </form>
  )
}
