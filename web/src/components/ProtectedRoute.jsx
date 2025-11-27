import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading, onboarding } = useAuth()
  const location = useLocation()

  if (loading || onboarding.loading) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const isOnboardingRoute = location.pathname.startsWith('/app/onboarding')

  if (!onboarding.onboardingCompleted && !isOnboardingRoute) {
    return <Navigate to="/app/onboarding" replace />
  }

  return children
}


