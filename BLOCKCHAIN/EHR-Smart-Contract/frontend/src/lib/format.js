export const short = (v, a = 6, b = 4) => (v && v.length > a + b + 2 ? `${v.slice(0, a)}…${v.slice(-b)}` : v || '-')
export const shortHash = (v) => short(v, 8, 6)
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' }) : '-')
export const fmtClock = (iso) => (iso ? new Date(iso).toLocaleTimeString('id-ID') : '-')

export const ROLE = {
  authority: { label: 'Authority', color: '#2563eb', soft: 'bg-blue-100 text-blue-700' },
  doctor: { label: 'Dokter', color: '#0d9488', soft: 'bg-teal-100 text-teal-700' },
  hospital: { label: 'Rumah Sakit', color: '#6366f1', soft: 'bg-indigo-100 text-indigo-700' },
  patient: { label: 'Pasien', color: '#f59e0b', soft: 'bg-amber-100 text-amber-700' },
  none: { label: 'Belum terdaftar', color: '#94a3b8', soft: 'bg-slate-100 text-slate-500' },
}
export const STATUS_COLORS = ['#94a3b8', '#38bdf8', '#14b8a6', '#2563eb']

export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true } catch { return false }
}

export const STATUS_LABEL = ['ADDED', 'DIAGNOSED', 'TREATED', 'DISCHARGED']
export const STATUS_SOFT = ['bg-slate-100 text-slate-600', 'bg-sky-100 text-sky-700', 'bg-teal-100 text-teal-700', 'bg-blue-100 text-blue-700']
