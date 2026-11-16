import { Link } from 'react-router-dom'
import { useSubscription } from '../../hooks/useSubscription'
import { useAccess } from '../../hooks/useAccess'
import type { Access } from '../../hooks/useAccess'
import { formatDate } from '../../lib/format'

const stateLabels: Record<Access['state'], string> = {
  active: 'Active', grace: 'Payment problem', read_only: 'Read-only', ended: 'Ended', none: 'Inactive'
}

// No subscription of their own: covered by a broker, or read-only after leaving a brokerage
function WithoutOwnPlan({ access }: { access: Access }) {
  const until = access.until ? formatDate(access.until) : null
  const covered = access.via === 'brokerage'
  return (
    <div className="subscription-card">
      <div className="subscription-info">
        <h2>{covered ? `Covered by ${access.brokerage_name ?? 'your brokerage'}` : 'No plan of your own'}</h2>
        <p>
          {covered
            ? 'Your broker pays for your account, so there is nothing to bill here. Questions about the plan go to your broker.'
            : access.state === 'read_only'
              ? `You can read your clients' cases until ${until}, but you can't make changes.`
              : 'Subscribe to be listed in the directory and work with homeowners.'}
        </p>
        <div className="subscription-details">
          <div className="info-item">
            <label>Status</label>
            <span className={`status-badge ${access.state === 'active' ? 'badge-success' : access.state === 'grace' || access.state === 'read_only' ? 'badge-warning' : 'badge-default'}`}>
              {stateLabels[access.state]}
            </span>
          </div>
          {until && access.state !== 'active' && (
            <div className="info-item">
              <label>{access.state === 'grace' ? 'Payment needed by' : 'Access until'}</label>
              <span>{until}</span>
            </div>
          )}
        </div>
      </div>
      {!covered && <Link to="/investor/subscribe" className="btn btn-primary">Subscribe on your own</Link>}
    </div>
  )
}

export function SubscriptionStatus() {
  const { subscription, loading, portalError, openBillingPortal } = useSubscription()
  const { access } = useAccess()

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
        <p>Manage your professional portal subscription</p>
      </div>

      {!subscription && access ? <WithoutOwnPlan access={access} /> : (
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

        {portalError && <div className="error-message">{portalError}</div>}

        {subscription && (
          <button className="btn btn-primary" onClick={openBillingPortal}>
            Manage Billing
          </button>
        )}
      </div>
      )}
    </div>
  )
}
