import { AnimatePresence, motion } from 'framer-motion'
import { Activity, FilePlus2, FileText, KeyRound, LayoutDashboard, Menu, QrCode, ShieldCheck, UserPlus, Users, Wallet, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../state'
import AccountSwitcher from './AccountSwitcher'
import TxToast from './TxToast'
import OfflineScreen from './OfflineScreen'

export function Logo({ size = 40 }) {
  return (
    <span className="grid place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-blue-600 shadow-lg shadow-blue-500/30"
      style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size * 0.58} height={size * 0.58}><path d="M27 12h10v15h15v10H37v15H27V37H12V27h15z" fill="#fff" /></svg>
    </span>
  )
}

// Menu mengikuti peran akun yang sedang aktif.
function menuFor(me) {
  const all = {
    dash: { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    patients: { to: '/patients', icon: Users, label: 'Patient List' },
    profile: { to: me?.id ? `/patients/${me.id}` : '/patients', icon: Users, label: 'Profil Saya' },
    records: { to: '/records', icon: FileText, label: 'Medical Record' },
    add: { to: '/records/new', icon: FilePlus2, label: 'Add Medical Record' },
    register: { to: '/register', icon: UserPlus, label: 'Registrasi' },
    access: { to: '/access', icon: KeyRound, label: 'Access Management' },
    wallet: { to: '/wallet', icon: Wallet, label: 'Wallet & Transaction' },
    verify: { to: '/verify', icon: QrCode, label: 'Verifikasi' },
  }
  const by = {
    authority: ['dash', 'patients', 'register', 'records', 'add', 'wallet', 'verify'],
    doctor: ['dash', 'patients', 'records', 'add', 'wallet', 'verify'],
    hospital: ['dash', 'patients', 'records', 'wallet', 'verify'],
    patient: ['dash', 'profile', 'records', 'access', 'wallet', 'verify'],
    none: ['dash', 'wallet', 'verify'],
  }
  return (by[me?.role] || by.none).map(k => all[k])
}

function Nav({ items, onNavigate }) {
  return (
    <nav className="space-y-1.5">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink key={label} to={to} end={to === '/'} onClick={onNavigate}
          className={({ isActive }) => `relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${isActive ? 'text-blue-700' : 'text-ink-500 hover:text-ink-900'}`}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="navpill" className="absolute inset-0 -z-10 rounded-2xl bg-white shadow-glass" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              <Icon size={19} className={isActive ? 'text-teal-600' : ''} /> {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout() {
  const { me, health, error, booting } = useApp()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const items = menuFor(me)

  const side = (
    <div className="flex h-full flex-col">
      <div className="mb-8 flex items-center gap-3 px-2">
        <Logo />
        <div><p className="text-[17px] font-extrabold leading-tight tracking-tight text-ink-900">MediChain</p>
          <p className="text-[11px] font-semibold text-ink-500">Electronic Health Record</p></div>
      </div>
      <Nav items={items} onNavigate={() => setOpen(false)} />
      <div className="mt-auto rounded-2xl bg-gradient-to-br from-teal-500/10 to-blue-500/10 p-4">
        <ShieldCheck className="mb-2 text-teal-600" size={22} />
        <p className="text-xs font-bold text-ink-900">Data medis terenkripsi</p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-500">Isi rekam medis disimpan off-chain. Blockchain hanya menyimpan hash dan hak akses.</p>
      </div>
    </div>
  )

  return (
    <>
      <div className="aurora"><i /><i /><i /></div>
      <aside className="glass fixed inset-y-4 left-4 z-30 hidden w-[260px] p-5 lg:block">{side}</aside>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-ink-900/30 backdrop-blur-sm lg:hidden" />
            <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="glass glass-strong fixed inset-y-3 left-3 z-50 w-[270px] p-5 lg:hidden">
              <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-1 text-ink-500"><X size={18} /></button>
              {side}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-[288px]">
        <header className="sticky top-0 z-20 px-4 pt-4 lg:px-6">
          <div className="glass flex items-center gap-3 !rounded-2xl px-3 py-2.5">
            <button onClick={() => setOpen(true)} className="rounded-xl p-2 text-ink-700 hover:bg-white lg:hidden"><Menu size={20} /></button>
            <div className="hidden items-center gap-2 sm:flex">
              <Activity size={16} className="text-teal-600" />
              <span className="text-xs font-semibold text-ink-500">Proof of Authority</span>
            </div>
            <span className="flex-1" />
            <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-ink-700">
              <span className={`h-2 w-2 rounded-full ${health ? 'animate-pulse bg-emerald-500' : 'bg-rose-500'}`} />
              {health ? `Hardhat online · #${health.blockNumber}` : 'Offline'}
            </span>
            <AccountSwitcher />
          </div>
        </header>

        <main className="px-4 pb-16 pt-5 lg:px-6">
          {booting ? null : error && !health ? <OfflineScreen error={error} /> : (
            // Animasi masuk saja (tanpa menunggu animasi keluar) supaya perpindahan halaman tidak pernah macet.
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
              <Outlet />
            </motion.div>
          )}
        </main>
      </div>
      <TxToast />
    </>
  )
}
