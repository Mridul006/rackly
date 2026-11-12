import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { formatTime } from '../format'


export default function GPUDetailPage() {
  const { gpuId } = useParams()
  const { user } = useAuth()
  const isRenter = user.role === 'renter'

  const [gpu, setGpu] = useState(null)
  const [windows, setWindows] = useState([])
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [start, setStart] = useState('')
  const [hours, setHours] = useState(1)
  const [bookingError, setBookingError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [booked, setBooked] = useState(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')

    Promise.all([
      api(`/gpus/${gpuId}`),
      api(`/gpus/${gpuId}/availability`),
      isRenter ? api('/wallet') : Promise.resolve(null),
    ])
      .then(([gpuData, windowData, wallet]) => {
        if (ignore) return
        setGpu(gpuData)
        setWindows(windowData)
        setBalance(wallet ? wallet.balance : null)
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
  }, [gpuId, isRenter])

  if (loading) return <p className="text-muted">Loading...</p>
  if (error) return <p className="text-danger">{error}</p>

  const startDate = start ? new Date(start) : null
  const endDate = startDate ? new Date(startDate.getTime() + hours * 3600 * 1000) : null
  const total = (Math.round(Number(gpu.price_per_hour) * 100) * hours) / 100
  const insideWindow =
    startDate &&
    windows.some((w) => new Date(w.start_at) <= startDate && new Date(w.end_at) >= endDate)

  async function handleBook(e) {
    e.preventDefault()
    setBookingError('')
    setBooked(null)
    setSubmitting(true)
    try {
      const booking = await api('/bookings', {
        method: 'POST',
        body: {
          gpu_id: gpu.id,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
        },
      })
      setBooked(booking)
      const wallet = await api('/wallet')
      setBalance(wallet.balance)
    } catch (err) {
      setBookingError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Link to="/browse" className="text-sm text-brand">
        ← Back to browse
      </Link>

      <h1 className="mt-4 text-3xl font-bold">{gpu.model}</h1>
      <p className="mt-1 text-muted">
        {gpu.gpu_count} × {gpu.vram_gb} GB VRAM · {gpu.location}
      </p>
      {gpu.rack_no !== null && (
        <p className="text-sm text-muted">
          Rack {gpu.rack_no}, slot {gpu.slot_no}
        </p>
      )}
      <p className="mt-3 text-2xl font-bold text-brand">
        ${gpu.price_per_hour}
        <span className="text-base font-normal text-muted"> / hour</span>
      </p>

      <h2 className="mt-8 text-lg font-semibold">Available times</h2>
      {windows.length === 0 ? (
        <p className="mt-2 text-muted">The provider has not opened any availability yet.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {windows.map((w) => (
            <li key={w.id}>
              {formatTime(w.start_at)} → {formatTime(w.end_at)}
            </li>
          ))}
        </ul>
      )}

      {isRenter ? (
        <form onSubmit={handleBook} className="mt-8 max-w-sm space-y-4 rounded-lg border bg-surface p-4">
          <h2 className="text-lg font-semibold">Book this GPU</h2>
          <p className="text-sm text-muted">Wallet balance: ${balance}</p>

          <label className="block text-sm">
            Start time
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
              className="mt-1 w-full rounded border p-2"
            />
          </label>

          <label className="block text-sm">
            Hours
            <input
              type="number"
              min="1"
              step="1"
              value={hours}
              onChange={(e) => setHours(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              required
              className="mt-1 w-full rounded border p-2"
            />
          </label>

          {startDate && (
            <div className="text-sm text-ink">
              <p>Ends: {formatTime(endDate)}</p>
              <p className="font-semibold">Total: ${total.toFixed(2)}</p>
              {!insideWindow && (
                <p className="mt-1 text-rented">
                  This time is not inside an available window.
                </p>
              )}
            </div>
          )}

          {bookingError && <p className="text-danger">{bookingError}</p>}
          {booked && (
            <p className="text-available">
              Booked! Total charged: ${booked.total_price}. Booking number {booked.id}.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-brand p-2 text-page disabled:opacity-50"
          >
            {submitting ? 'Booking...' : 'Book now'}
          </button>
        </form>
      ) : (
        <p className="mt-8 text-sm text-muted">
          {gpu.owner_id === user.id
            ? 'This is your listing.'
            : 'Only renters can book GPUs.'}
        </p>
      )}
    </div>
  )
}