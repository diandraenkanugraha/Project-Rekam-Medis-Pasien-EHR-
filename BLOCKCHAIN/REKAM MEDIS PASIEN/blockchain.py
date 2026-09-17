from block import Block


class Blockchain:

    def __init__(self):
        self.chain = [
            self.create_genesis_block()
        ]

    def create_genesis_block(self):

        return Block(
            index=0,
            data={
                "message": "Genesis Block"
            },
            previous_hash="0"
        )

    def add_block(self, data: dict):

        previous_block = self.chain[-1]

        new_block = Block(
            index=len(self.chain),
            data=data,
            previous_hash=previous_block.hash
        )

        self.chain.append(new_block)

    def is_valid(self):

        for i in range(1, len(self.chain)):

            current = self.chain[i]
            previous = self.chain[i - 1]

            if current.hash != current.calculate_hash():
                return False

            if current.previous_hash != previous.hash:
                return False

        return True

    def show(self):

        for block in self.chain:

            print("Block:", block.index)
            print("Timestamp:", block.timestamp)
            print("Data:", block.data)
            print("Previous Hash:", block.previous_hash)
            print("Nonce:", block.nonce)
            print("Hash:", block.hash)