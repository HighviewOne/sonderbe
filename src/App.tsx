import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Header, Footer, ProtectedRoute } from './components/layout'
import {
  HomePage,
  LoginPage,
  SignupPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  PortalPage,
  AdminPage,
  InvestorPage,
  InvestorSubscribePage,
  JoinBrokeragePage,
  AdReportPage
} from './pages'
import './App.css'

// HashRouter keeps the old scroll position between pages; start each page at the top
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <ScrollToTop />
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/ad-report/:token" element={<AdReportPage />} />
        <Route
          path="/portal/*"
          element={
            <ProtectedRoute>
              <PortalPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute requireAdmin>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/join/:token"
          element={
            <ProtectedRoute>
              <JoinBrokeragePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/investor/subscribe"
          element={
            <ProtectedRoute>
              <InvestorSubscribePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/investor/*"
          element={
            <ProtectedRoute requireInvestor>
              <InvestorPage />
            </ProtectedRoute>
          }
        />
      </Routes>
      <Footer />
    </>
  )
}

export default App
