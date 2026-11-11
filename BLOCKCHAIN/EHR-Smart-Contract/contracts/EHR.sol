// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title EHR - Rekam Medis Pasien berbasis Blockchain (PoA) + Tokenisasi ERC-721
/// @notice Setiap rekam medis (MedicalRecord) ditokenisasi menjadi 1 NFT ERC-721.
///         tokenId == recordId, pemilik NFT awal == wallet pasien.
///         Data medis sensitif TIDAK disimpan di sini. Hanya hash, referensi off-chain,
///         status, akses, dan timestamp yang disimpan on-chain.
contract EHR is ERC721URIStorage {
    // =====================================================
    // 1. ENUM
    // =====================================================
    enum Role { NONE, DOCTOR, HOSPITAL }

    // Urutan enum = urutan transisi: ADDED -> DIAGNOSED -> TREATED -> DISCHARGED
    enum RecordStatus { ADDED, DIAGNOSED, TREATED, DISCHARGED }

    // =====================================================
    // 2. STRUCT
    // =====================================================

    // Input registrasi pasien (dibungkus struct agar tidak "stack too deep")
    struct PatientInput {
        string nama;
        string nik;
        string tglLahir;
        string alamat;
        string golDarah;
        string noTelepon;
    }

    // Data pasien on-chain: hanya HASH, bukan data pribadi plaintext
    struct Patient {
        bytes32 id;
        address wallet;
        bytes32 nikHash;
        bytes32 profileHash;
        uint256 registeredAt;
    }

    // Dokter / Rumah Sakit (informasi profesional, bukan data sensitif pasien)
    struct Entity {
        bytes32 id;
        address wallet;
        Role role;
        string nama;
        string nomorIzin;
        string detail;      // spesialisasi (DOCTOR) atau alamat RS (HOSPITAL)
        bool verified;
        uint256 registeredAt;
    }

    struct MedicalRecord {
        uint256 id;
        bytes32 patientId;
        bytes32 doctorId;
        string metadata;     // metadata aman, mis. "Rawat Jalan - Poli Umum"
        bytes32 dataHash;    // HASH(encrypted_data)
        string offChainRef;  // pointer ke penyimpanan off-chain (bukan isi data)
        RecordStatus status; // status terakhir
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct StatusChange {
        RecordStatus previousStatus;
        RecordStatus newStatus;
        bytes32 doctorId;
        uint256 timestamp;
    }

    // =====================================================
    // 3. STATE
    // =====================================================
    address public owner;
    // Token ID otomatis (Mint pertama -> 1, kedua -> 2, ...). tokenId == recordId
    uint256 private nextTokenId = 1;

    mapping(address => bool) public isAuthority;

    mapping(bytes32 => Patient) private patients;
    mapping(bytes32 => Entity) private entities;
    mapping(bytes32 => bool) private nikRegistered;       // keccak256(NIK)
    mapping(bytes32 => bool) private licenseRegistered;   // keccak256(nomor_izin)

    // wallet -> id (0x0 = belum terdaftar)
    mapping(address => bytes32) public patientIdOf;
    mapping(address => bytes32) public entityIdOf;

    mapping(uint256 => MedicalRecord) private records;
    mapping(uint256 => StatusChange[]) private statusHistory;
    mapping(bytes32 => uint256[]) private patientRecordIds;

    // accessActive[patient_id][target_id] = true jika akses ACTIVE
    mapping(bytes32 => mapping(bytes32 => bool)) private accessActive;

    // =====================================================
    // 4. EVENT (audit trail)
    // =====================================================
    event AuthorityAdded(address indexed authority);
    event AuthorityRemoved(address indexed authority);
    event PatientRegistered(bytes32 indexed patientId, address indexed wallet, address indexed authority, uint256 timestamp);
    event EntityRegistered(bytes32 indexed entityId, address indexed wallet, Role role, address indexed authority, uint256 timestamp);
    event RecordCreated(uint256 indexed recordId, bytes32 indexed patientId, bytes32 indexed doctorId, bytes32 dataHash, uint256 timestamp);
    event RecordStatusUpdated(uint256 indexed recordId, RecordStatus previousStatus, RecordStatus newStatus, bytes32 indexed doctorId, uint256 timestamp);
    event AccessGranted(bytes32 indexed patientId, bytes32 indexed targetId, uint256 timestamp);
    event AccessRevoked(bytes32 indexed patientId, bytes32 indexed targetId, uint256 timestamp);

    // =====================================================
    // 5. CUSTOM ERROR
    // =====================================================
    error NotOwner();
    error NotAuthority();                       // "Validasi konsensus gagal - bukan authority"
    error InvalidInput(string field);           // "Input tidak valid"
    error InvalidAddress();
    error WalletAlreadyUsed();
    error PatientAlreadyRegistered();           // "Pasien sudah terdaftar"
    error EntityAlreadyRegistered();            // "Sudah terdaftar"
    error PatientNotFound();                    // "Pasien tidak ditemukan"
    error DoctorNotFound();                     // "Dokter tidak ditemukan / tidak valid"
    error EntityNotFound();                     // "ID tidak valid"
    error RecordNotFound();                     // "Record tidak ditemukan"
    error AccessDenied();                       // "Akses ditolak"
    error NotPatient();                         // "Hanya pasien boleh mengubah akses"
    error InvalidTarget();                      // "Target tidak valid"
    error AccessAlreadyActive();                // "Akses sudah aktif"
    error NoActiveAccess();                     // "Tidak ada akses aktif"
    error InvalidStatusTransition(RecordStatus from, RecordStatus to);
    error NoHistory();                          // "Belum ada riwayat"

    // =====================================================
    // 6. CONSTRUCTOR & MODIFIER
    // =====================================================
    constructor() ERC721("EHR Medical Record", "EHR") {
        owner = msg.sender;
        isAuthority[msg.sender] = true;
        emit AuthorityAdded(msg.sender);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // Representasi pengecekan "Authority Node PoA" di level contract
    modifier onlyAuthority() {
        if (!isAuthority[msg.sender]) revert NotAuthority();
        _;
    }

    // =====================================================
    // 7. MANAJEMEN AUTHORITY
    // =====================================================
    function addAuthority(address _authority) external onlyOwner {
        if (_authority == address(0)) revert InvalidAddress();
        isAuthority[_authority] = true;
        emit AuthorityAdded(_authority);
    }

    function removeAuthority(address _authority) external onlyOwner {
        require(_authority != owner, "Owner tidak boleh dihapus");
        isAuthority[_authority] = false;
        emit AuthorityRemoved(_authority);
    }

    // =====================================================
    // A. REGISTRASI & IDENTITAS
    // =====================================================

    /// A1. registerPatient
    function registerPatient(address _wallet, PatientInput calldata _input)
        external
        onlyAuthority
        returns (bytes32 patientId)
    {
        if (_wallet == address(0)) revert InvalidAddress();
        _required(_input.nama, "nama");
        if (bytes(_input.nik).length != 16) revert InvalidInput("NIK harus 16 karakter");
        _required(_input.tglLahir, "tgl_lahir");
        _required(_input.alamat, "alamat");
        _required(_input.golDarah, "gol_darah");
        _required(_input.noTelepon, "no_telepon");

        bytes32 nikHash = keccak256(bytes(_input.nik));
        if (nikRegistered[nikHash]) revert PatientAlreadyRegistered();
        if (patientIdOf[_wallet] != bytes32(0) || entityIdOf[_wallet] != bytes32(0)) {
            revert WalletAlreadyUsed();
        }

        // patient_id = HASH(NIK + timestamp)
        patientId = keccak256(abi.encodePacked(nikHash, block.timestamp));

        patients[patientId] = Patient({
            id: patientId,
            wallet: _wallet,
            nikHash: nikHash,
            profileHash: keccak256(abi.encode(
                _input.nama, _input.tglLahir, _input.alamat, _input.golDarah, _input.noTelepon
            )),
            registeredAt: block.timestamp
        });

        nikRegistered[nikHash] = true;
        patientIdOf[_wallet] = patientId;

        emit PatientRegistered(patientId, _wallet, msg.sender, block.timestamp);
    }

    /// A2. registerDoctor / registerHospital (dibedakan lewat _role)
    function registerEntity(
        address _wallet,
        string calldata _nama,
        string calldata _nomorIzin,
        string calldata _detail,
        Role _role
    ) external onlyAuthority returns (bytes32 entityId) {
        if (_wallet == address(0)) revert InvalidAddress();
        if (_role != Role.DOCTOR && _role != Role.HOSPITAL) revert InvalidInput("role");
        _required(_nama, "nama");
        _required(_nomorIzin, "nomor_izin");
        _required(_detail, "spesialisasi/alamat_rs");

        bytes32 licenseHash = keccak256(bytes(_nomorIzin));
        if (licenseRegistered[licenseHash]) revert EntityAlreadyRegistered();
        if (patientIdOf[_wallet] != bytes32(0) || entityIdOf[_wallet] != bytes32(0)) {
            revert WalletAlreadyUsed();
        }

        // entity_id = HASH(nomor_izin + timestamp)
        entityId = keccak256(abi.encodePacked(licenseHash, block.timestamp));

        entities[entityId] = Entity({
            id: entityId,
            wallet: _wallet,
            role: _role,
            nama: _nama,
            nomorIzin: _nomorIzin,
            detail: _detail,
            verified: true,   // didaftarkan & divalidasi authority = terverifikasi
            registeredAt: block.timestamp
        });

        licenseRegistered[licenseHash] = true;
        entityIdOf[_wallet] = entityId;

        emit EntityRegistered(entityId, _wallet, _role, msg.sender, block.timestamp);
    }

    // =====================================================
    // B. PENGELOLAAN REKAM MEDIS
    // =====================================================

    /// B1. createRecord
    /// Enkripsi dilakukan off-chain (backend). Contract hanya menerima HASH + referensi.
    function createRecord(
        bytes32 _patientId,
        bytes32 _doctorId,
        bytes32 _dataHash,
        string calldata _offChainRef,
        string calldata _metadata
    ) external onlyAuthority returns (uint256 recordId) {
        if (!_isVerifiedDoctor(_doctorId)) revert DoctorNotFound();
        if (patients[_patientId].id == bytes32(0)) revert PatientNotFound();
        if (!accessActive[_patientId][_doctorId]) revert AccessDenied();
        if (_dataHash == bytes32(0)) revert InvalidInput("data_hash");
        if (bytes(_offChainRef).length == 0) revert InvalidInput("offChainRef");

        // Ambil Token ID, lalu naikkan untuk token berikutnya
        recordId = nextTokenId;
        nextTokenId++;

        records[recordId] = MedicalRecord({
            id: recordId,
            patientId: _patientId,
            doctorId: _doctorId,
            metadata: _metadata,
            dataHash: _dataHash,
            offChainRef: _offChainRef,
            status: RecordStatus.ADDED,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        patientRecordIds[_patientId].push(recordId);

        // Tokenisasi: mint NFT ke wallet pasien (dilakukan terakhir, setelah semua state tersimpan)
        // _metadata menjadi tokenURI, jadi HARUS berisi info aman (non-sensitif)
        mint(patients[_patientId].wallet, recordId, _metadata);

        emit RecordCreated(recordId, _patientId, _doctorId, _dataHash, block.timestamp);
    }

    /// Membuat NFT dan menyimpan metadata URI-nya (pola dari modul)
    function mint(address to, uint256 tokenId, string memory metadataURI) internal {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);
    }

    /// B2. updateRecordStatus
    function updateRecordStatus(
        uint256 _recordId,
        bytes32 _doctorId,
        RecordStatus _newStatus
    ) external onlyAuthority {
        MedicalRecord storage rec = records[_recordId];
        if (rec.id == 0) revert RecordNotFound();
        if (!_isVerifiedDoctor(_doctorId)) revert DoctorNotFound();
        if (!accessActive[rec.patientId][_doctorId]) revert AccessDenied();

        RecordStatus current = rec.status;

        // Hanya boleh maju satu langkah: ADDED->DIAGNOSED->TREATED->DISCHARGED
        if (uint8(_newStatus) != uint8(current) + 1) {
            revert InvalidStatusTransition(current, _newStatus);
        }

        rec.status = _newStatus;
        rec.updatedAt = block.timestamp;

        statusHistory[_recordId].push(StatusChange({
            previousStatus: current,
            newStatus: _newStatus,
            doctorId: _doctorId,
            timestamp: block.timestamp
        }));

        emit RecordStatusUpdated(_recordId, current, _newStatus, _doctorId, block.timestamp);
    }

    // =====================================================
    // C. KONTROL HAK AKSES (dipanggil langsung oleh wallet pasien)
    // =====================================================

    /// C1. grantAccess
    function grantAccess(bytes32 _patientId, bytes32 _targetId) external {
        if (patientIdOf[msg.sender] != _patientId || _patientId == bytes32(0)) revert NotPatient();
        if (patients[_patientId].id == bytes32(0)) revert PatientNotFound();
        if (entities[_targetId].id == bytes32(0)) revert InvalidTarget();
        if (accessActive[_patientId][_targetId]) revert AccessAlreadyActive();

        accessActive[_patientId][_targetId] = true;

        emit AccessGranted(_patientId, _targetId, block.timestamp);
    }

    /// C2. revokeAccess
    function revokeAccess(bytes32 _patientId, bytes32 _targetId) external {
        if (patientIdOf[msg.sender] != _patientId || _patientId == bytes32(0)) revert NotPatient();
        if (patients[_patientId].id == bytes32(0)) revert PatientNotFound();
        if (entities[_targetId].id == bytes32(0)) revert EntityNotFound();
        if (!accessActive[_patientId][_targetId]) revert NoActiveAccess();

        accessActive[_patientId][_targetId] = false;

        emit AccessRevoked(_patientId, _targetId, block.timestamp);
    }

    function hasAccess(bytes32 _targetId, bytes32 _patientId) public view returns (bool) {
        return accessActive[_patientId][_targetId];
    }

    // =====================================================
    // D. PEMBACAAN & RIWAYAT (caller = msg.sender)
    // =====================================================

    /// D1. getRecord - metadata + data_hash + offChainRef + status terakhir
    function getRecord(uint256 _recordId)
        external
        view
        returns (MedicalRecord memory)
    {
        MedicalRecord memory rec = records[_recordId];
        if (rec.id == 0) revert RecordNotFound();
        if (!_canRead(rec.patientId, msg.sender)) revert AccessDenied();
        return rec;
    }

    /// Melihat pemilik NFT rekam medis (tokenId == recordId)
    /// Tidak memakai pembatasan akses: pemilik NFT memang publik di standar ERC-721.
    function getRecordOwner(uint256 _tokenId) public view returns (address) {
        if (records[_tokenId].id == 0) revert RecordNotFound();
        return ownerOf(_tokenId);
    }

    /// Verifikasi integritas: bandingkan hash data off-chain dengan hash on-chain.
    /// (Pengambilan data off-chain & dekripsi dilakukan backend.)
    function verifyRecordIntegrity(uint256 _recordId, bytes32 _offChainDataHash)
        external
        view
        returns (bool)
    {
        MedicalRecord storage rec = records[_recordId];
        if (rec.id == 0) revert RecordNotFound();
        if (!_canRead(rec.patientId, msg.sender)) revert AccessDenied();
        return rec.dataHash == _offChainDataHash;
    }

    /// Riwayat perubahan status satu record
    function getStatusHistory(uint256 _recordId)
        external
        view
        returns (StatusChange[] memory)
    {
        MedicalRecord storage rec = records[_recordId];
        if (rec.id == 0) revert RecordNotFound();
        if (!_canRead(rec.patientId, msg.sender)) revert AccessDenied();
        return statusHistory[_recordId];
    }

    /// D2. getPatientHistory - urut timestamp ASC (record ditambah berurutan)
    function getPatientHistory(bytes32 _patientId)
        external
        view
        returns (MedicalRecord[] memory)
    {
        if (patients[_patientId].id == bytes32(0)) revert PatientNotFound();
        if (!_canRead(_patientId, msg.sender)) revert AccessDenied();

        uint256[] storage ids = patientRecordIds[_patientId];
        if (ids.length == 0) revert NoHistory();

        MedicalRecord[] memory history = new MedicalRecord[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            history[i] = records[ids[i]];
        }
        return history;
    }

    // =====================================================
    // GETTER PENDUKUNG
    // =====================================================
    function getEntity(bytes32 _entityId) external view returns (Entity memory) {
        if (entities[_entityId].id == bytes32(0)) revert EntityNotFound();
        return entities[_entityId];
    }

    // =====================================================
    // INTERNAL
    // =====================================================

    // Validasi string wajib diisi
    function _required(string calldata _value, string memory _field) internal pure {
        if (bytes(_value).length == 0) revert InvalidInput(_field);
    }

    function _isVerifiedDoctor(bytes32 _id) internal view returns (bool) {
        Entity storage e = entities[_id];
        return e.id != bytes32(0) && e.role == Role.DOCTOR && e.verified;
    }

    // Pasien pemilik data, atau entity yang diberi akses aktif
    function _canRead(bytes32 _patientId, address _caller) internal view returns (bool) {
        if (patientIdOf[_caller] == _patientId) return true;
        bytes32 eid = entityIdOf[_caller];
        return eid != bytes32(0) && accessActive[_patientId][eid];
    }
}
