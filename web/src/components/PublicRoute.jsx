import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/app/dashboard" replace />
  }

  return children
}


