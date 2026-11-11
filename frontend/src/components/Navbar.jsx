import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
        <Link to="/" className="text-xl font-bold text-blue-600">
          Rackly
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">
            {user.email} ({user.role})
          </span>
          <button onClick={logout} className="rounded bg-gray-800 px-3 py-1 text-white">
            Log out
          </button>
        </div>
      </div>
    </nav>
  )
}