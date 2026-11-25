import { motion } from 'framer-motion'
import { Hammer } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Card } from '../components/ui'

const INFO = {
  '/patients': ['Patient List', 'Tabel pasien dari smart contract + detail pasien (tab Riwayat Pemeriksaan & Informasi Medis).', 'patientIdOf, getPatientHistory, hasAccess'],
  '/records': ['Medical Record', 'Daftar rekam medis, kartu NFT 3D, verifikasi hash, dan QR Code.', 'getRecord, getStatusHistory, verifyRecordIntegrity, ownerOf'],
  '/records/new': ['Add Medical Record', 'Form pemeriksaan dengan validasi dan upload PDF (hash otomatis).', 'createRecord, updateRecordStatus'],
  '/register': ['Registrasi', 'Form pendaftaran pasien, dokter, dan rumah sakit oleh authority.', 'registerPatient, registerEntity'],
  '/access': ['Access Management', 'Beri atau cabut izin akses dokter/RS dengan indikator status.', 'grantAccess, revokeAccess, hasAccess'],
  '/wallet': ['Wallet & Transaction', 'Alamat wallet, saldo, peran, dan log transaksi dengan status.', 'balanceOf, transferFrom'],
  '/verify': ['Verifikasi', 'Verifikasi publik rekam medis lewat Token ID atau QR Code.', 'getRecordOwner, tokenURI, verifyRecordIntegrity'],
}

export default function ComingSoon() {
  const { pathname } = useLocation()
  const key = Object.keys(INFO).find(k => pathname === k || (k !== '/' && pathname.startsWith(k + '/'))) || ''
  const [title, desc, fns] = INFO[key] || ['Halaman', 'Halaman ini sedang disiapkan.', '-']
  return (
    <Card className="mx-auto mt-10 max-w-xl p-9 text-center">
      <motion.div animate={{ rotate: [0, -12, 12, 0] }} transition={{ repeat: Infinity, duration: 2.6 }}
        className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-teal-100 text-teal-600"><Hammer size={26} /></motion.div>
      <h2 className="text-xl font-extrabold text-ink-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">{desc}</p>
      <p className="label mt-5">Fungsi kontrak</p>
      <p className="hash mt-1 text-ink-700">{fns}</p>
      <p className="mt-5 text-xs font-semibold text-blue-600">Dibangun di tahap berikutnya</p>
    </Card>
  )
}
