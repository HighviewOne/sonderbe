import { useState } from 'react'
import { useSubscription } from '../hooks/useSubscription'
import { useAccess } from '../hooks/useAccess'
import { apiPost } from '../lib/api'

export function InvestorSubscribePage() {
  const { createCheckout } = useSubscription()
  const { access } = useAccess()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubscribe = async () => {
    setLoading(true)
    setError('')
    try {
      await createCheckout()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start checkout')
      setLoading(false)
    }
  }

  // Test environment only: the server refuses this on the live site
  const skipPayment = async () => {
    setLoading(true)
    setError('')
    try {
      await apiPost('/account/demo-subscription')
      // Role may have changed: reload so the app picks up professional access
      window.location.hash = '#/investor'
      window.location.reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to activate')
      setLoading(false)
    }
  }

  const returning = access?.state === 'ended' || access?.state === 'read_only'

  return (
    <main className="auth-page">
      <div className="subscribe-container">
        <div className="subscribe-card">
          <h1>{returning ? 'Welcome back' : 'SonderBe for Real Estate Professionals'}</h1>
          <p className="subscribe-subtitle">
            {returning
              ? 'Renew to get back into the directory and keep working with your clients.'
              : 'Get listed for homeowners facing foreclosure in your counties, and manage their cases and documents in one place.'}
          </p>

          <div className="subscribe-features">
            <h3>What you get:</h3>
            <ul>
              <li>A listing in the homeowner directory for the counties you serve (A–Z; placement is never sold)</li>
              <li>Homeowners who choose you share their information, household and document readiness</li>
              <li>A case tracker, document checklists with repeat requests, and notes for every client</li>
              <li>Brokers: one subscription covers your whole team</li>
            </ul>
            <p className="subscribe-note">
              Homeowners never pay SonderBe. By subscribing you agree not to charge homeowners any
              upfront fee for foreclosure or loan-modification help.
            </p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button className="btn btn-primary btn-full" onClick={handleSubscribe} disabled={loading}>
            {loading ? 'Please wait...' : returning ? 'Renew subscription' : 'Subscribe Now'}
          </button>
          <p className="subscribe-note">You will be redirected to Stripe for secure payment processing.</p>

          {access?.demo_mode && (
            <div className="demo-box">
              <strong>Test environment</strong>
              <p>Demo and test accounts can skip payment here. This button does not exist on the live site.</p>
              <button className="btn btn-secondary btn-full" onClick={skipPayment} disabled={loading}>
                Skip payment (test only)
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
