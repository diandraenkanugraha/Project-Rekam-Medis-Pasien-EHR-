import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ROLE } from '../lib/format'

// Susun posisi: authority di tengah, dokter/RS cincin dalam, pasien cincin luar.
function layout(nodes) {
  const pos = {}
  const ring = (list, r, phase) => list.forEach((n, i) => {
    const a = (i / Math.max(list.length, 1)) * Math.PI * 2 + phase
    pos[n.id] = [Math.cos(a) * r, Math.sin(i * 2.3 + phase) * 0.75, Math.sin(a) * r]
  })
  const auth = nodes.filter(n => n.role === 'authority')
  auth.length === 1 ? (pos[auth[0].id] = [0, 0, 0]) : ring(auth, 0.7, 0)
  ring(nodes.filter(n => n.role === 'doctor' || n.role === 'hospital'), 2.2, 0.4)
  ring(nodes.filter(n => n.role === 'patient'), 3.5, 1.1)
  return pos
}

function Pulse({ a, b, color, offset = 0 }) {
  const m = useRef()
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.5 + offset) % 1
    m.current.position.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
    m.current.scale.setScalar(0.6 + Math.sin(t * Math.PI) * 0.8)
  })
  return <mesh ref={m}><sphereGeometry args={[0.085, 12, 12]} /><meshBasicMaterial color={color} /></mesh>
}

function Node({ n, p, onHover, hovered }) {
  const ref = useRef()
  const isAuth = n.role === 'authority'
  const color = ROLE[n.role].color
  useFrame(({ clock }) => { if (isAuth) ref.current.rotation.y = clock.elapsedTime * 0.6 })
  return (
    <group position={p}>
      <mesh onPointerOver={(e) => { e.stopPropagation(); onHover(n.id) }} onPointerOut={() => onHover(null)} scale={hovered ? 1.25 : 1}>
        <sphereGeometry args={[isAuth ? 0.5 : 0.28, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered ? 0.9 : 0.45} roughness={0.25} metalness={0.1} />
      </mesh>
      {isAuth && (
        <mesh ref={ref} rotation={[1.2, 0, 0]}>
          <torusGeometry args={[0.85, 0.018, 12, 80]} /><meshBasicMaterial color="#60a5fa" />
        </mesh>
      )}
      {hovered && (
        <Html center position={[0, 0.7, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-xl bg-white px-3 py-1.5 text-center shadow-lg">
            <p className="text-xs font-extrabold text-ink-900">{n.name}</p>
            <p className="text-[10px] font-semibold" style={{ color }}>{ROLE[n.role].label}</p>
          </div>
        </Html>
      )}
    </group>
  )
}

// Jauhkan/dekatkan kamera sesuai lebar kanvas supaya seluruh jaringan selalu muat.
function CamFit() {
  const { camera, size } = useThree()
  useEffect(() => {
    const aspect = size.width / size.height
    camera.position.z = aspect < 0.9 ? 9.5 : aspect < 1.4 ? 7.4 : 6.6
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

export default function NetworkScene({ nodes = [], edges = [] }) {
  const [hover, setHover] = useState(null)
  const pos = useMemo(() => layout(nodes), [nodes])
  const auth = nodes.find(n => n.role === 'authority')
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 2.6, 6.6], fov: 45 }} gl={{ alpha: true, antialias: true }}>
      <CamFit />
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 6, 5]} intensity={1.3} />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.9} maxPolarAngle={Math.PI * 0.62} minPolarAngle={Math.PI * 0.3} />
      <group>
        {auth && nodes.filter(n => n.id !== auth.id).map(n => pos[n.id] && (
          <Line key={'a' + n.id} points={[pos[auth.id], pos[n.id]]} color="#a9c9dc" lineWidth={1} transparent opacity={0.55} />
        ))}
        {edges.map((e, i) => pos[e.from] && pos[e.to] && (
          <group key={i}>
            <Line points={[pos[e.from], pos[e.to]]} color="#0d9488" lineWidth={2.4} />
            <Pulse a={pos[e.from]} b={pos[e.to]} color="#0d9488" offset={i * 0.37} />
          </group>
        ))}
        {nodes.map(n => pos[n.id] && <Node key={n.id} n={n} p={pos[n.id]} hovered={hover === n.id} onHover={setHover} />)}
      </group>
    </Canvas>
  )
}
