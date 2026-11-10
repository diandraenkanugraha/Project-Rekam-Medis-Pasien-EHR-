# EHR Blockchain — Pseudocode Smart Contract (PoA)

## GLOBAL RULES

```text
FUNCTION validateAuthority(caller):
    IF caller IS NOT registered_as_authority:
        RETURN ERROR("Validasi konsensus gagal - bukan authority")
    authoritySignature = signBlock(caller)
    validateBlock(authoritySignature)
    addBlockToBlockchain()
    RETURN SUCCESS
```

```text
FUNCTION hashID(data, timestamp):
    RETURN HASH(data + timestamp)
```

```text
FUNCTION hasAccess(caller_id, patient_id):
    RETURN currentAccess(caller_id, patient_id) == ACTIVE
```

---

# A. REGISTRASI & IDENTITAS

## A1. registerPatient

```text
FUNCTION registerPatient(nama, NIK, tgl_lahir, alamat, gol_darah, no_telepon):

    IF NOT allFieldsValid(nama, NIK, tgl_lahir, alamat, gol_darah, no_telepon):
        RETURN ERROR("Input tidak valid")

    IF blockchain.existsPatientByNIK(NIK):
        RETURN ERROR("Pasien sudah terdaftar")

    patient_id = hashID(NIK, timestamp)

    block = createBlock(
        type = REGISTER_PATIENT,
        data = {
            patient_id,
            nama,
            NIK,
            tgl_lahir,
            alamat,
            gol_darah,
            no_telepon
        }
    )

    IF NOT isAuthority(caller):
        RETURN ERROR("Validasi konsensus gagal - bukan authority")

    signAndValidateBlock(block, caller)
    addBlock(block)

    RETURN patient_id
```

## A2. registerDoctor / registerHospital

```text
FUNCTION registerEntity(nama, nomor_izin, spesialisasi_or_alamat, role):

    IF NOT validInput(nama, nomor_izin, role):
        RETURN ERROR("Input tidak valid")

    IF blockchain.existsEntityByLicense(nomor_izin):
        RETURN ERROR("Sudah terdaftar")

    entity_id = hashID(nomor_izin, timestamp)

    IF role == DOCTOR:
        data = {
            entity_id,
            nama,
            nomor_izin,
            spesialisasi
        }

    ELSE IF role == HOSPITAL:
        data = {
            entity_id,
            nama,
            nomor_izin,
            alamat_rs
        }

    ELSE:
        RETURN ERROR("Role tidak valid")

    block = createBlock(
        type = REGISTER_ENTITY,
        data = data
    )

    IF NOT isAuthority(caller):
        RETURN ERROR("Validasi konsensus gagal - bukan authority")

    signAndValidateBlock(block, caller)
    addBlock(block)

    RETURN entity_id
```

---

# B. PENGELOLAAN REKAM MEDIS

## B1. createRecord

```text
FUNCTION createRecord(patient_id, doctor_id, diagnosis, hasil_lab, resep_obat):

    IF NOT blockchain.existsVerifiedDoctor(doctor_id):
        RETURN ERROR("Dokter tidak ditemukan")

    IF NOT blockchain.existsPatient(patient_id):
        RETURN ERROR("Pasien tidak ditemukan")

    IF NOT hasAccess(doctor_id, patient_id):
        RETURN ERROR("Akses ditolak")

    record_id = generateRecordID()

    encrypted_data = encrypt(
        diagnosis,
        hasil_lab,
        resep_obat
    )

    offChainStorage.save(record_id, encrypted_data)

    data_hash = HASH(encrypted_data)

    block = createBlock(
        type = CREATE_RECORD,
        data = {
            record_id,
            patient_id,
            doctor_id,
            metadata,
            data_hash,
            status = ADDED
        }
    )

    IF NOT validateTransaction(block):
        RETURN ERROR("Validasi gagal")

    IF NOT isAuthority(caller):
        RETURN ERROR("Validasi konsensus gagal - bukan authority")

    signAndValidateBlock(block, caller)
    addBlock(block)

    RETURN record_id
```

## B2. updateRecordStatus

```text
FUNCTION updateRecordStatus(record_id, doctor_id, new_status):

    IF NOT blockchain.existsRecord(record_id):
        RETURN ERROR("Record tidak ditemukan")

    IF NOT blockchain.isValidDoctor(doctor_id):
        RETURN ERROR("Dokter tidak valid")

    IF NOT hasAccess(doctor_id, getPatientID(record_id)):
        RETURN ERROR("Dokter tidak mempunyai akses")

    current_status = getLatestStatus(record_id)

    valid_transition =
        (current_status == DIAGNOSED AND new_status == TREATED)
        OR
        (current_status == TREATED AND new_status == DISCHARGED)

    IF NOT valid_transition:
        RETURN ERROR("Transisi status tidak valid")

    block = createBlock(
        type = UPDATE_STATUS,
        data = {
            record_id,
            previous_status = current_status,
            new_status
        }
    )

    IF NOT isAuthority(caller):
        RETURN ERROR("Validasi konsensus gagal - bukan authority")

    signAndValidateBlock(block, caller)
    addBlock(block)

    RETURN "Status berhasil diupdate"
```

---

# C. KONTROL HAK AKSES

## C1. grantAccess

```text
FUNCTION grantAccess(patient_id, target_id, caller_id):

    IF caller_id != patient_id:
        RETURN ERROR("Hanya pasien boleh mengubah akses")

    IF NOT blockchain.existsPatient(patient_id):
        RETURN ERROR("Pasien tidak ditemukan")

    IF NOT blockchain.existsEntity(target_id):
        RETURN ERROR("Target tidak valid")

    IF NOT isDoctorOrHospital(target_id):
        RETURN ERROR("Target tidak valid")

    IF hasAccess(target_id, patient_id):
        RETURN ERROR("Akses sudah aktif")

    block = createBlock(
        type = GRANT_ACCESS,
        data = {
            patient_id,
            target_id,
            access = ACTIVE
        }
    )

    IF NOT isAuthority(caller):
        RETURN ERROR("Validasi konsensus gagal - bukan authority")

    signAndValidateBlock(block, caller)
    addBlock(block)

    RETURN "Akses berhasil diberikan"
```

## C2. revokeAccess

```text
FUNCTION revokeAccess(patient_id, target_id, caller_id):

    IF caller_id != patient_id:
        RETURN ERROR("Hanya pasien boleh mengubah akses")

    IF NOT blockchain.existsPatient(patient_id):
        RETURN ERROR("Pasien tidak ditemukan")

    IF NOT blockchain.existsEntity(target_id):
        RETURN ERROR("ID tidak valid")

    IF NOT hasAccess(target_id, patient_id):
        RETURN ERROR("Tidak ada akses aktif")

    block = createBlock(
        type = REVOKE_ACCESS,
        data = {
            patient_id,
            target_id,
            access = REVOKED
        }
    )

    IF NOT isAuthority(caller):
        RETURN ERROR("Validasi konsensus gagal - bukan authority")

    signAndValidateBlock(block, caller)
    addBlock(block)

    RETURN "Akses berhasil dicabut"
```

---

# D. PEMBACAAN & RIWAYAT

## D1. getRecord

```text
FUNCTION getRecord(record_id, caller_id):

    IF NOT blockchain.existsRecord(record_id):
        RETURN ERROR("Record tidak ditemukan")

    patient_id = blockchain.getPatientID(record_id)

    IF caller_id != patient_id AND NOT hasAccess(caller_id, patient_id):
        RETURN ERROR("Akses ditolak")

    data_hash = blockchain.getDataHash(record_id)

    encrypted_data = offChainStorage.get(record_id)

    IF HASH(encrypted_data) != data_hash:
        RETURN ERROR("Integritas data gagal")

    data = decrypt(encrypted_data)

    status = getLatestStatus(record_id)

    result = merge(
        metadata(record_id),
        data,
        status
    )

    RETURN result
```

## D2. getPatientHistory

```text
FUNCTION getPatientHistory(patient_id, caller_id):

    IF caller_id != patient_id AND NOT hasAccess(caller_id, patient_id):
        RETURN ERROR("Akses ditolak")

    records = blockchain.scanRecords(patient_id)

    IF records IS EMPTY:
        RETURN ERROR("Belum ada riwayat")

    sort records BY timestamp ASCENDING

    history = []

    FOR each record IN records:

        IF record.type == MEDICAL_RECORD:

            encrypted_data = offChainStorage.get(record.record_id)
            data = decrypt(encrypted_data)
            status = getLatestStatus(record.record_id)

            history.append(
                merge(
                    record.metadata,
                    data,
                    status
                )
            )

        ELSE:
            history.append(record)

    RETURN history
```

---

# POA BLOCK VALIDATION

Semua fungsi yang membuat block mengikuti pola berikut:

```text
FUNCTION commitBlock(block, caller):

    IF NOT isAuthority(caller):
        RETURN ERROR("Validasi konsensus gagal - bukan authority")

    signature = authoritySign(caller, block)

    IF NOT verifyAuthoritySignature(signature, block):
        RETURN ERROR("Signature authority tidak valid")

    IF NOT validateBlock(block):
        RETURN ERROR("Block tidak valid")

    blockchain.add(block)

    RETURN SUCCESS
```

# RINGKASAN ALUR

```text
INPUT
  ↓
VALIDASI IDENTITAS / DATA
  ↓
VALIDASI AKSES (jika diperlukan)
  ↓
VALIDASI TRANSAKSI (jika diperlukan)
  ↓
BUAT BLOCK
  ↓
VALIDASI AUTHORITY NODE (PoA)
  ↓
SIGN BLOCK
  ↓
ADD BLOCK TO BLOCKCHAIN
  ↓
RETURN RESULT
```

# STORAGE RULE

```text
Sensitive Medical Data
        ↓
ENCRYPT
        ↓
OFF-CHAIN STORAGE

HASH(encrypted_data)
        ↓
BLOCKCHAIN
```

Blockchain menyimpan:
- ID
- metadata
- hash data medis
- status
- access event
- timestamp
- authority/signature

Off-chain menyimpan:
- diagnosis
- hasil laboratorium
- resep obat
- data medis sensitif lainnya dalam bentuk terenkripsi
