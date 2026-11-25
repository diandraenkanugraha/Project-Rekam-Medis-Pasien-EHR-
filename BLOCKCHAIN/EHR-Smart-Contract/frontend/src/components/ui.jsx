import { Component, useEffect, useRef, useState } from 'react'
import { animate, motion } from 'framer-motion'
import { Check, Copy } from 'lucide-react'
import { STATUS_LABEL, STATUS_SOFT, copyText } from '../lib/format'

export function Card({ className = '', children, delay = 0, ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`glass ${className}`} {...rest}>
      {children}
    </motion.div>
  )
}

export function CountUp({ value, className = '' }) {
  const ref = useRef(null)
  const prev = useRef(0)
  useEffect(() => {
    const c = animate(prev.current, value, {
      duration: 1.1, ease: 'easeOut',
      onUpdate: (v) => { if (ref.current) ref.current.textContent = Math.round(v).toLocaleString('id-ID') },
    })
    prev.current = value
    return () => c.stop()
  }, [value])
  return <span ref={ref} className={className}>0</span>
}

export function CopyBtn({ text, className = '' }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" title="Salin"
      onClick={async () => { if (await copyText(text)) { setOk(true); setTimeout(() => setOk(false), 1400) } }}
      className={`inline-flex items-center justify-center rounded-lg p-1.5 text-ink-500 transition hover:bg-white hover:text-teal-600 ${className}`}>
      {ok ? <Check size={14} className="text-teal-600" /> : <Copy size={14} />}
    </button>
  )
}

export function Pill({ children, className = '' }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-2xl bg-white/60 ${className}`} />
}

export function Empty({ icon: Icon, title, text }) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 p-6 text-center">
      {Icon && <div className="rounded-2xl bg-white/70 p-3 text-teal-600"><Icon size={22} /></div>}
      <p className="text-sm font-bold text-ink-900">{title}</p>
      {text && <p className="max-w-xs text-xs leading-relaxed text-ink-500">{text}</p>}
    </div>
  )
}

// Jika WebGL tidak tersedia, jangan merusak halaman: tampilkan latar statis.
export class SceneBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div className="absolute inset-0 bg-gradient-to-br from-teal-100/60 to-blue-100/60" />
    return this.props.children
  }
}

export function PageHead({ icon: Icon, title, sub, right }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-4">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-blue-600 text-white shadow-lg shadow-blue-500/25"><Icon size={22} /></span>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>
        {sub && <p className="text-sm text-ink-500">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function StatusBadge({ status }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide ${STATUS_SOFT[status]}`}>{STATUS_LABEL[status]}</span>
}

export function Tabs({ tabs, value, onChange, id = 'tabs' }) {
  return (
    <div className="inline-flex max-w-full gap-1 overflow-auto rounded-2xl bg-white/60 p-1.5">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`relative whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${value === t.key ? 'text-blue-700' : 'text-ink-500 hover:text-ink-900'}`}>
          {value === t.key && <motion.span layoutId={id} className="absolute inset-0 rounded-xl bg-white shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
          <span className="relative">{t.label}</span>
        </button>
      ))}
    </div>
  )
}

export const inputCls = 'w-full rounded-2xl border border-white/80 bg-white/75 px-4 py-3 text-sm font-semibold text-ink-900 outline-none transition placeholder:font-medium placeholder:text-ink-300 focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-200/50 disabled:opacity-60'

export function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span>
        : hint ? <span className="mt-1 block text-[11px] text-ink-500">{hint}</span> : null}
    </label>
  )
}

export function InfoRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1 border-b border-white/70 py-3 last:border-0 sm:flex-row sm:items-start sm:gap-6">
      <span className="label w-40 shrink-0 pt-0.5">{label}</span>
      <span className="min-w-0 flex-1 break-words text-sm font-semibold text-ink-900">{children}</span>
    </div>
  )
}
