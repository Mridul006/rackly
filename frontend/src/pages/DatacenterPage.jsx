import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import DatacenterScene from '../components/scene/DatacenterScene'
import { SAMPLE_GPUS } from '../scene/sampleData'

const STATUS = {
  available: {
    label: 'Available',
    dot: 'bg-available',
    badge: 'bg-available/15 text-available',
    note: 'Open for booking.',
  },
  rented: {
    label: 'Rented',
    dot: 'bg-rented',
    badge: 'bg-rented/15 text-rented',
    note: 'In use right now. You can still book a later time.',
  },
  offline: {
    label: 'Offline',
    dot: 'bg-offline',
    badge: 'bg-offline/20 text-muted',
    note: 'The provider has not opened any availability.',
  },
}

const smallBtn =
  'border border-line bg-surface/80 px-3 py-1.5 text-ink hover:border-brand hover:text-brand'

export default function DatacenterPage() {
  const { user } = useAuth()
  const [live, setLive] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [useSample, setUseSample] = useState(false)
  const [orbit, setOrbit] = useState(true)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')

    api('/datacenter')
      .then((data) => {
        if (!ignore) setLive(data)
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

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const gpus = useSample ? SAMPLE_GPUS : live
  const selected = useMemo(() => gpus.find((g) => g.id === selectedId) ?? null, [gpus, selectedId])
  const counts = useMemo(() => {
    const c = { available: 0, rented: 0, offline: 0 }
    gpus.forEach((g) => {
      c[g.status] += 1
    })
    return c
  }, [gpus])

  function toggleSample() {
    setUseSample((value) => !value)
    setSelectedId(null)
  }

  function toggleOrbit() {
    setOrbit((value) => !value)
    setSelectedId(null)
  }

  return (
    <div className="relative h-[calc(100vh-9rem)] w-full overflow-hidden border border-line bg-page">
      <DatacenterScene
        gpus={gpus}
        mode={orbit ? 'orbit' : 'drift'}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <div className="absolute left-4 top-4 space-y-3 font-mono text-xs uppercase tracking-widest">
        <p className="text-muted">Datacenter · {useSample ? 'sample data' : 'live data'}</p>
        <div className="pointer-events-none space-y-1.5">
          {Object.entries(STATUS).map(([key, item]) => (
            <p key={key} className="flex items-center gap-2 text-ink">
              <i className={`h-2 w-2 rounded-full ${item.dot}`} />
              {item.label} <span className="text-muted">{counts[key]}</span>
            </p>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={toggleSample} className={smallBtn}>
            {useSample ? 'Use live data' : 'Use sample data'}
          </button>
          {!useSample && (
            <button onClick={() => setReloadKey((key) => key + 1)} className={smallBtn}>
              Refresh
            </button>
          )}
        </div>
        {loading && !useSample && <p className="text-muted">Loading...</p>}
        {error && <p className="normal-case tracking-normal text-danger">{error}</p>}
        {!loading && !error && !useSample && live.length === 0 && (
          <p className="max-w-56 normal-case tracking-normal text-muted">
            No GPUs are listed yet. List one from My GPUs, or view the sample data.
          </p>
        )}
      </div>

      {orbit && !selected && (
        <p className="pointer-events-none absolute bottom-4 left-4 font-mono text-xs uppercase tracking-widest text-muted">
          Click a lit slot to select a GPU
        </p>
      )}

      {selected && (
        <aside className="absolute right-4 top-4 w-72 border border-line bg-surface/95 p-4">
          <div className="flex items-start justify-between gap-2">
            <span
              className={`rounded-sm px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${STATUS[selected.status].badge}`}
            >
              {STATUS[selected.status].label}
            </span>
            <button
              onClick={() => setSelectedId(null)}
              aria-label="Close"
              className="font-mono text-sm text-muted hover:text-ink"
            >
              ×
            </button>
          </div>

          <h2 className="mt-3 text-xl font-light">{selected.model}</h2>
          <p className="mt-1 text-sm text-muted">
            {selected.gpu_count} × {selected.vram_gb} GB VRAM · {selected.location}
          </p>
          <p className="font-mono text-xs uppercase tracking-wider text-muted">
            Rack {selected.rack_no}, slot {selected.slot_no}
          </p>
          <p className="mt-3 text-2xl font-light">
            ${selected.price_per_hour}
            <span className="text-sm text-muted"> / hour</span>
          </p>
          <p className="mt-2 text-sm text-muted">{STATUS[selected.status].note}</p>

          {useSample ? (
            <p className="mt-4 font-mono text-xs uppercase tracking-wider text-muted">
              Sample data, not bookable
            </p>
          ) : (
            <Link
              to={`/gpus/${selected.id}`}
              className="mt-4 block rounded-sm bg-brand px-4 py-2 text-center font-mono text-xs font-medium uppercase tracking-wider text-page hover:opacity-90"
            >
              {user.role === 'renter' ? 'View and book' : 'View'}
            </Link>
          )}
        </aside>
      )}

      <button
        onClick={toggleOrbit}
        className={`absolute bottom-4 right-4 font-mono text-xs uppercase tracking-wider ${smallBtn}`}
      >
        {orbit ? 'Auto tour' : 'Take control'}
      </button>
    </div>
  )
}