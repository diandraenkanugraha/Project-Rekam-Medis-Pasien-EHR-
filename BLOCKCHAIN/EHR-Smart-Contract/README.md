# MediChain EHR - Rekam Medis Pasien Berbasis Blockchain

Aplikasi pencatatan rekam medis elektronik (EHR) dengan konsensus **Proof of Authority**.
Setiap rekam medis dicetak menjadi **1 NFT (ERC-721)** untuk pasien. Isi medis (diagnosis, hasil lab, resep, PDF)
**dienkripsi dan disimpan off-chain**; blockchain hanya menyimpan ID, metadata publik, **hash data**, status,
hak akses, dan tanda tangan authority.

Proyek Praktikum Blockchain (Modul 06 Tokenisasi, Modul 10 Connect Smart Contract, Modul 11-12 Implementasi UI).

## Arsitektur

```
 Browser (React + Three.js)  --/api-->  FastAPI + Web3.py  --JSON-RPC-->  Hardhat Node
        :5173                               :8000                           :8545
                                              |                               |
                                  offchain_store/ (data medis          EHR.sol (ERC-721)
                                  terenkripsi Fernet)                  deployment.json + artifacts/
```

- **Smart contract:** `contracts/EHR.sol` (Solidity 0.8.28, OpenZeppelin ERC721URIStorage).
- **Backend:** `backend/main.py` - semua pemanggilan kontrak memakai **Web3.py**.
- **Frontend utama:** `frontend/` - React 18, Vite, Tailwind, Framer Motion, React Three Fiber (3D), Recharts.
- **Frontend Modul 10:** `app.py` (Streamlit) tetap tersedia: `streamlit run app.py`.

## Prasyarat

Node.js 18+ (disarankan 20/22), Python 3.10+, dan Git. Semua perintah di bawah untuk PowerShell, dijalankan dari folder root project
(folder yang berisi `hardhat.config.js`).

## Instalasi (sekali saja)

```powershell
# 1. Dependensi Hardhat (root project)
npm install

# 2. Dependensi backend (aktifkan virtual environment dulu)
.venv\Scripts\activate
python -m pip install -r backend\requirements.txt

# 3. Dependensi frontend (DI DALAM folder frontend)
cd frontend
npm install
cd ..
```

## Menjalankan (4 terminal)

| Terminal | Perintah | Hasil yang harus terlihat |
|---|---|---|
| 1 | `npx hardhat node` | daftar 20 akun, node tetap berjalan |
| 2 | `npx hardhat compile` lalu `npx hardhat run scripts/deploy.js --network localhost` | `Deployment berhasil!` dan file `deployment.json` terbentuk |
| 3 | `cd backend` lalu `uvicorn main:app --reload --port 8000` | `Uvicorn running on http://127.0.0.1:8000` |
| 4 | `cd frontend` lalu `npm run dev` | `Local: http://localhost:5173` |

Buka **http://localhost:5173**. Dokumentasi API otomatis ada di http://localhost:8000/docs.

> Setiap kali `hardhat node` di-restart, semua data hilang. Jalankan deploy ulang (terminal 2), lalu refresh browser.
> Alamat kontrak dibaca otomatis dari `deployment.json`, tidak perlu diubah manual.

## Akun uji (Hardhat)

Pemilih akun di pojok kanan atas UI memilih akun yang bertindak sebagai `msg.sender`.

| Akun | Peran awal | Catatan |
|---|---|---|
| #0 `0xf39F...2266` | Authority | deployer, otomatis authority |
| #1, #2, ... | belum terdaftar | didaftarkan lewat menu Registrasi sebagai pasien, dokter, atau RS |

## Skenario demo singkat

1. **Authority** → Registrasi: daftarkan 1 dokter (akun #1) dan 1 pasien (akun #2).
2. Pilih akun **pasien** → Access Management: beri akses ke dokter.
3. Pilih akun **dokter** → Add Medical Record: pilih pasien, isi form, unggah PDF, simpan. NFT #1 tercetak.
4. Buka Medical Record #1: lihat kartu NFT, integritas valid, ubah status.
5. Pilih akun **Authority** → Medical Record: isi terkunci (sesuai aturan kontrak).
6. Buka **Verifikasi** (atau scan QR pada kartu NFT) → hasil VALID.

## Halaman

Dashboard, Registrasi, Patient List, Patient Detail, Medical Record (daftar dan detail), Add Medical Record,
Access Management, Wallet & Transaction, Verifikasi (publik). Menu menyesuaikan peran akun aktif
(Authority, Dokter/RS, Pasien).

## Troubleshooting

| Pesan / gejala | Penyebab | Solusi |
|---|---|---|
| Backend tidak dapat dihubungi | `uvicorn` belum jalan | jalankan terminal 3 |
| Tidak dapat terhubung ke Hardhat Network | node mati | jalankan `npx hardhat node` |
| File deployment.json tidak ditemukan | belum deploy | jalankan deploy (terminal 2) |
| Artifact smart contract tidak ditemukan | belum compile | `npx hardhat compile` |
| Tidak ada kontrak di alamat pada deployment.json | node di-restart | deploy ulang, lalu refresh |
| `Could not open requirements file` | perintah dijalankan di folder salah | jalankan dari root project |
| `npm install` menampilkan banyak vulnerabilities | alat bantu Hardhat | abaikan; jangan pakai `npm audit fix --force` |
| Profil pasien "tidak ditemukan" | profil off-chain ada di komputer lain | wajar; data on-chain tetap tampil |

## Catatan keamanan dan keterbatasan

- Proyek ini untuk **pembelajaran di jaringan lokal**. Kunci akun Hardhat bersifat publik; jangan dipakai di jaringan sungguhan.
- `createRecord` dan `updateRecordStatus` di kontrak bersifat `onlyAuthority` (PoA). Saat dokter mengisi form, backend
  meneruskan transaksi lewat akun Authority; kontrak tetap memeriksa dokter terverifikasi dan izin akses pasien.
- Authority **tidak** otomatis boleh membaca isi rekam medis (`getRecord` memakai `msg.sender`).
- Profil pasien (nama, alamat) disimpan terenkripsi di `offchain_store/profiles/` karena kontrak hanya menyimpan hash profil.
- Backend membaca riwayat tiap pasien sebagai agregator untuk angka di Dashboard dan hasil verifikasi publik (hanya angka/boolean, bukan isi medis).
- Folder `offchain_store/` berisi data terenkripsi dan file `.key`. **Jangan di-commit.**
- Argumen registrasi (nama, NIK, alamat) tetap terlihat di calldata transaksi, dan hash NIK 16 digit bisa ditebak lewat brute force.
  `tokenURI` (metadata) bersifat publik, jadi hanya berisi informasi non-sensitif.
