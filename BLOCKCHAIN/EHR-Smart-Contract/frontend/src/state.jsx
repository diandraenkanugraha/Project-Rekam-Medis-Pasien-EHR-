import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './lib/api'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
  const [accounts, setAccounts] = useState([])
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)
  const [booting, setBooting] = useState(true)
  const [actor, setActorState] = useState(() => localStorage.getItem('ehr_actor') || '')
  const [txs, setTxs] = useState([])
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    try {
      const [h, a] = await Promise.all([api.health(), api.accounts()])
      setHealth(h); setAccounts(a); setError(null)
      setActorState(cur => (a.some(x => x.address === cur) ? cur : a[0]?.address || ''))
    } catch (e) { setError(e); setHealth(null) }
    finally { setBooting(false) }
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t) }, [load])

  const setActor = (a) => { localStorage.setItem('ehr_actor', a); setActorState(a) }
  const me = accounts.find(a => a.address === actor) || null

  // Bungkus semua transaksi: tampilkan status Menunggu -> Berhasil/Gagal, simpan ke log.
  const runTx = useCallback(async (label, fn) => {
    setToast({ state: 'pending', label })
    try {
      const res = await fn()
      const rec = { ...res, label: res.label || label, at: Date.now() }
      setTxs(t => [rec, ...t]); setToast({ state: 'success', ...rec }); load()
      return res
    } catch (e) {
      setToast({ state: 'error', label, message: e.message, code: e.code })
      setTxs(t => [{ ok: false, label, message: e.message, code: e.code, at: Date.now(), from: actor }, ...t])
      throw e
    }
  }, [actor, load])

  return (
    <Ctx.Provider value={{ accounts, health, error, booting, actor, setActor, me, reload: load, txs, toast, setToast, runTx }}>
      {children}
    </Ctx.Provider>
  )
}
