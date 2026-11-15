import { Routes, Route, NavLink, Navigate, Link } from 'react-router-dom'
import { useAccess } from '../hooks/useAccess'
import type { Access } from '../hooks/useAccess'
import { formatDate } from '../lib/format'
import {
  InvestorDashboard,
  PropertySearch,
  PropertyDetail,
  SubscriptionStatus,
  Leads,
  MyBrokerage,
  ProDashboard,
  ProDocuments,
  ProInformation
} from '../components/investor'

// Professional portal. The property-data pages (data/search/detail) are kept but left out
// of the nav while SonderBe focuses on homeowner matching.
// Banner for a payment problem (grace) or an ended subscription (read-only)
function AccessBanner({ access }: { access: Access }) {
  const until = access.until ? formatDate(access.until) : ''
  const viaBroker = access.via === 'brokerage'
  if (access.state === 'grace') {
    return (
      <div className="dashboard-card warning-card access-banner" role="status">
        <strong>{viaBroker ? `${access.brokerage_name ?? 'Your brokerage'}'s last payment didn't go through.` : "Your last payment didn't go through."}</strong>{' '}
        {viaBroker
          ? `Your broker needs to update their card by ${until} to keep your account working.`
          : <>Update your card by {until} to keep everything working. <Link to="/investor/subscription">Manage billing</Link></>}
      </div>
    )
  }
  if (access.state === 'read_only') {
    return (
      <div className="dashboard-card warning-card access-banner" role="status">
        <strong>{viaBroker ? `${access.brokerage_name ?? 'Your brokerage'}'s subscription has ended.` : 'Your subscription has ended.'}</strong>{' '}
        You can still read your clients' cases until {until}, but you can't make changes, and homeowners can't find you
        in the directory. After {until} your open cases close and your clients are asked to choose someone new.{' '}
        <Link to="/investor/subscribe">{viaBroker ? 'Subscribe on your own' : 'Renew now'}</Link>
      </div>
    )
  }
  return null
}

export function InvestorPage() {
  const link = ({ isActive }: { isActive: boolean }) => isActive ? 'active' : ''
  const { access } = useAccess()
  if (access && (access.state === 'ended' || access.state === 'none')) {
    return <Navigate to="/investor/subscribe" replace />
  }
  return (
    <main className="investor-page">
      <div className="investor-container">
        {access && <AccessBanner access={access} />}
        <nav className="investor-nav">
          <NavLink to="/investor" end className={link}>Dashboard</NavLink>
          <NavLink to="/investor/clients" className={link}>Clients</NavLink>
          <NavLink to="/investor/documents" className={link}>Documents</NavLink>
          <NavLink to="/investor/info" className={link}>My Information</NavLink>
          <NavLink to="/investor/brokerage" className={link}>My Brokerage</NavLink>
          <NavLink to="/investor/subscription" className={link}>Subscription</NavLink>
        </nav>

        <div className="investor-content">
          <Routes>
            <Route index element={<ProDashboard />} />
            <Route path="clients" element={<Leads />} />
            <Route path="documents" element={<ProDocuments />} />
            <Route path="info" element={<ProInformation />} />
            <Route path="listing" element={<Navigate to="/investor/info" replace />} />
            <Route path="brokerage" element={<MyBrokerage />} />
            <Route path="data" element={<InvestorDashboard />} />
            <Route path="search" element={<PropertySearch />} />
            <Route path="properties/:id" element={<PropertyDetail />} />
            <Route path="subscription" element={<SubscriptionStatus />} />
          </Routes>
        </div>
      </div>
    </main>
  )
}
