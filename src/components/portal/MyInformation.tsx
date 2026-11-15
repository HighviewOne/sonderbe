import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiDelete, apiGet, apiPost, apiPut } from '../../lib/api'
import { useMyInfo, infoProgress } from '../../hooks/useMyInfo'
import type { MyInfo, HomeownerInfo, HouseholdMember, ExtraEmail } from '../../hooks/useMyInfo'
import { COUNTIES, relationships, relationshipLabel, incomeTypes, incomeLabel, hardshipReasons } from '../../lib/constants'
import { DocumentExample } from '../case/DocumentExample'

// "My Information": entered once, reused for the document list, the hardship letter and
// what the homeowner's chosen professionals see.
export function MyInformation() {
  const { data, loading, error, reload, patch } = useMyInfo()

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your information...</p>
      </div>
    )
  }
  if (error || !data) {
    return (
      <div>
        <div className="error-message">{error}</div>
        <button className="btn btn-secondary" onClick={reload}>Retry</button>
      </div>
    )
  }
  return <InfoPage data={data} patch={patch} />
}

type InfoForm = HomeownerInfo & { full_name: string; phone: string }

const blankInfo: HomeownerInfo = {
  property_street: '', property_unit: '', property_city: '', property_zip: '', property_county: '',
  mailing_same: true, mailing_street: '', mailing_unit: '', mailing_city: '', mailing_state: '', mailing_zip: '',
  alt_phone: '', preferred_contact: null, best_time: '', servicer_name: '', hardship_reasons: [], hardship_details: ''
}

function InfoPage({ data, patch }: { data: MyInfo; patch: (fn: (prev: MyInfo) => MyInfo) => void }) {
  const [form, setForm] = useState<InfoForm>(() => ({
    ...blankInfo,
    ...Object.fromEntries(Object.entries(data.info ?? {}).map(([k, v]) => [k, v ?? (k === 'hardship_reasons' ? [] : '')])),
    mailing_same: data.info?.mailing_same ?? true,
    preferred_contact: data.info?.preferred_contact ?? null,
    full_name: data.profile.full_name ?? '',
    phone: data.profile.phone ?? ''
  }))
  const [saving, setSaving] = useState<string | null>(null)
  const [savedSection, setSavedSection] = useState<string | null>(null)
  const [error, setError] = useState<{ section: string; message: string } | null>(null)
  const set = <K extends keyof InfoForm>(k: K, v: InfoForm[K]) => {
    setForm(prev => ({ ...prev, [k]: v }))
    setSavedSection(null)
  }

  const progress = infoProgress(data)

  const save = async (section: string, e?: FormEvent) => {
    e?.preventDefault()
    setSaving(section)
    setError(null)
    try {
      const saved = await apiPut<HomeownerInfo>('/me/info', form)
      patch(d => ({ ...d, info: saved, profile: { ...d.profile, full_name: form.full_name, phone: form.phone || null } }))
      setSavedSection(section)
    } catch (err) {
      setError({ section, message: err instanceof Error ? err.message : 'Failed to save' })
    } finally {
      setSaving(null)
    }
  }

  const SaveRow = ({ section }: { section: string }) => (
    <div className="save-row">
      <button type="submit" className="btn btn-primary btn-small" disabled={saving !== null}>
        {saving === section ? 'Saving...' : 'Save'}
      </button>
      {savedSection === section && <span className="form-note">✓ Saved</span>}
      {error?.section === section && <span className="error-message">{error.message}</span>}
    </div>
  )

  return (
    <div className="my-information">
      <div className="page-header">
        <h1>My Information</h1>
        <p>
          Fill this in once. SonderBe uses it to build your document list, draft your hardship letter, and give the
          professionals you choose what they need, so you don't have to repeat yourself.
        </p>
      </div>

      <div className="dashboard-card info-progress">
        <strong>{progress.done} of {progress.total} sections done</strong>
        <ul className="section-steps">
          {(['contact', 'property', 'household', 'hardship'] as const).map(k => (
            <li key={k} className={progress.sections[k] ? 'done' : ''}>
              <a href={`#info-${k}`}>{progress.sections[k] ? '✓ ' : ''}{{ contact: 'Contact', property: 'Home', household: 'Household', hardship: 'Hardship' }[k]}</a>
            </li>
          ))}
        </ul>
      </div>

      {/* Contact */}
      <form id="info-contact" className="dashboard-card" onSubmit={e => save('contact', e)}>
        <h2>1. How to reach you</h2>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="mi-name">Full name</label>
            <input id="mi-name" value={form.full_name} onChange={e => set('full_name', e.target.value)} maxLength={100} required autoComplete="name" />
          </div>
          <div className="form-group">
            <label htmlFor="mi-phone">Main phone</label>
            <input id="mi-phone" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} maxLength={30} autoComplete="tel" />
          </div>
          <div className="form-group">
            <label htmlFor="mi-alt">Second phone (optional)</label>
            <input id="mi-alt" type="tel" value={form.alt_phone ?? ''} onChange={e => set('alt_phone', e.target.value)} maxLength={30} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="mi-pref">Best way to reach you</label>
            <select id="mi-pref" value={form.preferred_contact ?? ''} onChange={e => set('preferred_contact', (e.target.value || null) as HomeownerInfo['preferred_contact'])}>
              <option value="">No preference</option>
              <option value="phone">Phone call</option>
              <option value="text">Text message</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="mi-time">Best time</label>
            <input id="mi-time" value={form.best_time ?? ''} onChange={e => set('best_time', e.target.value)} maxLength={200} placeholder="e.g. weekday evenings" />
          </div>
        </div>
        <SaveRow section="contact" />
        <Emails main={data.profile.email} emails={data.emails} onChanged={emails => patch(d => ({ ...d, emails }))} />
      </form>

      {/* Property */}
      <form id="info-property" className="dashboard-card" onSubmit={e => save('property', e)}>
        <h2>2. Your home</h2>
        <div className="form-row">
          <div className="form-group grow-2">
            <label htmlFor="mi-street">Street address</label>
            <input id="mi-street" value={form.property_street ?? ''} onChange={e => set('property_street', e.target.value)} maxLength={120} autoComplete="address-line1" />
          </div>
          <div className="form-group">
            <label htmlFor="mi-unit">Unit (optional)</label>
            <input id="mi-unit" value={form.property_unit ?? ''} onChange={e => set('property_unit', e.target.value)} maxLength={30} autoComplete="address-line2" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="mi-city">City</label>
            <input id="mi-city" value={form.property_city ?? ''} onChange={e => set('property_city', e.target.value)} maxLength={60} autoComplete="address-level2" />
          </div>
          <div className="form-group">
            <label htmlFor="mi-zip">ZIP</label>
            <input id="mi-zip" inputMode="numeric" value={form.property_zip ?? ''} onChange={e => set('property_zip', e.target.value)} maxLength={10} autoComplete="postal-code" />
          </div>
          <div className="form-group">
            <label htmlFor="mi-county">County</label>
            <select id="mi-county" value={form.property_county ?? ''} onChange={e => set('property_county', e.target.value)}>
              <option value="">Select</option>
              {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <label className="consent-label">
          <input type="checkbox" checked={form.mailing_same} onChange={e => set('mailing_same', e.target.checked)} />
          <span>I get my mail at this address</span>
        </label>
        {!form.mailing_same && (
          <>
            <div className="form-row">
              <div className="form-group grow-2">
                <label htmlFor="mi-mstreet">Mailing street address</label>
                <input id="mi-mstreet" value={form.mailing_street ?? ''} onChange={e => set('mailing_street', e.target.value)} maxLength={120} />
              </div>
              <div className="form-group">
                <label htmlFor="mi-munit">Unit</label>
                <input id="mi-munit" value={form.mailing_unit ?? ''} onChange={e => set('mailing_unit', e.target.value)} maxLength={30} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="mi-mcity">City</label>
                <input id="mi-mcity" value={form.mailing_city ?? ''} onChange={e => set('mailing_city', e.target.value)} maxLength={60} />
              </div>
              <div className="form-group">
                <label htmlFor="mi-mstate">State</label>
                <input id="mi-mstate" value={form.mailing_state ?? ''} onChange={e => set('mailing_state', e.target.value)} maxLength={30} />
              </div>
              <div className="form-group">
                <label htmlFor="mi-mzip">ZIP</label>
                <input id="mi-mzip" inputMode="numeric" value={form.mailing_zip ?? ''} onChange={e => set('mailing_zip', e.target.value)} maxLength={10} />
              </div>
            </div>
          </>
        )}
        <div className="form-group">
          <label htmlFor="mi-servicer">Who do you pay your mortgage to? (your servicer, from your mortgage statement)</label>
          <input id="mi-servicer" value={form.servicer_name ?? ''} onChange={e => set('servicer_name', e.target.value)} maxLength={120} placeholder="e.g. Example Home Loan Servicing" />
        </div>
        <SaveRow section="property" />
      </form>

      {/* Household */}
      <div id="info-household" className="dashboard-card">
        <h2>3. Who lives in the home</h2>
        <p className="form-note">
          List everyone, and what kind of income each person has. No dollar amounts needed. Each person's income
          adds the right documents to your list automatically.
        </p>
        <Household household={data.household} onChanged={household => patch(d => ({ ...d, household }))} />
        <DocumentPreview household={data.household} />
      </div>

      {/* Hardship */}
      <form id="info-hardship" className="dashboard-card" onSubmit={e => save('hardship', e)}>
        <h2>4. What happened</h2>
        <p className="form-note">Pick everything that applies. This drafts your hardship letter.</p>
        <div className="chip-checks">
          {hardshipReasons.map(r => (
            <label key={r.value} className={`chip-check ${form.hardship_reasons.includes(r.value) ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={form.hardship_reasons.includes(r.value)}
                onChange={e => set('hardship_reasons', e.target.checked
                  ? [...form.hardship_reasons, r.value]
                  : form.hardship_reasons.filter(x => x !== r.value))}
              />
              {r.label}
            </label>
          ))}
        </div>
        <div className="form-group">
          <label htmlFor="mi-details">In your own words (optional): when it happened and how it changed your income</label>
          <textarea id="mi-details" rows={4} value={form.hardship_details ?? ''} onChange={e => set('hardship_details', e.target.value)} maxLength={2000}
            placeholder="e.g. In March my hours were cut in half, and we fell three payments behind." />
        </div>
        <SaveRow section="hardship" />
        <p><Link to="/portal/hardship-letter">Draft my hardship letter →</Link></p>
      </form>
    </div>
  )
}

function Emails({ main, emails, onChanged }: { main: string; emails: ExtraEmail[]; onChanged: (e: ExtraEmail[]) => void }) {
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState('personal')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = async () => {
    setBusy(true)
    setError(null)
    try {
      const saved = await apiPost<ExtraEmail>('/me/emails', { email, label })
      onChanged([...emails, saved])
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await apiDelete(`/me/emails/${id}`)
      onChanged(emails.filter(e => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove')
    }
  }

  return (
    <div className="emails-block">
      <h4>Emails</h4>
      <ul className="email-list">
        <li><span>{main}</span> <span className="license-badge verified">Main · your login</span></li>
        {emails.map(e => (
          <li key={e.id}>
            <span>{e.email}</span> {e.label && <span className="license-badge pending">{e.label}</span>}
            <button type="button" className="btn-link" onClick={() => remove(e.id)}>Remove</button>
          </li>
        ))}
      </ul>
      {emails.length < 5 && (
        <div className="add-doc">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Add another email" aria-label="Another email" maxLength={254} />
          <select value={label} onChange={e => setLabel(e.target.value)} aria-label="Email type">
            <option value="personal">Personal</option>
            <option value="work">Work</option>
            <option value="other">Other</option>
          </select>
          <button type="button" className="btn btn-secondary btn-small" onClick={add} disabled={busy || !email.trim()}>Add</button>
        </div>
      )}
      {error && <div className="error-message">{error}</div>}
    </div>
  )
}

type MemberDraft = Omit<HouseholdMember, 'id' | 'is_self'>
const blankMember: MemberDraft = { full_name: '', relationship: 'spouse', on_mortgage: false, income_types: [], employer: '' }

function Household({ household, onChanged }: { household: HouseholdMember[]; onChanged: (h: HouseholdMember[]) => void }) {
  const [editing, setEditing] = useState<string | 'new' | null>(() => {
    const self = household.find(m => m.is_self)
    return self && self.income_types.length === 0 ? self.id : null
  })

  return (
    <>
      <ul className="household-list">
        {household.map(m => (
          <li key={m.id} className="household-card">
            {editing === m.id ? (
              <MemberForm
                member={m}
                onCancel={() => setEditing(null)}
                onSaved={saved => { onChanged(household.map(x => x.id === saved.id ? saved : x)); setEditing(null) }}
                onDeleted={m.is_self ? undefined : () => { onChanged(household.filter(x => x.id !== m.id)); setEditing(null) }}
              />
            ) : (
              <div className="household-summary">
                <div>
                  <strong>{m.full_name}</strong> <span className="pro-subtitle">{relationshipLabel(m.relationship)}{m.on_mortgage ? ' · on the mortgage' : ''}</span>
                  <div className="pro-subtitle">
                    {m.income_types.length === 0 ? 'No income listed' : m.income_types.map(incomeLabel).join(', ')}
                    {m.employer ? ` · ${m.employer}` : ''}
                  </div>
                </div>
                <button type="button" className="btn-link" onClick={() => setEditing(m.id)}>Edit</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing === 'new' ? (
        <MemberForm
          member={null}
          onCancel={() => setEditing(null)}
          onSaved={saved => { onChanged([...household, saved]); setEditing(null) }}
        />
      ) : (
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setEditing('new')}>+ Add someone who lives here</button>
      )}
    </>
  )
}

function MemberForm({ member, onCancel, onSaved, onDeleted }: {
  member: HouseholdMember | null
  onCancel: () => void
  onSaved: (m: HouseholdMember) => void
  onDeleted?: () => void
}) {
  const isSelf = member?.is_self ?? false
  const [d, setD] = useState<MemberDraft>(member ? { ...member, employer: member.employer ?? '' } : blankMember)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fid = member?.id ?? 'new'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const saved = member
        ? await apiPut<HouseholdMember>(`/me/household/${member.id}`, d)
        : await apiPost<HouseholdMember>('/me/household', d)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!member || !onDeleted) return
    setBusy(true)
    try {
      await apiDelete(`/me/household/${member.id}`)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove')
      setBusy(false)
    }
  }

  const toggleIncome = (t: string, on: boolean) =>
    setD(prev => ({ ...prev, income_types: on ? [...prev.income_types, t] : prev.income_types.filter(x => x !== t) }))

  return (
    <form className="member-form" onSubmit={submit}>
      {error && <div className="error-message">{error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor={`mn-${fid}`}>{isSelf ? 'Your name' : 'Their name'}</label>
          <input id={`mn-${fid}`} value={d.full_name} onChange={e => setD({ ...d, full_name: e.target.value })} maxLength={100} required />
        </div>
        {!isSelf && (
          <div className="form-group">
            <label htmlFor={`mr-${fid}`}>Relationship to you</label>
            <select id={`mr-${fid}`} value={d.relationship} onChange={e => setD({ ...d, relationship: e.target.value })}>
              {relationships.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        )}
      </div>
      {!isSelf && (
        <label className="consent-label">
          <input type="checkbox" checked={d.on_mortgage} onChange={e => setD({ ...d, on_mortgage: e.target.checked })} />
          <span>Their name is on the mortgage</span>
        </label>
      )}
      <fieldset className="income-fieldset">
        <legend>{isSelf ? 'Your income' : 'Their income'} (check all that apply, or none)</legend>
        <div className="chip-checks">
          {incomeTypes.map(t => (
            <label key={t.value} className={`chip-check ${d.income_types.includes(t.value) ? 'checked' : ''}`}>
              <input type="checkbox" checked={d.income_types.includes(t.value)} onChange={e => toggleIncome(t.value, e.target.checked)} />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      {d.income_types.includes('employment') && (
        <div className="form-group">
          <label htmlFor={`me-${fid}`}>Employer (optional)</label>
          <input id={`me-${fid}`} value={d.employer ?? ''} onChange={e => setD({ ...d, employer: e.target.value })} maxLength={120} />
        </div>
      )}
      <button type="submit" className="btn btn-primary btn-small" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>{' '}
      <button type="button" className="btn btn-secondary btn-small" onClick={onCancel} disabled={busy}>Cancel</button>
      {onDeleted && <> <button type="button" className="btn-link" onClick={remove} disabled={busy}>Remove</button></>}
    </form>
  )
}

type PreviewDoc = { label: string; doc_type: string; household_member_id: string | null }

// Live preview of the list the professional can add in one click
function DocumentPreview({ household }: { household: HouseholdMember[] }) {
  const [docs, setDocs] = useState<PreviewDoc[] | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const key = JSON.stringify(household.map(m => [m.id, m.full_name, m.income_types, m.employer, m.on_mortgage]))

  // No synchronous setState here — it runs from an effect
  useEffect(() => {
    apiGet<{ documents: PreviewDoc[] }>('/me/documents')
      .then(res => setDocs(res.documents))
      .catch(err => console.error('Error loading document preview:', err))
  }, [key])

  if (!docs) return null
  return (
    <details className="doc-preview">
      <summary>Documents you'll likely need ({docs.length})</summary>
      <p className="form-note">Start gathering these now. Your professional can add this list to your case in one click.</p>
      <ul className="doc-checklist">
        {docs.map((doc, i) => (
          <li key={doc.label} className="doc-row">
            <span className="doc-label">{doc.label}</span>
            <button type="button" className="btn-link" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              {open === i ? 'Hide example' : 'See an example'}
            </button>
            {open === i && <DocumentExample type={doc.doc_type} />}
          </li>
        ))}
      </ul>
    </details>
  )
}
