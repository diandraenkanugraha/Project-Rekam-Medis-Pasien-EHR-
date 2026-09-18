from block import Block
from pow import proof_of_work
from pos import proof_of_stake

print("PROOF OF WORK")

block = Block(
    index=1,
    data="Resep dari Dokter",
    previous_hash="0"
)

difficulty = 5

print("\nData Block     :", block.data)
print("Difficulty     :", difficulty)

proof_of_work(block, difficulty)

print("Nonce          :", block.nonce)
print("Hash           :", block.hash)

print("PROOF OF STAKE")

validators = {
    "Dokter": 10,
    "Pasien": 95,
    "Rumah Sakit": 40,
    "Wali": 80
}

print("\nValidator:")
for validator, stake in validators.items():
    print(f"- {validator}: {stake} stake")

selected = proof_of_stake(validators)

print("\nValidator terpilih:", selected)