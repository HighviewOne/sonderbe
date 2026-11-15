import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { apiGet, apiPost } from '../lib/api'
import { Avatar } from '../components/case/CaseParts'

type InviteInfo = { brokerage: { name: string; logo_url: string | null } | null; invited_email: string; email_matches: boolean }

// /join/:token — an agent accepts their broker's invite (must be logged in with the invited email)
export function JoinBrokeragePage() {
  const { token = '' } = useParams()
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    apiGet<InviteInfo>(`/brokerage/invite/${encodeURIComponent(token)}`)
      .then(res => setInvite(res))
      .catch(err => setError(err instanceof Error ? err.message : 'This invite link is not valid'))
      .finally(() => setLoading(false))
  }, [token])

  const join = async () => {
    setJoining(true)
    setError(null)
    try {
      await apiPost('/brokerage/join', { token })
      // Role changed to professional: reload so the app picks up the new access
      window.location.hash = '#/investor/listing'
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join')
      setJoining(false)
    }
  }

  return (
    <main className="portal-page">
      <div className="portal-container">
        <div className="portal-content join-page">
          {loading ? (
            <div className="loading-container"><div className="loading-spinner"></div><p>Loading invite...</p></div>
          ) : !invite ? (
            <div className="dashboard-card">
              <h1>Invite not found</h1>
              <div className="error-message">{error}</div>
            </div>
          ) : (
            <div className="dashboard-card">
              {invite.brokerage && <Avatar url={invite.brokerage.logo_url} name={invite.brokerage.name} size={72} square />}
              <h1>Join {invite.brokerage?.name ?? 'the brokerage'}</h1>
              {invite.email_matches ? (
                <>
                  <p>
                    You'll join as an agent. Your broker's subscription covers you, homeowners will see you in the
                    SonderBe directory under this brokerage, and your broker will see your clients.
                  </p>
                  {error && <div className="error-message">{error}</div>}
                  <button className="btn btn-primary" onClick={join} disabled={joining}>{joining ? 'Joining...' : 'Join the brokerage'}</button>
                </>
              ) : (
                <p>
                  This invite was sent to <strong>{invite.invited_email}</strong>. Sign out and log in (or{' '}
                  <Link to="/signup">sign up</Link>) with that email, then open the link again.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
