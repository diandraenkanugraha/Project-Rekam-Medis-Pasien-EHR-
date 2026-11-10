# Modul Praktikum Blockchain 05 — Smart Contract II
## Ringkasan + Transkripsi Contoh Kode untuk Claude Project

> **Sumber:** Modul Praktikum Blockchain — 05 Smart Contract II.  
> Materi utama: contoh full smart contract dan contoh project Supply Chain Kopi.  
> Online Remix IDE yang dicantumkan dosen: `https://app.remix.live/`
>
> **Catatan penting:** bagian kode di bawah ditranskripsi dari gambar kode pada PDF agar Claude dapat membaca seluruh konteks tanpa perlu memproses PNG. Struktur dan isi contoh dipertahankan. Beberapa karakter pada gambar tampak memiliki artefak visual; jika ada perbedaan sintaks kecil, gunakan gambar/PDF asli sebagai sumber pengecekan.

---

# 1. Contoh Full Smart Contract

## Konsep yang ditunjukkan

Contoh `ManajemenInventaris` memperlihatkan penggunaan:

- `pragma solidity ^0.8.20`
- `contract`
- `address public`
- `struct`
- `uint256`
- `string`
- custom error
- `mapping`
- array dinamis
- `event`
- `indexed`
- `constructor`
- `msg.sender`
- `modifier`
- `revert`
- `require`
- `external`
- `payable`
- `storage`
- pembaruan state
- event emission

## Kode contoh dari modul

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ManajemenInventaris {
    address public owner;

    // 1. Struct Tipe Data Kustom
    struct Barang {
        uint256 id;
        string nama;
        uint256 stok;
        uint256 harga;
    }

    // Custom Error untuk efisiensi gas
    error HanyaOwner();
    error StokTidakCukup(uint256 diminta, uint256 tersedia);
    error BarangTidakAda(uint256 id);

    // 2. Mappings dan Arrays
    mapping(uint256 => Barang) public daftarBarang;
    uint256[] public listIdBarang;

    // 3. Events
    event BarangDitambahkan(
        uint256 indexed id,
        string nama,
        uint256 stok
    );

    event BarangDibeli(
        uint256 indexed id,
        address indexed pembeli,
        uint256 jumlah
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert HanyaOwner();
        _;
    }

    // Menambah Barang Baru
    function tambahBarang(
        uint256 _id,
        string memory _nama,
        uint256 _stok,
        uint256 _harga
    ) external onlyOwner {
        // Validasi dengan require
        require(
            daftarBarang[_id].id == 0,
            "ID Barang sudah terdaftar"
        );

        require(
            _stok > 0,
            "Stok awal harus lebih dari 0"
        );

        daftarBarang[_id] = Barang(
            _id,
            _nama,
            _stok,
            _harga
        );

        listIdBarang.push(_id);

        emit BarangDitambahkan(
            _id,
            _nama,
            _stok
        );
    }

    // Membeli Barang
    function beliBarang(
        uint256 _id,
        uint256 _jumlah
    ) external payable {
        Barang storage item = daftarBarang[_id];

        // Validasi menggunakan Custom Revert
        if (item.id == 0)
            revert BarangTidakAda(_id);

        if (item.stok < _jumlah)
            revert StokTidakCukup(
                _jumlah,
                item.stok
            );

        require(
            msg.value >= item.harga * _jumlah,
            "Pembayaran Ether kurang"
        );

        // Pembaruan State
        item.stok -= _jumlah;

        emit BarangDibeli(
            _id,
            msg.sender,
            _jumlah
        );
    }
}
```

### Inti alur contoh

```text
constructor
    ↓
owner = msg.sender
    ↓
modifier onlyOwner
    ↓
tambahBarang()
    ↓
validasi ID + stok
    ↓
simpan struct ke mapping
    ↓
push ID ke array
    ↓
emit event

beliBarang()
    ↓
ambil Barang dengan storage
    ↓
cek barang ada
    ↓
cek stok cukup
    ↓
cek pembayaran Ether
    ↓
ubah stok
    ↓
emit event
```

---

# 2. Contoh Project Supply Chain Kopi

## Konsep yang ditunjukkan

Contoh kedua memperlihatkan pola smart contract yang lebih dekat dengan project berbasis proses/status:

- `pragma solidity ^0.8.24`
- `enum`
- `struct`
- `address`
- `mapping`
- auto-increment ID
- `event`
- `indexed`
- `calldata`
- `msg.sender`
- `block.timestamp`
- `external`
- `storage`
- `memory`
- `require`
- `view`
- `returns`
- update status
- transfer ownership
- getter custom

## Kode contoh dari modul

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SupplyChain {
    enum Status {
        PRODUCED,
        SHIPPED,
        RECEIVED,
        STORED,
        SOLD
    }

    struct Item {
        uint256 id;
        string batchId;
        string productName;
        address currentOwner;
        Status status;
        uint256 timestamp;
    }

    uint256 private nextItemId = 1;

    mapping(uint256 => Item) public items;

    event ItemCreated(
        uint256 indexed itemId,
        string batchId,
        address indexed owner
    );

    event StatusUpdated(
        uint256 indexed itemId,
        Status status,
        address indexed actor
    );

    event OwnershipTransferred(
        uint256 indexed itemId,
        address indexed from,
        address indexed to
    );

    function createItem(
        string calldata _batchId,
        string calldata _productName
    ) external {
        uint256 itemId = nextItemId;

        items[itemId] = Item({
            id: itemId,
            batchId: _batchId,
            productName: _productName,
            currentOwner: msg.sender,
            status: Status.PRODUCED,
            timestamp: block.timestamp
        });

        nextItemId++;

        emit ItemCreated(
            itemId,
            _batchId,
            msg.sender
        );
    }

    function updateStatus(
        uint256 _itemId,
        Status _status
    ) external {
        Item storage item = items[_itemId];

        require(
            item.id != 0,
            "Item not found"
        );

        require(
            item.currentOwner == msg.sender,
            "Not owner"
        );

        item.status = _status;
        item.timestamp = block.timestamp;

        emit StatusUpdated(
            _itemId,
            _status,
            msg.sender
        );
    }

    function transferItem(
        uint256 _itemId,
        address _newOwner
    ) external {
        Item storage item = items[_itemId];

        require(
            item.id != 0,
            "Item not found"
        );

        require(
            item.currentOwner == msg.sender,
            "Not owner"
        );

        require(
            _newOwner != address(0),
            "Invalid owner"
        );

        address oldOwner = item.currentOwner;

        item.currentOwner = _newOwner;
        item.timestamp = block.timestamp;

        emit OwnershipTransferred(
            _itemId,
            oldOwner,
            _newOwner
        );
    }

    function getItem(
        uint256 _itemId
    )
        external
        view
        returns (
            uint256,
            string memory,
            string memory,
            address,
            Status,
            uint256
        )
    {
        Item memory item = items[_itemId];

        return (
            item.id,
            item.batchId,
            item.productName,
            item.currentOwner,
            item.status,
            item.timestamp
        );
    }
}
```

---

# 3. Struktur Logika Supply Chain

```text
createItem()
    ↓
generate itemId
    ↓
buat Item
    ├── id
    ├── batchId
    ├── productName
    ├── currentOwner = msg.sender
    ├── status = PRODUCED
    └── timestamp = block.timestamp
    ↓
simpan ke mapping
    ↓
nextItemId++
    ↓
emit ItemCreated
```

```text
updateStatus()
    ↓
ambil Item dari mapping sebagai storage
    ↓
cek Item ditemukan
    ↓
cek msg.sender == currentOwner
    ↓
ubah status
    ↓
update timestamp
    ↓
emit StatusUpdated
```

```text
transferItem()
    ↓
ambil Item
    ↓
cek Item ditemukan
    ↓
cek caller adalah owner
    ↓
cek newOwner != address(0)
    ↓
simpan oldOwner
    ↓
ubah currentOwner
    ↓
update timestamp
    ↓
emit OwnershipTransferred
```

```text
getItem()
    ↓
ambil Item sebagai memory
    ↓
return seluruh field
```

---

# 4. Pola Solidity yang Relevan untuk Project EHR

Gunakan materi di atas sebagai pola pembelajaran, lalu sesuaikan dengan domain EHR.

## Struct

Data kompleks dapat dikelompokkan menggunakan `struct`.

Contoh modul:

```solidity
struct Item {
    uint256 id;
    string batchId;
    string productName;
    address currentOwner;
    Status status;
    uint256 timestamp;
}
```

Untuk EHR, pola yang sama dapat digunakan untuk entity seperti pasien, dokter, rumah sakit, dan record medis.

## Enum

Status yang memiliki pilihan terbatas dapat menggunakan `enum`.

Contoh modul:

```solidity
enum Status {
    PRODUCED,
    SHIPPED,
    RECEIVED,
    STORED,
    SOLD
}
```

Untuk EHR, status harus mengikuti status yang telah ditentukan pada spesifikasi project/flowchart, bukan status Supply Chain.

## Mapping

Contoh modul:

```solidity
mapping(uint256 => Item) public items;
```

Mapping dapat digunakan sebagai penyimpanan berdasarkan ID.

## Event

Contoh modul menggunakan event untuk mencatat perubahan penting:

```solidity
event ItemCreated(...);
event StatusUpdated(...);
event OwnershipTransferred(...);
```

EHR dapat menggunakan event untuk aktivitas seperti registrasi, pembuatan record, perubahan status, dan perubahan hak akses.

## `msg.sender`

Contoh Supply Chain menggunakan:

```solidity
currentOwner: msg.sender
```

dan:

```solidity
require(
    item.currentOwner == msg.sender,
    "Not owner"
);
```

Dalam EHR, `msg.sender` dapat digunakan untuk mengidentifikasi wallet/actor yang melakukan transaksi, kemudian harus divalidasi terhadap role dan hak akses yang berlaku.

## `block.timestamp`

Contoh Supply Chain mencatat waktu perubahan:

```solidity
timestamp: block.timestamp
```

dan:

```solidity
item.timestamp = block.timestamp;
```

Pola timestamp dapat digunakan untuk mencatat waktu pembuatan/perubahan record atau event EHR sesuai kebutuhan project.

## `storage` vs `memory`

Modul menunjukkan:

```solidity
Item storage item = items[_itemId];
```

untuk bekerja langsung terhadap data yang tersimpan sehingga perubahan pada `item` mengubah state contract.

Sedangkan:

```solidity
Item memory item = items[_itemId];
```

digunakan pada fungsi `getItem()` untuk membaca data lalu mengembalikannya.

## `calldata`

Contoh:

```solidity
function createItem(
    string calldata _batchId,
    string calldata _productName
) external
```

`calldata` digunakan pada parameter external yang hanya dibaca.

## `external`

Contoh modul menggunakan fungsi:

```solidity
external
```

untuk fungsi yang dipanggil dari luar contract.

## `view`

Getter:

```solidity
function getItem(...)
    external
    view
```

digunakan untuk membaca state tanpa mengubah state.

## `require`

Digunakan untuk validasi kondisi:

```solidity
require(
    item.id != 0,
    "Item not found"
);
```

## Custom Error

Contoh pertama menggunakan:

```solidity
error HanyaOwner();
error StokTidakCukup(uint256 diminta, uint256 tersedia);
error BarangTidakAda(uint256 id);
```

dan:

```solidity
revert HanyaOwner();
```

Custom error digunakan sebagai alternatif error string dan ditunjukkan dalam modul sebagai cara yang lebih efisien terhadap gas.

---

# 5. Mapping Materi Modul → EHR

| Materi Modul | Penerapan yang mungkin pada EHR |
|---|---|
| `struct` | Patient, Entity, MedicalRecord, Access |
| `enum` | Role/status record/access |
| `mapping` | Penyimpanan berdasarkan ID |
| `array` | Daftar ID / riwayat |
| `event` | Audit trail aktivitas |
| `constructor` | Inisialisasi owner/authority |
| `modifier` | Pembatasan role/authority |
| `require` | Validasi kondisi |
| custom `error` | Error contract |
| `msg.sender` | Actor transaksi |
| `block.timestamp` | Waktu transaksi/event |
| `storage` | Mengubah state blockchain |
| `memory` | Membaca/copy data |
| `calldata` | Parameter external read-only |
| `external` | Fungsi yang dipanggil dari luar |
| `view` | Fungsi baca state |
| `returns` | Mengembalikan data |
| `emit` | Mencatat event blockchain |

---

# 6. Batasan Konteks Modul

Modul ini memberikan **contoh pola Solidity dan smart contract**, bukan implementasi EHR.

Karena itu:

```text
JANGAN:
menyalin domain Supply Chain ke EHR.

LAKUKAN:
menggunakan konsep Solidity yang diajarkan modul
+
mengikuti flowchart EHR
+
mengikuti pseudocode EHR
+
mengikuti kebutuhan project yang sudah ada.
```

Contoh Supply Chain:

```text
Item
Owner
PRODUCED
SHIPPED
RECEIVED
STORED
SOLD
```

tidak boleh dipakai sebagai domain EHR kecuali memang ada alasan desain yang relevan.

---

# 7. Referensi Project EHR

Untuk implementasi minggu ini, sumber prioritas adalah:

1. Flowchart EHR yang telah dibuat.
2. Pseudocode EHR.
3. Source code Python EHR yang sudah ada di Claude Project.
4. Modul Praktikum Blockchain 05 ini untuk pola/sintaks Solidity.
5. Instruksi tugas dosen minggu berjalan.

Implementasi Solidity harus mempertahankan fungsi bisnis EHR yang sudah dirancang dan menerjemahkannya ke smart contract, bukan mengganti project menjadi Supply Chain.

