// Pieces shared by the homeowner's case view and the professional's case manager.
import { stages, stageLabel, outcomeLabel, professionalTypeLabel } from '../../lib/constants'
import type { Stage } from '../../lib/constants'
import { formatDate } from '../../lib/format'
import type { CaseEvent, DirectoryEntry } from '../../hooks/useMatch'


export function StageProgress({ stage, outcome }: { stage: Stage; outcome?: string | null }) {
  const current = stages.findIndex(s => s.value === stage)
  return (
    <ol className="stage-progress" aria-label={`Current stage: ${stageLabel(stage)}`}>
      {stages.map((s, i) => (
        <li
          key={s.value}
          className={i < current ? 'done' : i === current ? 'current' : ''}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="stage-dot" aria-hidden="true">{i < current ? '✓' : i + 1}</span>
          <span className="stage-name">
            {s.value === 'outcome' && stage === 'outcome' && outcome ? outcomeLabel(outcome) : s.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function CaseTimeline({ events, homeownerLabel = 'You' }: { events: CaseEvent[]; homeownerLabel?: string }) {
  if (events.length === 0) return <p className="empty-state">No updates yet.</p>
  return (
    <ul className="case-timeline">
      {[...events].reverse().map(e => (
        <li key={e.id}>
          <div className="timeline-meta">
            {formatDate(e.created_at)} · <strong>{stageLabel(e.stage)}</strong>
            {e.by_homeowner && <> · {homeownerLabel}</>}
          </div>
          {e.note && <div className="timeline-note">{e.note}</div>}
        </li>
      ))}
    </ul>
  )
}

export function LicenseBadge({ pro }: { pro: Pick<DirectoryEntry, 'licensed_profession' | 'license_verified' | 'license_number'> }) {
  if (!pro.licensed_profession) {
    return (
      <span className="license-badge unlicensed">
        Not a state-licensed profession{pro.license_number ? ` · Reg. ${pro.license_number}` : ''}
      </span>
    )
  }
  if (pro.license_verified) {
    return <span className="license-badge verified">✓ License verified{pro.license_number ? ` · ${pro.license_number}` : ''}</span>
  }
  return <span className="license-badge pending">License not yet verified</span>
}

type HeaderPro = Partial<Pick<DirectoryEntry, 'full_name' | 'business_name' |
  'professional_type' | 'licensed_profession' | 'license_verified' | 'license_number' | 'avatar_url' | 'brokerage'>>

// Photo, or initials when there is none
export function Avatar({ url, name, size = 56, square = false }: { url?: string | null; name: string; size?: number; square?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
  const style = { width: size, height: size, fontSize: size * 0.38 }
  return url
    ? <img className={`avatar ${square ? 'square' : ''}`} src={url} alt="" style={style} />
    : <span className={`avatar avatar-initials ${square ? 'square' : ''}`} style={style} aria-hidden="true">{initials}</span>
}

export function ProfessionalHeader({ pro }: { pro: HeaderPro }) {
  const name = pro.full_name || pro.business_name || 'Professional'
  return (
    <div className="pro-header">
      <Avatar url={pro.avatar_url} name={name} />
      <div className="pro-header-text">
        <h3>{pro.business_name || pro.full_name || 'Professional'}</h3>
        <div className="pro-subtitle">
          {pro.business_name && pro.full_name && <>{pro.full_name} · </>}
          {professionalTypeLabel(pro.professional_type)}
        </div>
        {pro.brokerage && (
          <div className="pro-brokerage">
            <Avatar url={pro.brokerage.logo_url} name={pro.brokerage.name} size={20} square />
            <span>{pro.brokerage.name}</span>
          </div>
        )}
      </div>
      {pro.licensed_profession !== undefined && (
        <LicenseBadge pro={{
          licensed_profession: pro.licensed_profession,
          license_verified: Boolean(pro.license_verified),
          license_number: pro.license_number ?? null
        }} />
      )}
    </div>
  )
}
