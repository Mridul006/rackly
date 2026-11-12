import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { SAMPLE_GPUS } from '../scene/sampleData'

const DatacenterScene = lazy(() => import('./scene/DatacenterScene'))

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export default function SceneBackdrop() {
  const progress = useRef(0)
  const [supported] = useState(webglAvailable)
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    function update() {
      const max = document.documentElement.scrollHeight - window.innerHeight
      progress.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-page">
      {supported && (
        <Suspense fallback={null}>
          <DatacenterScene
            gpus={SAMPLE_GPUS}
            mode="scroll"
            progress={progress}
            frozen={reduced}
            dpr={[1, 1.5]}
          />
        </Suspense>
      )}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgb(5_5_5/0.75)_100%)]" />
    </div>
  )
}