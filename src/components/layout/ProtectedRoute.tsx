import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
  requireInvestor?: boolean
}

export function ProtectedRoute({ children, requireAdmin = false, requireInvestor = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin, isInvestor } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/portal" replace />
  }

  if (requireInvestor && !isInvestor) {
    return <Navigate to="/investor/subscribe" replace />
  }

  return <>{children}</>
}
