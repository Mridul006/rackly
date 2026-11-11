import { useAuth } from '../auth'

export default function HomePage() {
  const { user, logout } = useAuth()

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-blue-600">Rackly</h1>
      <p className="mt-4">Logged in as {user.email}</p>
      <p>Role: {user.role}</p>
      <button onClick={logout} className="mt-4 rounded bg-gray-800 px-4 py-2 text-white">
        Log out
      </button>
    </div>
  )
}