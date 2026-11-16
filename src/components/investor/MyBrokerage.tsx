import { useState, useEffect, useCallback } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import { stageLabel } from '../../lib/constants'
import { formatDate } from '../../lib/format'
import { Avatar } from '../case/CaseParts'
import { ImageUpload } from '../case/ImageUpload'

type Brokerage = { id: string; owner_id: string; name: string; website: string | null; dre_number: string | null; logo_url: string | null }
type Agent = { id: string; full_name: string | null; email: string; professional_type: string | null; avatar_url: string | null; listed: boolean }
type Invite = { id: string; email: string; token: string; created_at: string }
type BrokerageResponse = { role: 'owner' | 'member' | null; brokerage: Brokerage | null; agents: Agent[]; invites: Invite[]; can_create: boolean }
// Counts only: homeowners share with the agent they chose, not the brokerage
type TeamAgent = {
  agent_id: string; agent_name: string; agent_is_me: boolean; clients: number; by_stage: Record<string, number>
  documents_total: number; documents_to_review: number; documents_received: number
}

const inviteLink = (token: string) => `${window.location.origin}${window.location.pathname}#/join/${token}`

export function MyBrokerage() {
  const [data, setData] = useState<BrokerageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // No synchronous setState here — it runs from the mount effect
  const fetchData = useCallback(() => {
    apiGet<BrokerageResponse>('/brokerage')
      .then(res => {
        setData(res)
        setError(null)
      })
      .catch(err => {
        console.error('Error loading brokerage:', err)
        setError('Failed to load your brokerage. Please refresh.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }
  if (error || !data) return <div className="error-message">{error}</div>

  return (
    <div className="my-brokerage">
      <div className="page-header">
        <h1>My Brokerage</h1>
        <p>A broker runs the brokerage and pays one subscription for the whole team. Agents join with an invite link.</p>
      </div>
      {data.role === 'owner' && data.brokerage ? (
        <OwnerView data={data} brokerage={data.brokerage} reload={fetchData} />
      ) : data.role === 'member' && data.brokerage ? (
        <MemberView brokerage={data.brokerage} reload={fetchData} />
      ) : data.can_create ? (
        <CreateBrokerage onCreated={fetchData} />
      ) : (
        <div className="dashboard-card">
          <p>
            You're not part of a brokerage. If you work under a broker, ask them to send you an invite link. If you
            are a broker, set your type to Real Estate Broker on <Link to="/investor/listing">My Listing</Link> first.
          </p>
        </div>
      )}
    </div>
  )
}

function BrokerageFields({ initial, submitLabel, onSubmit }: {
  initial: { name: string; website: string; dre_number: string }
  submitLabel: string
  onSubmit: (v: { name: string; website: string; dre_number: string }) => Promise<void>
}) {
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await onSubmit(v)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-row">
        <div className="form-group grow-2">
          <label htmlFor="bk-name">Brokerage name</label>
          <input id="bk-name" value={v.name} onChange={e => setV({ ...v, name: e.target.value })} maxLength={120} required />
        </div>
        <div className="form-group">
          <label htmlFor="bk-dre">Corporate DRE license (optional)</label>
          <input id="bk-dre" value={v.dre_number} onChange={e => setV({ ...v, dre_number: e.target.value })} maxLength={40} />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="bk-web">Website (optional)</label>
        <input id="bk-web" type="url" value={v.website} onChange={e => setV({ ...v, website: e.target.value })} maxLength={200} placeholder="https://" />
      </div>
      <button type="submit" className="btn btn-primary btn-small" disabled={busy}>{busy ? 'Saving...' : submitLabel}</button>
      {saved && <span className="form-note"> ✓ Saved</span>}
      {error && <div className="error-message" role="alert">{error}</div>}
    </form>
  )
}

function CreateBrokerage({ onCreated }: { onCreated: () => void }) {
  return (
    <div className="dashboard-card">
      <h2>Set up your brokerage</h2>
      <p>Your agents will appear in the directory under your brokerage name and logo, and you'll see all their clients.</p>
      <BrokerageFields
        initial={{ name: '', website: '', dre_number: '' }}
        submitLabel="Create brokerage"
        onSubmit={async v => { await apiPost('/brokerage', v); onCreated() }}
      />
    </div>
  )
}

function MemberView({ brokerage, reload }: { brokerage: Brokerage; reload: () => void }) {
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const leave = async () => {
    try {
      await apiPost('/brokerage/leave')
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to leave')
    }
  }
  return (
    <div className="dashboard-card">
      <div className="pro-header">
        <Avatar url={brokerage.logo_url} name={brokerage.name} square />
        <div className="pro-header-text">
          <h3>{brokerage.name}</h3>
          <div className="pro-subtitle">You're an agent with this brokerage. Your broker's subscription covers you.</div>
        </div>
      </div>
      {error && <div className="error-message">{error}</div>}
      {confirm ? (
        <p>
          Leave {brokerage.name}? Without your own subscription you'll lose access to your clients.{' '}
          <button className="btn btn-primary btn-small" onClick={leave}>Yes, leave</button>{' '}
          <button className="btn btn-secondary btn-small" onClick={() => setConfirm(false)}>Cancel</button>
        </p>
      ) : (
        <button className="btn-link" onClick={() => setConfirm(true)}>Leave this brokerage</button>
      )}
    </div>
  )
}

function OwnerView({ data, brokerage, reload }: { data: BrokerageResponse; brokerage: Brokerage; reload: () => void }) {
  const [logo, setLogo] = useState(brokerage.logo_url)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [team, setTeam] = useState<TeamAgent[] | null>(null)

  useEffect(() => {
    apiGet<{ agents: TeamAgent[] }>('/brokerage/clients')
      .then(res => setTeam(res.agents))
      .catch(err => console.error('Error loading team clients:', err))
  }, [])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const invite = async (e: FormEvent) => {
    e.preventDefault()
    await run(async () => {
      const created = await apiPost<Invite>('/brokerage/invites', { email })
      setEmail('')
      await copyLink(created.token)
    })
  }

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(token))
      setCopied(token)
    } catch {
      setCopied(null)
    }
  }

  return (
    <>
      <div className="dashboard-card">
        <ImageUpload label="Brokerage logo" url={logo} name={brokerage.name} uploadPath="/brokerage/logo" field="logo_url" square onUploaded={setLogo} />
        <BrokerageFields
          initial={{ name: brokerage.name, website: brokerage.website ?? '', dre_number: brokerage.dre_number ?? '' }}
          submitLabel="Save"
          onSubmit={async v => { await apiPut('/brokerage', v) }}
        />
      </div>

      <div className="dashboard-card">
        <div className="card-header"><h2>Agents ({data.agents.length})</h2></div>
        {error && <div className="error-message">{error}</div>}
        {data.agents.length === 0 ? (
          <p className="empty-state">No agents yet. Invite them below.</p>
        ) : (
          <ul className="team-list">
            {data.agents.map(a => (
              <li key={a.id} className="agent-row">
                <Avatar url={a.avatar_url} name={a.full_name || a.email} size={40} />
                <div className="agent-row-text">
                  <strong>{a.full_name || a.email}</strong>
                  <div className="pro-subtitle">{a.email} · {a.listed ? 'Listed in directory' : 'Listing not published yet'}</div>
                </div>
                <button className="btn-link" disabled={busy} onClick={() => run(() => apiDelete(`/brokerage/agents/${a.id}`))}>Remove</button>
              </li>
            ))}
          </ul>
        )}

        <h4>Invite an agent</h4>
        <form className="add-doc" onSubmit={invite}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="agent@example.com" aria-label="Agent email" maxLength={254} required />
          <button type="submit" className="btn btn-primary btn-small" disabled={busy}>Create invite link</button>
        </form>
        <p className="form-note">
          We copy the link for you. Send it to the agent by email or text. They open it, sign up or log in with that
          email, and they're on your team.
        </p>
        {data.invites.length > 0 && (
          <ul className="invite-list">
            {data.invites.map(i => (
              <li key={i.id}>
                <span>{i.email} · sent {formatDate(i.created_at)}</span>
                <button className="btn-link" onClick={() => copyLink(i.token)}>{copied === i.token ? '✓ Link copied' : 'Copy link'}</button>
                <button className="btn-link" disabled={busy} onClick={() => run(() => apiDelete(`/brokerage/invites/${i.id}`))}>Cancel invite</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="dashboard-card">
        <div className="card-header"><h2>Team clients</h2></div>
        <p className="form-note">
          Totals for each agent. Homeowners share their details only with the agent they chose, so names and case
          details stay with that agent.
        </p>
        {team === null ? <p>Loading...</p> : team.every(a => a.clients === 0) ? (
          <p className="empty-state">No active clients across your team yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="team-table">
              <thead>
                <tr><th>Agent</th><th>Active clients</th><th>Stages</th><th>Documents</th></tr>
              </thead>
              <tbody>
                {team.map(a => (
                  <tr key={a.agent_id}>
                    <td>{a.agent_is_me ? `${a.agent_name} (you)` : a.agent_name}</td>
                    <td>{a.clients}</td>
                    <td>
                      {Object.keys(a.by_stage).length === 0 ? '—' : Object.entries(a.by_stage)
                        .map(([stage, n]) => `${stageLabel(stage)}: ${n}`).join(' · ')}
                    </td>
                    <td>
                      {a.documents_received}/{a.documents_total} received
                      {a.documents_to_review > 0 && <div className="pro-subtitle">{a.documents_to_review} to review</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
