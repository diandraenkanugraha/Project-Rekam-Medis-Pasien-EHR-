import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, FileText, KeyRound, Lock, ShieldOff, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/AccountSwitcher'
import { Card, CopyBtn, Empty, InfoRow, Skeleton, StatusBadge, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { ROLE, fmtTime, short } from '../lib/format'
import { usePoll } from '../lib/usePoll'
import { useApp } from '../state'

export default function PatientDetail() {
  const { id } = useParams()
  const { actor, me } = useApp()
  const [tab, setTab] = useState('history')
  const { data: d, error, loading } = usePoll(() => api.patient(id, actor), [id, actor], 7000)

  if (loading && !d) return <div className="mx-auto max-w-[1000px] space-y-4"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>
  if (error && !d) {
    const denied = error.code === 'AccessDenied'
    return (
      <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-500">{denied ? <ShieldOff size={26} /> : <XCircle size={26} />}</div>
        <h2 className="text-lg font-extrabold text-ink-900">{denied ? 'Akses ditolak' : 'Tidak dapat memuat pasien'}</h2>
        <p className="mt-2 text-sm text-ink-500">{error.message}</p>
        <Link to="/patients" className="btn btn-ghost mt-5"><ArrowLeft size={16} /> Kembali ke Patient List</Link>
      </Card>
    )
  }
  const p = d.profile
  const activeAccess = d.access.filter(a => a.active)

  return (
    <div className="mx-auto max-w-[1000px] space-y-5">
      <Link to="/patients" className="inline-flex items-center gap-2 text-sm font-bold text-ink-500 transition hover:text-teal-600"><ArrowLeft size={16} /> Patient List</Link>

      <Card className="relative overflow-hidden p-6 lg:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-amber-200/50 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <Avatar role="patient" name={p?.nama || 'P'} size={72} />
          <div className="min-w-0 flex-1">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${ROLE.patient.soft}`}>Pasien</span>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900">{p?.nama || 'Profil tidak tersedia'}</h1>
            <p className="hash mt-1 flex flex-wrap items-center gap-1 text-ink-500">{short(d.wallet, 10, 8)}<CopyBtn text={d.wallet} /></p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['NFT', d.nfts, FileText], ['Rekam', d.recordsLocked ? '🔒' : d.records.length, FileText], ['Izin aktif', activeAccess.length, KeyRound]].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-white/70 px-4 py-3 text-center">
                <p className="text-2xl font-extrabold text-ink-900">{v}</p><p className="label">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="hash relative mt-5 flex flex-wrap items-center gap-1 break-all text-ink-300">ID: {d.id}<CopyBtn text={d.id} /></p>
      </Card>

      <Tabs id="pdtabs" value={tab} onChange={setTab}
        tabs={[{ key: 'history', label: 'Riwayat Pemeriksaan' }, { key: 'info', label: 'Informasi Medis' }, { key: 'access', label: 'Izin Akses' }]} />

      <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {tab === 'history' && (
          d.recordsLocked ? (
            <Card className="p-8 text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-600"><Lock size={26} /></div>
              <p className="text-base font-extrabold text-ink-900">Isi rekam medis dikunci</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">
                Sesuai aturan smart contract, {me?.role === 'authority' ? 'Authority tidak otomatis boleh membaca isi rekam medis' : 'akun ini belum diberi izin'}.
                Hanya pasien pemilik data dan dokter/RS yang diberi izin yang boleh membacanya.
              </p>
            </Card>
          ) : d.records.length === 0 ? <Card><Empty icon={FileText} title="Belum ada riwayat" text="Rekam medis akan muncul setelah dokter membuatnya." /></Card> : (
            <div className="relative space-y-4 pl-6 before:absolute before:bottom-3 before:left-[9px] before:top-3 before:w-0.5 before:bg-gradient-to-b before:from-teal-300 before:to-blue-300">
              {[...d.records].reverse().map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="relative">
                  <span className="absolute -left-[22px] top-6 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-teal-500 shadow" />
                  <Link to={`/records/${r.id}`}>
                    <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-blue-600 text-sm font-extrabold text-white">#{r.id}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-extrabold text-ink-900">{r.metadata}</p>
                          <p className="text-xs text-ink-500">{r.doctorName} · {fmtTime(r.createdAt)}</p>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )
        )}

        {tab === 'info' && (
          <Card className="p-6">
            {p ? (
              <>
                <InfoRow label="Nama lengkap">{p.nama}</InfoRow>
                <InfoRow label="Tanggal lahir">{p.tglLahir}</InfoRow>
                <InfoRow label="Golongan darah">{p.golDarah}</InfoRow>
                <InfoRow label="Alamat">{p.alamat}</InfoRow>
                <InfoRow label="No. telepon">{p.noTelepon}</InfoRow>
                <InfoRow label="NIK">{p.nikMasked}</InfoRow>
                <p className="mt-4 rounded-2xl bg-teal-50/70 p-3 text-xs leading-relaxed text-teal-800">
                  Kontrak hanya menyimpan <b>hash</b> profil. Data di atas dibaca dari penyimpanan off-chain terenkripsi milik aplikasi.
                </p>
              </>
            ) : <Empty icon={ShieldOff} title="Profil off-chain tidak ditemukan" text="Profil tersimpan di komputer tempat pasien didaftarkan. Data on-chain (ID, wallet, NFT, izin) tetap tersedia." />}
          </Card>
        )}

        {tab === 'access' && (
          <Card className="p-3">
            {d.access.length === 0 ? <Empty icon={KeyRound} title="Belum ada dokter/RS terdaftar" /> : d.access.map(a => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-white/70">
                <Avatar role={a.role} name={a.nama} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-ink-900">{a.nama}</p>
                  <p className="truncate text-xs text-ink-500">{ROLE[a.role].label} · {a.detail}</p>
                </div>
                {a.active
                  ? <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-extrabold text-teal-700"><CheckCircle2 size={14} />Aktif</span>
                  : <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-500"><XCircle size={14} />Tidak aktif</span>}
              </div>
            ))}
          </Card>
        )}
      </motion.div>
    </div>
  )
}
