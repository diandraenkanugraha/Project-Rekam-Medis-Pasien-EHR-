import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../state'
import { ROLE, short } from '../lib/format'

const ORDER = { authority: 0, doctor: 1, hospital: 2, patient: 3, none: 4 }

export function Avatar({ role, name, size = 36 }) {
  const c = ROLE[role]?.color || '#94a3b8'
  return (
    <span className="grid shrink-0 place-items-center rounded-xl font-extrabold text-white"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${c}, ${c}cc)`, fontSize: size * 0.4 }}>
      {(name || '?').replace(/^dr\.\s*/i, '').charAt(0).toUpperCase()}
    </span>
  )
}

export default function AccountSwitcher() {
  const { accounts, actor, setActor, me } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const sorted = [...accounts].sort((a, b) => ORDER[a.role] - ORDER[b.role])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="glass flex items-center gap-3 !rounded-2xl py-1.5 pl-1.5 pr-3 text-left transition hover:shadow-lift">
        <Avatar role={me?.role} name={me?.name} />
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[170px] truncate text-sm font-bold text-ink-900">{me?.name || 'Pilih akun'}</span>
          <span className="block text-[11px] text-ink-500">{me ? `${ROLE[me.role].label} · ${short(me.address, 6, 4)}` : '-'}</span>
        </span>
        <ChevronDown size={16} className={`text-ink-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.18 }}
            className="glass glass-strong absolute right-0 z-50 mt-2 w-[330px] max-w-[92vw] overflow-hidden !rounded-2xl">
            <p className="label border-b border-white/70 px-4 py-3">Bertindak sebagai (msg.sender)</p>
            <div className="max-h-[360px] overflow-auto p-2">
              {sorted.map(a => (
                <button key={a.address} onClick={() => { setActor(a.address); setOpen(false) }}
                  className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white ${a.address === actor ? 'bg-white shadow-sm' : ''}`}>
                  <Avatar role={a.role} name={a.name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-ink-900">{a.name}</span>
                    <span className="hash block text-ink-500">{short(a.address, 8, 6)}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE[a.role].soft}`}>{ROLE[a.role].label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
