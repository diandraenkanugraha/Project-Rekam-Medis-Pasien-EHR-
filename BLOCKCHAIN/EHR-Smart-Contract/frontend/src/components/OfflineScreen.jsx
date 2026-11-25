import { motion } from 'framer-motion'
import { PlugZap, RefreshCw } from 'lucide-react'
import { useApp } from '../state'

const STEPS = {
  NoBackend: ['uvicorn main:app --reload --port 8000  (di folder backend)', 'npx hardhat node  (terminal lain)'],
  NoRpc: ['npx hardhat node'],
  NoDeployment: ['npx hardhat run scripts/deploy.js --network localhost'],
  NoArtifact: ['npx hardhat compile'],
  NoContract: ['npx hardhat run scripts/deploy.js --network localhost'],
}

export default function OfflineScreen({ error }) {
  const { reload } = useApp()
  const steps = STEPS[error?.code] || STEPS.NoBackend
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="glass mx-auto mt-16 max-w-xl p-8 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-rose-500"><PlugZap size={28} /></div>
      <h2 className="text-xl font-extrabold text-ink-900">Belum terhubung ke blockchain</h2>
      <p className="mt-2 text-sm text-ink-500">{error?.message}</p>
      <div className="mt-5 space-y-2 text-left">
        {steps.map(s => <code key={s} className="hash block rounded-xl bg-white/80 px-3 py-2.5 text-ink-700">{s}</code>)}
      </div>
      <button onClick={reload} className="btn btn-primary mt-6"><RefreshCw size={16} /> Coba lagi</button>
    </motion.div>
  )
}
