import { motion } from 'framer-motion'
import { Loader2, QrCode, Search, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CopyBtn, InfoRow, PageHead, inputCls } from '../components/ui'
import { api } from '../lib/api'

export default function Verify() {
  const { id } = useParams()
  const nav = useNavigate()
  const [val, setVal] = useState(id || '')
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const run = async (rid) => {
    setBusy(true); setErr(null); setRes(null)
    try { setRes(await api.verify(rid)) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  useEffect(() => { setVal(id || ''); if (id) run(id); else setRes(null) }, [id])

  const submit = (e) => {
    e.preventDefault()
    if (!/^\d+$/.test(val) || Number(val) < 1) { setErr('Masukkan Token ID berupa angka, minimal 1.'); return }
    nav(`/verify/${val}`)
  }

  const state = !res ? null : !res.exists ? 'none' : res.integrity === true ? 'valid' : res.integrity === false ? 'invalid' : 'unknown'
  const V = {
    valid: { Icon: ShieldCheck, title: 'Rekam medis VALID', text: 'Token terdaftar di blockchain dan hash file off-chain cocok.', cls: 'from-emerald-400 to-teal-500', soft: 'bg-emerald-50 text-emerald-800' },
    invalid: { Icon: ShieldAlert, title: 'TIDAK VALID', text: 'Hash file off-chain tidak cocok dengan hash di blockchain.', cls: 'from-rose-400 to-red-500', soft: 'bg-rose-50 text-rose-700' },
    unknown: { Icon: ShieldQuestion, title: 'Terdaftar, integritas belum bisa dicek', text: 'Token ada di blockchain, tetapi file off-chain tidak ditemukan di server ini.', cls: 'from-amber-400 to-orange-500', soft: 'bg-amber-50 text-amber-800' },
    none: { Icon: ShieldX, title: 'Tidak ditemukan', text: `Token ID #${id} belum pernah dicetak di kontrak ini.`, cls: 'from-slate-400 to-slate-500', soft: 'bg-slate-100 text-slate-700' },
  }[state] || {}

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHead icon={QrCode} title="Verifikasi Rekam Medis" sub="Halaman publik. Hanya menampilkan keberadaan NFT, pemilik, dan keutuhan data. Isi medis tidak ditampilkan." />
      <Card className="p-5">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-300" />
            <input className={`${inputCls} !pl-10`} inputMode="numeric" placeholder="Masukkan Token ID, mis. 1" value={val} onChange={e => setVal(e.target.value.replace(/\D/g, ''))} />
          </div>
          <button className="btn btn-primary justify-center" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}Verifikasi</button>
        </form>
        {err && <p className="mt-3 text-xs font-bold text-rose-500">{err}</p>}
        <p className="mt-3 text-xs text-ink-500">Atau scan QR Code pada kartu NFT rekam medis. QR langsung membuka halaman ini.</p>
      </Card>

      {state && (
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 22 }} className="glass mt-5 overflow-hidden">
          <div className={`flex items-center gap-4 bg-gradient-to-r ${V.cls} p-6 text-white`}>
            <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.15 }} className="grid h-16 w-16 place-items-center rounded-2xl bg-white/25 backdrop-blur">
              <V.Icon size={34} />
            </motion.span>
            <div><p className="text-xl font-extrabold">{V.title}</p><p className="text-sm text-white/90">{V.text}</p></div>
          </div>
          {res.exists && (
            <div className="p-6">
              <InfoRow label="Token ID">#{res.recordId}</InfoRow>
              <InfoRow label="Pemilik NFT"><span className="hash flex items-center gap-1 break-all">{res.owner}<CopyBtn text={res.owner} /></span></InfoRow>
              <InfoRow label="Metadata (publik)">{res.metadata}</InfoRow>
              <InfoRow label="Smart contract"><span className="hash flex items-center gap-1 break-all">{res.contractAddress}<CopyBtn text={res.contractAddress} /></span></InfoRow>
              <InfoRow label="Chain ID">{res.chainId}</InfoRow>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
