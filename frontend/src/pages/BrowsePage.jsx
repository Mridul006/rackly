import { useEffect, useState } from 'react'
import { api } from '../api'
import GPUCard from '../components/GPUCard'

const PAGE_SIZE = 12
const EMPTY_FILTERS = { model: '', maxPrice: '', minCount: '' }

export default function BrowsePage() {
  const [draft, setDraft] = useState(EMPTY_FILTERS)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [offset, setOffset] = useState(0)
  const [gpus, setGpus] = useState([])
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')

    const params = new URLSearchParams()
    params.set('limit', PAGE_SIZE + 1)
    params.set('offset', offset)
    if (filters.model) params.set('model', filters.model)
    if (filters.maxPrice) params.set('max_price', filters.maxPrice)
    if (filters.minCount) params.set('min_gpu_count', filters.minCount)

    api(`/gpus?${params}`)
      .then((data) => {
        if (ignore) return
        setHasNext(data.length > PAGE_SIZE)
        setGpus(data.slice(0, PAGE_SIZE))
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
  }, [filters, offset])

  function updateDraft(field, value) {
    setDraft({ ...draft, [field]: value })
  }

  function applyFilters(e) {
    e.preventDefault()
    setOffset(0)
    setFilters(draft)
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS)
    setFilters(EMPTY_FILTERS)
    setOffset(0)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Browse GPUs</h1>

      <form onSubmit={applyFilters} className="mt-4 flex flex-wrap items-end gap-3">
        <input
          placeholder="Model (e.g. A100)"
          value={draft.model}
          onChange={(e) => updateDraft('model', e.target.value)}
          className="rounded border bg-surface p-2"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Max price / hour"
          value={draft.maxPrice}
          onChange={(e) => updateDraft('maxPrice', e.target.value)}
          className="w-44 rounded border bg-surface p-2"
        />
        <input
          type="number"
          min="1"
          placeholder="Min GPUs"
          value={draft.minCount}
          onChange={(e) => updateDraft('minCount', e.target.value)}
          className="w-32 rounded border bg-surface p-2"
        />
        <button type="submit" className="rounded bg-brand px-4 py-2 text-page">
          Apply
        </button>
        <button type="button" onClick={clearFilters} className="rounded border bg-surface px-4 py-2">
          Clear
        </button>
      </form>

      {error && <p className="mt-6 text-danger">{error}</p>}
      {loading && <p className="mt-6 text-muted">Loading...</p>}      
      {!loading && !error && gpus.length === 0 && (
        <p className="mt-6 text-muted">No GPUs match your filters.</p>
      )}

      {!loading && gpus.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gpus.map((gpu) => (
            <GPUCard key={gpu.id} gpu={gpu} />
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center gap-4">
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