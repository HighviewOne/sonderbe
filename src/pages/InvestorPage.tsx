import { Routes, Route, NavLink } from 'react-router-dom'
import {
  InvestorDashboard,
  PropertySearch,
  PropertyDetail,
  SubscriptionStatus
} from '../components/investor'

export function InvestorPage() {
  return (
    <main className="investor-page">
      <div className="investor-container">
        <nav className="investor-nav">
          <NavLink to="/investor" end className={({ isActive }) => isActive ? 'active' : ''}>
            Dashboard
          </NavLink>
          <NavLink to="/investor/search" className={({ isActive }) => isActive ? 'active' : ''}>
            Property Search
          </NavLink>
          <NavLink to="/investor/subscription" className={({ isActive }) => isActive ? 'active' : ''}>
            Subscription
          </NavLink>
        </nav>

        <div className="investor-content">
          <Routes>
            <Route index element={<InvestorDashboard />} />
            <Route path="search" element={<PropertySearch />} />
            <Route path="properties/:id" element={<PropertyDetail />} />
            <Route path="subscription" element={<SubscriptionStatus />} />
          </Routes>
        </div>
      </div>
    </main>
  )
}
