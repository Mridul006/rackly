import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { bookingState, formatTime, STATE_BADGE } from '../format'

const PAGE_SIZE = 10

const TABS = [
  { value: '', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'past', label: 'Past' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function BookingsPage() {
  const [when, setWhen] = useState('')
  const [offset, setOffset] = useState(0)
  const [bookings, setBookings] = useState([])
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [cancellingId, setCancellingId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')

    const params = new URLSearchParams()
    params.set('limit', PAGE_SIZE + 1)
    params.set('offset', offset)
    if (when) params.set('when', when)

    api(`/bookings?${params}`)
      .then((data) => {
        if (ignore) return
        setHasNext(data.length > PAGE_SIZE)
        setBookings(data.slice(0, PAGE_SIZE))
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
  }, [when, offset, reloadKey])

  function changeTab(value) {
    setWhen(value)
    setOffset(0)
    setNotice('')
    setActionError('')
  }

  async function handleCancel(booking) {
    const ok = window.confirm(
      `Cancel booking #${booking.id}? $${booking.total_price} will be refunded to your wallet.`,
    )
    if (!ok) return

    setActionError('')
    setNotice('')
    setCancellingId(booking.id)
    try {
      await api(`/bookings/${booking.id}/cancel`, { method: 'POST' })
      setNotice(`Booking #${booking.id} cancelled. $${booking.total_price} was refunded.`)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">My bookings</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => changeTab(tab.value)}
            className={`rounded px-3 py-1 text-sm ${
              when === tab.value ? 'bg-brand text-page' : 'border bg-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice && <p className="mt-4 text-available">{notice}</p>}
      {actionError && <p className="mt-4 text-danger">{actionError}</p>}
      {error && <p className="mt-6 text-danger">{error}</p>}
      {loading && <p className="mt-6 text-muted">Loading...</p>}
      {!loading && !error && bookings.length === 0 && (
        <p className="mt-6 text-muted">No bookings here yet.</p>
      )}

      {!loading && bookings.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-raised text-muted">
              <tr>
                <th className="p-3">Booking</th>
                <th className="p-3">GPU</th>
                <th className="p-3">From</th>
                <th className="p-3">To</th>
                <th className="p-3">Total</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const state = bookingState(b)
                return (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="p-3">#{b.id}</td>
                    <td className="p-3">
                      <Link to={`/gpus/${b.gpu_id}`} className="text-brand">
                          {b.gpu_model}
                      </Link>
                      <p className="text-xs text-muted">{b.gpu_location}</p>
                    </td>
                    <td className="p-3">{formatTime(b.start_at)}</td>
                    <td className="p-3">{formatTime(b.end_at)}</td>
                    <td className="p-3">${b.total_price}</td>
                    <td className="p-3">
                      <span className={`rounded px-2 py-0.5 text-xs ${STATE_BADGE[state]}`}>{state}</span>
                    </td>
                    <td className="p-3">
                      {state === 'upcoming' && (
                        <button
                          onClick={() => handleCancel(b)}
                          disabled={cancellingId === b.id}
                          className="rounded border border-danger/40 px-3 py-1 text-danger disabled:opacity-50"
                        >
                          {cancellingId === b.id ? 'Cancelling...' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          disabled={offset === 0}
          className="rounded border bg-surface px-4 py-2 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-muted">Page {offset / PAGE_SIZE + 1}</span>
        <button
          onClick={() => setOffset(offset + PAGE_SIZE)}
          disabled={!hasNext}
          className="rounded border bg-surface px-4 py-2 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}