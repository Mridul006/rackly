import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

export default function GPUCard({ gpu }) {
  const { user } = useAuth()
  const isRenter = user.role === 'renter'
  const isOwner = user.id === gpu.owner_id
  return (
    <div className="rounded-lg border bg-surface p-4">
      <h3 className="text-lg font-semibold">{gpu.model}</h3>
      {isOwner && (
        <span className="mt-1 inline-block rounded bg-available/15 px-2 py-0.5 text-xs text-available">
          Your GPU
        </span>
      )}
      <p className="mt-1 text-sm text-muted">
        {gpu.gpu_count} × {gpu.vram_gb} GB VRAM
      </p>
      <p className="text-sm text-muted">{gpu.location}</p>
      {gpu.rack_no !== null && (
        <p className="text-sm text-muted">
          Rack {gpu.rack_no}, slot {gpu.slot_no}
        </p>
      )}
      <p className="mt-3 text-xl font-bold text-brand">
        ${gpu.price_per_hour}
        <span className="text-sm font-normal text-muted"> / hour</span>
      </p>
      <Link
        to={`/gpus/${gpu.id}`}
        className="mt-4 inline-block rounded bg-brand px-3 py-1 text-sm text-page"
      >
        {isRenter ? 'View and book' : 'View'}
      </Link>
    </div>
  )
}