import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import AuthLayout from '../components/AuthLayout'
import { buttonClass, inputClass, labelClass } from '../components/authStyles'

const ROLES = [
  { value: 'renter', label: 'Rent GPUs' },
  { value: 'provider', label: 'List my GPUs' },
]

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
    <AuthLayout
      eyebrow="Join the room"
      title="Create account"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-brand">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className={labelClass}>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-muted">At least 8 characters</span>
        </label>

        <div>
          <span className={labelClass}>I want to</span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button
                type="button"
                key={r.value}
                onClick={() => setRole(r.value)}
                aria-pressed={role === r.value}
                className={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${
                  role === r.value ? 'border-brand text-brand' : 'border-line text-muted hover:text-ink'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className={buttonClass}>
          {submitting ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
    </AuthLayout>
  )
}