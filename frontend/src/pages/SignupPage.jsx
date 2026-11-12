import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('renter')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signup(email, password, role)
      navigate('/browse')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-sm p-6">
      <h1 className="text-2xl font-bold">Create account</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded border p-2"
        />
        <input
          type="password"
          placeholder="Password (at least 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full rounded border p-2"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full rounded border p-2"
        >
          <option value="renter">I want to rent GPUs</option>
          <option value="provider">I want to list my GPUs</option>
        </select>
        {error && <p className="text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-brand p-2 text-page disabled:opacity-50"
        >
          {submitting ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account?{' '}
        <Link to="/login" className="text-brand">
          Log in
        </Link>
      </p>
    </div>
  )
}