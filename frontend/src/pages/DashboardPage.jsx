import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

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
        className="mt-4 grid max-w-2xl gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2"
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
            className="w-full rounded bg-blue-600 p-2 text-white disabled:opacity-50"
          >
            {submitting ? 'Listing...' : 'List GPU'}
          </button>
        </div>

        {formError && <p className="text-red-600 sm:col-span-2">{formError}</p>}
        {created && (
          <p className="text-green-700 sm:col-span-2">
            Listed {created.model}. It was placed at rack {created.rack_no}, slot {created.slot_no}.
            Add availability so renters can book it.
          </p>
        )}
      </form>

      {actionError && <p className="mt-4 text-red-600">{actionError}</p>}
      {error && <p className="mt-6 text-red-600">{error}</p>}
      {loading && <p className="mt-6 text-gray-500">Loading...</p>}
      {!loading && !error && gpus.length === 0 && (
        <p className="mt-6 text-gray-500">You have not listed any GPUs yet.</p>
      )}

      {!loading && gpus.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gpus.map((gpu) => (
            <div
              key={gpu.id}
              className={`rounded-lg border bg-white p-4 shadow-sm ${gpu.is_active ? '' : 'opacity-70'}`}
            >
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    gpu.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {gpu.is_active ? 'Listed' : 'Switched off'}
                </span>
                {gpu.rented_now && (
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                    Rented now
                  </span>
                )}
              </div>

              <h3 className="mt-2 text-lg font-semibold">{gpu.model}</h3>
              <p className="text-sm text-gray-600">
                {gpu.gpu_count} × {gpu.vram_gb} GB VRAM · {gpu.location}
              </p>
              <p className="text-sm text-gray-500">
                {gpu.rack_no !== null
                  ? `Rack ${gpu.rack_no}, slot ${gpu.slot_no}`
                  : 'No rack position'}
              </p>
              <p className="mt-2 text-xl font-bold text-blue-600">
                ${gpu.price_per_hour}
                <span className="text-sm font-normal text-gray-500"> / hour</span>
              </p>

              <div className="mt-4 flex gap-2">
                {gpu.is_active && (
                  <Link
                    to={`/gpus/${gpu.id}`}
                    className="rounded border px-3 py-1 text-sm"
                  >
                    View
                  </Link>
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}