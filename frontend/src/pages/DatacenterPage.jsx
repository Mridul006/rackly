import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

const COLORS = {
  available: '#9dc95e',
  rented: '#ff9f1c',
  offline: '#5f5f66',
}

function Box({ position, color }) {
  const [hovered, setHovered] = useState(false)

  return (
    <mesh
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#1a1a1c"
        emissive={color}
        emissiveIntensity={hovered ? 1.2 : 0.25}
        metalness={0.2}
        roughness={0.5}
      />
    </mesh>
  )
}

function Spinner({ children }) {
  const group = useRef()

  useFrame((state, delta) => {
    group.current.rotation.y += delta * 0.2
  })

  return <group ref={group}>{children}</group>
}

export default function DatacenterPage() {
  return (
    <div className="h-[calc(100vh-9rem)] w-full overflow-hidden border border-line bg-page">
      <Canvas camera={{ position: [6, 4, 8], fov: 45 }}>
        <color attach="background" args={['#050505']} />
        <fog attach="fog" args={['#050505', 10, 25]} />

        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={2} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#0c0c0d" />
        </mesh>

        <Spinner>
          <Box position={[-2, 0, 0]} color={COLORS.available} />
          <Box position={[0, 0, 0]} color={COLORS.rented} />
          <Box position={[2, 0, 0]} color={COLORS.offline} />
        </Spinner>

        <OrbitControls enablePan={false} />
      </Canvas>
    </div>
  )
}