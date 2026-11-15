import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
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
export function InvestorPage() {
  const link = ({ isActive }: { isActive: boolean }) => isActive ? 'active' : ''
  return (
    <main className="investor-page">
      <div className="investor-container">
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
