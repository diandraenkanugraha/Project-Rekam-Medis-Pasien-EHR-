import { motion } from 'framer-motion'
import { FileText, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CopyBtn, Empty, PageHead, Skeleton, StatusBadge } from '../components/ui'
import { api } from '../lib/api'
import { fmtTime, short } from '../lib/format'
import { usePoll } from '../lib/usePoll'
import { useApp } from '../state'

export default function Records() {
  const { me, actor } = useApp()
  const { data, error, loading } = usePoll(() => api.records(actor), [actor], 6000)
  const list = data?.records || []

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHead icon={FileText} title="Medical Record" sub="Setiap rekam medis adalah satu NFT ERC-721 (Token ID = Record ID)." />

      {loading && !data ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-52" />)}</div>
        : error && !data ? <Card><Empty title="Gagal memuat" text={error.message} /></Card>
          : list.length === 0 ? <Card><Empty icon={FileText} title="Belum ada rekam medis" text={me?.role === 'patient' ? 'Rekam medismu akan muncul setelah dokter membuatnya.' : 'Rekam medis muncul setelah dokter membuatnya dan pasien memberi izin akses.'} /></Card>
            : data.locked ? (
              <>
                <Card className="mb-4 flex items-start gap-3 !rounded-2xl bg-amber-50/70 p-4">
                  <Lock className="mt-0.5 shrink-0 text-amber-600" size={18} />
                  <p className="text-sm font-semibold text-amber-800">Authority hanya melihat info publik NFT. Isi rekam medis tidak bisa dibaca, sesuai aturan kontrak.</p>
                </Card>
                <Card className="overflow-hidden !rounded-[28px]">
                  {list.map((r, i) => (
                    <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="flex flex-wrap items-center gap-4 border-b border-white/60 px-6 py-4 last:border-0">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-blue-600 text-sm font-extrabold text-white">#{r.id}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-ink-900">{r.metadata}</p>
                        <p className="hash flex items-center gap-1 text-ink-500">Pemilik {short(r.owner, 8, 6)}<CopyBtn text={r.owner} className="!p-1" /></p>
                      </div>
                      <Link to={`/verify/${r.id}`} className="btn btn-ghost !py-2">Verifikasi</Link>
                      <Lock size={16} className="text-amber-500" />
                    </motion.div>
                  ))}
                </Card>
              </>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" style={{ perspective: 1200 }}>
                {list.map((r, i) => (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    whileHover={{ y: -8, rotateX: 4, rotateY: -4 }}>
                    <Link to={`/records/${r.id}`} className="block">
                      <div className="glass relative overflow-hidden p-5 transition-shadow hover:shadow-lift">
                        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-teal-400/90 to-blue-600/90" />
                        <div className="relative flex items-start justify-between text-white">
                          <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/80">Token ID</p><p className="text-4xl font-extrabold leading-none">#{r.id}</p></div>
                          <StatusBadge status={r.status} />
                        </div>
                        <div className="relative mt-9 space-y-1">
                          <p className="text-sm font-extrabold text-ink-900">{r.metadata}</p>
                          <p className="text-xs font-semibold text-ink-700">{r.patientName}</p>
                          <p className="text-xs text-ink-500">{r.doctorName}</p>
                          <p className="pt-2 text-[11px] text-ink-300">{fmtTime(r.createdAt)}</p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
    </div>
  )
}
