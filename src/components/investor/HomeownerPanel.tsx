import type { HomeownerInfo, HouseholdMember } from '../../hooks/useMyInfo'
import { relationshipLabel, incomeLabel, hardshipReasons } from '../../lib/constants'

export type SharedHomeowner = {
  info: HomeownerInfo | null
  emails: { email: string; label: string | null }[]
  household: Omit<HouseholdMember, 'id'>[]
} | null

const CONTACT_LABEL: Record<string, string> = { phone: 'Phone call', text: 'Text message', email: 'Email' }

function address(street?: string | null, unit?: string | null, city?: string | null, state?: string | null, zip?: string | null) {
  if (!street) return null
  return `${street}${unit ? ` ${unit}` : ''}, ${city ?? ''}${state ? `, ${state}` : ', CA'} ${zip ?? ''}`.trim()
}

// What the homeowner entered under My Information, as their professional sees it
export function HomeownerPanel({ homeowner, firstName }: { homeowner: SharedHomeowner; firstName: string }) {
  if (!homeowner) {
    return (
      <p className="form-note">
        {firstName} chose you before sharing My Information was part of the consent, so only their contact details
        and checklist are shown.
      </p>
    )
  }
  const i = homeowner.info
  const property = address(i?.property_street, i?.property_unit, i?.property_city, null, i?.property_zip)
  const mailing = i && !i.mailing_same ? address(i.mailing_street, i.mailing_unit, i.mailing_city, i.mailing_state, i.mailing_zip) : null

  return (
    <details className="homeowner-panel" open>
      <summary><strong>{firstName}'s information</strong></summary>
      <dl className="info-grid">
        <div><dt>Property</dt><dd>{property ?? <em>Not entered yet</em>}{i?.property_county ? ` (${i.property_county} County)` : ''}</dd></div>
        {mailing && <div><dt>Mailing address</dt><dd>{mailing}</dd></div>}
        {i?.servicer_name && <div><dt>Servicer</dt><dd>{i.servicer_name}</dd></div>}
        {i?.alt_phone && <div><dt>Second phone</dt><dd><a href={`tel:${i.alt_phone}`}>{i.alt_phone}</a></dd></div>}
        {homeowner.emails.length > 0 && (
          <div><dt>Other emails</dt><dd>{homeowner.emails.map(e => <div key={e.email}><a href={`mailto:${e.email}`}>{e.email}</a>{e.label ? ` (${e.label})` : ''}</div>)}</dd></div>
        )}
        {(i?.preferred_contact || i?.best_time) && (
          <div><dt>Prefers</dt><dd>{[i?.preferred_contact && CONTACT_LABEL[i.preferred_contact], i?.best_time].filter(Boolean).join(' · ')}</dd></div>
        )}
        {i && i.hardship_reasons.length > 0 && (
          <div><dt>Hardship</dt><dd>{i.hardship_reasons.map(r => hardshipReasons.find(h => h.value === r)?.label ?? r).join(', ')}</dd></div>
        )}
        {i?.hardship_details && <div className="wide"><dt>In their words</dt><dd>{i.hardship_details}</dd></div>}
      </dl>
      <h5>Household ({homeowner.household.length})</h5>
      <ul className="household-mini">
        {homeowner.household.map((m, idx) => (
          <li key={idx}>
            <strong>{m.full_name}</strong> · {m.is_self ? 'Homeowner' : relationshipLabel(m.relationship)}
            {m.on_mortgage && !m.is_self ? ' · on the mortgage' : ''}
            <span className="pro-subtitle"> — {m.income_types.length ? m.income_types.map(incomeLabel).join(', ') : 'no income listed'}{m.employer ? ` (${m.employer})` : ''}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
