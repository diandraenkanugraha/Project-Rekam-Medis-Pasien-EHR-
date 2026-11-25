import { motion } from 'framer-motion'
import { CheckCircle2, CloudUpload, FilePlus2, FileText, Loader2, Lock, ShieldCheck, Trash2, XCircle } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import NftCard from '../components/NftCard'
import { Card, CopyBtn, Field, PageHead, inputCls } from '../components/ui'
import { api } from '../lib/api'
import { short } from '../lib/format'
import { usePoll } from '../lib/usePoll'
import { useApp } from '../state'

const MAX_PDF = 5 * 1024 * 1024
const EMPTY = { patient: '', doctor: '', diagnosis: '', lab: '', resep: '', meta: '' }

async function sha256Hex(buf) {
  const h = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function AddRecord() {
  const { me, actor, runTx } = useApp()
  const isDoc = me?.role === 'doctor', isAuth = me?.role === 'authority'
  const [f, setF] = useState(EMPTY)
  const [file, setFile] = useState(null)       // { obj, name, size, hash }
  const [fileErr, setFileErr] = useState('')
  const [hashing, setHashing] = useState(false)
  const [drag, setDrag] = useState(false)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const inputRef = useRef(null)

  const { data: patients } = usePoll(() => api.patients(actor), [actor], 8000)
  const { data: ents } = usePoll(() => api.entities(actor), [actor], 10000)
  const doctors = (ents || []).filter(e => e.role === 'doctor')
  const doctorId = isDoc ? me.id : f.doctor
  const { data: pd } = usePoll(() => (f.patient ? api.patient(f.patient, actor) : Promise.resolve(null)), [f.patient, actor], 6000)
  const access = pd && doctorId ? pd.access.find(a => a.id === doctorId)?.active : undefined
  const patient = (patients || []).find(p => p.id === f.patient)
  const doctor = isDoc ? me : doctors.find(d => d.id === f.doctor)

  const errors = useMemo(() => {
    const e = {}
    if (!f.patient) e.patient = 'Pilih pasien.'
    if (isAuth && !f.doctor) e.doctor = 'Pilih dokter yang memeriksa.'
    if (f.diagnosis.trim().length < 3) e.diagnosis = 'Diagnosis minimal 3 karakter.'
    if (f.lab.trim().length < 3) e.lab = 'Hasil laboratorium minimal 3 karakter.'
    if (f.resep.trim().length < 3) e.resep = 'Resep obat minimal 3 karakter.'
    if (!f.meta.trim()) e.meta = 'Metadata wajib diisi.'
    else if (f.meta.length > 80) e.meta = 'Metadata maksimal 80 karakter.'
    if (f.patient && doctorId && access === false) e.access = 'Dokter ini belum diberi izin akses oleh pasien. Pasien harus menekan Grant Access dulu.'
    return e
  }, [f, isAuth, doctorId, access])
  const show = (k) => (tried ? errors[k] : undefined)
  const up = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }))

  const pick = async (obj) => {
    setFileErr(''); setFile(null)
    if (!obj) return
    if (!(obj.type === 'application/pdf' || obj.name.toLowerCase().endsWith('.pdf'))) return setFileErr('File harus berformat PDF.')
    if (obj.size > MAX_PDF) return setFileErr('Ukuran PDF maksimal 5 MB.')
    setHashing(true)
    try {
      const buf = await obj.arrayBuffer()
      const head = new TextDecoder().decode(new Uint8Array(buf.slice(0, 4)))
      if (head !== '%PDF') return setFileErr('Isi file bukan PDF yang valid.')
      setFile({ obj, name: obj.name, size: obj.size, hash: await sha256Hex(buf) })
    } catch { setFileErr('Browser tidak dapat membaca file ini.') }
    finally { setHashing(false) }
  }

  const submit = async (e) => {
    e.preventDefault(); setTried(true); setDone(null)
    if (Object.keys(errors).length || busy) return
    const fd = new FormData()
    fd.append('actor', actor); fd.append('patient_id', f.patient)
    if (isAuth) fd.append('doctor_id', f.doctor)
    fd.append('diagnosis', f.diagnosis); fd.append('hasil_lab', f.lab); fd.append('resep_obat', f.resep); fd.append('metadata', f.meta)
    if (file) fd.append('file', file.obj, file.name)
    setBusy(true)
    try {
      const r = await runTx('Membuat rekam medis + mencetak NFT', () => api.createRecord(fd))
      setDone({ ...r, hashMatch: file && r.attachment ? r.attachment.sha256 === file.hash : null, localHash: file?.hash })
      setF(EMPTY); setFile(null); setTried(false)
    } catch { /* pesan error ada di toast */ }
    finally { setBusy(false) }
  }

  if (!isDoc && !isAuth) {
    return (
      <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-600"><Lock size={26} /></div>
        <h2 className="text-lg font-extrabold text-ink-900">Hanya untuk dokter</h2>
        <p className="mt-2 text-sm text-ink-500">Rekam medis dibuat oleh dokter (atau Authority atas nama dokter). Ganti akun lewat pemilih di kanan atas.</p>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHead icon={FilePlus2} title="Add Medical Record" sub="Isi hasil pemeriksaan. Data dienkripsi di luar rantai, hash-nya dicatat di blockchain, lalu NFT dicetak untuk pasien." />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_330px]">
        <Card className="p-6 lg:p-7">
          <form onSubmit={submit} noValidate className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Pasien" error={show('patient')} hint={patients?.length === 0 ? 'Belum ada pasien yang bisa dipilih.' : undefined}>
                <select className={inputCls} value={f.patient} onChange={up('patient')}>
                  <option value="">Pilih pasien…</option>
                  {(patients || []).map(p => <option key={p.id} value={p.id}>{p.nama || short(p.wallet)}</option>)}
                </select>
              </Field>
              {isAuth ? (
                <Field label="Dokter pemeriksa" error={show('doctor')}>
                  <select className={inputCls} value={f.doctor} onChange={up('doctor')}>
                    <option value="">Pilih dokter…</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.nama}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label="Dokter pemeriksa"><div className={`${inputCls} !bg-white/50`}>{me.name}</div></Field>
              )}
            </div>

            {f.patient && doctorId && access !== undefined && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 rounded-2xl p-3.5 text-sm font-bold ${access ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}>
                {access ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                {access ? 'Izin akses aktif. Dokter boleh mencatat rekam medis untuk pasien ini.' : 'Belum ada izin akses dari pasien. Transaksi akan ditolak kontrak.'}
              </motion.div>
            )}

            <Field label="Diagnosis" error={show('diagnosis')}><textarea rows={2} className={inputCls} value={f.diagnosis} onChange={up('diagnosis')} placeholder="Hipertensi stadium 1" /></Field>
            <Field label="Hasil laboratorium" error={show('lab')}><textarea rows={3} className={inputCls} value={f.lab} onChange={up('lab')} placeholder="Tekanan darah 150/95 mmHg. Kolesterol total 232 mg/dL." /></Field>
            <Field label="Resep obat" error={show('resep')}><textarea rows={3} className={inputCls} value={f.resep} onChange={up('resep')} placeholder="Amlodipine 5 mg 1x1" /></Field>
            <Field label={`Metadata publik (${f.meta.length}/80)`} error={show('meta')} hint="Muncul di NFT dan bisa dibaca siapa saja. Jangan isi data sensitif.">
              <input className={inputCls} value={f.meta} onChange={up('meta')} maxLength={90} placeholder="Rawat Jalan - Poli Umum" />
            </Field>

            <div>
              <span className="label mb-1.5 block">Lampiran hasil lab (PDF, opsional)</span>
              <div onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]) }}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition ${drag ? 'border-teal-400 bg-teal-50/70' : 'border-white bg-white/50 hover:bg-white/80'}`}>
                <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
                {hashing ? (
                  <p className="flex items-center justify-center gap-2 text-sm font-bold text-blue-600"><Loader2 size={18} className="animate-spin" />Menghitung SHA-256…</p>
                ) : file ? (
                  <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 text-left" onClick={(e) => e.stopPropagation()}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-500"><FileText size={20} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-ink-900">{file.name}</p>
                      <p className="hash flex items-center gap-1 text-ink-500">SHA-256 {short(file.hash, 10, 8)}<CopyBtn text={file.hash} className="!p-1" /> · {(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button type="button" onClick={() => setFile(null)} className="rounded-lg p-2 text-ink-500 hover:bg-white hover:text-rose-500"><Trash2 size={17} /></button>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-ink-500">
                    <CloudUpload size={26} className="text-teal-600" />
                    <p className="text-sm font-bold text-ink-900">Seret PDF ke sini atau klik untuk memilih</p>
                    <p className="text-xs">Hash dihitung otomatis di browser. Maksimal 5 MB.</p>
                  </div>
                )}
              </div>
              {fileErr && <p className="mt-1.5 text-xs font-semibold text-rose-500">{fileErr}</p>}
            </div>

            {tried && errors.access && <p className="rounded-2xl bg-rose-50 p-3 text-xs font-bold text-rose-600">{errors.access}</p>}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button type="submit" disabled={busy} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-60">
                {busy ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}{busy ? 'Menunggu konfirmasi…' : 'Simpan ke blockchain'}
              </button>
              {tried && Object.keys(errors).length > 0 && <span className="text-xs font-bold text-rose-500">Periksa {Object.keys(errors).length} isian yang belum valid.</span>}
            </div>
          </form>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-24">
          <p className="label text-center">Pratinjau NFT</p>
          <NftCard rec={{ id: '?', status: 0, patientName: patient?.nama || 'Nama pasien', doctorName: doctor?.nama || doctor?.name || 'Dokter pemeriksa',
            metadata: f.meta || 'Metadata publik', owner: patient?.wallet || '0x0000000000000000000000000000000000000000',
            dataHash: file ? '0x' + file.hash : '0x0000000000000000000000000000000000000000000000000000000000000000' }}
            qrValue={`${window.location.origin}/verify`} />
        </div>
      </div>

      {done && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass mt-6 overflow-hidden">
          <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-400 to-teal-500 p-5 text-white">
            <CheckCircle2 size={28} />
            <div><p className="text-lg font-extrabold">Rekam medis tersimpan · NFT #{done.recordId} dicetak</p><p className="text-sm text-white/90">Blok #{done.blockNumber} · {done.timestamp && new Date(done.timestamp).toLocaleString('id-ID')}</p></div>
          </div>
          <div className="space-y-2 p-5 text-sm">
            <p className="hash flex items-center gap-1 break-all text-ink-700">Data hash: {done.dataHash}<CopyBtn text={done.dataHash} /></p>
            {done.hashMatch !== null && (
              <p className={`flex items-center gap-2 font-bold ${done.hashMatch ? 'text-emerald-700' : 'text-rose-600'}`}>
                {done.hashMatch ? <ShieldCheck size={17} /> : <XCircle size={17} />}
                Hash PDF di browser {done.hashMatch ? 'sama dengan' : 'BERBEDA dari'} hash yang dihitung server.
              </p>
            )}
            <Link to={`/records/${done.recordId}`} className="btn btn-ghost mt-2">Buka rekam medis #{done.recordId}</Link>
          </div>
        </motion.div>
      )}
    </div>
  )
}
