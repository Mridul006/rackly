import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function ProtectedRoute({ children }) {
  const { user, loading, loggedOut } = useAuth()

  if (loading) return <p className="p-6 text-muted">Loading...</p>
  if (!user) return <Navigate to={loggedOut ? '/' : '/login'} replace />
  return children
}