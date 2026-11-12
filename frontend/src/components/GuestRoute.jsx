import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function GuestRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) return <Navigate to="/browse" replace />
  return children
}