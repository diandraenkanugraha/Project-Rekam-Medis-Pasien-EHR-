import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Edges, Environment, Float, Html, Lightformer, RoundedBox, Sparkles } from '@react-three/drei'
import { useRef } from 'react'
import { MathUtils } from 'three'

const SP = 2.5   // jarak antar blok
const SIZE = 1.45 // sisi kubus

function Link({ x1, x2, offset }) {
  const dot = useRef()
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.45 + offset) % 1
    dot.current.position.x = x1 + (x2 - x1) * t
    dot.current.scale.setScalar(0.55 + Math.sin(t * Math.PI) * 0.7)
  })
  return (
    <group>
      <mesh position={[(x1 + x2) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, x2 - x1, 12]} />
        <meshStandardMaterial color="#9bd7f5" emissive="#38bdf8" emissiveIntensity={0.5} />
      </mesh>
      <mesh ref={dot}><sphereGeometry args={[0.11, 16, 16]} /><meshBasicMaterial color="#0d9488" /></mesh>
    </group>
  )
}

function Block({ x, number, hash, latest }) {
  const grp = useRef(), core = useRef(), cube = useRef()
  const k = useRef(0)
  useFrame(({ clock }, dt) => {
    k.current = MathUtils.damp(k.current, 1, 3.2, dt)            // animasi muncul
    grp.current.scale.setScalar(k.current)
    core.current.rotation.y += dt * 0.9
    core.current.rotation.x += dt * 0.45
    if (latest) cube.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.2) * 0.025)
  })
  return (
    <Float speed={1.4} rotationIntensity={0.1} floatIntensity={0.55} floatingRange={[-0.08, 0.08]}>
      <group ref={grp} position={[x, 0, 0]}>
        <RoundedBox ref={cube} args={[SIZE, SIZE, SIZE]} radius={0.17} smoothness={5}>
          <meshPhysicalMaterial color={latest ? '#e2faf6' : '#ffffff'} roughness={0.12} clearcoat={1} clearcoatRoughness={0.08}
            transparent opacity={0.9} emissive={latest ? '#14b8a6' : '#7dd3fc'} emissiveIntensity={latest ? 0.32 : 0.1} />
          <Edges color={latest ? '#0d9488' : '#86c5e6'} threshold={15} />
        </RoundedBox>
        <mesh ref={core}>
          <icosahedronGeometry args={[0.34, 0]} />
          <meshStandardMaterial color={latest ? '#14b8a6' : '#38bdf8'} emissive={latest ? '#14b8a6' : '#38bdf8'} emissiveIntensity={1.1} roughness={0.3} />
        </mesh>
        <Html center position={[0, -1.3, 0]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="blk-label"><b>#{number}</b><span>{hash.slice(0, 10)}…</span></div>
        </Html>
      </group>
    </Float>
  )
}

function Rig({ blocks }) {
  const g = useRef()
  const { viewport, pointer } = useThree()
  const n = blocks.length
  const width = (n - 1) * SP + SIZE
  const BASE = -0.42                                  // rantai dimiringkan agar terasa 3D
  const fit = Math.min(1.1, (viewport.width * 0.78) / (width * Math.cos(BASE) + 1.4))
  useFrame((_, dt) => {
    g.current.rotation.y = MathUtils.damp(g.current.rotation.y, BASE + pointer.x * 0.3, 3, dt)
    g.current.rotation.x = MathUtils.damp(g.current.rotation.x, 0.06 - pointer.y * 0.14, 3, dt)
  })
  const xs = blocks.map((_, i) => (i - (n - 1) / 2) * SP)
  return (
    <group ref={g} position={[-0.2, -0.25, 0]} scale={fit}>
      {blocks.map((b, i) => <Block key={b.number} x={xs[i]} number={b.number} hash={b.hash} latest={i === n - 1} />)}
      {xs.slice(0, -1).map((x, i) => <Link key={i} x1={x + SIZE / 2} x2={xs[i + 1] - SIZE / 2} offset={i * 0.31} />)}
    </group>
  )
}

export default function ChainScene({ blocks }) {
  const list = (blocks || []).slice(-5)
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 1.4, 11], fov: 40 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 7, 6]} intensity={1.5} />
      <pointLight position={[-6, 2, 4]} intensity={18} color="#5eead4" />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3.2} position={[0, 6, -4]} scale={[14, 4, 1]} />
        <Lightformer form="rect" intensity={2} position={[-7, 1, 3]} scale={[4, 6, 1]} color="#bff3ff" />
        <Lightformer form="rect" intensity={2} position={[7, 1, 3]} scale={[4, 6, 1]} color="#dbeafe" />
      </Environment>
      <Sparkles count={46} scale={[16, 6, 5]} size={3.2} speed={0.35} color="#14b8a6" opacity={0.7} />
      {list.length > 0 && <Rig blocks={list} />}
    </Canvas>
  )
}
