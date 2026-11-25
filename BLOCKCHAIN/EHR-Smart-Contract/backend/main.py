"""
EHR Blockchain - Backend API (FastAPI + Web3.py)

Semua interaksi ke smart contract dilakukan DI SINI memakai Web3.py.
Frontend React hanya memanggil endpoint JSON di bawah ini.

Prinsip penting:
- Alamat kontrak dibaca dari deployment.json, ABI dari artifacts/ (hasil `npx hardhat compile`).
- Pembacaan data medis memakai akun pelaku sebagai msg.sender, jadi aturan akses KONTRAK tetap berlaku.
- createRecord dan updateRecordStatus di kontrak bersifat onlyAuthority (PoA): backend meneruskan
  form dokter lewat akun Authority, sedangkan kontrak tetap memeriksa dokter + izin pasiennya.
- Data sensitif dienkripsi (Fernet) dan disimpan off-chain di offchain_store/. Yang masuk blockchain: hash-nya.
"""
import hashlib
import json
import re
import time
from datetime import datetime
from pathlib import Path

from cryptography.fernet import Fernet
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from web3 import Web3

# ---------------------------------------------------------
# KONFIGURASI
# ---------------------------------------------------------
RPC_URL = "http://127.0.0.1:8545"
PROJECT_DIR = Path(__file__).resolve().parent.parent
DEPLOYMENT_PATH = PROJECT_DIR / "deployment.json"
ARTIFACT_PATH = PROJECT_DIR / "artifacts" / "contracts" / "EHR.sol" / "EHR.json"
STORE = PROJECT_DIR / "offchain_store"
PROFILES = STORE / "profiles"
STORE.mkdir(exist_ok=True)
PROFILES.mkdir(exist_ok=True)

STATUS = ["ADDED", "DIAGNOSED", "TREATED", "DISCHARGED"]
ZERO32 = b"\x00" * 32
MAX_PDF = 5 * 1024 * 1024

ERR = {
    "NotOwner": "Hanya owner kontrak yang boleh melakukan ini.",
    "NotAuthority": "Validasi konsensus gagal: akun ini bukan authority.",
    "InvalidInput": "Input tidak valid. Periksa semua isian (NIK harus 16 karakter).",
    "InvalidAddress": "Alamat wallet tidak valid.",
    "WalletAlreadyUsed": "Wallet ini sudah dipakai oleh peran lain (satu wallet satu peran).",
    "PatientAlreadyRegistered": "Pasien sudah terdaftar.",
    "EntityAlreadyRegistered": "Dokter/RS sudah terdaftar.",
    "PatientNotFound": "Pasien tidak ditemukan.",
    "DoctorNotFound": "Dokter tidak ditemukan atau belum terverifikasi.",
    "EntityNotFound": "ID dokter/RS tidak valid.",
    "RecordNotFound": "Rekam medis tidak ditemukan.",
    "AccessDenied": "Akses ditolak: akun ini tidak punya hak akses ke data pasien.",
    "NotPatient": "Hanya pasien pemilik data yang boleh mengubah akses.",
    "InvalidTarget": "Target tidak valid (harus dokter atau rumah sakit).",
    "AccessAlreadyActive": "Akses sudah aktif.",
    "NoActiveAccess": "Tidak ada akses aktif untuk dicabut.",
    "InvalidStatusTransition": "Transisi status tidak valid. Urutannya harus maju satu langkah.",
    "NoHistory": "Belum ada riwayat rekam medis.",
    "ERC721InsufficientApproval": "Transfer ditolak: akun ini bukan pemilik NFT.",
    "ERC721NonexistentToken": "Token ID belum ada.",
}

w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 15}))
app = FastAPI(title="EHR Blockchain API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# UTIL
# ---------------------------------------------------------
class ApiError(HTTPException):
    def __init__(self, message, code="ERROR", status=400):
        super().__init__(status_code=status, detail={"code": code, "message": message})


def hx(b):
    s = b.hex() if isinstance(b, (bytes, bytearray)) else str(b)
    return s if s.startswith("0x") else "0x" + s


def b32(s):
    try:
        v = bytes.fromhex(s[2:] if s.startswith("0x") else s)
    except Exception:
        raise ApiError("Format ID tidak valid (harus heksadesimal 32 byte).", "BadId")
    if len(v) != 32:
        raise ApiError("Format ID tidak valid (harus 32 byte).", "BadId")
    return v


_cache = {"sig": None, "contract": None, "selectors": {}, "fn_sel": {}}


def _canon(i):
    """Tipe kanonik parameter ABI (tuple diurai) untuk menghitung selector fungsi."""
    t = i["type"]
    if t.startswith("tuple"):
        return "(" + ",".join(_canon(x) for x in i["components"]) + ")" + t[5:]
    return t


def contract():
    """Muat kontrak dari deployment.json + artifact. Otomatis ikut berubah bila deploy ulang."""
    if not w3.is_connected():
        raise ApiError("Tidak dapat terhubung ke Hardhat Network. Pastikan Hardhat Node sedang berjalan.",
                       "NoRpc", 503)
    if not DEPLOYMENT_PATH.exists():
        raise ApiError("File deployment.json tidak ditemukan. Silakan deploy smart contract terlebih dahulu.",
                       "NoDeployment", 503)
    if not ARTIFACT_PATH.exists():
        raise ApiError("Artifact smart contract tidak ditemukan. Silakan compile smart contract terlebih dahulu.",
                       "NoArtifact", 503)
    address = Web3.to_checksum_address(json.loads(DEPLOYMENT_PATH.read_text())["address"])
    sig = (address, ARTIFACT_PATH.stat().st_mtime)
    if _cache["sig"] != sig:
        abi = json.loads(ARTIFACT_PATH.read_text())["abi"]
        sel = {}
        for it in abi:
            if it.get("type") == "error":
                s = it["name"] + "(" + ",".join(i["type"] for i in it["inputs"]) + ")"
                sel[Web3.keccak(text=s)[:4].hex().removeprefix("0x")] = it["name"]
        fsel = {}
        for it in abi:
            if it.get("type") == "function":
                sg = it["name"] + "(" + ",".join(_canon(x) for x in it["inputs"]) + ")"
                fsel[Web3.keccak(text=sg)[:4].hex().removeprefix("0x")] = it["name"]
        _cache.update(sig=sig, contract=w3.eth.contract(address=address, abi=abi), selectors=sel, fn_sel=fsel)
    c = _cache["contract"]
    if w3.eth.get_code(c.address) in (b"", b"\x00"):
        raise ApiError("Tidak ada kontrak di alamat pada deployment.json. Hardhat Node kemungkinan di-restart. "
                       "Jalankan deploy ulang.", "NoContract", 503)
    return c


def err_name(e):
    s = str(e)
    m = re.search(r"custom error\s+\\*['\"]?(\w+)", s)
    if m:
        return m.group(1)
    m = re.search(r"0x([0-9a-fA-F]{8})", s)
    return _cache["selectors"].get(m.group(1).lower()) if m else None


def explain(e):
    name = err_name(e)
    return name, ERR.get(name, f"Transaksi ditolak: {str(e)[:220]}")


def cipher():
    key = STORE / ".key"
    if not key.exists():
        key.write_bytes(Fernet.generate_key())
    return Fernet(key.read_bytes())


def addr(a):
    """Validasi: alamat harus salah satu akun Hardhat (akun yang bisa menandatangani)."""
    try:
        x = Web3.to_checksum_address(a)
    except Exception:
        raise ApiError("Alamat wallet tidak valid.", "InvalidAddress")
    if x not in w3.eth.accounts:
        raise ApiError("Wallet ini bukan akun bawaan Hardhat, jadi belum bisa dipakai di demo ini.", "UnknownAccount")
    return x


def ts(t):
    return datetime.fromtimestamp(t).isoformat() if t else None


# ---------------------------------------------------------
# CACHE PER BLOK
# Hasil pembacaan kontrak (call) untuk satu blok selalu sama, jadi cukup dihitung sekali per blok.
# Begitu ada transaksi baru (hash blok terbaru berubah), cache otomatis tidak berlaku lagi.
# ---------------------------------------------------------
_memo = {}


def memo(fn):
    def wrap(c, *args):
        stamp = bytes(w3.eth.get_block("latest")["hash"])
        key = (fn.__name__, c.address, args)
        hit = _memo.get(key)
        if hit and hit[0] == stamp:
            return hit[1]
        val = fn(c, *args)
        if len(_memo) > 4000:
            _memo.clear()
        _memo[key] = (stamp, val)
        return val
    wrap.__name__ = fn.__name__
    return wrap


@memo
def has_access(c, target_id, patient_id):
    return c.functions.hasAccess(target_id, patient_id).call()


# ---------------------------------------------------------
# PROFIL PASIEN (off-chain, terenkripsi)
# Kontrak hanya menyimpan hash profil, jadi nama/alamat disimpan di sini.
# ---------------------------------------------------------
def save_profile(pid_hex, data):
    (PROFILES / (pid_hex[2:] + ".enc")).write_bytes(cipher().encrypt(json.dumps(data).encode()))


def load_profile(pid_hex):
    f = PROFILES / (pid_hex[2:] + ".enc")
    if not f.exists():
        return None
    try:
        return json.loads(cipher().decrypt(f.read_bytes()))
    except Exception:
        return None


# ---------------------------------------------------------
# PERAN & AKUN
# ---------------------------------------------------------
@memo
def entity_dict(c, eid):
    e = c.functions.getEntity(eid).call()
    return {"id": hx(e[0]), "wallet": e[1], "role": "doctor" if e[2] == 1 else "hospital",
            "nama": e[3], "nomorIzin": e[4], "detail": e[5], "verified": e[6]}


@memo
def role_info(c, a):
    base = {"address": a}
    if c.functions.isAuthority(a).call():
        return {**base, "role": "authority", "label": "Authority", "name": "Authority Node", "id": None}
    pid = c.functions.patientIdOf(a).call()
    if pid != ZERO32:
        prof = load_profile(hx(pid))
        return {**base, "role": "patient", "label": "Pasien", "name": (prof or {}).get("nama", "Pasien"), "id": hx(pid)}
    eid = c.functions.entityIdOf(a).call()
    if eid != ZERO32:
        e = entity_dict(c, eid)
        return {**base, "role": e["role"], "label": "Dokter" if e["role"] == "doctor" else "Rumah Sakit",
                "name": e["nama"], "id": e["id"]}
    return {**base, "role": "none", "label": "Belum terdaftar", "name": "Belum terdaftar", "id": None}


def authority_account(c):
    for a in w3.eth.accounts:
        if c.functions.isAuthority(a).call():
            return a
    raise ApiError("Tidak ada akun authority.", "NoAuthority", 500)


@memo
def all_patients(c):
    out = []
    for a in w3.eth.accounts:
        pid = c.functions.patientIdOf(a).call()
        if pid != ZERO32:
            out.append((a, pid))
    return out


@memo
def all_entities(c):
    out = []
    for a in w3.eth.accounts:
        eid = c.functions.entityIdOf(a).call()
        if eid != ZERO32:
            out.append(entity_dict(c, eid))
    return out


def rec_dict(c, r, names=None):
    names = names or {}
    return {
        "id": r[0], "patientId": hx(r[1]), "doctorId": hx(r[2]), "metadata": r[3], "dataHash": hx(r[4]),
        "offChainRef": r[5], "status": r[6], "statusLabel": STATUS[r[6]],
        "createdAt": ts(r[7]), "updatedAt": ts(r[8]),
        "patientName": names.get(hx(r[1])), "doctorName": names.get(hx(r[2])),
    }


@memo
def name_map(c):
    m = {}
    for a, pid in all_patients(c):
        m[hx(pid)] = (load_profile(hx(pid)) or {}).get("nama", "Pasien " + a[:6])
    for e in all_entities(c):
        m[e["id"]] = e["nama"]
    return m


@memo
def history_as(c, pid, caller):
    """getPatientHistory dengan caller sebagai msg.sender. Kosong -> []."""
    try:
        return c.functions.getPatientHistory(pid).call({"from": caller})
    except Exception as e:
        if err_name(e) == "NoHistory":
            return []
        raise


@memo
def aggregate_records(c):
    """Pembaca agregat (hanya untuk statistik): membaca riwayat tiap pasien memakai wallet pasien itu."""
    recs = []
    for a, pid in all_patients(c):
        recs += list(history_as(c, pid, a))
    return sorted(recs, key=lambda r: r[0])


@memo
def token_ids(c):
    """Token ID berurutan mulai 1: cek getRecordOwner sampai RecordNotFound (tanpa event)."""
    ids, i = [], 1
    while True:
        try:
            owner = c.functions.getRecordOwner(i).call()
        except Exception:
            break
        ids.append((i, owner))
        i += 1
    return ids


# ---------------------------------------------------------
# TRANSAKSI
# ---------------------------------------------------------
def send_tx(fn, sender, label):
    c = contract()
    try:
        h = fn.transact({"from": sender})
        rc = w3.eth.wait_for_transaction_receipt(h, timeout=30)
    except ApiError:
        raise
    except Exception as e:
        name, msg = explain(e)
        raise ApiError(msg, name or "TxFailed")
    if rc.status != 1:
        raise ApiError("Transaksi gagal di blockchain.", "TxFailed")
    blk = w3.eth.get_block(rc.blockNumber)
    return {
        "ok": True, "label": label, "txHash": hx(h), "blockNumber": rc.blockNumber,
        "blockHash": hx(blk["hash"]), "gasUsed": rc.gasUsed, "from": sender,
        "to": c.address, "timestamp": ts(blk["timestamp"]),
        "steps": ["Input diterima", "Validasi kontrak lolos", "Authority menandatangani",
                  f"Blok #{rc.blockNumber} ditambahkan", "Selesai"],
    }, rc


# ---------------------------------------------------------
# ENDPOINT: STATUS
# ---------------------------------------------------------
@app.get("/api/health")
def health():
    c = contract()
    return {
        "rpc": RPC_URL, "connected": True, "chainId": w3.eth.chain_id, "blockNumber": w3.eth.block_number,
        "contractAddress": c.address, "name": c.functions.name().call(), "symbol": c.functions.symbol().call(),
        "owner": c.functions.owner().call(), "consensus": "Proof of Authority",
    }


@app.get("/api/accounts")
def accounts():
    c = contract()
    out = []
    for a in w3.eth.accounts:
        info = dict(role_info(c, a))
        info["balance"] = float(w3.from_wei(w3.eth.get_balance(a), "ether"))
        info["nfts"] = c.functions.balanceOf(a).call()
        out.append(info)
    return out


@app.get("/api/stats")
def stats():
    c = contract()
    pats, ents = all_patients(c), all_entities(c)
    recs = aggregate_records(c)
    by_status = [0, 0, 0, 0]
    by_doctor = {}
    names = name_map(c)
    for r in recs:
        by_status[r[6]] += 1
        n = names.get(hx(r[2]), "?")
        by_doctor[n] = by_doctor.get(n, 0) + 1
    active = sum(1 for _, pid in pats for e in ents if has_access(c, b32(e["id"]), pid))
    latest = w3.eth.block_number
    blocks = []
    for n in range(max(0, latest - 9), latest + 1):
        b = w3.eth.get_block(n)
        blocks.append({"number": n, "hash": hx(b["hash"]), "parentHash": hx(b["parentHash"]),
                       "txs": len(b["transactions"]), "timestamp": ts(b["timestamp"])})
    return {
        "patients": len(pats),
        "doctors": sum(1 for e in ents if e["role"] == "doctor"),
        "hospitals": sum(1 for e in ents if e["role"] == "hospital"),
        "records": len(recs), "activeAccess": active, "latestBlock": latest, "chainId": w3.eth.chain_id,
        "byStatus": [{"status": STATUS[i], "count": by_status[i]} for i in range(4)],
        "byDoctor": [{"name": k, "count": v} for k, v in by_doctor.items()],
        "blocks": blocks,
    }


@app.get("/api/network")
def network():
    """Node (peran) dan garis izin akses pasien -> dokter/RS, untuk visual jaringan 3D."""
    c = contract()
    nodes, pats, ents = [], all_patients(c), all_entities(c)
    for a in w3.eth.accounts:
        info = role_info(c, a)
        if info["role"] != "none":
            nodes.append({"id": info["id"] or a, "address": a, "role": info["role"], "name": info["name"]})
    edges = [{"from": hx(pid), "to": e["id"]} for _, pid in pats for e in ents
             if has_access(c, b32(e["id"]), pid)]
    return {"nodes": nodes, "edges": edges}


@memo
def recent_txs(c, limit):
    """Transaksi ke kontrak dari blok-blok terbaru (dibaca dari blok, bukan dari event)."""
    out, n = [], w3.eth.block_number
    scanned = 0
    while n >= 0 and len(out) < limit and scanned < 400:
        blk = w3.eth.get_block(n, full_transactions=True)
        for tx in reversed(blk["transactions"]):
            to = Web3.to_checksum_address(tx["to"]) if tx["to"] else None
            if to is not None and to != c.address:
                continue
            rc = w3.eth.get_transaction_receipt(tx["hash"])
            inp = bytes(tx["input"]).hex()
            method = "deploy" if to is None else _cache["fn_sel"].get(inp[:8], "unknown")
            sender = Web3.to_checksum_address(tx["from"])
            out.append({
                "hash": hx(tx["hash"]), "block": n, "method": method, "ok": rc.status == 1,
                "from": sender, "fromName": role_info(c, sender)["name"], "gasUsed": rc.gasUsed,
                "timestamp": ts(blk["timestamp"]),
            })
            if len(out) >= limit:
                break
        n -= 1
        scanned += 1
    return out


@app.get("/api/transactions")
def transactions(limit: int = 30):
    return recent_txs(contract(), max(1, min(limit, 100)))


# ---------------------------------------------------------
# ENDPOINT: PASIEN
# ---------------------------------------------------------
def can_see_patient(c, actor, pid):
    me = role_info(c, actor)
    if me["role"] == "authority":
        return True
    if me["role"] == "patient":
        return me["id"] == hx(pid)
    if me["role"] in ("doctor", "hospital"):
        return has_access(c, b32(me["id"]), pid)
    return False


@app.get("/api/patients")
def patients(actor: str = Query(...)):
    c = contract()
    actor = addr(actor)
    ents = all_entities(c)
    recs = aggregate_records(c)
    out = []
    for a, pid in all_patients(c):
        if not can_see_patient(c, actor, pid):
            continue
        prof = load_profile(hx(pid)) or {}
        out.append({
            "id": hx(pid), "wallet": a, "nama": prof.get("nama"), "golDarah": prof.get("golDarah"),
            "records": sum(1 for r in recs if r[1] == pid),
            "nfts": c.functions.balanceOf(a).call(),
            "accessCount": sum(1 for e in ents if has_access(c, b32(e["id"]), pid)),
        })
    return out


@app.get("/api/patients/{patient_id}")
def patient_detail(patient_id: str, actor: str = Query(...)):
    c = contract()
    actor = addr(actor)
    pid = b32(patient_id)
    wallet = next((a for a, p in all_patients(c) if p == pid), None)
    if wallet is None:
        raise ApiError(ERR["PatientNotFound"], "PatientNotFound", 404)
    if not can_see_patient(c, actor, pid):
        raise ApiError(ERR["AccessDenied"], "AccessDenied", 403)
    me = role_info(c, actor)
    names = name_map(c)
    try:
        hist = [rec_dict(c, r, names) for r in history_as(c, pid, actor)]
        locked = False
    except Exception as e:
        hist, locked = [], err_name(e) == "AccessDenied"
        if not locked:
            raise
    return {
        "id": patient_id, "wallet": wallet, "profile": load_profile(patient_id),
        "nfts": c.functions.balanceOf(wallet).call(),
        "access": [{**e, "active": has_access(c, b32(e["id"]), pid)} for e in all_entities(c)],
        "records": hist, "recordsLocked": locked, "viewerRole": me["role"],
    }


class PatientIn(BaseModel):
    actor: str
    wallet: str
    nama: str
    nik: str
    tglLahir: str
    alamat: str
    golDarah: str
    noTelepon: str


@app.post("/api/patients")
def register_patient(p: PatientIn):
    c = contract()
    actor, wallet = addr(p.actor), addr(p.wallet)
    if not re.fullmatch(r"\d{16}", p.nik):
        raise ApiError("NIK harus tepat 16 digit angka.", "InvalidInput")
    for k, v in (("Nama", p.nama), ("Tanggal lahir", p.tglLahir), ("Alamat", p.alamat), ("Golongan darah", p.golDarah)):
        if not v.strip():
            raise ApiError(f"{k} wajib diisi.", "InvalidInput")
    if not re.fullmatch(r"[0-9+]{8,16}", p.noTelepon):
        raise ApiError("No. telepon harus 8-16 digit.", "InvalidInput")
    tx, _ = send_tx(c.functions.registerPatient(wallet, (p.nama, p.nik, p.tglLahir, p.alamat, p.golDarah, p.noTelepon)),
                    actor, "Pasien terdaftar")
    pid = hx(c.functions.patientIdOf(wallet).call())
    save_profile(pid, {"nama": p.nama, "tglLahir": p.tglLahir, "alamat": p.alamat,
                       "golDarah": p.golDarah, "noTelepon": p.noTelepon,
                       "nikMasked": p.nik[:4] + "********" + p.nik[-4:]})
    _memo.clear()          # profil baru tersimpan setelah blok terbentuk: buang cache nama yang basi
    return {**tx, "patientId": pid}


# ---------------------------------------------------------
# ENDPOINT: DOKTER / RS
# ---------------------------------------------------------
@app.get("/api/entities")
def entities(actor: str = Query(...)):
    c = contract()
    actor = addr(actor)
    me = role_info(c, actor)
    out = []
    for e in all_entities(c):
        row = dict(e)
        if me["role"] == "patient":
            row["accessActive"] = has_access(c, b32(e["id"]), b32(me["id"]))
        out.append(row)
    return out


class EntityIn(BaseModel):
    actor: str
    wallet: str
    role: str          # "doctor" | "hospital"
    nama: str
    nomorIzin: str
    detail: str


@app.post("/api/entities")
def register_entity(p: EntityIn):
    c = contract()
    actor, wallet = addr(p.actor), addr(p.wallet)
    if p.role not in ("doctor", "hospital"):
        raise ApiError("Peran harus doctor atau hospital.", "InvalidInput")
    for k, v in (("Nama", p.nama), ("Nomor izin", p.nomorIzin), ("Spesialisasi/alamat", p.detail)):
        if not v.strip():
            raise ApiError(f"{k} wajib diisi.", "InvalidInput")
    tx, _ = send_tx(c.functions.registerEntity(wallet, p.nama, p.nomorIzin, p.detail, 1 if p.role == "doctor" else 2),
                    actor, "Dokter terdaftar" if p.role == "doctor" else "Rumah sakit terdaftar")
    return {**tx, "entityId": hx(c.functions.entityIdOf(wallet).call())}


# ---------------------------------------------------------
# ENDPOINT: REKAM MEDIS
# ---------------------------------------------------------
@app.get("/api/records")
def records(actor: str = Query(...)):
    c = contract()
    actor = addr(actor)
    me = role_info(c, actor)
    names = name_map(c)
    if me["role"] == "authority":
        # Authority TIDAK boleh membaca isi (aturan kontrak): hanya info publik NFT.
        out = []
        for i, owner in token_ids(c):
            out.append({"id": i, "owner": owner, "metadata": c.functions.tokenURI(i).call(), "locked": True})
        return {"locked": True, "records": out}
    recs = []
    if me["role"] == "patient":
        recs = list(history_as(c, b32(me["id"]), actor))
    elif me["role"] in ("doctor", "hospital"):
        for _, pid in all_patients(c):
            if has_access(c, b32(me["id"]), pid):
                recs += list(history_as(c, pid, actor))
    out = []
    for r in sorted(recs, key=lambda r: r[0]):
        d = rec_dict(c, r, names)
        d["owner"] = c.functions.getRecordOwner(r[0]).call()
        out.append(d)
    return {"locked": False, "records": out}


@app.get("/api/records/{record_id}")
def record_detail(record_id: int, actor: str = Query(...)):
    c = contract()
    actor = addr(actor)
    try:
        rec = c.functions.getRecord(record_id).call({"from": actor})
        hist = c.functions.getStatusHistory(record_id).call({"from": actor})
        owner = c.functions.getRecordOwner(record_id).call()
    except Exception as e:
        name, msg = explain(e)
        raise ApiError(msg, name or "ReadFailed", 403 if name == "AccessDenied" else 404 if name == "RecordNotFound" else 400)
    names = name_map(c)
    d = rec_dict(c, rec, names)
    d["owner"] = owner
    d["tokenURI"] = c.functions.tokenURI(record_id).call()
    d["history"] = [{"from": STATUS[h[0]], "to": STATUS[h[1]], "doctorName": names.get(hx(h[2])),
                     "timestamp": ts(h[3])} for h in hist]
    f = STORE / rec[5].replace("local://", "")
    d["offchain"] = None
    if not f.exists():
        d["integrity"] = None
        d["offchainNote"] = "File terenkripsi tidak ada di offchain_store pada komputer ini."
    else:
        raw = f.read_bytes()
        ok = c.functions.verifyRecordIntegrity(record_id, Web3.keccak(raw)).call({"from": actor})
        d["integrity"] = bool(ok)
        if ok:
            data = json.loads(cipher().decrypt(raw))
            d["offchain"] = {"diagnosis": data["diagnosis"], "hasilLab": data["hasil_lab"],
                             "resepObat": data["resep_obat"], "lampiran": data.get("lampiran")}
    return d


@app.get("/api/records/{record_id}/attachment")
def record_attachment(record_id: int, actor: str = Query(...)):
    c = contract()
    actor = addr(actor)
    try:
        rec = c.functions.getRecord(record_id).call({"from": actor})
    except Exception as e:
        name, msg = explain(e)
        raise ApiError(msg, name or "ReadFailed", 403)
    f = STORE / rec[5].replace("local://", "")
    if not f.exists():
        raise ApiError("File terenkripsi tidak ditemukan.", "NoFile", 404)
    data = json.loads(cipher().decrypt(f.read_bytes()))
    att = data.get("lampiran")
    if not att:
        raise ApiError("Rekam medis ini tidak punya lampiran.", "NoAttachment", 404)
    pdf = cipher().decrypt((STORE / att["file"]).read_bytes())
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{att["nama"]}"'})


def _doctor_for(c, me, doctor_id):
    """Dokter/RS memakai ID-nya sendiri. Authority wajib memilih doctor_id."""
    if me["role"] in ("doctor", "hospital"):
        return b32(me["id"])
    if me["role"] == "authority":
        if not doctor_id:
            raise ApiError("Authority harus memilih dokter.", "InvalidInput")
        return b32(doctor_id)
    raise ApiError("Hanya dokter/RS atau authority yang boleh melakukan ini.", "Forbidden", 403)


@app.post("/api/records")
async def create_record(
    actor: str = Form(...), patient_id: str = Form(...), doctor_id: str = Form(""),
    diagnosis: str = Form(...), hasil_lab: str = Form(...), resep_obat: str = Form(...),
    metadata: str = Form(...), file: UploadFile | None = File(None),
):
    c = contract()
    actor = addr(actor)
    me = role_info(c, actor)
    for k, v in (("Diagnosis", diagnosis), ("Hasil lab", hasil_lab), ("Resep obat", resep_obat), ("Metadata", metadata)):
        if not v.strip():
            raise ApiError(f"{k} wajib diisi.", "InvalidInput")
    if len(metadata) > 80:
        raise ApiError("Metadata maksimal 80 karakter (metadata ini publik, jangan isi data sensitif).", "InvalidInput")
    pid, did = b32(patient_id), _doctor_for(c, me, doctor_id)

    payload = {"diagnosis": diagnosis, "hasil_lab": hasil_lab, "resep_obat": resep_obat}
    att_file = None
    if file is not None and file.filename:
        pdf = await file.read()
        if not pdf.startswith(b"%PDF"):
            raise ApiError("Lampiran harus berupa file PDF.", "InvalidInput")
        if len(pdf) > MAX_PDF:
            raise ApiError("Ukuran PDF maksimal 5 MB.", "InvalidInput")
        sha = hashlib.sha256(pdf).hexdigest()
        att_file = STORE / f"{sha}.pdf.enc"
        att_file.write_bytes(cipher().encrypt(pdf))
        payload["lampiran"] = {"nama": Path(file.filename).name, "sha256": sha, "size": len(pdf), "file": att_file.name}

    enc = cipher().encrypt(json.dumps(payload).encode())
    dh = Web3.keccak(enc)
    f = STORE / (hx(dh)[2:] + ".enc")
    f.write_bytes(enc)
    try:
        tx, rc = send_tx(c.functions.createRecord(pid, did, dh, "local://" + f.name, metadata),
                         authority_account(c), "Rekam medis dibuat dan NFT dicetak")
    except ApiError:
        f.unlink(missing_ok=True)
        if att_file:
            att_file.unlink(missing_ok=True)
        raise
    rid = c.events.RecordCreated().process_receipt(rc)[0]["args"]["recordId"]
    return {**tx, "recordId": rid, "dataHash": hx(dh), "attachment": payload.get("lampiran")}


class StatusIn(BaseModel):
    actor: str
    new_status: int
    doctor_id: str = ""


@app.post("/api/records/{record_id}/status")
def update_status(record_id: int, p: StatusIn):
    c = contract()
    actor = addr(p.actor)
    me = role_info(c, actor)
    if p.new_status not in (1, 2, 3):
        raise ApiError("Status baru harus DIAGNOSED, TREATED, atau DISCHARGED.", "InvalidInput")
    did = _doctor_for(c, me, p.doctor_id)
    tx, _ = send_tx(c.functions.updateRecordStatus(record_id, did, p.new_status), authority_account(c),
                    f"Status menjadi {STATUS[p.new_status]}")
    return tx


class TransferIn(BaseModel):
    actor: str
    to: str


@app.post("/api/records/{record_id}/transfer")
def transfer(record_id: int, p: TransferIn):
    c = contract()
    actor, to = addr(p.actor), addr(p.to)
    tx, _ = send_tx(c.functions.transferFrom(actor, to, record_id), actor, f"NFT #{record_id} dipindahkan")
    return tx


# ---------------------------------------------------------
# ENDPOINT: HAK AKSES (dipanggil langsung oleh wallet pasien)
# ---------------------------------------------------------
class AccessIn(BaseModel):
    actor: str
    target_id: str


def _access(p, grant):
    c = contract()
    actor = addr(p.actor)
    me = role_info(c, actor)
    if me["role"] != "patient":
        raise ApiError(ERR["NotPatient"], "NotPatient", 403)
    fn = c.functions.grantAccess if grant else c.functions.revokeAccess
    tx, _ = send_tx(fn(b32(me["id"]), b32(p.target_id)), actor, "Akses diberikan" if grant else "Akses dicabut")
    return tx


@app.post("/api/access/grant")
def grant(p: AccessIn):
    return _access(p, True)


@app.post("/api/access/revoke")
def revoke(p: AccessIn):
    return _access(p, False)


# ---------------------------------------------------------
# ENDPOINT: VERIFIKASI PUBLIK (tujuan QR Code)
# Hanya menjawab: token ada atau tidak, pemilik NFT, metadata publik, dan apakah
# file off-chain masih cocok dengan hash di blockchain. Isi medis TIDAK ikut keluar.
# ---------------------------------------------------------
@app.get("/api/verify/{record_id}")
def verify(record_id: int):
    c = contract()
    try:
        owner = c.functions.getRecordOwner(record_id).call()
    except Exception:
        return {"exists": False, "recordId": record_id}
    integrity = None
    for a, pid in all_patients(c):                       # pembaca agregat: hanya untuk boolean hasil cek
        for r in history_as(c, pid, a):
            if r[0] == record_id:
                f = STORE / r[5].replace("local://", "")
                if f.exists():
                    integrity = bool(c.functions.verifyRecordIntegrity(record_id, Web3.keccak(f.read_bytes()))
                                     .call({"from": a}))
    return {"exists": True, "recordId": record_id, "owner": owner,
            "metadata": c.functions.tokenURI(record_id).call(), "integrity": integrity,
            "contractAddress": c.address, "chainId": w3.eth.chain_id}
