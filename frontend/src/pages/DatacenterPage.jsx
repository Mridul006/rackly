import { useState } from 'react'
import DatacenterScene from '../components/scene/DatacenterScene'
import { SAMPLE_GPUS } from '../scene/sampleData'

const LEGEND = [
  { label: 'Available', dot: 'bg-available' },
  { label: 'Rented', dot: 'bg-rented' },
  { label: 'Offline', dot: 'bg-offline' },
  { label: 'Idle rack', dot: 'bg-[#4d5d50]' },
]

export default function DatacenterPage() {
  const [interactive, setInteractive] = useState(false)

  return (
    <div className="relative h-[calc(100vh-9rem)] w-full overflow-hidden border border-line bg-page">
      <DatacenterScene gpus={SAMPLE_GPUS} mode={interactive ? 'orbit' : 'drift'}/>

      <div className="pointer-events-none absolute left-4 top-4 space-y-2 font-mono text-xs uppercase tracking-widest">
        <p className="text-muted">Datacenter · sample data</p>
        {LEGEND.map((item) => (
          <p key={item.label} className="flex items-center gap-2 text-ink">
            <i className={`h-2 w-2 rounded-full ${item.dot}`} />
            {item.label}
          </p>
        ))}
      </div>

      <button
        onClick={() => setInteractive((value) => !value)}
        className="absolute bottom-4 right-4 border border-line bg-surface/80 px-3 py-2 font-mono text-xs uppercase tracking-wider text-ink hover:border-brand hover:text-brand"
      >
        {interactive ? 'Auto camera' : 'Take control'}
      </button>
    </div>
  )
}