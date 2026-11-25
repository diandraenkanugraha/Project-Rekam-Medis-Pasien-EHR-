import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp } from '../state'
import { shortHash } from '../lib/format'
import { CopyBtn } from './ui'

const STEPS = ['Input', 'Validasi kontrak', 'Authority menandatangani', 'Blok ditambahkan', 'NFT / selesai']

export default function TxToast() {
  const { toast, setToast } = useApp()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (toast?.state !== 'pending') return
    setStep(0)
    const t = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 2)), 650)
    return () => clearInterval(t)
  }, [toast?.state, toast?.label])

  useEffect(() => {
    if (toast?.state !== 'success') return
    const t = setTimeout(() => setToast(null), 12000)
    return () => clearTimeout(t)
  }, [toast, setToast])

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] w-[min(94vw,380px)]">
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.state + toast.label}
            initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="glass glass-strong pointer-events-auto p-4">
            <div className="flex items-start gap-3">
              {toast.state === 'pending' && <Loader2 className="mt-0.5 animate-spin text-blue-600" size={22} />}
              {toast.state === 'success' && <CheckCircle2 className="mt-0.5 text-teal-600" size={22} />}
              {toast.state === 'error' && <XCircle className="mt-0.5 text-rose-500" size={22} />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-ink-900">
                  {toast.state === 'pending' && 'Menunggu konfirmasi…'}
                  {toast.state === 'success' && 'Transaksi berhasil'}
                  {toast.state === 'error' && 'Transaksi gagal'}
                </p>
                <p className="text-xs text-ink-500">{toast.label}</p>

                {toast.state === 'pending' && (
                  <div className="mt-3 space-y-1.5">
                    {STEPS.map((s, i) => (
                      <div key={s} className={`flex items-center gap-2 text-xs transition ${i <= step ? 'text-ink-900' : 'text-ink-300'}`}>
                        <span className={`h-2 w-2 rounded-full ${i < step ? 'bg-teal-500' : i === step ? 'animate-pulse bg-blue-500' : 'bg-slate-300'}`} />
                        {s}
                      </div>
                    ))}
                  </div>
                )}
                {toast.state === 'success' && (
                  <div className="mt-2 space-y-1 text-xs text-ink-700">
                    <div className="flex items-center justify-between rounded-xl bg-white/70 px-2.5 py-1.5">
                      <span className="hash">{shortHash(toast.txHash)}</span><CopyBtn text={toast.txHash} />
                    </div>
                    <p>Blok <b>#{toast.blockNumber}</b> · gas {toast.gasUsed?.toLocaleString('id-ID')}</p>
                  </div>
                )}
                {toast.state === 'error' && <p className="mt-2 text-xs leading-relaxed text-rose-600">{toast.message}</p>}
              </div>
              {toast.state !== 'pending' && (
                <button onClick={() => setToast(null)} className="rounded-lg p-1 text-ink-500 hover:bg-white"><X size={16} /></button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
