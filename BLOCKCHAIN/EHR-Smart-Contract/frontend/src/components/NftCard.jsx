import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import { STATUS_LABEL, short } from '../lib/format'

// Kartu NFT 3D: miring mengikuti kursor, ada kilau holografik dan lapisan yang melayang.
export default function NftCard({ rec, qrValue }) {
  const mx = useMotionValue(0.5), my = useMotionValue(0.5)
  const rx = useSpring(useTransform(my, [0, 1], [14, -14]), { stiffness: 160, damping: 18 })
  const ry = useSpring(useTransform(mx, [0, 1], [-16, 16]), { stiffness: 160, damping: 18 })
  const glare = useMotionTemplate`radial-gradient(circle at ${useTransform(mx, v => v * 100)}% ${useTransform(my, v => v * 100)}%, rgba(255,255,255,.55), transparent 55%)`
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width); my.set((e.clientY - r.top) / r.height)
  }
  const reset = () => { mx.set(0.5); my.set(0.5) }

  return (
    <div style={{ perspective: 1100 }} className="mx-auto w-full max-w-[340px]" onPointerMove={move} onPointerLeave={reset}>
      <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}>
        <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
          className="relative aspect-[3/4.15] overflow-hidden rounded-[30px] p-6 text-white shadow-[0_40px_70px_-25px_rgba(37,99,235,.55)]"
          initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}>
          <div className="absolute inset-0 bg-gradient-to-br from-teal-400 via-cyan-500 to-blue-600" />
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/25 blur-2xl" />
          <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-indigo-300/40 blur-3xl" />
          <motion.div className="absolute inset-0 mix-blend-overlay" style={{ background: glare }} />
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'repeating-linear-gradient(115deg, transparent 0 14px, rgba(255,255,255,.35) 14px 15px)' }} />

          <div className="relative flex h-full flex-col" style={{ transformStyle: 'preserve-3d' }}>
            <div className="flex items-center justify-between" style={{ transform: 'translateZ(30px)' }}>
              <span className="text-[11px] font-extrabold uppercase tracking-[.2em] text-white/85">MediChain · EHR</span>
              <span className="rounded-full bg-white/25 px-3 py-1 text-[11px] font-extrabold backdrop-blur">{STATUS_LABEL[rec.status]}</span>
            </div>
            <div className="mt-5" style={{ transform: 'translateZ(50px)' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Token ID</p>
              <p className="text-6xl font-extrabold leading-none tracking-tight drop-shadow">#{rec.id}</p>
            </div>
            <div className="mt-5 space-y-1" style={{ transform: 'translateZ(35px)' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Pasien</p>
              <p className="text-lg font-extrabold leading-tight">{rec.patientName || 'Pasien'}</p>
              <p className="text-xs font-semibold text-white/80">{rec.doctorName}</p>
              <p className="text-xs text-white/70">{rec.metadata}</p>
            </div>
            <div className="mt-auto flex items-end justify-between gap-3" style={{ transform: 'translateZ(60px)' }}>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Pemilik NFT</p>
                <p className="hash text-white/90">{short(rec.owner, 8, 6)}</p>
                <p className="hash mt-1 text-white/60">{short(rec.dataHash, 8, 6)}</p>
              </div>
              <div className="rounded-2xl bg-white p-2 shadow-xl"><QRCodeSVG value={qrValue} size={78} fgColor="#0b2236" /></div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
