import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import AvailabilityPanel from '../components/AvailabilityPanel'

const EMPTY_FORM = {
  model: '',
  vram_gb: '',
  gpu_count: '1',
  price_per_hour: '',
  location: '',
}

export default function DashboardPage() {
  const [gpus, setGpus] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [created, setCreated] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [togglingId, setTogglingId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')

    api('/providers/me/gpus')
      .then((data) => {
        if (!ignore) setGpus(data)
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
  }, [reloadKey])

  function updateForm(field, value) {
    setForm({ ...form, [field]: value })
  }

  async function handleCreate(e) {
    e.preventDefault()
    setFormError('')
    setCreated(null)
    setSubmitting(true)
    try {
      const gpu = await api('/gpus', {
        method: 'POST',
        body: {
          model: form.model.trim(),
          vram_gb: Number(form.vram_gb),
          gpu_count: Number(form.gpu_count),
          price_per_hour: form.price_per_hour,
          location: form.location.trim(),
        },
      })
      setCreated(gpu)
      setForm(EMPTY_FORM)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(gpu) {
    if (gpu.is_active) {
      const ok = window.confirm(
        `Switch off ${gpu.model}? It will disappear from Browse. Existing bookings are not affected.`,
      )
      if (!ok) return
    }

    setActionError('')
    setTogglingId(gpu.id)
    try {
      await api(`/gpus/${gpu.id}`, {
        method: 'PATCH',
        body: { is_active: !gpu.is_active },
      })
      if (gpu.is_active && openId === gpu.id) setOpenId(null)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">My GPUs</h1>

      <form
        onSubmit={handleCreate}
        className="mt-4 grid max-w-2xl gap-3 rounded-lg border bg-surface p-4 sm:grid-cols-2"
      >
        <h2 className="text-lg font-semibold sm:col-span-2">List a new GPU</h2>

        <label className="block text-sm">
          Model
          <input
            value={form.model}
            onChange={(e) => updateForm('model', e.target.value)}
            placeholder="e.g. RTX 4090"
            required
            maxLength={100}
            className="mt-1 w-full rounded border p-2"
          />
        </label>

        <label className="block text-sm">
          Location
          <input
            value={form.location}
            onChange={(e) => updateForm('location', e.target.value)}
            placeholder="e.g. Delhi"
            required
            maxLength={100}
            className="mt-1 w-full rounded border p-2"
          />
        </label>

        <label className="block text-sm">
          VRAM per GPU (GB)
          <input
            type="number"
            min="1"
            step="1"
            value={form.vram_gb}
            onChange={(e) => updateForm('vram_gb', e.target.value)}
            required
            className="mt-1 w-full rounded border p-2"
          />
        </label>

        <label className="block text-sm">
          Number of GPUs
          <input
            type="number"
            min="1"
            step="1"
            value={form.gpu_count}
            onChange={(e) => updateForm('gpu_count', e.target.value)}
            required
            className="mt-1 w-full rounded border p-2"
          />
        </label>

        <label className="block text-sm">
          Price per hour ($)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.price_per_hour}
            onChange={(e) => updateForm('price_per_hour', e.target.value)}
            required
            className="mt-1 w-full rounded border p-2"
          />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-brand p-2 text-page disabled:opacity-50"
          >
            {submitting ? 'Listing...' : 'List GPU'}
          </button>
        </div>

        {formError && <p className="text-danger sm:col-span-2">{formError}</p>}
        {created && (
          <p className="text-available sm:col-span-2">
            Listed {created.model}. It was placed at rack {created.rack_no}, slot {created.slot_no}.
            Add availability so renters can book it.
          </p>
        )}
      </form>

      {actionError && <p className="mt-4 text-danger">{actionError}</p>}
      {error && <p className="mt-6 text-danger">{error}</p>}
      {loading && gpus.length === 0 && <p className="mt-6 text-muted">Loading...</p>}      
      {!loading && !error && gpus.length === 0 && (
        <p className="mt-6 text-muted">You have not listed any GPUs yet.</p>
      )}

      {gpus.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gpus.map((gpu) => (
            <div
              key={gpu.id}
              className={`rounded-lg border bg-surface p-4 ${gpu.is_active ? '' : 'opacity-70'} ${
                openId === gpu.id ? 'sm:col-span-2 lg:col-span-3' : ''
              }`}
            >
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    gpu.is_active ? 'bg-available/15 text-available' : 'bg-offline/20 text-muted'
                  }`}
                >
                  {gpu.is_active ? 'Listed' : 'Switched off'}
                </span>
                {gpu.rented_now && (
                  <span className="rounded bg-brand/15 px-2 py-0.5 text-xs text-brand">
                    Rented now
                  </span>
                )}
              </div>

              <h3 className="mt-2 text-lg font-semibold">{gpu.model}</h3>
              <p className="text-sm text-muted">
                {gpu.gpu_count} × {gpu.vram_gb} GB VRAM · {gpu.location}
              </p>
              <p className="text-sm text-muted">
                {gpu.rack_no !== null
                  ? `Rack ${gpu.rack_no}, slot ${gpu.slot_no}`
                  : 'No rack position'}
              </p>
              <p className="mt-2 text-xl font-bold text-brand">
                ${gpu.price_per_hour}
                <span className="text-sm font-normal text-muted"> / hour</span>
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {gpu.is_active && (
                  <Link to={`/gpus/${gpu.id}`} className="rounded border px-3 py-1 text-sm">
                    View
                  </Link>
                )}
                {gpu.is_active && (
                  <button
                    onClick={() => setOpenId(openId === gpu.id ? null : gpu.id)}
                    className="rounded border px-3 py-1 text-sm"
                  >
                    {openId === gpu.id ? 'Hide availability' : 'Availability'}
                  </button>
                )}
                <button
                  onClick={() => handleToggle(gpu)}
                  disabled={togglingId === gpu.id}
                  className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                >
                  {togglingId === gpu.id
                    ? 'Saving...'
                    : gpu.is_active
                      ? 'Switch off'
                      : 'Switch on'}
                </button>
              </div>

              {openId === gpu.id && gpu.is_active && <AvailabilityPanel gpuId={gpu.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}