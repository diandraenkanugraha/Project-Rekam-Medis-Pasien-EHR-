# EHR Blockchain — Flowchart Specification (PoA)

> Ringkasan token-efficient dari flowchart utama. Gunakan dokumen ini sebagai konteks implementasi 8 fungsi smart contract.

## Global
- Sistem: Rekam Medis Pasien (EHR) berbasis Blockchain.
- Konsensus: **Proof of Authority (PoA)**.
- Kategori: A Registrasi & Identitas; B Pengelolaan Rekam Medis; C Kontrol Hak Akses; D Pembacaan & Riwayat.
- Pola block: `START → input → validasi/decision → proses → validasi transaksi/PoA → block → RETURN → END`.
- **Authority Node** wajib terdaftar/valid dan menandatangani + memvalidasi block sebelum block ditambahkan ke blockchain.
- Data medis sensitif: disimpan **off-chain dalam bentuk terenkripsi**; blockchain menyimpan metadata/hash/status untuk integritas.

## A — Registrasi & Identitas

### A1 `registerPatient`
Input: `nama, NIK, tgl_lahir, alamat, gol_darah, no_telepon`
1. Validasi semua field + format. Jika gagal → `Input tidak valid`.
2. Cek `NIK` sudah terdaftar di blockchain? Ya → `Pasien sudah terdaftar`.
3. `patient_id = HASH(NIK + timestamp)`.
4. Buat block `REGISTER_PATIENT`.
5. Cek pengaju = Authority Node PoA? Tidak → `Validasi konsensus gagal — bukan authority`.
6. Authority Node menandatangani & memvalidasi block.
7. Tambahkan block ke blockchain.
8. Return `patient_id`.

### A2 `registerDoctor / registerHospital`
Input: `nama, nomor_izin, spesialisasi/alamat, role`
1. Validasi input. Gagal → `Input tidak valid`.
2. Cek `nomor_izin` sudah terdaftar? Ya → `Sudah terdaftar`.
3. `entity_id` dibuat.
4. Jika `role == DOCTOR` → data + `spesialisasi`; jika `role == HOSPITAL` → data + `alamat_rs`.
5. Buat block `REGISTER_ENTITY`.
6. Cek Authority Node PoA. Gagal → `Validasi konsensus gagal — bukan authority`.
7. Authority Node menandatangani & memvalidasi block.
8. Tambahkan block.
9. Return `entity_id`.

## B — Pengelolaan Rekam Medis

### B1 `createRecord`
Input: `patient_id, doctor_id, diagnosis, hasil_lab, resep_obat`
1. Cek `doctor_id` terdaftar & terverifikasi. Gagal → `Dokter tidak ditemukan`.
2. Cek `patient_id` terdaftar. Gagal → `Pasien tidak ditemukan`.
3. Cek dokter punya akses ke pasien (`has_access`). Gagal → `Akses ditolak`.
4. Generate `record_id`.
5. Enkripsi data sensitif → simpan off-chain; simpan `data_hash` ke blockchain.
6. Buat block `CREATE_RECORD` dengan `metadata + data_hash`, `status=ADDED`.
7. Validasi transaction (smart contract). Gagal → `Validasi gagal`.
8. Cek Authority Node PoA. Gagal → `Validasi konsensus gagal — bukan authority`.
9. Authority Node menandatangani & memvalidasi block.
10. Tambahkan block.
11. Return `record_id`.

### B2 `updateRecordStatus`
Input: `record_id, doctor_id, new_status`
1. Cek `record_id` ada di blockchain. Gagal → `Record tidak ditemukan`.
2. Cek `doctor_id` terdaftar & punya akses. Gagal → `Dokter tidak valid`.
3. Ambil `current_status` terakhir berdasarkan `record_id`.
4. Validasi transisi: `DIAGNOSED → TREATED → DISCHARGED`. Tidak valid → `Transisi status tidak valid`.
5. Buat block `UPDATE_STATUS` dengan `previous → new`.
6. Cek Authority Node PoA. Gagal → `Validasi konsensus gagal — bukan authority`.
7. Authority Node menandatangani & memvalidasi block.
8. Tambahkan block.
9. Return `Status berhasil diupdate`.

## C — Kontrol Hak Akses

### C1 `grantAccess`
Input: `patient_id, target_id, caller_id`
1. `caller_id == patient_id`? Tidak → `Hanya pasien boleh mengubah akses`.
2. Cek `patient_id` terdaftar. Gagal → `Pasien tidak ditemukan`.
3. Cek `target_id` terdaftar sebagai `DOCTOR/HOSPITAL`. Gagal → `Target tidak valid`.
4. Cek akses sudah aktif (`has_access`). Ya → `Akses sudah aktif`.
5. Buat block `GRANT_ACCESS`.
6. Cek Authority Node PoA. Gagal → `Validasi konsensus gagal — bukan authority`.
7. Authority Node menandatangani & memvalidasi block.
8. Tambahkan block.
9. Return `Akses berhasil diberikan`.

### C2 `revokeAccess`
Input: `patient_id, target_id, caller_id`
1. `caller_id == patient_id`? Tidak → `Hanya pasien boleh mengubah akses`.
2. Cek `patient_id` & `target_id` terdaftar. Gagal → `ID tidak valid`.
3. Cek akses saat ini aktif. Tidak → `Tidak ada akses aktif`.
4. Buat block `REVOKE_ACCESS`.
5. Cek Authority Node PoA. Gagal → `Validasi konsensus gagal — bukan authority`.
6. Authority Node menandatangani & memvalidasi block.
7. Tambahkan block.
8. Return `Akses berhasil dicabut`.

## D — Pembacaan & Riwayat

### D1 `getRecord`
Input: `record_id, caller_id`
1. Cek `record_id` ditemukan di blockchain. Tidak → `Record tidak ditemukan`.
2. Ambil `patient_id` dari record.
3. Cek `caller_id == patient_id` ATAU `has_access(caller_id, patient_id)`. Gagal → `Akses ditolak`.
4. Ambil `data_hash` → fetch encrypted data off-chain → decrypt.
5. Ambil status terakhir (`GET_LATEST_STATUS`).
6. Gabungkan `metadata + data + status`.
7. Return hasil lengkap.

### D2 `getPatientHistory`
Input: `patient_id, caller_id`
1. Cek `caller_id == patient_id` ATAU `has_access(caller_id, patient_id)`. Gagal → `Akses ditolak`.
2. Scan blockchain → kumpulkan block terkait `patient_id` (`RECORD`, `UPDATE_STATUS`, `GRANT/REVOKE_ACCESS` sesuai implementasi).
3. `History kosong?` Ya → `Belum ada riwayat`.
4. Urutkan berdasarkan timestamp.
5. Untuk setiap `MEDICAL_RECORD`: ambil off-chain, decrypt, ambil status terakhir.
6. Return history lengkap.

## Data/aturan inti
- ID: `patient_id`, `entity_id`, `record_id`.
- Entity role: `DOCTOR` atau `HOSPITAL`.
- Status record: `ADDED → DIAGNOSED → TREATED → DISCHARGED` (transisi mengikuti aturan smart contract).
- Access: dikendalikan pasien melalui `grantAccess` / `revokeAccess`.
- Smart contract harus memvalidasi identitas, akses, keberadaan data, dan validitas transaksi sebelum PoA.
- Jangan menaruh data medis sensitif plaintext di blockchain; gunakan encryption + off-chain storage + hash on-chain.
