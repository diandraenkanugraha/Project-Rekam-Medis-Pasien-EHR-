// Helper: compute the off-chain dataHash for the medical record
// (in production this would be keccak256(encrypted_payload) computed by the backend)
const plaintext = 'ipfs://QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o::encrypted-blob-v1';
let hash;
try {
  hash = web3.utils.keccak256(plaintext);
  console.log('via web3');
} catch (e) {
  hash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(plaintext));
  console.log('via ethers');
}
console.log('DATA_HASH=' + hash);
return hash;
