import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRightLeft, CheckCircle2, ExternalLink, FileDown, FlaskConical, Pill as PillIcon, QrCode, ShieldAlert, ShieldCheck, ShieldOff, Stethoscope, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import NftCard from '../components/NftCard'
import { Card, CopyBtn, InfoRow, Skeleton, StatusBadge, Tabs, inputCls } from '../components/ui'
import { api } from '../lib/api'
import { STATUS_LABEL, fmtTime, short } from '../lib/format'
import { usePoll } from '../lib/usePoll'
import { useApp } from '../state'

function Section({ icon: Icon, title, children, tint }) {
  return (
    <div className="rounded-2xl bg-white/65 p-4">
      <p className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-ink-500"><Icon size={15} className={tint} />{title}</p>
      <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-ink-900">{children}</p>
    </div>
  )
}

export default function RecordDetail() {
  const { id } = useParams()
  const { actor, me, accounts, runTx } = useApp()
  const [tab, setTab] = useState('data')
  const [showTransfer, setShowTransfer] = useState(false)
  const [to, setTo] = useState('')
  const { data: r, error, loading, reload } = usePoll(() => api.record(id, actor), [id, actor], 8000)
  const verifyUrl = `${window.location.origin}/verify/${id}`

  if (loading && !r) return <div className="mx-auto grid max-w-[1100px] gap-5 lg:grid-cols-[360px_1fr]"><Skeleton className="h-[460px]" /><Skeleton className="h-[460px]" /></div>
  if (error && !r) {
    const denied = error.code === 'AccessDenied'
    return (
      <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-500">{denied ? <ShieldOff size={26} /> : <XCircle size={26} />}</div>
        <h2 className="text-lg font-extrabold text-ink-900">{denied ? 'Akses ditolak' : 'Rekam medis tidak dapat dibuka'}</h2>
        <p className="mt-2 text-sm text-ink-500">{error.message}</p>
        {denied && <p className="mt-2 text-xs text-ink-500">Ganti akun ke pasien pemilik data atau dokter/RS yang sudah diberi izin.</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link to="/records" className="btn btn-ghost"><ArrowLeft size={16} /> Medical Record</Link>
          <Link to={`/verify/${id}`} className="btn btn-primary"><QrCode size={16} /> Verifikasi publik</Link>
        </div>
      </Card>
    )
  }

  const canWrite = ['doctor', 'hospital', 'authority'].includes(me?.role) && r.status < 3
  const isOwner = me?.address === r.owner
  const others = accounts.filter(a => a.address !== r.owner)

  const nextStatus = () => runTx(`Status menjadi ${STATUS_LABEL[r.status + 1]}`,
    () => api.updateStatus(r.id, { actor, new_status: r.status + 1, doctor_id: r.doctorId })).then(reload).catch(() => {})
  const doTransfer = () => runTx(`Transfer NFT #${r.id}`, () => api.transfer(r.id, { actor, to }))
    .then(() => { setShowTransfer(false); setTo(''); reload() }).catch(() => {})

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <Link to="/records" className="inline-flex items-center gap-2 text-sm font-bold text-ink-500 transition hover:text-teal-600"><ArrowLeft size={16} /> Medical Record</Link>

      <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4 lg:sticky lg:top-24">
          <NftCard rec={r} qrValue={verifyUrl} />
          <div className="flex flex-wrap justify-center gap-2">
            <Link to={`/verify/${r.id}`} className="btn btn-ghost !py-2"><QrCode size={15} /> Halaman verifikasi</Link>
            <button onClick={() => navigator.clipboard?.writeText(verifyUrl)} className="btn btn-ghost !py-2"><ExternalLink size={15} /> Salin tautan QR</button>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Rekam Medis #{r.id}</h1>
                <p className="text-sm text-ink-500">{r.patientName} · {r.doctorName}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>

            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              className={`mt-4 flex items-center gap-3 rounded-2xl p-4 ${r.integrity === true ? 'bg-emerald-50 text-emerald-800' : r.integrity === false ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
              {r.integrity === true ? <ShieldCheck size={26} /> : r.integrity === false ? <ShieldAlert size={26} /> : <ShieldOff size={26} />}
              <div>
                <p className="text-sm font-extrabold">{r.integrity === true ? 'Integritas valid' : r.integrity === false ? 'Integritas TIDAK valid' : 'Integritas belum bisa diperiksa'}</p>
                <p className="text-xs opacity-80">
                  {r.integrity === true ? 'Hash file terenkripsi cocok dengan hash yang tercatat di blockchain.'
                    : r.integrity === false ? 'File off-chain berbeda dengan hash di blockchain. Data mungkin telah diubah.'
                      : r.offchainNote}
                </p>
              </div>
            </motion.div>

            {(canWrite || isOwner) && (
              <div className="mt-4 flex flex-wrap gap-3">
                {canWrite && (
                  <button onClick={nextStatus} className="btn btn-primary"><CheckCircle2 size={17} />Tandai {STATUS_LABEL[r.status + 1]}</button>
                )}
                {isOwner && (
                  <button onClick={() => setShowTransfer(s => !s)} className="btn btn-ghost"><ArrowRightLeft size={17} />Transfer NFT</button>
                )}
              </div>
            )}
            <AnimatePresence>
              {showTransfer && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-4 rounded-2xl bg-white/65 p-4">
                    <p className="label mb-2">Pindahkan kepemilikan NFT ke</p>
                    <select className={inputCls} value={to} onChange={e => setTo(e.target.value)}>
                      <option value="">Pilih akun…</option>
                      {others.map(a => <option key={a.address} value={a.address}>{a.name} · {short(a.address, 8, 6)}</option>)}
                    </select>
                    <p className="mt-2 text-xs leading-relaxed text-ink-500">Yang berpindah hanya kepemilikan token. Isi data dan hak akses tetap melekat pada ID pasien, bukan pada pemilik NFT.</p>
                    <button disabled={!to} onClick={doTransfer} className="btn btn-primary mt-3 disabled:opacity-50"><ArrowRightLeft size={16} />Pindahkan</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          <Tabs id="rdtabs" value={tab} onChange={setTab}
            tabs={[{ key: 'data', label: 'Data Medis' }, { key: 'status', label: 'Riwayat Status' }, { key: 'chain', label: 'Blockchain' }]} />

          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
            {tab === 'data' && (
              <Card className="space-y-3 p-5">
                {r.offchain ? (
                  <>
                    <Section icon={Stethoscope} title="Diagnosis" tint="text-teal-600">{r.offchain.diagnosis}</Section>
                    <Section icon={FlaskConical} title="Hasil laboratorium" tint="text-blue-600">{r.offchain.hasilLab}</Section>
                    <Section icon={PillIcon} title="Resep obat" tint="text-indigo-600">{r.offchain.resepObat}</Section>
                    {r.offchain.lampiran && (
                      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/65 p-4">
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-100 text-rose-500"><FileDown size={20} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold text-ink-900">{r.offchain.lampiran.nama}</p>
                          <p className="hash flex items-center gap-1 text-ink-500">SHA-256 {short(r.offchain.lampiran.sha256, 10, 8)}<CopyBtn text={r.offchain.lampiran.sha256} className="!p-1" /> · {(r.offchain.lampiran.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <a className="btn btn-ghost !py-2" target="_blank" rel="noreferrer" href={`/api/records/${r.id}/attachment?actor=${encodeURIComponent(actor)}`}>Buka PDF</a>
                      </div>
                    )}
                  </>
                ) : <p className="p-4 text-sm font-semibold text-ink-500">{r.integrity === false ? 'Isi tidak ditampilkan karena integritas gagal.' : r.offchainNote || 'Data tidak tersedia.'}</p>}
              </Card>
            )}

            {tab === 'status' && (
              <Card className="p-6">
                <ol className="relative space-y-5 pl-7 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-0.5 before:bg-gradient-to-b before:from-teal-300 before:to-blue-300">
                  <li className="relative">
                    <span className="absolute -left-[26px] top-1 h-4 w-4 rounded-full border-[3px] border-white bg-slate-400 shadow" />
                    <p className="text-sm font-extrabold text-ink-900">ADDED <span className="font-semibold text-ink-500">· dibuat dan NFT dicetak</span></p>
                    <p className="text-xs text-ink-500">{r.doctorName} · {fmtTime(r.createdAt)}</p>
                  </li>
                  {r.history.map((h, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * (i + 1) }} className="relative">
                      <span className="absolute -left-[26px] top-1 h-4 w-4 rounded-full border-[3px] border-white bg-teal-500 shadow" />
                      <p className="text-sm font-extrabold text-ink-900">{h.from} → {h.to}</p>
                      <p className="text-xs text-ink-500">{h.doctorName} · {fmtTime(h.timestamp)}</p>
                    </motion.li>
                  ))}
                </ol>
                {r.history.length === 0 && <p className="mt-4 text-xs text-ink-500">Belum ada perubahan status. Dokter dapat memajukan status satu langkah.</p>}
              </Card>
            )}

            {tab === 'chain' && (
              <Card className="p-6">
                <InfoRow label="Token ID">#{r.id}</InfoRow>
                <InfoRow label="Pemilik NFT"><span className="hash flex items-center gap-1 break-all">{r.owner}<CopyBtn text={r.owner} /></span></InfoRow>
                <InfoRow label="ID pasien"><span className="hash break-all">{r.patientId}</span></InfoRow>
                <InfoRow label="ID dokter"><span className="hash break-all">{r.doctorId}</span></InfoRow>
                <InfoRow label="Data hash"><span className="hash flex items-center gap-1 break-all">{r.dataHash}<CopyBtn text={r.dataHash} /></span></InfoRow>
                <InfoRow label="Referensi off-chain"><span className="hash">{r.offChainRef}</span></InfoRow>
                <InfoRow label="Metadata (publik)">{r.tokenURI}</InfoRow>
                <InfoRow label="Dibuat">{fmtTime(r.createdAt)}</InfoRow>
                <InfoRow label="Diperbarui">{fmtTime(r.updatedAt)}</InfoRow>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
