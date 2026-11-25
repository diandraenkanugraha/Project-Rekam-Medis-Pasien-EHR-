# Dokumen Pengumpulan Modul 11-12 - Implementasi UI (EHR Blockchain)

Isi dokumen: (1) pemenuhan ketentuan modul, (2) penjelasan fungsi tiap halaman dan hubungannya dengan smart contract,
(3) daftar screenshot, (4) naskah video demo, (5) merapikan repository dan ceklis pengumpulan.
Tulis ulang bagian penjelasan dengan bahasamu sendiri sebelum dikumpulkan.

---

## 1. Alur data singkat

```
Halaman React  -->  endpoint FastAPI (/api/...)  -->  Web3.py  -->  fungsi smart contract EHR.sol
```

Browser tidak pernah berbicara langsung ke blockchain. Semua pembacaan dan transaksi dilakukan backend memakai **Web3.py**,
dengan ABI dari `artifacts/contracts/EHR.sol/EHR.json` dan alamat dari `deployment.json` (hasil `scripts/deploy.js`).

## 2. Pemenuhan ketentuan modul

| Ketentuan modul | Pemenuhan |
|---|---|
| Dashboard: nama proyek, status koneksi, info ringkas | Halaman Dashboard (status Hardhat, chain ID, alamat kontrak, jumlah pasien/dokter/rekam medis/izin akses, grafik) |
| Data Management: tabel/daftar dari smart contract | Patient List dan Medical Record |
| Form Input | Registrasi (pasien, dokter/RS) dan Add Medical Record |
| Detail Data berdasarkan ID | Patient Detail (`/patients/:id`) dan Record Detail (`/records/:id`) |
| Wallet & Transaction | Halaman Wallet & Transaction |
| Web3.py | Seluruh interaksi kontrak ada di `backend/main.py` |
| ABI dan alamat kontrak sendiri | `artifacts/.../EHR.json` dan `deployment.json` |
| Data bukan dummy | Semua daftar dan detail dibaca dari kontrak (state, bukan event) |
| Form punya validasi | NIK 16 digit, telepon, tanggal, wallet, panjang teks, PDF (tipe, ukuran, isi) |
| Minimal satu fungsi kontrak dapat dipanggil dari UI | 7 fungsi tulis (lihat tabel di bagian 3) |
| Hasil transaksi ditampilkan | Notifikasi Menunggu konfirmasi / Berhasil (tx hash, blok, gas) / Gagal (pesan error) dan log di halaman Wallet |
| Tanpa event monitoring | Riwayat on-chain dibaca dari blok dan receipt, bukan dari event |

## 3. Fungsi tiap halaman dan hubungan dengan smart contract

| Halaman | Fungsi halaman | Fungsi kontrak yang dipakai |
|---|---|---|
| **Dashboard** | Ringkasan sistem: status koneksi, statistik, grafik status rekam medis dan aktivitas per blok, rantai blok 3D dari blok asli, jaringan peran 3D | `name`, `symbol`, `owner`, `patientIdOf`, `entityIdOf`, `getEntity`, `getPatientHistory`, `hasAccess`; data blok dari `eth_getBlock` |
| **Registrasi** | Authority mendaftarkan pasien dan dokter/RS dengan validasi form | `registerPatient`, `registerEntity` (keduanya `onlyAuthority`) |
| **Patient List** | Tabel pasien yang boleh dilihat akun aktif (Authority: semua; dokter: yang memberi izin; pasien: dirinya) | `patientIdOf`, `balanceOf`, `getPatientHistory`, `hasAccess` |
| **Patient Detail** | Profil dasar, statistik, tab Riwayat Pemeriksaan, Informasi Medis, dan Izin Akses | `patientIdOf`, `getPatientHistory` (memakai `msg.sender`), `hasAccess`, `getEntity`, `balanceOf` |
| **Medical Record** | Daftar rekam medis sebagai kartu NFT; Authority hanya melihat info publik NFT (terkunci) | `getPatientHistory`, `getRecordOwner`, `tokenURI` |
| **Record Detail** | Kartu NFT 3D dengan QR, bukti integritas, data medis terdekripsi, lampiran PDF, riwayat status, info blockchain; memajukan status dan transfer NFT | `getRecord`, `getStatusHistory`, `getRecordOwner`, `tokenURI`, `verifyRecordIntegrity`, `updateRecordStatus`, `transferFrom` |
| **Add Medical Record** | Form pemeriksaan dengan indikator izin akses, unggah PDF (hash SHA-256 dihitung di browser), pratinjau NFT | `hasAccess`, `createRecord` (cek dokter terverifikasi, pasien ada, izin aktif, hash tidak nol, lalu `_safeMint` ke wallet pasien) |
| **Access Management** | Pasien memberi/mencabut izin dokter dan RS lewat saklar; Authority dan dokter melihat matriks izin | `grantAccess`, `revokeAccess`, `hasAccess` |
| **Wallet & Transaction** | Wallet aktif (alamat, saldo, NFT), info jaringan, log transaksi sesi ini, dan riwayat on-chain | `balanceOf`; blok dan receipt dari node |
| **Verifikasi** (publik) | Cek keberadaan dan keutuhan rekam medis lewat Token ID atau QR Code; isi medis tidak ditampilkan | `getRecordOwner`, `tokenURI`, `verifyRecordIntegrity` |

### Poin desain yang perlu bisa kamu jelaskan

1. **Mengapa dokter mengisi form tetapi transaksi ditandatangani Authority.** Di kontrak, `createRecord` dan
   `updateRecordStatus` bersifat `onlyAuthority` (konsep PoA: authority node yang menandatangani blok). Backend meneruskan
   form dokter lewat akun Authority, sedangkan kontrak tetap memeriksa dokter terverifikasi dan izin akses pasien.
2. **Mengapa Authority tidak bisa membaca isi rekam medis.** `getRecord` memeriksa `msg.sender`: hanya pasien pemilik data atau
   dokter/RS dengan izin aktif. Ini terlihat di UI sebagai gembok.
3. **Mengapa data medis tidak ada di blockchain.** Data sensitif dienkripsi (Fernet) dan disimpan off-chain; kontrak hanya menyimpan
   hash (`keccak256` dari file terenkripsi). Halaman Record Detail menghitung ulang hash itu untuk menampilkan Integritas valid/tidak valid.
4. **Mengapa transfer NFT tidak memindahkan hak baca.** Hak akses melekat pada `patientId`, bukan pada pemilik token. Pemilik baru
   NFT tidak otomatis boleh membaca isi rekam medis.
5. **Mengapa tidak memakai event.** Modul melarang event monitoring, jadi daftar disusun dari state kontrak (loop akun, `getRecordOwner`
   berurutan sampai gagal) dan riwayat transaksi dibaca dari blok.

## 4. Daftar screenshot (minimal 4; di bawah 8 yang disarankan)

Siapkan data dulu mengikuti skenario di naskah video. Simpan dengan nama berurutan.

| No | File | Halaman | Akun aktif | Yang harus terlihat |
|---|---|---|---|---|
| 1 | `01_dashboard.png` | Dashboard | Authority | rantai blok 3D, 5 kartu statistik, grafik, jaringan peran |
| 2 | `02_registrasi_sukses.png` | Registrasi | Authority | form terisi, notifikasi Transaksi berhasil, kartu ID pasien |
| 3 | `03_patient_list.png` | Patient List | Authority | tabel pasien dengan kolom rekam, NFT, izin akses |
| 4 | `04_add_record.png` | Add Medical Record | Dokter | indikator izin akses hijau, PDF dengan hash, pratinjau NFT |
| 5 | `05_record_detail.png` | Record Detail | Dokter atau Pasien | kartu NFT dengan QR, Integritas valid, data medis |
| 6 | `06_access_management.png` | Access Management | Pasien | saklar AKSES AKTIF dan notifikasi |
| 7 | `07_wallet_onchain.png` | Wallet & Transaction (tab on-chain) | siapa saja | riwayat transaksi dari Deploy sampai terbaru |
| 8 | `08_verifikasi.png` | Verifikasi | siapa saja | banner Rekam medis VALID |

Bonus yang bagus untuk laporan: Record Detail saat dibuka Authority (Akses ditolak/terkunci) sebagai bukti aturan privasi,
dan form Registrasi dengan pesan validasi.

## 5. Naskah video demo (target 4:30, maksimal 5:00)

### Persiapan sebelum merekam

1. Restart `npx hardhat node`, lalu deploy ulang. Hapus isi `offchain_store\profiles` dan file `*.enc` agar data bersih.
2. Siapkan 1 file PDF kecil (mis. `hasil-lab.pdf`).
3. Browser layar penuh, zoom 100%, sembunyikan bookmark. Rekam dengan Xbox Game Bar (Win+G) atau OBS, resolusi 1080p.
4. Data yang akan diketik:
   - Dokter (Akun #1): `dr. Hamdan, M.Kom` | STR `STR-3209-0001` | `Spesialis Penyakit Dalam`
   - Pasien (Akun #2): `Siti Aminah` | NIK `3209012345670001` | lahir `2001-05-17` | gol. darah `O` | `Jl. Pemuda No. 12 Cirebon` | `081234567890`
   - Rekam medis: diagnosis `Hipertensi stadium 1` | lab `Tekanan darah 150/95 mmHg` | resep `Amlodipine 5 mg 1x1` | metadata `Rawat Jalan - Poli Umum`

### Adegan

| Waktu | Akun | Yang dilakukan di layar | Contoh narasi (tulis ulang dengan bahasamu) |
|---|---|---|---|
| 0:00-0:25 | Authority | Dashboard: arahkan kursor ke rantai blok 3D, jaringan peran, status Hardhat online | "Ini MediChain, aplikasi rekam medis berbasis blockchain dengan Proof of Authority. Backend memakai Web3.py, tampilan memakai React dan Three.js. Rantai blok ini dibuat dari blok asli jaringan." |
| 0:25-1:05 | Authority | Registrasi: klik Daftarkan dengan NIK `123` untuk menunjukkan validasi, perbaiki, daftarkan dokter lalu pasien | "Hanya authority yang boleh mendaftar. Form punya validasi. Setiap pendaftaran menjadi transaksi dan tercatat di blok baru." |
| 1:05-1:30 | Authority | Patient List: tunjukkan pasien baru, klik untuk membuka Patient Detail | "Daftar ini dibaca langsung dari smart contract, bukan data dummy." |
| 1:30-1:55 | Pasien | Ganti akun ke Siti. Access Management: nyalakan saklar dokter, tunjukkan notifikasi | "Pasien pemilik data. Hanya pasien yang bisa memberi izin, dan izin dicatat di blockchain." |
| 1:55-2:50 | Dokter | Ganti akun ke dr. Hamdan. Add Medical Record: pilih pasien, tunjukkan indikator izin hijau, isi form, unggah PDF (tunjukkan hash), klik Simpan, tunjukkan langkah transaksi dan hasil NFT #1 | "Data dienkripsi di luar rantai. Yang masuk blockchain adalah hash-nya. Hash PDF dihitung otomatis di browser. Setelah transaksi, NFT dicetak untuk pasien." |
| 2:50-3:35 | Dokter | Buka Record Detail #1: putar kartu NFT 3D, tunjukkan Integritas valid, data medis, tab Riwayat Status, klik Tandai DIAGNOSED, tab Blockchain | "Kartu NFT ini mewakili rekam medis. Integritas dihitung dengan membandingkan hash file dengan hash di blockchain. Status hanya boleh maju satu langkah." |
| 3:35-4:00 | Authority | Medical Record: tunjukkan gembok. Buka Record Detail #1 untuk menunjukkan Akses ditolak | "Authority tidak otomatis boleh membaca isi rekam medis. Aturan ini ditegakkan oleh kontrak." |
| 4:00-4:20 | Siapa saja | Verifikasi: buka `/verify/1` (atau pindai QR), tunjukkan VALID | "Halaman publik ini hanya menampilkan keberadaan dan keutuhan data, bukan isi medis." |
| 4:20-4:40 | Dokter | Wallet & Transaction: tab Transaksi sesi ini, lalu Riwayat on-chain | "Setiap aksi tadi tercatat sebagai transaksi, lengkap dengan hash, blok, dan gas." |
| 4:40-4:50 | - | Kembali ke Dashboard | "Dashboard ikut diperbarui: jumlah pasien, rekam medis, dan izin akses. Terima kasih." |

Tips: latih sekali tanpa merekam. Tunggu notifikasi transaksi selesai sebelum berpindah halaman. Jangan tampilkan file `.key`
atau isi `offchain_store`.

## 6. Merapikan repository GitHub

1. Hapus dari repo: `conversation_history/`, `large_tool_results/`, `tmp/`, `probe.js`, dan `README.md` lama bawaan template.
2. Pastikan `.gitignore` berisi:
   ```
   node_modules/
   dist/
   artifacts/
   cache/
   deployment.json
   offchain_store/
   .venv/
   __pycache__/
   ```
3. Struktur akhir yang disarankan: `contracts/`, `scripts/`, `backend/`, `frontend/`, `app.py` (Streamlit Modul 10), `hardhat.config.js`,
   `package.json`, `README.md`.
4. Pastikan `contracts/EHR.sol` di repo adalah versi NFT (ada `ERC721URIStorage`).
5. Commit dan push:
   ```powershell
   git status
   git add .
   git commit -m "Modul 11-12: UI React + FastAPI (Web3.py) untuk EHR"
   git push
   ```
6. Setelah push, periksa di GitHub bahwa `offchain_store/` dan `deployment.json` **tidak** ikut ter-upload.

## 7. Ceklis pengumpulan

- [ ] Source code (`backend/`, `frontend/`, `app.py`) dan link GitHub
- [ ] Minimal 4 screenshot UI (disarankan 8)
- [ ] `README.md` berisi cara menjalankan
- [ ] Video demo 3-5 menit
- [ ] Penjelasan fungsi tiap halaman dan hubungan UI dengan smart contract (bagian 3, ditulis ulang dengan bahasa sendiri)
- [ ] Cek format dan tenggat di Google Classroom
