import { useEffect, useState } from 'react'
import { api } from '../api'
import { formatTime } from '../format'

export default function AvailabilityPanel({ gpuId }) {
  const [windows, setWindows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')

    api(`/gpus/${gpuId}/availability`)
      .then((data) => {
        if (!ignore) setWindows(data)
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [gpuId, reloadKey])

  async function handleAdd(e) {
    e.preventDefault()
    setFormError('')

    const startDate = new Date(start)
    const endDate = new Date(end)
    if (endDate <= startDate) {
      setFormError('The end must be after the start.')
      return
    }

    setSubmitting(true)
    try {
      await api(`/gpus/${gpuId}/availability`, {
        method: 'POST',
        body: { start_at: startDate.toISOString(), end_at: endDate.toISOString() },
      })
      setStart('')
      setEnd('')
      setReloadKey((key) => key + 1)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(w) {
    const ok = window.confirm(
      'Remove this window? Bookings that already exist inside it are not affected.',
    )
    if (!ok) return

    setFormError('')
    setDeletingId(w.id)
    try {
      await api(`/gpus/${gpuId}/availability/${w.id}`, { method: 'DELETE' })
      setReloadKey((key) => key + 1)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mt-4 border-t pt-4">
      <h4 className="font-semibold">Availability</h4>
      <p className="text-xs text-gray-500">Times are in your local time zone.</p>

      {error && <p className="mt-2 text-red-600">{error}</p>}
      {loading && <p className="mt-2 text-sm text-gray-500">Loading...</p>}
      {!loading && !error && windows.length === 0 && (
        <p className="mt-2 text-sm text-gray-500">
          No upcoming windows. Renters cannot book until you add one.
        </p>
      )}

      {!loading && windows.length > 0 && (
        <ul className="mt-2 space-y-2 text-sm">
          {windows.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-2">
              <span>
                {formatTime(w.start_at)} → {formatTime(w.end_at)}
              </span>
              <button
                onClick={() => handleDelete(w)}
                disabled={deletingId === w.id}
                className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 disabled:opacity-50"
              >
                {deletingId === w.id ? '...' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-4 grid gap-2 sm:grid-cols-3 sm:items-end">
        <label className="block text-xs">
          From
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
            className="mt-1 w-full rounded border p-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          Until
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
            className="mt-1 w-full rounded border p-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 p-2 text-sm text-white disabled:opacity-50"
        >
          {submitting ? 'Adding...' : 'Add window'}
        </button>
      </form>
      {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}
    </div>
  )
}