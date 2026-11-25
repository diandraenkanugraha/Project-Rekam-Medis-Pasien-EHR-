import { useCallback, useEffect, useRef, useState } from 'react'

// Ambil data dari backend, ulangi tiap `ms` milidetik supaya Dashboard hidup mengikuti blockchain.
export function usePoll(fn, deps = [], ms = 5000) {
  const [state, set] = useState({ data: null, error: null, loading: true })
  const fnRef = useRef(fn)
  fnRef.current = fn
  const run = useCallback(async () => {
    try { const data = await fnRef.current(); set({ data, error: null, loading: false }) }
    catch (error) { set(s => ({ data: s.data, error, loading: false })) }
  }, [])
  useEffect(() => {
    set(s => ({ ...s, loading: true }))
    run()
    const t = ms ? setInterval(run, ms) : null
    return () => t && clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ms, ...deps])
  return { ...state, reload: run }
}
