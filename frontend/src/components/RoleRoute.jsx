import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function RoleRoute({ role, children }) {
  const { user } = useAuth()

  if (user.role !== role) return <Navigate to="/" replace />
  return children
}