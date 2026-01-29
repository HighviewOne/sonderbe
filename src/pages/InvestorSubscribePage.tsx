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
    } catch (e: any) {
      setError(e.message || 'Failed to start checkout')
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="subscribe-container">
        <div className="subscribe-card">
          <h1>Investor Portal</h1>
          <p className="subscribe-subtitle">
            Access distressed property data across six Southern California counties
          </p>

          <div className="subscribe-features">
            <h3>What you get:</h3>
            <ul>
              <li>Foreclosure leads (NOD &amp; NOT)</li>
              <li>Probate property data</li>
              <li>Tax lien and tax sale listings</li>
              <li>Coverage: LA, Orange, Riverside, San Bernardino, San Diego, Ventura</li>
              <li>Advanced search and filtering</li>
              <li>Regularly updated data</li>
            </ul>
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
