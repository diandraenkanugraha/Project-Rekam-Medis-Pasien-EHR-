```
MULAI

Buat Smart Contract "RekamMedisPasienBlockchain"

    Siapkan tempat untuk menyimpan data pasien, dokter/rumah sakit,
    rekam medis, dan izin akses

    Setiap Pasien memiliki:
        Patient ID
        Nama
        NIK
        Tanggal Lahir
        Alamat
        Golongan Darah
        No Telepon

    Setiap Dokter/Rumah Sakit memiliki:
        Entity ID
        Nama
        Nomor Izin
        Spesialisasi / Alamat RS
        Role (DOCTOR atau HOSPITAL)

    Setiap Rekam Medis memiliki:
        Record ID
        Patient ID
        Doctor ID
        Data Hash (data medis terenkripsi, disimpan off-chain)
        Status

    Setiap Izin Akses memiliki:
        Patient ID
        Target ID (Dokter/RS yang diberi akses)
        Status Akses (aktif / tidak aktif)

====================================
1. REGISTRASI PASIEN
====================================

Ketika Pasien mendaftar:

    Input nama, NIK, tanggal lahir, alamat, golongan darah, no telepon

    Periksa apakah semua field terisi dan formatnya valid

    Jika salah:

        Tolak, kembalikan "Input tidak valid"

    Periksa apakah NIK sudah terdaftar di blockchain

    Jika sudah terdaftar:

        Tolak, kembalikan "Pasien sudah terdaftar"

    Jika belum:

        Buat Patient ID (dari HASH NIK + waktu saat ini)

        Simpan data pasien ke blockchain

        Kembalikan Patient ID

====================================
2. REGISTRASI DOKTER / RUMAH SAKIT
====================================

Ketika Dokter atau Rumah Sakit mendaftar:

    Input nama, nomor izin, spesialisasi/alamat, role

    Periksa apakah input valid

    Jika salah:

        Tolak, kembalikan "Input tidak valid"

    Periksa apakah nomor izin sudah terdaftar

    Jika sudah:

        Tolak, kembalikan "Sudah terdaftar"

    Jika belum:

        Buat Entity ID

        Jika role adalah DOCTOR:

            Simpan data + spesialisasi

        Jika role adalah HOSPITAL:

            Simpan data + alamat rumah sakit

        Simpan data ke blockchain

        Kembalikan Entity ID

====================================
3. MEMBUAT REKAM MEDIS
====================================

Ketika Dokter membuat rekam medis baru:

    Input Patient ID, Doctor ID, diagnosis, hasil lab, resep obat

    Periksa apakah Dokter terdaftar dan terverifikasi

    Jika salah:

        Tolak, kembalikan "Dokter tidak valid"

    Periksa apakah Pasien terdaftar

    Jika salah:

        Tolak, kembalikan "Pasien tidak ditemukan"

    Periksa apakah Dokter punya akses ke Pasien

    Jika salah:

        Tolak, kembalikan "Akses ditolak"

    Jika semua benar:

        Buat Record ID

        Enkripsi data medis, simpan ke penyimpanan off-chain

        Ambil Data Hash dari hasil penyimpanan

        Buat data block (metadata + Data Hash, Status = ADMITTED)

        Periksa keabsahan transaksi (smart contract)

        Jika tidak valid:

            Tolak, kembalikan "Validasi gagal"

        Jika valid:

            Lakukan Mining (PoW) atau pilih Validator (PoS)

            Simpan block ke blockchain

            Kembalikan Record ID

Contoh alur status rekam medis:

    ADMITTED
      ↓
    DIAGNOSED
      ↓
    TREATED
      ↓
    DISCHARGED
      ↓
    COMPLETED

====================================
4. MENGUBAH STATUS REKAM MEDIS
====================================

Ketika Dokter ingin mengubah status rekam medis:

    Input Record ID, Doctor ID, status baru

    Cari Record ID di blockchain

    Jika tidak ditemukan:

        Tolak, kembalikan "Record tidak ditemukan"

    Periksa apakah Dokter terdaftar dan punya akses

    Jika salah:

        Tolak, kembalikan "Dokter tidak valid"

    Ambil status terakhir dari Record ID

    Periksa apakah perubahan status sesuai urutan yang benar

    Jika salah:

        Tolak, kembalikan "Transisi status tidak valid"

    Jika benar:

        Simpan perubahan status (status lama → status baru) ke blockchain

        Kembalikan "Status berhasil diupdate"

====================================
5. MEMBERIKAN AKSES (GRANT ACCESS)
====================================

Ketika Pasien ingin memberikan akses ke Dokter/RS:

    Input Patient ID, Target ID, ID pemanggil

    Periksa apakah pemanggil adalah pemilik data (Patient ID)

    Jika salah:

        Tolak, kembalikan "Hanya pasien yang boleh memberi akses"

    Periksa apakah Pasien terdaftar

    Jika salah:

        Tolak, kembalikan "Pasien tidak ditemukan"

    Periksa apakah Target (Dokter/RS) terdaftar

    Jika salah:

        Tolak, kembalikan "Target tidak valid"

    Periksa apakah akses sudah aktif sebelumnya

    Jika sudah aktif:

        Tolak, kembalikan "Akses sudah aktif"

    Jika belum:

        Simpan data akses baru ke blockchain

        Kembalikan "Akses berhasil diberikan"

====================================
6. MENCABUT AKSES (REVOKE ACCESS)
====================================

Ketika Pasien ingin mencabut akses:

    Input Patient ID, Target ID, ID pemanggil

    Periksa apakah pemanggil adalah pemilik data

    Jika salah:

        Tolak, kembalikan "Hanya pasien yang boleh mencabut akses"

    Periksa apakah Patient ID dan Target ID terdaftar

    Jika salah:

        Tolak, kembalikan "ID tidak valid"

    Periksa apakah akses saat ini masih aktif

    Jika tidak aktif:

        Tolak, kembalikan "Tidak ada akses aktif untuk dicabut"

    Jika aktif:

        Simpan perubahan (akses dicabut) ke blockchain

        Kembalikan "Akses berhasil dicabut"

====================================
7. MELIHAT REKAM MEDIS (GET RECORD)
====================================

Ketika seseorang ingin melihat rekam medis:

    Input Record ID, ID pemanggil

    Cari Record ID di blockchain

    Jika tidak ditemukan:

        Tolak, kembalikan "Record tidak ditemukan"

    Ambil Patient ID dari rekam medis

    Periksa apakah pemanggil adalah pemilik data ATAU punya akses

    Jika salah:

        Tolak, kembalikan "Akses ditolak"

    Jika benar:

        Ambil Data Hash

        Ambil data terenkripsi dari penyimpanan off-chain

        Buka enkripsi data

        Ambil status terakhir

        Gabungkan metadata + data + status

        Tampilkan hasil lengkap

====================================
8. MELIHAT RIWAYAT PASIEN (GET HISTORY)
====================================

Ketika seseorang ingin melihat riwayat lengkap pasien:

    Input Patient ID, ID pemanggil

    Periksa apakah pemanggil adalah pemilik data ATAU punya akses

    Jika salah:

        Tolak, kembalikan "Akses ditolak"

    Jika benar:

        Telusuri seluruh blockchain

        Kumpulkan semua block yang berkaitan dengan Patient ID
        (rekam medis, perubahan status, pemberian akses, pencabutan akses)

        Jika riwayat kosong:

            Kembalikan "Belum ada riwayat"

        Jika ada:

            Urutkan berdasarkan waktu kejadian

            Untuk setiap rekam medis: ambil data off-chain,
            buka enkripsi, ambil status terakhir

            Tampilkan riwayat lengkap

Contoh perjalanan data pasien:

    Pasien terdaftar
      ↓
    Rekam medis dibuat
      ↓
    Status diperbarui (DIAGNOSED → TREATED → DISCHARGED → COMPLETED)
      ↓
    Akses diberikan / dicabut oleh pasien
      ↓
    Riwayat dapat dilihat kapan saja oleh pasien atau pihak yang berwenang

SELESAI
```
