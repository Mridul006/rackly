import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { SAMPLE_GPUS } from '../scene/sampleData'
import { prefersReducedMotion, webglAvailable } from '../scene/support'

const DatacenterScene = lazy(() => import('./scene/DatacenterScene'))

const DOT = { available: 'bg-available', rented: 'bg-rented', offline: 'bg-offline' }
const LABEL = { available: 'Available', rented: 'Rented', offline: 'Offline' }
const pad = (n) => String(n).padStart(2, '0')

export default function AuthBackdrop() {
  const [supported] = useState(webglAvailable)
  const [reduced] = useState(prefersReducedMotion)
  const [index, setIndex] = useState(0)

  const featured = useMemo(
    () =>
      SAMPLE_GPUS.filter((g) => g.rack_no <= 8).sort(
        (a, b) => ((a.id * 37) % 101) - ((b.id * 37) % 101),
      ),
    [],
  )

  useEffect(() => {
    if (reduced) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % featured.length), 3500)
    return () => clearInterval(timer)
  }, [featured, reduced])

  const gpu = featured[index]

  return (
    <aside aria-hidden="true" className="relative hidden overflow-hidden bg-page lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_55%,rgb(157_201_94/0.1),transparent_60%)]" />

      {supported && (
        <Suspense fallback={null}>
          <div className="absolute inset-0 animate-fade-in">
            <DatacenterScene gpus={SAMPLE_GPUS} mode="closeup" frozen={reduced} dpr={[1, 1.5]} />
          </div>
        </Suspense>
      )}

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(5_5_5/0.7)_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-linear-to-r from-surface/95 to-transparent" />

      <div className="pointer-events-none absolute bottom-6 left-10 font-mono text-xs uppercase tracking-widest">
        <p className="text-muted">Sample data</p>
        <p key={gpu.id} className="mt-2 flex animate-fade-in items-center gap-2 text-ink">
          <i className={`h-2 w-2 rounded-full ${DOT[gpu.status]}`} />
          Rack {pad(gpu.rack_no)} · Slot {pad(gpu.slot_no)} · {gpu.model} · {LABEL[gpu.status]}
        </p>
      </div>
    </aside>
  )
}