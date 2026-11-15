import { useState } from 'react'
import type { FormEvent } from 'react'
import { apiPost, apiPut, apiDelete } from '../../lib/api'
import { teamStatuses } from '../../lib/constants'
import type { TeamContact } from '../../hooks/useMyInfo'

type Draft = Omit<TeamContact, 'id' | 'created_at'>

const empty: Draft = {
  role: 'attorney', directory_profile_id: null, name: '', firm: '', phone: '', email: '', status: 'contacted', notes: ''
}

// The homeowner's own record of a lawyer (or other helper) outside SonderBe matching.
// SonderBe never contacts them or shares anything with them.
export function TeamContacts({ team, onChanged }: { team: TeamContact[]; onChanged: (team: TeamContact[]) => void }) {
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  return (
    <div className="team-contacts">
      {team.length === 0 && editing !== 'new' && (
        <p className="empty-state">
          No lawyer yet. If you're facing a foreclosure sale date, a foreclosure defense or bankruptcy attorney may be
          able to stop or delay it. Find one below, or add one you already have.
        </p>
      )}
      <ul className="team-list">
        {team.map(c => editing === c.id ? (
          <li key={c.id}>
            <TeamForm
              initial={c}
              onCancel={() => setEditing(null)}
              onSaved={saved => { onChanged(team.map(t => t.id === saved.id ? saved : t)); setEditing(null) }}
              onDeleted={() => { onChanged(team.filter(t => t.id !== c.id)); setEditing(null) }}
              id={c.id}
            />
          </li>
        ) : (
          <li key={c.id} className="team-card">
            <div className="pro-header">
              <div>
                <h3>{c.name}</h3>
                <div className="pro-subtitle">{c.role === 'attorney' ? 'Attorney' : 'Other'}{c.firm ? ` · ${c.firm}` : ''}</div>
              </div>
              <span className="license-badge pending">{teamStatuses.find(s => s.value === c.status)?.label}</span>
            </div>
            <ul className="match-contact">
              {c.phone && <li>Phone: <a href={`tel:${c.phone}`}>{c.phone}</a></li>}
              {c.email && <li>Email: <a href={`mailto:${c.email}`}>{c.email}</a></li>}
            </ul>
            {c.notes && <p className="team-notes">{c.notes}</p>}
            <button type="button" className="btn-link" onClick={() => setEditing(c.id)}>Edit</button>
          </li>
        ))}
      </ul>
      {editing === 'new' ? (
        <TeamForm
          initial={empty}
          onCancel={() => setEditing(null)}
          onSaved={saved => { onChanged([...team, saved]); setEditing(null) }}
        />
      ) : (
        <button type="button" className="btn btn-secondary btn-small" onClick={() => setEditing('new')}>
          + Add a lawyer I already have
        </button>
      )}
      <p className="form-note">
        This list is just for your records. SonderBe doesn't contact your lawyer or share your information with them.
      </p>
    </div>
  )
}

function TeamForm({ initial, id, onCancel, onSaved, onDeleted }: {
  initial: Draft
  id?: string
  onCancel: () => void
  onSaved: (c: TeamContact) => void
  onDeleted?: () => void
}) {
  const [d, setD] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const saved = id ? await apiPut<TeamContact>(`/me/team/${id}`, d) : await apiPost<TeamContact>('/me/team', d)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!id || !onDeleted) return
    setBusy(true)
    try {
      await apiDelete(`/me/team/${id}`)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove')
      setBusy(false)
    }
  }

  const fid = id ?? 'new'
  return (
    <form className="team-form" onSubmit={submit}>
      {error && <div className="error-message">{error}</div>}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor={`tn-${fid}`}>Name</label>
          <input id={`tn-${fid}`} value={d.name} onChange={e => set('name', e.target.value)} maxLength={120} required />
        </div>
        <div className="form-group">
          <label htmlFor={`tf-${fid}`}>Law firm (optional)</label>
          <input id={`tf-${fid}`} value={d.firm ?? ''} onChange={e => set('firm', e.target.value)} maxLength={120} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor={`tp-${fid}`}>Phone</label>
          <input id={`tp-${fid}`} type="tel" value={d.phone ?? ''} onChange={e => set('phone', e.target.value)} maxLength={30} />
        </div>
        <div className="form-group">
          <label htmlFor={`te-${fid}`}>Email</label>
          <input id={`te-${fid}`} type="email" value={d.email ?? ''} onChange={e => set('email', e.target.value)} maxLength={254} />
        </div>
        <div className="form-group">
          <label htmlFor={`ts-${fid}`}>Status</label>
          <select id={`ts-${fid}`} value={d.status} onChange={e => set('status', e.target.value as Draft['status'])}>
            {teamStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor={`tno-${fid}`}>Notes (court dates, what they're doing for you)</label>
        <textarea id={`tno-${fid}`} value={d.notes ?? ''} onChange={e => set('notes', e.target.value)} maxLength={2000} rows={2} />
      </div>
      <button type="submit" className="btn btn-primary btn-small" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>{' '}
      <button type="button" className="btn btn-secondary btn-small" onClick={onCancel} disabled={busy}>Cancel</button>
      {id && onDeleted && <> <button type="button" className="btn-link" onClick={remove} disabled={busy}>Remove</button></>}
    </form>
  )
}
