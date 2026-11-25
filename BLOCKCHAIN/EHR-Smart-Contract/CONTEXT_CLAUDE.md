# CONTEXT PROYEK — EHR Blockchain (Rekam Medis Pasien, PoA + NFT ERC-721)

> Dokumen ini adalah ringkasan lengkap project untuk diberikan ke Claude (project knowledge / chat).
> Tulis dalam Bahasa Indonesia, istilah teknis tetap Inggris. Semua path relatif ke root project.

---

## 1. Ikhtisar

Sistem **Rekam Medis Pasien (EHR)** berbasis blockchain dengan konsensus **Proof of Authority (PoA)**.
Setiap rekam medis ditokenisasi menjadi **1 NFT ERC-721**; `tokenId == recordId` dan NFT di-mint ke wallet pasien.

Prinsip utama:
- **Data medis sensitif TIDAK pernah masuk blockchain.** Data dienkripsi (Fernet/AES) dan disimpan off-chain di folder lokal `offchain_store/`.
- On-chain hanya: hash data, referensi off-chain (`local://<file>.enc`), metadata non-sensitif, status, timestamp, dan daftar akses.
- Identitas pasien disimpan sebagai hash (`nikHash`, `profileHash`), bukan plaintext.
- Akses data dikendalikan **oleh pasien** lewat `grantAccess` / `revokeAccess`.
- "Authority" adalah representasi node PoA di level kontrak (`isAuthority`), hanya authority yang boleh registrasi dan menulis rekam medis.

Ini project praktikum/tugas (materi Modul 05 Smart Contract II), dijalankan full lokal di Windows.

---

## 2. Stack & Versi (terverifikasi dari environment)

| Komponen | Versi / Detail |
|---|---|
| Node/Hardhat | hardhat `^2.29.1`, `@nomicfoundation/hardhat-ethers ^3.1.3`, `hardhat-toolbox ^7.0.0`, `ethers ^6.17.0` |
| Solidity | pragma `^0.8.24`, dikompilasi dengan `0.8.28`, `evmVersion: cancun`, optimizer 200 runs |
| OpenZeppelin | `@openzeppelin/contracts ^5.6.1` (ERC721URIStorage) |
| Frontend | Streamlit `1.66.1` (Python `3.14.7`), `streamlit.components.v2` + fallback `st.iframe` |
| Web3 | `web3.py 8.0.0`, RPC `http://127.0.0.1:8545` |
| Enkripsi | `cryptography` / `Fernet` (opsional — app menampilkan error jika tidak terpasang) |
| Dataframe | `pandas` |
| Wallet | MetaMask via custom component (hanya untuk memilih `msg.sender`) |
| Jaringan | Hardhat Network lokal, `chainId 31337`, akun unlocked bawaan Hardhat |

Catatan: **tidak ada `requirements.txt`** — dependency Python ada di `.venv/` (venv lokal).

---

## 3. Struktur Folder

```
blockchain/
├─ contracts/
│  ├─ EHR.sol                 # KONTRAK UTAMA (459 baris) — seluruh logika sistem
│  └─ Lock.sol                # sisa template Hardhat, tidak dipakai
├─ scripts/
│  └─ deploy.js               # deploy EHR, tulis alamat ke deployment.json
├─ test/
│  └─ Lock.js                 # sisa template, TIDAK menguji EHR
├─ ignition/modules/Lock.js   # sisa template, tidak dipakai
├─ hardhat.config.js          # solidity 0.8.28 + network localhost (31337)
├─ package.json               # deps JS (nama project masih "blockchain")
├─ deployment.json            # {contractName, address, network, chainId} hasil deploy
├─ EHR_abi.json               # salinan ABI (72 entri) — app TIDAK memakainya
├─ app.py                     # UI Streamlit (705 baris) — seluruh frontend + enkripsi
├─ offchain_store/            # "database" off-chain: file *.enc + .key (kunci Fernet)
├─ artifacts/                 # hasil hardhat compile (sumber ABI untuk app)
│  └─ contracts/EHR.sol/EHR.json
├─ cache/                     # cache hardhat
├─ dokumentasi/               # screenshot bukti demo (+ subfolder flowchart/)
├─ poster-ehr-blockchain-poa.png
├─ README.md                  # masih boilerplate Hardhat (belum ditulis ulang)
├─ EHR_Blockchain_Flowchart_Context.md   # spesifikasi flowchart 8 fungsi
├─ EHR_Blockchain_Pseudocode.md / .txt   # pseudocode kontrak
├─ pseudocode-ehr-blockchain-.md         # pseudocode versi bahasa natural
├─ Modul_05_Smart_Contract_II_Claude_Context.md  # materi modul (referensi kode)
└─ .venv/                     # virtualenv Python
```

App membaca ABI dari `artifacts/contracts/EHR.sol/EHR.json`, dan alamat dari `deployment.json`.
`EHR_abi.json` hanya duplikat manual (tidak direferensikan kode).

---

## 4. Arsitektur & Alur Data

```
[Streamlit app.py]
   │  (1) baca form, validasi ringan, enkripsi data medis
   ├─► Fernet.encrypt(JSON{diagnosis, hasil_lab, resep_obat})  → offchain_store/<keccak(enc)>.enc
   │   data_hash = keccak256(ciphertext)
   │
   ├─ (2) transact({"from": actor})  ──► Hardhat Network (akun unlocked, tanpa private key di app)
   │        createRecord(patientId, doctorId, dataHash, "local://<file>.enc", metadata)
   │
   └─ (3) membaca: getRecord / getStatusHistory → ambil file .enc → keccak → verifyRecordIntegrity
             → jika cocok → decrypt → tampilkan diagnosis/lab/resep
```

Peran per komponen:
- **Kontrak** = otoritas kebenaran: siapa terdaftar, siapa punya akses, status record, hash, kepemilikan NFT.
- **App** = orkestrator: enkripsi/dekripsi, simpan file, kirim transaksi, tampilkan ledger event.
- **MetaMask** = hanya memilih akun aktif (`actor`); transaksi ditandatangani oleh akun unlocked Hardhat node. Wallet di luar akun bawaan Hardhat ditolak dengan pesan informatif.

---

## 5. Smart Contract `contracts/EHR.sol`

`contract EHR is ERC721URIStorage` — nama token `"EHR Medical Record"`, simbol `"EHR"`.

### 5.1 Enum
- `Role { NONE, DOCTOR, HOSPITAL }` — nilai numerik: 0/1/2 (app mengirim `1` untuk dokter, `2` untuk RS).
- `RecordStatus { ADDED, DIAGNOSED, TREATED, DISCHARGED }` — urutan = urutan transisi (0→1→2→3).

### 5.2 Struct
- `PatientInput { nama, nik, tglLahir, alamat, golDarah, noTelepon }` — dibungkus agar tidak "stack too deep".
- `Patient { bytes32 id, address wallet, bytes32 nikHash, bytes32 profileHash, uint256 registeredAt }`
- `Entity { bytes32 id, address wallet, Role role, string nama, string nomorIzin, string detail, bool verified, uint256 registeredAt }`
- `MedicalRecord { uint256 id, bytes32 patientId, bytes32 doctorId, string metadata, bytes32 dataHash, string offChainRef, RecordStatus status, uint256 createdAt, uint256 updatedAt }`
- `StatusChange { RecordStatus previousStatus, RecordStatus newStatus, bytes32 doctorId, uint256 timestamp }`

Urutan field `MedicalRecord` dipakai app sebagai indeks tuple: `rec[0]=id, [1]=patientId, [2]=doctorId, [3]=metadata, [4]=dataHash, [5]=offChainRef, [6]=status, [7]=createdAt, [8]=updatedAt`.

### 5.3 State
| Nama | Tipe | Keterangan |
|---|---|---|
| `owner` | `address public` | deployer; otomatis jadi authority pertama |
| `nextTokenId` | `uint256 private = 1` | `tokenId == recordId` |
| `isAuthority` | `mapping(address=>bool) public` | node PoA |
| `patients` | `mapping(bytes32=>Patient) private` | key = patientId |
| `entities` | `mapping(bytes32=>Entity) private` | key = entityId |
| `nikRegistered` | `mapping(bytes32=>bool)` | keccak(NIK) |
| `licenseRegistered` | `mapping(bytes32=>bool)` | keccak(nomor_izin) |
| `patientIdOf` | `mapping(address=>bytes32) public` | wallet → patientId (0x0 = belum) |
| `entityIdOf` | `mapping(address=>bytes32) public` | wallet → entityId |
| `records` | `mapping(uint256=>MedicalRecord) private` | |
| `statusHistory` | `mapping(uint256=>StatusChange[]) private` | |
| `patientRecordIds` | `mapping(bytes32=>uint256[]) private` | urutan record per pasien |
| `accessActive` | `mapping(bytes32=>mapping(bytes32=>bool)) private` | `[patientId][targetId]` |

### 5.4 Event (audit trail)
`AuthorityAdded`, `AuthorityRemoved`, `PatientRegistered`, `EntityRegistered`, `RecordCreated`, `RecordStatusUpdated`, `AccessGranted`, `AccessRevoked` (+ event `Transfer` bawaan ERC-721).

### 5.5 Custom Error (dipetakan ke pesan Indonesia di `app.py`)
`NotOwner`, `NotAuthority`, `InvalidInput(string field)`, `InvalidAddress`, `WalletAlreadyUsed`, `PatientAlreadyRegistered`, `EntityAlreadyRegistered`, `PatientNotFound`, `DoctorNotFound`, `EntityNotFound`, `RecordNotFound`, `AccessDenied`, `NotPatient`, `InvalidTarget`, `AccessAlreadyActive`, `NoActiveAccess`, `InvalidStatusTransition(from,to)`, `NoHistory`.

### 5.6 Modifier
- `onlyOwner` → `msg.sender == owner`
- `onlyAuthority` → `isAuthority[msg.sender]`

### 5.7 Daftar Fungsi

| Fungsi | Akses | Perilaku inti |
|---|---|---|
| `constructor()` | — | set `owner`, `isAuthority[deployer]=true`, emit `AuthorityAdded` |
| `addAuthority(address)` | owner | tolak address(0) |
| `removeAuthority(address)` | owner | `require(addr != owner)`, pakai string require (bukan custom error) |
| `registerPatient(address _wallet, PatientInput)` | authority | validasi field wajib, NIK **tepat 16 karakter**, NIK unik, wallet belum dipakai peran lain; `patientId = keccak256(nikHash + block.timestamp)`; `profileHash = keccak(nama,tglLahir,alamat,golDarah,noTelepon)` |
| `registerEntity(address _wallet, nama, nomorIzin, detail, Role)` | authority | role hanya DOCTOR/HOSPITAL, nomor izin unik, wallet belum dipakai; `entityId = keccak(licenseHash + timestamp)`; `verified = true` otomatis |
| `createRecord(patientId, doctorId, dataHash, offChainRef, metadata)` | authority | doctor harus DOCTOR + verified, patient harus ada, **akses pasien→dokter harus ACTIVE**, dataHash ≠ 0, offChainRef tidak kosong; `recordId = nextTokenId++`; simpan record `status=ADDED`; push ke `patientRecordIds`; **mint NFT ke wallet pasien** dengan `metadata` sebagai tokenURI |
| `updateRecordStatus(recordId, doctorId, newStatus)` | authority | record ada, doctor valid + punya akses aktif; transisi **hanya boleh maju satu langkah** (`uint8(new) == uint8(current)+1`); catat `StatusChange`; update `updatedAt` |
| `grantAccess(patientId, targetId)` | **wallet pasien sendiri** | `patientIdOf[msg.sender] == patientId`, target harus entity terdaftar, tidak boleh sudah aktif |
| `revokeAccess(patientId, targetId)` | **wallet pasien sendiri** | harus ada akses aktif |
| `hasAccess(targetId, patientId)` | publik (view) | **urutan argumen: target dulu, patient kedua** |
| `getRecord(recordId)` | `_canRead` | kembalikan struct lengkap |
| `getRecordOwner(tokenId)` | publik | `ownerOf`, tanpa cek akses (kepemilikan NFT publik) |
| `verifyRecordIntegrity(recordId, offChainDataHash)` | `_canRead` | bandingkan hash |
| `getStatusHistory(recordId)` | `_canRead` | array `StatusChange` |
| `getPatientHistory(patientId)` | `_canRead` | semua record pasien urut ASC; **revert `NoHistory` jika kosong** |
| `getEntity(entityId)` | publik | data dokter/RS |
| `mint(to, tokenId, metadataURI)` | internal | `_safeMint` + `_setTokenURI` |
| `transferFrom` | ERC-721 bawaan | dipakai tab "Transfer NFT" |

### 5.8 Aturan akses baca (`_canRead`)
Pemanggil boleh membaca jika:
1. `patientIdOf[caller] == patientId` (pasien pemilik), **atau**
2. caller punya `entityIdOf[caller]` dan `accessActive[patientId][entityId] == true`.

Asimetri yang perlu diingat:
- RS (HOSPITAL) bisa diberi akses baca, **tapi tidak bisa** `createRecord`/`updateRecordStatus` (keduanya mensyaratkan `Role.DOCTOR`).
- Satu wallet hanya boleh satu peran (pasien ATAU entity ATAU authority).
- `transferFrom` hanya memindahkan NFT; **hak akses tetap menempel pada patientId**, bukan pada pemilik token.

### 5.9 Deployment
- `deployment.json` saat ini: `{ "contractName": "EHR", "address": "0x5FbDB2315678afecb367f032d93F642f64180aa3", "network": "localhost", "chainId": 31337 }` (alamat deterministik deploy pertama di Hardhat).
- Jika node di-restart, alamat bisa berubah → app mendeteksi `get_code == 0x` dan menyuruh deploy ulang.

---

## 6. Frontend `app.py`

Satu file, dieksekusi top-down oleh Streamlit. Bagian penting:

### 6.1 Konfigurasi & bootstrap
- Konstanta: `RPC_URL`, `DEPLOYMENT_PATH`, `ARTIFACT_PATH`, `STORE = offchain_store/`, `STATUS = ["ADDED","DIAGNOSED","TREATED","DISCHARGED"]`, `ZERO32`.
- CSS besar (tema dark "medchain": Orbitron/Exo 2, glassmorphism, animasi aurora) via `st.markdown(..., unsafe_allow_html=True)`.
- `HERO`: iframe three.js (untaian blok + heliks DNA + ECG) dengan `__N__` diganti jumlah record (min 8, max 14).
- Komponen wallet: `components.component(name="ehr_metamask_wallet", html, css, js)` — JS mengirim state `{wallet:{address,chainId,connected}}`.
- Status sidebar: RPC hidup/mati, ABI siap, deployment.json siap, alamat kontrak, nama/simbol/owner.
- Jika RPC mati / deployment / ABI hilang / kontrak tidak ada di alamat → `st.error` + `st.stop()`.

### 6.2 Helper
| Helper | Fungsi |
|---|---|
| `logo(id)` | SVG logo hexagon + cross (gradient unik per `id`) |
| `hx(b)` | bytes/hash → string `0x...` |
| `b32(s)` | hex string → bytes32 |
| `short(v)` | potong hash untuk tampilan |
| `when(ts)` | timestamp → `"dd Mon YYYY, HH:MM:SS"` |
| `load_abi()` / `load_deployment()` | baca artifact & deployment.json |
| `cipher()` | Fernet dari `offchain_store/.key`; **generate kunci jika belum ada** |
| `explain(e)` | parse custom error / selector 4-byte → pesan Indonesia dari `ERR` |
| `ledger()` | ambil log 8 event (+`Transfer`) dari block 0, urut blok desc |
| `role_of(a)` | "Authority" / "Pasien" / "Dokter X" / "RS X" / "Belum terdaftar" (di-cache di `_roles`) |
| `lab(a)` | label akun = `role · 0xabc…1234` |
| `pid_of(a)` / `eid_of(a)` | patientId / entityId per wallet |
| `send(fn, label, extra)` | jalankan `fn.transact({"from": actor})`, tunggu receipt (timeout 30s), set `flash` message + tx hash, `st.rerun()`; error → `explain()` |

`ERR` memetakan 18 nama error kontrak + 2 error ERC-721 ke kalimat Indonesia (mis. `NotAuthority` → "Validasi konsensus gagal: akun ini bukan authority.").

### 6.3 Dompet & peran aktif
- Kolom kiri: komponen MetaMask. Jika terhubung: cek chainId harus sama dengan chain app; tampilkan saldo + peran; wallet non-Hardhat → caption "belum bisa dipakai menandatangani".
- Kolom kanan: `selectbox "Bertindak sebagai"` berisi **20 akun unlocked Hardhat** (`w3.eth.accounts`), label `lab`. Ini yang jadi `msg.sender`.
- Jika MetaMask terhubung ke akun Hardhat, `actor` otomatis diset ke akun itu.

### 6.4 Statistik & alur
5 sel: blok terbaru, jumlah pasien, jumlah dokter+RS, jumlah record, chainId (dihitung dari event, bukan state contract). Di bawahnya strip alur 5 langkah: Input → Validasi kontrak → Authority menandatangani → Blok ditambahkan → NFT dicetak.

### 6.5 Lima tab
1. **Registrasi** (authority saja): form pasien (wallet, nama, NIK 16 digit — divalidasi `isdigit`), form dokter/RS (role radio → kirim `1`/`2`).
2. **Rekam medis**:
   - *Buat*: pilih pasien+dokter, isi diagnosis/hasil lab/resep → enkripsi JSON → tulis `offchain_store/<hash>.enc` → `createRecord(...)`; **jika tx gagal, file .enc dihapus** (rollback manual).
   - *Perbarui status*: `number_input` token ID, pilih dokter, status baru dari `[1,2,3]` (tidak boleh kembali ke ADDED).
   - *Transfer NFT*: `transferFrom(actor, to, tokenId)`.
3. **Hak akses**: pilih pasien + dokter/RS, tampilkan status AKTIF/tidak, tombol Beri/Cabut akses (dikirim atas nama `actor` — harus wallet pasien). Butuh `hasAccess(tid, pid)`.
4. **Baca dan verifikasi**: `getRecord` + `getRecordOwner` + `getStatusHistory` → kartu NFT 3D CSS + detail; lalu baca file .enc, hitung `keccak`, panggil `verifyRecordIntegrity(rid, hash)`; jika cocok & Fernet ada → decrypt & tampilkan 3 field. Sub-bagian "Riwayat pasien" → `getPatientHistory` ke dataframe.
5. **Ledger**: dataframe seluruh event, terbaru di atas.

---

## 7. Cara Menjalankan

```powershell
# 1. Terminal 1 — node blockchain lokal (biarkan hidup)
npx hardhat node

# 2. Terminal 2 — compile + deploy (menulis deployment.json)
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost

# 3. Jalankan UI
.venv\Scripts\streamlit run app.py
```

- Deployer = akun #0 Hardhat → menjadi `owner` + `authority` pertama.
- Akun #1..#19 unlocked, saldo 10.000 ETH, bisa dipakai langsung sebagai `msg.sender`.
- Setelah deploy ulang cukup refresh halaman Streamlit (alamat dibaca otomatis).
- Jika MetaMask dipakai: tambahkan jaringan `http://127.0.0.1:8545`, chainId `31337`, lalu import private key akun Hardhat yang ditampilkan `npx hardhat node`.

---

## 8. Skenario Demo End-to-End

1. **Actor = akun #0** (authority). Tab Registrasi → daftarkan pasien (akun #1) dan dokter (akun #2, nomor izin `STR-3209-0001`), opsional RS (akun #3).
2. **Actor = akun #1** (pasien). Tab Hak akses → pilih dokter #2 → **Beri akses**.
3. **Actor = akun #2** (dokter). Tab Rekam medis → pilih pasien #1 + dokter #2 → isi diagnosis/lab/resep → **Simpan dan cetak NFT** → dapat Token ID 1.
4. **Actor = akun #2**. Perbarui status → `DIAGNOSED` → `TREATED` → `DISCHARGED` (satu langkah per transaksi).
5. **Actor = akun #1 atau #2**. Tab Baca → Token ID 1 → kartu NFT + "Integritas terverifikasi" + data terdekripsi.
6. **Actor = akun #4** (belum terdaftar) → mencoba baca → "Akses ditolak: akun ini tidak punya hak akses…".
7. **Actor = akun #1**. Cabut akses dokter → dokter tidak bisa lagi membuat/membaca record.
8. Tab Ledger → seluruh jejak audit event.

Contoh nilai form default di app: NIK `3209012345670001`, nama "Siti Aminah", dokter "dr. Hamdan, M.Kom", metadata "Rawat Jalan - Poli Umum".

---

## 9. Batasan & Hal yang Belum Selesai (jujur)

- `README.md` **masih boilerplate Hardhat**, belum menjelaskan project ini.
- Tidak ada `requirements.txt` / `pyproject.toml`; dependency Python hanya ada di `.venv/`.
- **Test kontrak EHR belum ada** — `test/Lock.js` hanya menguji `Lock.sol` (sisa template). `contracts/Lock.sol`, `ignition/modules/Lock.js` juga sisa template.
- `deployment.json` menunjuk alamat deploy pertama; restart node tanpa deploy ulang membuat app menolak jalan.
- Kunci Fernet disimpan plain di `offchain_store/.key` dan file `.key`/`.enc` tidak di-`.gitignore` → **hanya untuk demo, bukan produksi**.
- Metadata `metadata` dikirim sebagai tokenURI NFT, jadi tidak boleh berisi data sensitif (hanya keterangan publik seperti "Rawat Jalan - Poli Umum").
- "PoA" di sini disimulasikan di level kontrak (`isAuthority`); tidak ada konsensus node nyata, tidak ada signature manual — Hardhat Network yang menandatangani.
- App memakai akun unlocked (`transact({"from": actor})`), jadi tidak ada manajemen private key. MetaMask hanya memilih akun.
- `EHR_abi.json` duplikat ABI yang tidak dipakai kode (sumber sebenarnya: `artifacts/.../EHR.json`).
- `addAuthority`/`removeAuthority` belum ada di UI; hanya bisa lewat console Hardhat.
- Tidak ada fitur hapus/amend record (immutable by design) dan tidak ada paginasi ledger.
- Project ini bukan git repo (hanya ada `.gitignore`).

---

## 10. Terminologi & Konvensi

| Istilah | Arti |
|---|---|
| Authority | wallet yang `isAuthority == true`; wajib untuk registrasi & tulis record |
| patientId | `keccak256(keccak256(NIK) ++ block.timestamp)`, bytes32 |
| entityId | `keccak256(keccak256(nomor_izin) ++ block.timestamp)`, bytes32 |
| recordId / Token ID | sama; mulai dari 1, increment |
| offChainRef | `"local://<keccak(ciphertext)>.enc"` |
| dataHash | `keccak256(ciphertext)` — dibandingkan saat verifikasi integritas |
| `ADDED → DIAGNOSED → TREATED → DISCHARGED` | transisi status, hanya maju satu langkah |
| `verified` | entity yang didaftarkan authority selalu `true` |

---

## 11. Prompt Pembuka untuk Claude

> Saya punya project lokal bernama **EHR Blockchain**: smart contract Solidity `EHR.sol` (PoA + NFT ERC-721 untuk rekam medis), frontend Streamlit `app.py` dengan web3.py + MetaMask, enkripsi off-chain Fernet, dan Hardhat Network lokal (chainId 31337). Konteks lengkapnya ada di dokumen ini (stack, struktur folder, semua fungsi kontrak beserta guard-nya, isi 5 tab UI, cara menjalankan, skenario demo, dan batasan yang diketahui).
>
> Jawab dalam Bahasa Indonesia. Anggap kode yang ada sebagai sumber kebenaran; jika saranku bertentangan dengan kontrak, sebutkan konfliknya. Jangan mengarang nama fungsi/field yang tidak ada di dokumen ini.
>
> Tugas saya: **[tulis di sini — mis. "review keamanan kontrak", "tambahkan test Hardhat untuk EHR.sol", "buat fitur X di tab Y", "tulis laporan praktikum"]**.
