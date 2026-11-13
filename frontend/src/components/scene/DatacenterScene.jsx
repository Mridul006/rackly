import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, MathUtils, SRGBColorSpace, Vector3 } from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Grid, Instance, Instances, Lightformer, OrbitControls } from '@react-three/drei'
import { BEZEL, buildLayout, ROW_LENGTH } from '../../scene/layout'
import { statusColors, themeColor } from '../../theme'

const DEFAULT_DPR = [1, 2]

function makeBezelTextures() {
  const W = 1024
  const H = 200
  const paint = document.createElement('canvas')
  const glow = document.createElement('canvas')
  paint.width = glow.width = W
  paint.height = glow.height = H
  const c = paint.getContext('2d')
  const g = glow.getContext('2d')

  c.fillStyle = '#1d1d20'
  c.fillRect(0, 0, W, H)
  c.fillStyle = '#2e2e33'
  c.fillRect(0, 0, W, 3)
  c.fillStyle = '#0c0c0e'
  c.fillRect(0, H - 4, W, 4)

  c.fillStyle = '#09090a'
  for (let x = 190; x < 770; x += 14) c.fillRect(x, 44, 6, 112)

  g.fillStyle = '#000000'
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 4; i++) {
    const x = 28 + i * 30
    c.fillStyle = '#0f0f11'
    c.fillRect(x, 70, 24, 60)
    c.strokeStyle = '#34343a'
    c.lineWidth = 2
    c.strokeRect(x, 70, 24, 60)
    g.fillStyle = i === 1 ? '#ff9f1c' : '#9dc95e'
    g.fillRect(x + 9, 78, 6, 6)
  }

  c.fillStyle = '#070708'
  c.fillRect(868, 68, 72, 64)

  const make = (canvas) => {
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }
  return { map: make(paint), glow: make(glow) }
}

function MetalParts({ parts, color = '#111113' }) {
  return (
    <Instances limit={Math.max(parts.length, 1)} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.42} />
      {parts.map((p) => (
        <Instance key={p.key} position={p.position} scale={p.scale} />
      ))}
    </Instances>
  )
}

const Bezels = memo(function Bezels({ bezels, onSelect, onHover }) {
  const textures = useMemo(() => makeBezelTextures(), [])

  return (
    <Instances limit={Math.max(bezels.length, 1)} frustumCulled={false}>
      <boxGeometry args={[BEZEL.w, BEZEL.h, BEZEL.d]} />
      <meshStandardMaterial
        map={textures.map}
        emissiveMap={textures.glow}
        emissive="#ffffff"
        emissiveIntensity={1.6}
        metalness={0.55}
        roughness={0.5}
      />
      {bezels.map((b) => {
        const pickable = Boolean(onSelect) && b.gpuId !== null
        return (
          <Instance
            key={b.key}
            position={b.position}
            rotation={[0, b.rotationY, 0]}
            onClick={
              pickable
                ? (e) => {
                    e.stopPropagation()
                    onSelect(b.gpuId)
                  }
                : undefined
            }
            onPointerOver={
              pickable
                ? (e) => {
                    e.stopPropagation()
                    onHover(b.gpuId)
                  }
                : undefined
            }
            onPointerOut={pickable ? () => onHover(null) : undefined}
          />
        )
      })}
    </Instances>
  )
})

function Handles({ handles }) {
  return (
    <Instances limit={Math.max(handles.length, 1)} frustumCulled={false}>
      <boxGeometry args={[0.025, 0.1, 0.04]} />
      <meshStandardMaterial color="#3a3a40" metalness={0.9} roughness={0.3} />
      {handles.map((h) => (
        <Instance key={h.key} position={h.position} />
      ))}
    </Instances>
  )
}

function Leds({ leds, colors }) {
  return (
    <Instances limit={Math.max(leds.length, 1)} frustumCulled={false}>
      <boxGeometry args={[0.07, 0.045, 0.03]} />
      <meshBasicMaterial toneMapped={false} />
      {leds.map((l) => (
        <Instance key={l.key} position={l.position} color={colors[l.status] ?? colors.empty} />
      ))}
    </Instances>
  )
}

function CeilingLights({ lights }) {
  return (
    <Instances limit={Math.max(lights.length, 1)} frustumCulled={false}>
      <boxGeometry args={[ROW_LENGTH + 2, 0.04, 0.3]} />
      <meshBasicMaterial color="#e6edf5" toneMapped={false} />
      {lights.map((l) => (
        <Instance key={l.key} position={l.position} />
      ))}
    </Instances>
  )
}

function Room() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#0a0a0b" metalness={0.6} roughness={0.55} />
      </mesh>
      <Grid
        position={[0, 0.003, 0]}
        cellSize={0.6}
        cellThickness={0.5}
        cellColor="#1c1c20"
        sectionSize={3}
        sectionThickness={0.9}
        sectionColor="#2b2b31"
        fadeDistance={40}
        fadeStrength={1.5}
        infiniteGrid
      />
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 4.5, 0]}>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#070708" />
      </mesh>
    </>
  )
}

function CameraLight() {
  const light = useRef()

  useFrame((state) => {
    light.current.position.copy(state.camera.position)
  })

  return <pointLight ref={light} intensity={5} distance={16} decay={2} color="#d8e4dc" />
}

function CameraDrift() {
  const time = useRef(0)

  useFrame((state, delta) => {
    time.current += delta
    const t = time.current
    state.camera.position.set(
      -12 + Math.sin(t * 0.08) * 6,
      1.7 + Math.sin(t * 0.2) * 0.08,
      Math.sin(t * 0.13) * 0.5,
    )
    state.camera.lookAt(10, 1.3, Math.sin(t * 0.05) * 1.5)
  })

  return null
}

function ScrollCamera({ progress, frozen }) {
  const current = useRef({ x: -12, y: 1.7, z: 0 })
  const time = useRef(0)

  useFrame((state, delta) => {
    time.current += delta
    const p = frozen ? 0 : progress.current
    const sway = frozen ? 0 : Math.sin(time.current * 0.15) * 0.25

    const targetX = -12 + p * 26
    const targetY = 1.7 + p * 0.9
    const targetZ = Math.sin(p * Math.PI * 2) * 0.7 + sway

    const c = current.current
    c.x = MathUtils.damp(c.x, targetX, 3, delta)
    c.y = MathUtils.damp(c.y, targetY, 3, delta)
    c.z = MathUtils.damp(c.z, targetZ, 3, delta)

    state.camera.position.set(c.x, c.y, c.z)
    state.camera.lookAt(c.x + 18, 1.3, c.z * 0.6)
  })

  return null
}

function CloseupCamera({ frozen }) {
  const time = useRef(0)

  useFrame((state, delta) => {
    if (!frozen) time.current += delta
    const t = time.current
    const x = -1.5 + Math.sin(t * 0.09) * 2.6

    state.camera.position.set(x, 1.45 + Math.sin(t * 0.17) * 0.05, 0.85)
    state.camera.lookAt(x + 2.6, 1.25, -1.2)
  })

  return null
}

function SlotMarker({ bezel, color, opacity }) {
  if (!bezel) return null
  const [x, y, z] = bezel.position

  return (
    <mesh position={[x, y, z + bezel.dir * 0.045]}>
      <boxGeometry args={[BEZEL.w + 0.1, BEZEL.h + 0.08, 0.02]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function PulseMarker({ bezel, color }) {
  const material = useRef()
  const time = useRef(0)

  useFrame((state, delta) => {
    time.current += delta
    if (material.current) material.current.opacity = 0.3 + 0.25 * Math.sin(time.current * 9)
  })

  if (!bezel) return null
  const [x, y, z] = bezel.position

  return (
    <mesh position={[x, y, z + bezel.dir * 0.05]}>
      <boxGeometry args={[BEZEL.w + 0.16, BEZEL.h + 0.12, 0.02]} />
      <meshBasicMaterial
        ref={material}
        color={color}
        transparent
        opacity={0.4}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

function FocusRig({ focus }) {
  const controls = useThree((state) => state.controls)
  const camera = useThree((state) => state.camera)
  const goal = useRef(null)

  useEffect(() => {
    goal.current = focus
      ? { target: new Vector3(...focus.target), camera: new Vector3(...focus.camera) }
      : null
  }, [focus])

  useFrame(() => {
    const g = goal.current
    if (!controls || !g) return

    controls.target.lerp(g.target, 0.07)
    camera.position.lerp(g.camera, 0.07)
    controls.update()

    if (controls.target.distanceTo(g.target) < 0.02 && camera.position.distanceTo(g.camera) < 0.02) {
      goal.current = null
    }
  })

  return null
}

export default function DatacenterScene({
  gpus,
  mode = 'drift',
  progress,
  frozen = false,
  dpr = DEFAULT_DPR,
  selectedId = null,
  pulseId = null,
  onSelect,
}) {
  const layout = useMemo(() => buildLayout(gpus), [gpus])
  const colors = useMemo(() => statusColors(), [])
  const brand = useMemo(() => themeColor('brand'), [])
  const [hoveredId, setHoveredId] = useState(null)

  const bezelByGpu = useMemo(() => {
    const map = new Map()
    layout.bezels.forEach((b) => {
      if (b.gpuId !== null) map.set(b.gpuId, b)
    })
    return map
  }, [layout])

  const selectedBezel = selectedId !== null ? bezelByGpu.get(selectedId) : null
  const hoveredBezel =
    hoveredId !== null && hoveredId !== selectedId ? bezelByGpu.get(hoveredId) : null
  const pulseBezel = pulseId !== null ? bezelByGpu.get(pulseId) : null

  const focus = useMemo(() => {
    if (!selectedBezel) return null
    const [x, y, z] = selectedBezel.position
    return { target: [x, y, z], camera: [x, y + 0.25, z + selectedBezel.dir * 3.2] }
  }, [selectedBezel])

  useEffect(() => {
    document.body.style.cursor = hoveredId !== null ? 'pointer' : 'auto'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [hoveredId])

  const pickable = mode === 'orbit' && Boolean(onSelect)

  return (
    <Canvas camera={{ position: [-12, 1.7, 0], fov: 50 }} dpr={dpr}>
      <color attach="background" args={['#050505']} />
      <fog attach="fog" args={['#050505', 12, 46]} />

      <ambientLight intensity={0.35} />
      <CameraLight />
      <Environment resolution={256} environmentIntensity={1.1}>
        {[-6, -3, 0, 3, 6].map((z) => (
          <Lightformer
            key={z}
            form="rect"
            intensity={3}
            color="#dfe6ee"
            position={[0, 6, z]}
            rotation-x={Math.PI / 2}
            scale={[24, 0.6, 1]}
          />
        ))}
        <Lightformer
          form="rect"
          intensity={0.8}
          color={colors.available}
          position={[-12, 2, 0]}
          rotation-y={Math.PI / 2}
          scale={[6, 3, 1]}
        />
      </Environment>

      <Room />
      <MetalParts parts={layout.frames} />
      <MetalParts parts={layout.trays} color="#161618" />
      <Bezels
        bezels={layout.bezels}
        onSelect={pickable ? onSelect : undefined}
        onHover={setHoveredId}
      />
      <Handles handles={layout.handles} />
      <Leds leds={layout.leds} colors={colors} />
      <CeilingLights lights={layout.lights} />

      <SlotMarker bezel={hoveredBezel} color="#e8e8ea" opacity={0.18} />
      <SlotMarker bezel={selectedBezel} color={brand} opacity={0.35} />
      <PulseMarker bezel={pulseBezel} color={brand} />

      {mode === 'orbit' && (
        <>
          <OrbitControls
            makeDefault
            target={[0, 1.2, 0]}
            enablePan
            screenSpacePanning={false}
            minDistance={3}
            maxDistance={40}
            maxPolarAngle={Math.PI / 2.05}
          />
          <FocusRig focus={focus} />
        </>
      )}
      {mode === 'drift' && <CameraDrift />}
      {mode === 'scroll' && <ScrollCamera progress={progress} frozen={frozen} />}
      {mode === 'closeup' && <CloseupCamera frozen={frozen} />}
    </Canvas>
  )
}