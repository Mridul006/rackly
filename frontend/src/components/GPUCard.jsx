import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

export default function GPUCard({ gpu }) {
  const { user } = useAuth()
  const isRenter = user.role === 'renter'
  const isOwner = user.id === gpu.owner_id
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold">{gpu.model}</h3>
      {isOwner && (
        <span className="mt-1 inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
          Your GPU
        </span>
      )}
      <p className="mt-1 text-sm text-gray-600">
        {gpu.gpu_count} × {gpu.vram_gb} GB VRAM
      </p>
      <p className="text-sm text-gray-600">{gpu.location}</p>
      {gpu.rack_no !== null && (
        <p className="text-sm text-gray-500">
          Rack {gpu.rack_no}, slot {gpu.slot_no}
        </p>
      )}
      <p className="mt-3 text-xl font-bold text-blue-600">
        ${gpu.price_per_hour}
        <span className="text-sm font-normal text-gray-500"> / hour</span>
      </p>
      <Link
        to={`/gpus/${gpu.id}`}
        className="mt-4 inline-block rounded bg-blue-600 px-3 py-1 text-sm text-white"
      >
        {isRenter ? 'View and book' : 'View'}
      </Link>
    </div>
  )
}