export default function GPUCard({ gpu }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold">{gpu.model}</h3>
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
    </div>
  )
}