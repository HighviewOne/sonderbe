import { Routes, Route, NavLink } from 'react-router-dom'
import {
  InvestorDashboard,
  PropertySearch,
  PropertyDetail,
  SubscriptionStatus,
  Leads
} from '../components/investor'

// Professional portal. The property-data pages (dashboard/search/detail) are kept but
// left out of the nav while SonderBe focuses on homeowner matching.
export function InvestorPage() {
  return (
    <main className="investor-page">
      <div className="investor-container">
        <nav className="investor-nav">
          <NavLink to="/investor" end className={({ isActive }) => isActive ? 'active' : ''}>
            Leads
          </NavLink>
          <NavLink to="/investor/subscription" className={({ isActive }) => isActive ? 'active' : ''}>
            Subscription
          </NavLink>
        </nav>

        <div className="investor-content">
          <Routes>
            <Route index element={<Leads />} />
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
