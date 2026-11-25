import { motion } from 'framer-motion'
import { Activity, ArrowRight, Boxes, FileText, KeyRound, Link2, Network, PieChart as PieIcon, Stethoscope, Users } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CopyBtn, CountUp, Empty, Pill, SceneBoundary, Skeleton } from '../components/ui'
import { ROLE, STATUS_COLORS, fmtClock, shortHash, short } from '../lib/format'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { useApp } from '../state'

const ChainScene = lazy(() => import('../scenes/ChainScene'))
const NetworkScene = lazy(() => import('../scenes/NetworkScene'))

const ACTIONS = {
  authority: [{ to: '/register', label: 'Registrasi Pasien / Dokter' }, { to: '/records', label: 'Medical Record' }],
  doctor: [{ to: '/records/new', label: 'Tambah Rekam Medis' }, { to: '/patients', label: 'Patient List' }],
  hospital: [{ to: '/patients', label: 'Patient List' }, { to: '/records', label: 'Medical Record' }],
  patient: [{ to: '/access', label: 'Kelola Akses' }, { to: '/records', label: 'Rekam Medis Saya' }],
  none: [{ to: '/wallet', label: 'Wallet & Transaction' }],
}

const glassTip = { background: 'rgba(255,255,255,.95)', border: 'none', borderRadius: 14, boxShadow: '0 10px 30px -10px rgba(14,116,144,.35)', fontSize: 12, fontWeight: 600 }

function SceneFallback() { return <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-teal-100/50 to-blue-100/50" /> }

function Stat({ icon: Icon, label, value, tint, delay }) {
  return (
    <Card delay={delay} className="group relative overflow-hidden p-5 transition-shadow hover:shadow-lift">
      <motion.div whileHover={{ y: -3 }}>
        <div className="mb-4 flex items-center justify-between">
          <span className="label">{label}</span>
          <span className="grid h-10 w-10 place-items-center rounded-2xl text-white shadow-md" style={{ background: tint }}><Icon size={19} /></span>
        </div>
        <p className="text-[34px] font-extrabold leading-none tracking-tight text-ink-900">
          {value == null ? <Skeleton className="h-9 w-16" /> : <CountUp value={value} />}
        </p>
      </motion.div>
      <span className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-20 blur-2xl transition group-hover:opacity-40" style={{ background: tint }} />
    </Card>
  )
}

function Head({ icon: Icon, title, sub }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-teal-600 shadow-sm"><Icon size={18} /></span>
      <div><p className="text-sm font-extrabold text-ink-900">{title}</p>{sub && <p className="text-[11px] text-ink-500">{sub}</p>}</div>
    </div>
  )
}

export default function Dashboard() {
  const { me, health } = useApp()
  const { data: s } = usePoll(api.stats, [], 5000)
  const { data: net } = usePoll(api.network, [], 8000)
  const actions = ACTIONS[me?.role] || ACTIONS.none
  const total = s ? s.byStatus.reduce((a, b) => a + b.count, 0) : 0
  const netOnlyAuth = net && net.nodes.filter(n => n.role !== 'authority').length === 0

  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      {/* HERO */}
      <Card className="relative overflow-hidden !rounded-[32px] lg:min-h-[400px]">
        <div className="relative h-[270px] lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[56%]">
          <SceneBoundary>
            <Suspense fallback={<SceneFallback />}>{s && <ChainScene blocks={s.blocks} />}</Suspense>
          </SceneBoundary>
        </div>
        <div className="relative z-10 flex flex-col justify-center p-7 lg:min-h-[400px] lg:w-[48%] lg:p-11">
          <Pill className="mb-4 w-fit bg-white/80 text-teal-700 shadow-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
            Halo, {me?.name || '…'} · {ROLE[me?.role || 'none'].label}
          </Pill>
          <h1 className="text-[32px] font-extrabold leading-[1.12] tracking-tight text-ink-900 lg:text-[40px]">
            Rekam medis yang <span className="bg-gradient-to-r from-teal-500 to-blue-600 bg-clip-text text-transparent">aman, transparan,</span> dan milik pasien.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-700">
            Setiap rekam medis menjadi NFT. Isinya terenkripsi di luar rantai, sedangkan blockchain menjaga hash, status, dan hak akses.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {actions.map((a, i) => (
              <Link key={a.to} to={a.to} className={`btn ${i === 0 ? 'btn-primary' : 'btn-ghost'}`}>{a.label}<ArrowRight size={16} /></Link>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Pill className="bg-white/80 text-ink-700"><Link2 size={13} /> Chain {health?.chainId ?? '-'}</Pill>
            <Pill className="bg-white/80 text-ink-700">Proof of Authority</Pill>
            <Pill className="bg-white/80 pr-1.5 text-ink-700"><span className="hash">{short(health?.contractAddress, 8, 6)}</span>{health && <CopyBtn text={health.contractAddress} />}</Pill>
          </div>
        </div>
      </Card>

      {/* STATISTIK */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat delay={0.05} icon={Users} label="Pasien" value={s?.patients} tint="linear-gradient(135deg,#fbbf24,#f59e0b)" />
        <Stat delay={0.1} icon={Stethoscope} label="Dokter & RS" value={s ? s.doctors + s.hospitals : null} tint="linear-gradient(135deg,#2dd4bf,#0d9488)" />
        <Stat delay={0.15} icon={FileText} label="Rekam medis (NFT)" value={s?.records} tint="linear-gradient(135deg,#60a5fa,#2563eb)" />
        <Stat delay={0.2} icon={KeyRound} label="Izin akses aktif" value={s?.activeAccess} tint="linear-gradient(135deg,#818cf8,#6366f1)" />
        <Stat delay={0.25} icon={Boxes} label="Blok terbaru" value={s?.latestBlock} tint="linear-gradient(135deg,#38bdf8,#0ea5e9)" />
      </div>

      {/* GRAFIK */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card delay={0.3} className="p-5">
          <Head icon={PieIcon} title="Status rekam medis" sub="ADDED → DIAGNOSED → TREATED → DISCHARGED" />
          {!s ? <Skeleton className="h-[220px]" /> : total === 0 ? <Empty icon={FileText} title="Belum ada rekam medis" text="Grafik muncul setelah dokter membuat rekam medis pertama." /> : (
            <div className="flex items-center gap-2">
              <div className="relative h-[220px] w-[56%]">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={s.byStatus} dataKey="count" nameKey="status" innerRadius={58} outerRadius={86} paddingAngle={4} cornerRadius={8} stroke="none">
                      {s.byStatus.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={glassTip} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div><p className="text-3xl font-extrabold text-ink-900">{total}</p><p className="label">rekam</p></div>
                </div>
              </div>
              <ul className="flex-1 space-y-2.5">
                {s.byStatus.map((x, i) => (
                  <li key={x.status} className="flex items-center gap-2 text-xs font-semibold text-ink-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[i] }} />{x.status}<b className="ml-auto text-ink-900">{x.count}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card delay={0.35} className="p-5">
          <Head icon={Activity} title="Aktivitas jaringan" sub="Jumlah transaksi per blok (10 terakhir)" />
          {!s ? <Skeleton className="h-[220px]" /> : (
            <div className="h-[220px]">
              <ResponsiveContainer>
                <AreaChart data={s.blocks.map(b => ({ name: '#' + b.number, txs: b.txs }))} margin={{ left: -22, right: 6, top: 8 }}>
                  <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.5} /><stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 6" stroke="#cfe0ea" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#5b7387' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#5b7387' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={glassTip} />
                  <Area type="monotone" dataKey="txs" name="Transaksi" stroke="#0d9488" strokeWidth={2.5} fill="url(#gA)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card delay={0.4} className="p-5">
          <Head icon={Stethoscope} title="Rekam medis per dokter" sub="Siapa yang paling banyak menulis rekam medis" />
          {!s ? <Skeleton className="h-[220px]" /> : s.byDoctor.length === 0 ? <Empty icon={Stethoscope} title="Belum ada data" text="Muncul setelah ada rekam medis yang ditulis dokter." /> : (
            <div className="h-[220px]">
              <ResponsiveContainer>
                <BarChart data={s.byDoctor} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke="#cfe0ea" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#5b7387' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11, fill: '#27425a', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={glassTip} cursor={{ fill: 'rgba(20,184,166,.08)' }} />
                  <Bar dataKey="count" name="Rekam medis" radius={[0, 10, 10, 0]} fill="#2563eb" barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* JARINGAN 3D + BLOK */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card delay={0.45} className="relative overflow-hidden p-5 lg:col-span-3">
          <Head icon={Network} title="Jaringan peran" sub="Geser untuk memutar. Garis hijau = izin akses pasien ke dokter/RS" />
          <div className="relative h-[360px]">
            <SceneBoundary>
              <Suspense fallback={<SceneFallback />}>{net && <NetworkScene nodes={net.nodes} edges={net.edges} />}</Suspense>
            </SceneBoundary>
            {netOnlyAuth && (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-semibold text-ink-500">Baru ada Authority. Daftarkan pasien dan dokter untuk melihat jaringan tumbuh.</div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {['authority', 'doctor', 'hospital', 'patient'].map(r => (
              <span key={r} className="flex items-center gap-1.5 text-[11px] font-bold text-ink-700"><i className="h-2.5 w-2.5 rounded-full" style={{ background: ROLE[r].color }} />{ROLE[r].label}</span>
            ))}
          </div>
        </Card>

        <Card delay={0.5} className="p-5 lg:col-span-2">
          <Head icon={Boxes} title="Blok terbaru" sub="Setiap blok menunjuk ke hash blok sebelumnya" />
          {!s ? <Skeleton className="h-[330px]" /> : (
            <ol className="relative max-h-[352px] space-y-2.5 overflow-auto pr-1">
              {[...s.blocks].reverse().map((b, i) => (
                <motion.li key={b.number} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="rounded-2xl bg-white/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-ink-900">Blok #{b.number}</span>
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">{b.txs} tx</span>
                  </div>
                  <p className="hash mt-1 flex items-center gap-1 text-ink-700">{shortHash(b.hash)}<CopyBtn text={b.hash} className="!p-1" /></p>
                  <p className="hash text-ink-300">← {shortHash(b.parentHash)} · {fmtClock(b.timestamp)}</p>
                </motion.li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  )
}
