import { motion } from 'framer-motion'
import { CheckCircle2, Coins, FileText, Layers, Link2, Wallet as WalletIcon, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Card, CopyBtn, Empty, PageHead, Skeleton, Tabs } from '../components/ui'
import { api } from '../lib/api'
import { ROLE, fmtTime, shortHash, short } from '../lib/format'
import { usePoll } from '../lib/usePoll'
import { useApp } from '../state'

const METHOD = {
  deploy: 'Deploy kontrak', registerPatient: 'Registrasi pasien', registerEntity: 'Registrasi dokter/RS',
  createRecord: 'Buat rekam medis + cetak NFT', updateRecordStatus: 'Update status rekam medis',
  grantAccess: 'Beri izin akses', revokeAccess: 'Cabut izin akses', transferFrom: 'Transfer NFT',
  safeTransferFrom: 'Transfer NFT', addAuthority: 'Tambah authority', removeAuthority: 'Hapus authority',
}

function TxRow({ ok, label, hash, block, gas, time, from, message, i }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}
      className="flex flex-wrap items-center gap-3 border-b border-white/60 px-5 py-4 last:border-0">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${ok ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>{ok ? <CheckCircle2 size={20} /> : <XCircle size={20} />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-ink-900">{label}</p>
        <p className="truncate text-xs text-ink-500">{ok ? `${from} · ${time}` : message}</p>
        {hash && <p className="hash flex items-center gap-1 text-ink-300">{shortHash(hash)}<CopyBtn text={hash} className="!p-1" /></p>}
      </div>
      <div className="text-right">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>{ok ? 'BERHASIL' : 'GAGAL'}</span>
        {ok && <p className="mt-1 text-[11px] text-ink-500">Blok #{block} · gas {gas?.toLocaleString('id-ID')}</p>}
      </div>
    </motion.div>
  )
}

export default function Wallet() {
  const { me, health, txs } = useApp()
  const [tab, setTab] = useState('session')
  const { data: chain, loading } = usePoll(() => api.transactions(30), [], 6000)
  const r = ROLE[me?.role || 'none']

  return (
    <div className="mx-auto max-w-[1000px] space-y-5">
      <PageHead icon={WalletIcon} title="Wallet & Transaction" sub="Wallet aktif, status jaringan, dan hasil setiap transaksi." />

      <div className="grid gap-5 lg:grid-cols-5">
        <motion.div initial={{ opacity: 0, y: 18, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 p-7 text-white shadow-[0_30px_60px_-24px_rgba(37,99,235,.6)] lg:col-span-3">
          <div className="absolute -right-10 -top-12 h-52 w-52 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(115deg, transparent 0 16px, rgba(255,255,255,.4) 16px 17px)' }} />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-[.2em] text-white/80">Wallet aktif</span>
              <span className="rounded-full bg-white/25 px-3 py-1 text-[11px] font-extrabold backdrop-blur">{r.label}</span>
            </div>
            <p className="mt-6 text-2xl font-extrabold">{me?.name || '-'}</p>
            <p className="hash mt-1 flex flex-wrap items-center gap-1 break-all !text-[.8rem] text-white/90">{me?.address}{me && <CopyBtn text={me.address} className="!text-white hover:!text-teal-700" />}</p>
            <div className="mt-7 flex items-end justify-between">
              <div><p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Saldo</p>
                <p className="text-3xl font-extrabold">{me ? me.balance.toLocaleString('id-ID', { maximumFractionDigits: 4 }) : '-'} <span className="text-lg text-white/80">ETH</span></p></div>
              <div className="text-right"><p className="text-[11px] font-bold uppercase tracking-widest text-white/70">NFT dimiliki</p><p className="text-3xl font-extrabold">{me?.nfts ?? '-'}</p></div>
            </div>
          </div>
        </motion.div>

        <Card delay={0.1} className="space-y-4 p-6 lg:col-span-2">
          <p className="label">Jaringan</p>
          {[[Link2, 'Chain ID', health?.chainId], [Layers, 'Blok terbaru', health ? `#${health.blockNumber}` : '-'], [Coins, 'Konsensus', health?.consensus], [FileText, 'Kontrak', health ? short(health.contractAddress, 8, 6) : '-']].map(([Ic, l, v]) => (
            <div key={l} className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-teal-600"><Ic size={17} /></span>
              <div className="min-w-0 flex-1"><p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{l}</p><p className="truncate text-sm font-extrabold text-ink-900">{v ?? '-'}</p></div>
            </div>
          ))}
          <p className="text-xs text-ink-500">RPC: {health?.rpc}</p>
        </Card>
      </div>

      <Tabs id="wtabs" value={tab} onChange={setTab} tabs={[{ key: 'session', label: `Transaksi sesi ini (${txs.length})` }, { key: 'chain', label: 'Riwayat on-chain' }]} />

      <Card className="overflow-hidden !rounded-[28px]">
        {tab === 'session' ? (
          txs.length === 0 ? <Empty icon={WalletIcon} title="Belum ada transaksi di sesi ini" text="Transaksi yang kamu kirim (berhasil maupun gagal) muncul di sini. Riwayat permanen ada di tab on-chain." />
            : txs.map((t, i) => <TxRow key={t.at + '-' + i} i={i} ok={t.ok !== false} label={t.label} hash={t.txHash} block={t.blockNumber} gas={t.gasUsed} message={t.message}
              from={me?.name} time={new Date(t.at).toLocaleTimeString('id-ID')} />)
        ) : loading && !chain ? <div className="space-y-3 p-5">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
          : !chain?.length ? <Empty icon={Layers} title="Belum ada transaksi" />
            : chain.map((t, i) => <TxRow key={t.hash} i={i} ok={t.ok} label={METHOD[t.method] || t.method} hash={t.hash} block={t.block} gas={t.gasUsed} from={t.fromName} time={fmtTime(t.timestamp)} />)}
      </Card>
    </div>
  )
}
