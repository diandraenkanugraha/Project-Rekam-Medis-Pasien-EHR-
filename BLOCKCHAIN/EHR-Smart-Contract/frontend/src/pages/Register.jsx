import { motion } from 'framer-motion'
import { Building2, Lock, Stethoscope, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CopyBtn, Card, Field, PageHead, Tabs, inputCls } from '../components/ui'
import { api } from '../lib/api'
import { short } from '../lib/format'
import { useApp } from '../state'

const EMPTY_P = { wallet: '', nama: '', nik: '', tglLahir: '', golDarah: '', alamat: '', noTelepon: '' }
const EMPTY_E = { wallet: '', role: 'doctor', nama: '', nomorIzin: '', detail: '' }

function validateP(f) {
  const e = {}
  if (!f.wallet) e.wallet = 'Pilih wallet pasien.'
  if (f.nama.trim().length < 3) e.nama = 'Nama minimal 3 karakter.'
  if (!/^\d{16}$/.test(f.nik)) e.nik = 'NIK harus tepat 16 digit angka.'
  if (!f.tglLahir) e.tglLahir = 'Tanggal lahir wajib diisi.'
  else if (new Date(f.tglLahir) > new Date()) e.tglLahir = 'Tanggal lahir tidak boleh di masa depan.'
  if (!f.golDarah) e.golDarah = 'Pilih golongan darah.'
  if (f.alamat.trim().length < 5) e.alamat = 'Alamat minimal 5 karakter.'
  if (!/^\+?\d{8,15}$/.test(f.noTelepon)) e.noTelepon = 'No. telepon 8-15 digit.'
  return e
}
function validateE(f) {
  const e = {}
  if (!f.wallet) e.wallet = 'Pilih wallet.'
  if (f.nama.trim().length < 3) e.nama = 'Nama minimal 3 karakter.'
  if (f.nomorIzin.trim().length < 4) e.nomorIzin = 'Nomor izin (STR/SIP) minimal 4 karakter.'
  if (f.detail.trim().length < 3) e.detail = f.role === 'doctor' ? 'Isi spesialisasi.' : 'Isi alamat rumah sakit.'
  return e
}

function WalletSelect({ value, onChange, accounts, error }) {
  const free = accounts.map((a, i) => ({ ...a, i })).filter(a => a.role === 'none')
  return (
    <Field label="Wallet" error={error} hint={free.length ? 'Hanya akun yang belum punya peran (satu wallet satu peran).' : 'Tidak ada akun kosong tersisa.'}>
      <select className={inputCls} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Pilih wallet…</option>
        {free.map(a => <option key={a.address} value={a.address}>Akun #{a.i} · {short(a.address, 8, 6)}</option>)}
      </select>
    </Field>
  )
}

export default function Register() {
  const { me, accounts, runTx } = useApp()
  const [tab, setTab] = useState('patient')
  const [p, setP] = useState(EMPTY_P)
  const [en, setEn] = useState(EMPTY_E)
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const isAuth = me?.role === 'authority'
  const errP = useMemo(() => validateP(p), [p])
  const errE = useMemo(() => validateE(en), [en])
  const err = tab === 'patient' ? errP : errE
  const show = (k) => (tried ? err[k] : undefined)

  const submit = async (e) => {
    e.preventDefault(); setTried(true)
    if (Object.keys(err).length || !isAuth) return
    setBusy(true); setDone(null)
    try {
      if (tab === 'patient') {
        const r = await runTx('Registrasi pasien', () => api.registerPatient({ actor: me.address, ...p }))
        setDone({ kind: 'Pasien', id: r.patientId, name: p.nama }); setP(EMPTY_P)
      } else {
        const r = await runTx(en.role === 'doctor' ? 'Registrasi dokter' : 'Registrasi rumah sakit', () => api.registerEntity({ actor: me.address, ...en }))
        setDone({ kind: en.role === 'doctor' ? 'Dokter' : 'Rumah Sakit', id: r.entityId, name: en.nama }); setEn(EMPTY_E)
      }
      setTried(false)
    } catch { /* pesan error sudah tampil di toast */ }
    finally { setBusy(false) }
  }

  const upP = (k) => (e) => setP(s => ({ ...s, [k]: e.target.value }))
  const upE = (k) => (e) => setEn(s => ({ ...s, [k]: e.target.value }))

  return (
    <div className="mx-auto max-w-[900px]">
      <PageHead icon={UserPlus} title="Registrasi" sub="Hanya Authority yang boleh mendaftarkan pasien, dokter, dan rumah sakit." />

      {!isAuth && (
        <Card className="mb-5 flex items-center gap-3 !rounded-2xl bg-amber-50/70 p-4">
          <Lock className="text-amber-600" size={20} />
          <p className="text-sm font-semibold text-amber-800">Akun aktif bukan Authority, jadi tombol kirim dinonaktifkan. Ganti akun lewat pemilih di kanan atas.</p>
        </Card>
      )}

      <Card className="p-6 lg:p-8">
        <Tabs id="regtabs" value={tab} onChange={(t) => { setTab(t); setTried(false); setDone(null) }}
          tabs={[{ key: 'patient', label: 'Pasien baru' }, { key: 'entity', label: 'Dokter / Rumah Sakit' }]} />

        <form onSubmit={submit} noValidate className="mt-6 space-y-5">
          {tab === 'patient' ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><WalletSelect value={p.wallet} onChange={(v) => setP(s => ({ ...s, wallet: v }))} accounts={accounts} error={show('wallet')} /></div>
              <Field label="Nama lengkap" error={show('nama')}><input className={inputCls} value={p.nama} onChange={upP('nama')} placeholder="Siti Aminah" /></Field>
              <Field label="NIK" error={show('nik')} hint="16 digit. NIK tidak disimpan terbaca, hanya hash-nya."><input className={`${inputCls} hash !text-sm`} inputMode="numeric" maxLength={16} value={p.nik} onChange={e => setP(s => ({ ...s, nik: e.target.value.replace(/\D/g, '') }))} placeholder="3209012345670001" /></Field>
              <Field label="Tanggal lahir" error={show('tglLahir')}><input type="date" className={inputCls} value={p.tglLahir} onChange={upP('tglLahir')} /></Field>
              <Field label="Golongan darah" error={show('golDarah')}>
                <select className={inputCls} value={p.golDarah} onChange={upP('golDarah')}>
                  <option value="">Pilih…</option>{['A', 'B', 'AB', 'O'].map(g => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2"><Field label="Alamat" error={show('alamat')}><input className={inputCls} value={p.alamat} onChange={upP('alamat')} placeholder="Jl. Pemuda No. 12, Cirebon" /></Field></div>
              <Field label="No. telepon" error={show('noTelepon')}><input className={inputCls} inputMode="tel" value={p.noTelepon} onChange={e => setP(s => ({ ...s, noTelepon: e.target.value.replace(/[^\d+]/g, '') }))} placeholder="081234567890" /></Field>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><WalletSelect value={en.wallet} onChange={(v) => setEn(s => ({ ...s, wallet: v }))} accounts={accounts} error={show('wallet')} /></div>
              <div className="sm:col-span-2">
                <span className="label mb-1.5 block">Jenis</span>
                <div className="grid grid-cols-2 gap-3">
                  {[['doctor', 'Dokter', Stethoscope], ['hospital', 'Rumah Sakit', Building2]].map(([k, l, Ic]) => (
                    <button type="button" key={k} onClick={() => setEn(s => ({ ...s, role: k }))}
                      className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-bold transition ${en.role === k ? 'border-teal-400 bg-white shadow-md' : 'border-white/80 bg-white/50 text-ink-500 hover:bg-white/80'}`}>
                      <Ic size={20} className={en.role === k ? 'text-teal-600' : ''} />{l}
                    </button>
                  ))}
                </div>
              </div>
              <Field label={en.role === 'doctor' ? 'Nama dokter' : 'Nama rumah sakit'} error={show('nama')}><input className={inputCls} value={en.nama} onChange={upE('nama')} placeholder={en.role === 'doctor' ? 'dr. Hamdan, M.Kom' : 'RS Siloam Cirebon'} /></Field>
              <Field label="Nomor izin (STR/SIP)" error={show('nomorIzin')}><input className={inputCls} value={en.nomorIzin} onChange={upE('nomorIzin')} placeholder="STR-3209-0001" /></Field>
              <div className="sm:col-span-2"><Field label={en.role === 'doctor' ? 'Spesialisasi' : 'Alamat rumah sakit'} error={show('detail')}><input className={inputCls} value={en.detail} onChange={upE('detail')} placeholder={en.role === 'doctor' ? 'Spesialis Penyakit Dalam' : 'Jl. Brigjen Dharsono, Cirebon'} /></Field></div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button type="submit" disabled={busy || !isAuth} className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50">
              <UserPlus size={17} />{busy ? 'Mengirim transaksi…' : 'Daftarkan'}
            </button>
            {tried && Object.keys(err).length > 0 && <span className="text-xs font-bold text-rose-500">Periksa {Object.keys(err).length} isian yang belum valid.</span>}
          </div>
        </form>
      </Card>

      {done && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass mt-5 p-5">
          <p className="text-sm font-extrabold text-teal-700">{done.kind} “{done.name}” berhasil terdaftar di blockchain.</p>
          <p className="label mt-3">ID (bytes32)</p>
          <p className="hash mt-1 flex items-center gap-1 break-all text-ink-700">{done.id}<CopyBtn text={done.id} /></p>
          <Link to={done.kind === 'Pasien' ? `/patients/${done.id}` : '/patients'} className="btn btn-ghost mt-4">Lihat {done.kind === 'Pasien' ? 'detail pasien' : 'daftar pasien'}</Link>
        </motion.div>
      )}
    </div>
  )
}
