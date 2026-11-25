// Klien API: semua data berasal dari backend FastAPI (Web3.py) -> smart contract.
export class ApiError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status }
}

async function j(url, opts) {
  let r
  try { r = await fetch(url, opts) }
  catch { throw new ApiError('Backend tidak dapat dihubungi. Pastikan uvicorn berjalan di port 8000.', 'NoBackend', 0) }
  const data = await r.json().catch(() => null)
  if (!r.ok) {
    const d = data?.detail
    const msg = typeof d === 'string' ? d : d?.message || (Array.isArray(d) ? d.map(x => x.msg).join('; ') : 'Permintaan gagal.')
    throw new ApiError(msg, d?.code, r.status)
  }
  return data
}
const post = (url, body) => j(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const q = (actor) => `?actor=${encodeURIComponent(actor)}`

export const api = {
  health: () => j('/api/health'),
  accounts: () => j('/api/accounts'),
  stats: () => j('/api/stats'),
  network: () => j('/api/network'),
  transactions: (limit = 30) => j(`/api/transactions?limit=${limit}`),
  patients: (actor) => j('/api/patients' + q(actor)),
  patient: (id, actor) => j(`/api/patients/${id}` + q(actor)),
  entities: (actor) => j('/api/entities' + q(actor)),
  records: (actor) => j('/api/records' + q(actor)),
  record: (id, actor) => j(`/api/records/${id}` + q(actor)),
  verify: (id) => j(`/api/verify/${id}`),
  registerPatient: (b) => post('/api/patients', b),
  registerEntity: (b) => post('/api/entities', b),
  createRecord: (formData) => j('/api/records', { method: 'POST', body: formData }),
  updateStatus: (id, b) => post(`/api/records/${id}/status`, b),
  transfer: (id, b) => post(`/api/records/${id}/transfer`, b),
  grant: (b) => post('/api/access/grant', b),
  revoke: (b) => post('/api/access/revoke', b),
}
