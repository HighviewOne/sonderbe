import { useSubscription } from '../../hooks/useSubscription'

export function SubscriptionStatus() {
  const { subscription, loading, openBillingPortal } = useSubscription()

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading subscription...</p>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    active: 'badge-success',
    trialing: 'badge-success',
    past_due: 'badge-warning',
    canceled: 'badge-error',
    inactive: 'badge-default'
  }

  return (
    <div className="subscription-status">
      <div className="page-header">
        <h1>Subscription</h1>
        <p>Manage your investor portal subscription</p>
      </div>

      <div className="subscription-card">
        <div className="subscription-info">
          <h2>Current Plan</h2>
          <div className="subscription-details">
            <div className="info-item">
              <label>Status</label>
              <span className={`status-badge ${statusColors[subscription?.status || 'inactive']}`}>
                {subscription?.status || 'inactive'}
              </span>
            </div>
            {subscription?.current_period_end && (
              <div className="info-item">
                <label>{subscription.status === 'canceled' ? 'Access Until' : 'Renews On'}</label>
                <span>{new Date(subscription.current_period_end).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        {subscription?.status === 'past_due' && (
          <div className="error-message">
            Your payment is past due. Please update your payment method to maintain access.
          </div>
        )}

        {subscription && (
          <button className="btn btn-primary" onClick={openBillingPortal}>
            Manage Billing
          </button>
        )}
      </div>
    </div>
  )
}
