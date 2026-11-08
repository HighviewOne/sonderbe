import { useState } from 'react'
import { useSubscription } from '../hooks/useSubscription'

export function InvestorSubscribePage() {
  const { createCheckout } = useSubscription()
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

  return (
    <main className="auth-page">
      <div className="subscribe-container">
        <div className="subscribe-card">
          <h1>SonderBe for Real Estate Professionals</h1>
          <p className="subscribe-subtitle">
            Get connected with homeowners facing foreclosure who have asked for help
          </p>

          <div className="subscribe-features">
            <h3>What you get:</h3>
            <ul>
              <li>Opt-in homeowner leads in the counties you serve</li>
              <li>Each lead is exclusive to you once you accept it</li>
              <li>See how document-ready each homeowner is before you call</li>
              <li>Coverage: LA, Orange, Riverside, San Bernardino, San Diego, Ventura</li>
            </ul>
            <p className="subscribe-note">
              Homeowners never pay SonderBe. By subscribing you agree not to charge homeowners any
              upfront fee for foreclosure or loan-modification help.
            </p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            className="btn btn-primary btn-full"
            onClick={handleSubscribe}
            disabled={loading}
          >
            {loading ? 'Redirecting to checkout...' : 'Subscribe Now'}
          </button>

          <p className="subscribe-note">
            You will be redirected to Stripe for secure payment processing.
          </p>
        </div>
      </div>
    </main>
  )
}
