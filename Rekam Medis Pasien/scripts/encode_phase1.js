// Pure computation: ABI-encode calldata for EHR state-changing calls (phase 1, no IDs needed)
(function () {
  let lib = null;
  try { lib = require('ethers'); } catch (e) { lib = null; }
  if (!lib && typeof ethers !== 'undefined') lib = ethers;
  if (!lib) { console.log('NO_ETHERS'); return; }
  const Iface = lib.Interface ? lib.Interface : (lib.utils && lib.utils.Interface);
  if (!Iface) { console.log('NO_INTERFACE'); return; }
  const iface = new Iface([
    'function registerPatient(address wallet, (string nama,string nik,string tglLahir,string alamat,string golDarah,string noTelepon) input)',
    'function registerEntity(address wallet, string nama, string nomorIzin, string detail, uint8 role)',
    'function addAuthority(address account)',
    'function removeAuthority(address account)',
    'function safeTransferFrom(address from, address to, uint256 tokenId)'
  ]);
  const out = {};
  out.registerPatient = iface.encodeFunctionData('registerPatient', [
    '0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB',
    ['Budi Santoso', '3201234567890001', '1990-05-17', 'Jl. Merdeka No. 10, Jakarta', 'O', '081234567890']
  ]);
  out.registerEntityDoctor = iface.encodeFunctionData('registerEntity', [
    '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db', 'Dr. Hamdan', 'STR-JKT-2024-001', 'Spesialis Penyakit Dalam', 1
  ]);
  out.registerEntityHospital = iface.encodeFunctionData('registerEntity', [
    '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2', 'RS Harapan Keluarga', 'NRS-8871-PTA', 'Jl. Kesehatan No. 5, Depok', 2
  ]);
  out.addAuthority = iface.encodeFunctionData('addAuthority', ['0x17F6AD8Ef982297579C203069C1DbfFE4348c372']);
  out.removeAuthority = iface.encodeFunctionData('removeAuthority', ['0x17F6AD8Ef982297579C203069C1DbfFE4348c372']);
  out.safeTransferFrom = iface.encodeFunctionData('safeTransferFrom', [
    '0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB', '0x617F2E2fD72FD9D5503197092aC168c91465E7f2', 1
  ]);
  console.log('=== ENCODED PHASE 1 ===');
  for (const k of Object.keys(out)) console.log(k + '=' + out[k]);
})();
