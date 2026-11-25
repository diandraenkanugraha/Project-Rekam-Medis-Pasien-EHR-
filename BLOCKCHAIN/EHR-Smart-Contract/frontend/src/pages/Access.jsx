import { motion } from 'framer-motion'
import { Building2, Check, KeyRound, Minus, ShieldCheck, Stethoscope } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '../components/AccountSwitcher'
import { Card, Empty, PageHead, Skeleton } from '../components/ui'
import { api } from '../lib/api'
import { ROLE } from '../lib/format'
import { usePoll } from '../lib/usePoll'
import { useApp } from '../state'

function Switch({ on, busy, onClick }) {
  return (
    <button onClick={onClick} disabled={busy} aria-pressed={on} aria-label={on ? 'Cabut akses' : 'Beri akses'}
      className={`relative h-8 w-[58px] shrink-0 rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-gradient-to-r from-teal-400 to-emerald-500' : 'bg-slate-300'}`}>
      <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow ${on ? 'right-1' : 'left-1'}`} />
    </button>
  )
}

function PatientView() {
  const { actor, runTx } = useApp()
  const [pending, setPending] = useState(null)
  const { data: ents, loading, reload } = usePoll(() => api.entities(actor), [actor], 5000)
  const active = (ents || []).filter(e => e.accessActive).length

  const toggle = async (e) => {
    setPending(e.id)
    try {
      await runTx(e.accessActive ? `Cabut akses ${e.nama}` : `Beri akses ke ${e.nama}`,
        () => (e.accessActive ? api.revoke : api.grant)({ actor, target_id: e.id }))
      await reload()
    } catch { /* toast */ } finally { setPending(null) }
  }

  return (
    <div className="mx-auto max-w-[860px]">
      <PageHead icon={KeyRound} title="Access Management" sub="Kamu pemilik data. Hanya kamu yang bisa memberi atau mencabut izin dokter dan rumah sakit."
        right={<span className="rounded-full bg-white/80 px-4 py-2 text-sm font-extrabold text-teal-700">{active} dari {ents?.length ?? 0} aktif</span>} />
      {loading && !ents ? <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
        : !ents?.length ? <Card><Empty icon={KeyRound} title="Belum ada dokter atau RS terdaftar" text="Authority perlu mendaftarkan dokter/RS lebih dulu lewat menu Registrasi." /></Card>
          : (
            <div className="space-y-3">
              {ents.map((e, i) => (
                <motion.div key={e.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <Card className="flex items-center gap-4 p-5">
                    <Avatar role={e.role} name={e.nama} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-extrabold text-ink-900">{e.nama}</p>
                      <p className="truncate text-xs text-ink-500">{ROLE[e.role].label} · {e.detail}</p>
                      <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${e.accessActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${e.accessActive ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
                        {e.accessActive ? 'AKSES AKTIF' : 'TIDAK ADA AKSES'}
                      </span>
                    </div>
                    <Switch on={e.accessActive} busy={pending === e.id} onClick={() => toggle(e)} />
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-ink-500"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-teal-600" />Setiap perubahan izin dikirim sebagai transaksi dan tercatat di blok baru. Mencabut izin langsung menutup akses dokter ke seluruh rekam medismu.</p>
    </div>
  )
}

function Matrix() {
  const { actor, me } = useApp()
  const { data: pats } = usePoll(() => api.patients(actor), [actor], 6000)
  const { data: ents } = usePoll(() => api.entities(actor), [actor], 8000)
  const { data: net } = usePoll(api.network, [], 8000)
  const edges = new Set((net?.edges || []).map(e => `${e.from}|${e.to}`))
  const ready = pats && ents && net

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHead icon={KeyRound} title="Access Management" sub={`Matriks izin akses (hanya baca) untuk ${me?.label || 'akun ini'}. Izin hanya bisa diubah oleh pasien yang bersangkutan.`} />
      {!ready ? <Skeleton className="h-60" /> : pats.length === 0 || ents.length === 0
        ? <Card><Empty icon={KeyRound} title="Belum ada data untuk ditampilkan" text="Daftarkan pasien dan dokter, lalu pasien memberi izin akses." /></Card> : (
          <Card className="overflow-auto p-2">
            <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left">
              <thead><tr>
                <th className="label p-4">Pasien</th>
                {ents.map(e => <th key={e.id} className="p-4 text-center">
                  <span className="mx-auto mb-1 grid h-9 w-9 place-items-center rounded-xl bg-white text-teal-600">{e.role === 'doctor' ? <Stethoscope size={17} /> : <Building2 size={17} />}</span>
                  <span className="block max-w-[110px] truncate text-[11px] font-bold text-ink-700">{e.nama}</span>
                </th>)}
              </tr></thead>
              <tbody>
                {pats.map((p, i) => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="group">
                    <td className="border-t border-white/70 p-4"><span className="flex items-center gap-3"><Avatar role="patient" name={p.nama || 'P'} size={34} /><b className="text-sm text-ink-900">{p.nama}</b></span></td>
                    {ents.map(e => {
                      const on = edges.has(`${p.id}|${e.id}`)
                      return <td key={e.id} className="border-t border-white/70 p-4 text-center">
                        <span className={`mx-auto grid h-8 w-8 place-items-center rounded-full ${on ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{on ? <Check size={16} /> : <Minus size={16} />}</span>
                      </td>
                    })}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
    </div>
  )
}

export default function Access() {
  const { me } = useApp()
  return me?.role === 'patient' ? <PatientView /> : <Matrix />
}
