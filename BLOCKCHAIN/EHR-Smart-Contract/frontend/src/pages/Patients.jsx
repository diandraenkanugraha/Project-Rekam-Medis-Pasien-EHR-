import { motion } from 'framer-motion'
import { Droplet, KeyRound, Search, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/AccountSwitcher'
import { Card, CopyBtn, Empty, PageHead, Skeleton, inputCls } from '../components/ui'
import { api } from '../lib/api'
import { shortHash, short } from '../lib/format'
import { usePoll } from '../lib/usePoll'
import { useApp } from '../state'

export default function Patients() {
  const { me, actor } = useApp()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const { data, error, loading } = usePoll(() => api.patients(actor), [actor], 6000)
  const rows = (data || []).filter(p => (p.nama || '').toLowerCase().includes(q.toLowerCase()) || p.wallet.toLowerCase().includes(q.toLowerCase()) || p.id.includes(q))

  const emptyText = me?.role === 'patient' ? 'Akun pasien hanya melihat dirinya sendiri.'
    : me?.role === 'doctor' || me?.role === 'hospital' ? 'Belum ada pasien yang memberi izin akses ke akun ini. Pasien harus menekan Grant Access lebih dulu.'
      : 'Belum ada pasien terdaftar. Daftarkan lewat menu Registrasi.'

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHead icon={Users} title="Patient List" sub={`Data diambil dari smart contract · tampilan untuk ${me?.name || '-'}`}
        right={
          <div className="relative w-full sm:w-72">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-300" />
            <input className={`${inputCls} !pl-10`} placeholder="Cari nama, wallet, atau ID…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        } />

      <Card className="overflow-hidden !rounded-[28px]">
        <div className="hidden grid-cols-[2.2fr_1.6fr_1.4fr_.7fr_.7fr_.8fr] gap-4 border-b border-white/70 px-6 py-3 md:grid">
          {['Pasien', 'ID pasien', 'Wallet', 'Rekam', 'NFT', 'Izin akses'].map(h => <span key={h} className="label">{h}</span>)}
        </div>
        {loading && !data ? <div className="space-y-3 p-5">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
          : error && !data ? <Empty title="Gagal memuat" text={error.message} />
            : rows.length === 0 ? <Empty icon={Users} title={q ? 'Tidak ditemukan' : 'Belum ada pasien'} text={q ? 'Coba kata kunci lain.' : emptyText} />
              : rows.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.045 }}
                  onClick={() => nav(`/patients/${p.id}`)}
                  className="group grid cursor-pointer grid-cols-2 items-center gap-3 border-b border-white/60 px-6 py-4 transition last:border-0 hover:bg-white/70 md:grid-cols-[2.2fr_1.6fr_1.4fr_.7fr_.7fr_.8fr] md:gap-4">
                  <div className="col-span-2 flex items-center gap-3 md:col-span-1">
                    <Avatar role="patient" name={p.nama || 'P'} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-ink-900">{p.nama || 'Profil tidak tersedia'}</p>
                      <p className="flex items-center gap-1 text-[11px] font-semibold text-ink-500"><Droplet size={11} className="text-rose-400" />Gol. darah {p.golDarah || '-'}</p>
                    </div>
                  </div>
                  <p className="hash flex items-center gap-1 text-ink-700">{shortHash(p.id)}<CopyBtn text={p.id} className="!p-1" /></p>
                  <p className="hash text-ink-500">{short(p.wallet, 8, 6)}</p>
                  <p className="text-sm font-extrabold text-ink-900">{p.records}</p>
                  <p className="text-sm font-extrabold text-ink-900">{p.nfts}</p>
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${p.accessCount ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                    <KeyRound size={12} />{p.accessCount} aktif
                  </span>
                </motion.div>
              ))}
      </Card>
    </div>
  )
}
