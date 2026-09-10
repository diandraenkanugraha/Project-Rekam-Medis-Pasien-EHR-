from blockchain import Blockchain


blockchain = Blockchain()


blockchain.add_block({

    "pasien_id": "pasien-001",
    "sick": "Gagal Ginjal",
    "actor": "Dokter",
    "location": "Cirebon"
})

blockchain.add_block({
    "perawat_id": "perawat-001",
    "sick": "Gagal Ginjal",
    "actor": "Perawat",
    "location": "Cirebon"
})

blockchain.add_block({
    "wali_id": "wali-001",
    "sick": "Gagal Ginjal",
    "actor": "Wali",
    "location": "Cirebon"
})

blockchain.add_block({
    "pasien_id": "pasien-004",
    "sick": "Gagal Ginjal",
    "actor": "pasien",
    "location": "Cirebon"
})


for block in blockchain.chain:
    print("=" * 50)
    print("INDEX :", block.index)
    print("DATA  :", block.data)
    print("PREV  :", block.previous_hash)
    print("HASH  :", block.hash)

print("\nBlockchain valid:", blockchain.is_valid())
