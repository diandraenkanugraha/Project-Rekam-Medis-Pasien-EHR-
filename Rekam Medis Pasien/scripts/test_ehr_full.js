// Full EHR function test — runs against Remix VM via injected web3
(async () => {
  let web3 = (typeof web3 !== 'undefined') ? web3 : null;
  if (!web3) { try { web3 = require('web3'); } catch (e) { console.log('NO_WEB3'); return; } }
  // some runners export constructor instead of instance
  if (typeof web3.eth === 'undefined') { try { web3 = new web3(); } catch (e) {} }
  if (!web3 || typeof web3.eth === 'undefined') { console.log('NO_WEB3_INSTANCE'); return; }

  const C = '0xd9145CCE52D386f254917e481eB44e9943F39138';
  const ADDR = {
    deployer: '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4',
    hospital: '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2',
    doctor:   '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db',
    patient:  '0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB',
    receiver: '0x617F2E2fD72FD9D5503197092aC168c91465E7f2',
    newAuth:  '0x17F6AD8Ef982297579C203069C1DbfFE4348c372'
  };
  const DATA_HASH = '0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
  const OFFCHAIN_REF = 'ipfs://QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o';
  const TOKEN_URI = 'ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco/rekam-medis-1.json';

  const PATIENT_INPUT_ABI = [
    { name: 'wallet', type: 'address' },
    { name: 'input', type: 'tuple', components: [
      { name: 'nama', type: 'string' }, { name: 'nik', type: 'string' },
      { name: 'tglLahir', type: 'string' }, { name: 'alamat', type: 'string' },
      { name: 'golDarah', type: 'string' }, { name: 'noTelepon', type: 'string' }
    ]}
  ];
  const FN = {
    registerPatient: { name: 'registerPatient', type: 'function', inputs: PATIENT_INPUT_ABI, outputs: [{ type: 'bytes32' }] },
    registerEntity: { name: 'registerEntity', type: 'function', inputs: [
      { name: 'wallet', type: 'address' }, { name: 'nama', type: 'string' },
      { name: 'nomorIzin', type: 'string' }, { name: 'detail', type: 'string' }, { name: 'role', type: 'uint8' }
    ], outputs: [{ type: 'bytes32' }] },
    createRecord: { name: 'createRecord', type: 'function', inputs: [
      { name: 'p', type: 'bytes32' }, { name: 'd', type: 'bytes32' }, { name: 'h', type: 'bytes32' },
      { name: 'ref', type: 'string' }, { name: 'meta', type: 'string' }
    ], outputs: [{ type: 'uint256' }] },
    updateRecordStatus: { name: 'updateRecordStatus', type: 'function', inputs: [
      { name: 'id', type: 'uint256' }, { name: 'd', type: 'bytes32' }, { name: 's', type: 'uint8' }
    ], outputs: [] },
    grantAccess: { name: 'grantAccess', type: 'function', inputs: [{ n: 'p', type: 'bytes32' }, { name: 't', type: 'bytes32' }], outputs: [] },
    revokeAccess: { name: 'revokeAccess', type: 'function', inputs: [{ name: 'p', type: 'bytes32' }, { name: 't', type: 'bytes32' }], outputs: [] },
    safeTransferFrom: { name: 'safeTransferFrom', type: 'function', inputs: [
      { name: 'f', type: 'address' }, { name: 't', type: 'address' }, { name: 'id', type: 'uint256' }
    ], outputs: [] },
    addAuthority: { name: 'addAuthority', type: 'function', inputs: [{ name: 'a', type: 'address' }], outputs: [] },
    removeAuthority: { name: 'removeAuthority', type: 'function', inputs: [{ name: 'a', type: 'address' }], outputs: [] },
    // views
    ownerOf: { name: 'ownerOf', type: 'function', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ type: 'address' }] },
    tokenURI: { name: 'tokenURI', type: 'function', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ type: 'string' }] },
    balanceOf: { name: 'balanceOf', type: 'function', inputs: [{ name: 'o', type: 'address' }], outputs: [{ type: 'uint256' }] },
    hasAccess: { name: 'hasAccess', type: 'function', inputs: [{ name: 't', type: 'bytes32' }, { name: 'p', type: 'bytes32' }], outputs: [{ type: 'bool' }] },
    patientIdOf: { name: 'patientIdOf', type: 'function', inputs: [{ name: 'w', type: 'address' }], outputs: [{ type: 'bytes32' }] },
    entityIdOf: { name: 'entityIdOf', type: 'function', inputs: [{ name: 'w', type: 'address' }], outputs: [{ type: 'bytes32' }] },
    getRecord: { name: 'getRecord', type: 'function', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ name: 'rec', type: 'tuple', components: [
      { name: 'id', type: 'uint256' }, { name: 'patientId', type: 'bytes32' }, { name: 'doctorId', type: 'bytes32' },
      { name: 'metadata', type: 'string' }, { name: 'dataHash', type: 'bytes32' }, { name: 'offChainRef', type: 'string' },
      { name: 'status', type: 'uint8' }, { name: 'createdAt', type: 'uint256' }, { name: 'updatedAt', type: 'uint256' }
    ]}] },
    verify: { name: 'verifyRecordIntegrity', type: 'function', inputs: [{ name: 'id', type: 'uint256' }, { name: 'h', type: 'bytes32' }], outputs: [{ type: 'bool' }] },
    statusHistory: { name: 'getStatusHistory', type: 'function', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ name: 'h', type: 'tuple[]', components: [
      { name: 'prev', type: 'uint8' }, { name: 'new', type: 'uint8' }, { name: 'doc', type: 'bytes32' }, { name: 'ts', type: 'uint256' }
    ]}] },
    patientHistory: { name: 'getPatientHistory', type: 'function', inputs: [{ name: 'p', type: 'bytes32' }], outputs: [{ name: 'r', type: 'tuple[]', components: [
      { name: 'id', type: 'uint256' }, { name: 'patientId', type: 'bytes32' }, { name: 'doctorId', type: 'bytes32' },
      { name: 'metadata', type: 'string' }, { name: 'dataHash', type: 'bytes32' }, { name: 'offChainRef', type: 'string' },
      { name: 'status', type: 'uint8' }, { name: 'createdAt', type: 'uint256' }, { name: 'updatedAt', type: 'uint256' }
    ]}] },
    getEntity: { name: 'getEntity', type: 'function', inputs: [{ name: 'e', type: 'bytes32' }], outputs: [{ name: 'ent', type: 'tuple', components: [
      { name: 'id', type: 'bytes32' }, { name: 'wallet', type: 'address' }, { name: 'role', type: 'uint8' },
      { name: 'nama', type: 'string' }, { name: 'nomorIzin', type: 'string' }, { name: 'detail', type: 'string' },
      { name: 'verified', type: 'bool' }, { name: 'registeredAt', type: 'uint256' }
    ]}] },
    getRecordOwner: { name: 'getRecordOwner', type: 'function', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ type: 'address' }] }
  };

  const enc = (fn, args) => web3.eth.abi.encodeFunctionCall(fn, args);
  const sel = (sig) => web3.utils.sha3(sig).slice(0, 10);

  async function view(fn, args, from) {
    const data = enc(fn, args);
    const res = await web3.eth.call({ to: C, data, from: from || ADDR.deployer });
    const out = web3.eth.abi.decodeParameters(fn.outputs, res);
    return fn.outputs.length === 1 ? out[0] : out;
  }

  async function send(from, fn, args) {
    try {
      const data = enc(fn, args);
      const r = await web3.eth.sendTransaction({ from, to: C, data, gas: 4500000 });
      return { ok: r.status === true || r.status === 1 || r.status === '0x1', receipt: r };
    } catch (e) {
      return { ok: false, err: (e && (e.message || e.reason)) || String(e) };
    }
  }

  async function expectRevert(from, fn, args, label) {
    try {
      await web3.eth.call({ from, to: C, data: enc(fn, args) });
      console.log(label + ': UNEXPECTED_SUCCESS (no revert)');
      return false;
    } catch (e) {
      console.log(label + ': REVERT_AS_EXPECTED -> ' + ((e && e.message) || String(e)).slice(0, 300));
      return true;
    }
  }

  const accounts = await web3.eth.getAccounts();
  console.log('ACCOUNTS=' + accounts.length);
  const S = {};
  for (const k of Object.keys(ADDR)) {
    S[k] = accounts.find(a => a.toLowerCase() === ADDR[k].toLowerCase());
    if (!S[k]) { console.log('MISSING_ACCOUNT ' + k); return; }
  }
  const from = S.deployer;

  // STEP 1: registerPatient
  let r = await send(from, FN.registerPatient, [S.patient, ['Budi Santoso', '3201234567890001', '1990-05-17', 'Jl. Merdeka No. 10, Jakarta', 'O', '081234567890']]);
  console.log('STEP1_REGISTER_PATIENT=' + (r.ok ? 'OK tx=' + r.receipt.transactionHash : 'FAIL ' + r.err));
  if (!r.ok) return;

  // STEP 2/3: register doctor & hospital
  r = await send(from, FN.registerEntity, [S.doctor, 'Dr. Hamdan', 'STR-JKT-2024-001', 'Spesialis Penyakit Dalam', 1]);
  console.log('STEP2_REGISTER_DOCTOR=' + (r.ok ? 'OK tx=' + r.receipt.transactionHash : 'FAIL ' + r.err));
  r = await send(from, FN.registerEntity, [S.hospital, 'RS Harapan Keluarga', 'NRS-8871-PTA', 'Jl. Kesehatan No. 5, Depok', 2]);
  console.log('STEP3_REGISTER_HOSPITAL=' + (r.ok ? 'OK tx=' + r.receipt.transactionHash : 'FAIL ' + r.err));

  // STEP 4: IDs
  const PATIENT_ID = await view(FN.patientIdOf, [S.patient]);
  const DOCTOR_ID = await view(FN.entityIdOf, [S.doctor]);
  const HOSPITAL_ID = await view(FN.entityIdOf, [S.hospital]);
  console.log('STEP4_IDS PATIENT_ID=' + PATIENT_ID + ' DOCTOR_ID=' + DOCTOR_ID + ' HOSPITAL_ID=' + HOSPITAL_ID);

  // STEP 5: grantAccess (patient)
  r = await send(S.patient, FN.grantAccess, [PATIENT_ID, DOCTOR_ID]);
  console.log('STEP5_GRANT_ACCESS=' + (r.ok ? 'OK tx=' + r.receipt.transactionHash : 'FAIL ' + r.err));
  const acc = await view(FN.hasAccess, [DOCTOR_ID, PATIENT_ID], S.patient);
  console.log('STEP6_HAS_ACCESS=' + acc);

  // STEP 7: createRecord -> mints tokenId 1 (SCREENSHOT 3: Create Transaction)
  r = await send(from, FN.createRecord, [PATIENT_ID, DOCTOR_ID, DATA_HASH, OFFCHAIN_REF, TOKEN_URI]);
  console.log('STEP7_CREATE_RECORD=' + (r.ok ? 'OK tx=' + r.receipt.transactionHash : 'FAIL ' + r.err));
  if (!r.ok) return;
  let recordId = null;
  const topic = web3.utils.sha3('RecordCreated(uint256,bytes32,bytes32,bytes32,uint256)');
  for (const lg of r.receipt.logs || []) {
    if (lg.topics && lg.topics[0] === topic) { recordId = web3.eth.abi.decodeParameter('uint256', lg.topics[1]); }
  }
  console.log('STEP7_RECORD_ID_TOKEN_ID=' + recordId + ' (SCREENSHOT 4: Token ID dibuat)');

  // STEP 8: negative test — skip status step
  await expectRevert(from, FN.updateRecordStatus, [recordId, DOCTOR_ID, 2], 'STEP8_NEGATIVE_SKIP_STATUS');

  // STEP 9: status transitions 1,2,3
  for (const s of [1, 2, 3]) {
    r = await send(from, FN.updateRecordStatus, [recordId, DOCTOR_ID, s]);
    console.log('STEP9_STATUS_' + s + '=' + (r.ok ? 'OK tx=' + r.receipt.transactionHash : 'FAIL ' + r.err));
  }

  // STEP 10: ownerOf / tokenURI / balance (SCREENSHOT 5)
  const ownerBefore = await view(FN.ownerOf, [recordId]);
  const uri = await view(FN.tokenURI, [recordId]);
  const recOwner = await view(FN.getRecordOwner, [recordId]);
  const balPatient = await view(FN.balanceOf, [S.patient]);
  console.log('STEP10_OWNER_BEFORE=' + ownerBefore + ' getRecordOwner=' + recOwner + ' balancePatient=' + balPatient);
  console.log('STEP10_TOKEN_URI=' + uri);

  // STEP 11: reads (patient)
  const rec = await view(FN.getRecord, [recordId], S.patient);
  console.log('STEP11_GET_RECORD=' + JSON.stringify(rec) + ' (SCREENSHOT 6: data terhubung Token ID)');
  const vf = await view(FN.verify, [recordId, DATA_HASH], S.patient);
  console.log('STEP11_VERIFY_INTEGRITY=' + vf);
  const hist = await view(FN.statusHistory, [recordId], S.patient);
  console.log('STEP11_STATUS_HISTORY_LEN=' + (Array.isArray(hist) ? hist.length : hist));
  const ph = await view(FN.patientHistory, [PATIENT_ID], S.patient);
  console.log('STEP11_PATIENT_HISTORY_LEN=' + (Array.isArray(ph) ? ph.length : ph));

  // extra negative: unauthorized read (deployer has no access)
  await expectRevert(from, FN.getRecord, [recordId], 'STEP11X_NEGATIVE_UNAUTHORIZED_READ');

  // STEP 12: transfer NFT (SCREENSHOT 7)
  r = await send(S.patient, FN.safeTransferFrom, [S.patient, S.receiver, recordId]);
  console.log('STEP12_TRANSFER=' + (r.ok ? 'OK tx=' + r.receipt.transactionHash : 'FAIL ' + r.err));

  // STEP 13: ownerOf after transfer (SCREENSHOT 8)
  const ownerAfter = await view(FN.ownerOf, [recordId]);
  const balReceiver = await view(FN.balanceOf, [S.receiver]);
  console.log('STEP13_OWNER_AFTER=' + ownerAfter + ' balanceReceiver=' + balReceiver);

  // STEP 14: revokeAccess + hasAccess false
  r = await send(S.patient, FN.revokeAccess, [PATIENT_ID, DOCTOR_ID]);
  console.log('STEP14_REVOKE=' + (r.ok ? 'OK tx=' + r.receipt.transactionHash : 'FAIL ' + r.err));
  const acc2 = await view(FN.hasAccess, [DOCTOR_ID, PATIENT_ID], S.patient);
  console.log('STEP14_HAS_ACCESS_AFTER_REVOKE=' + acc2);

  // STEP 15: entities
  const entD = await view(FN.getEntity, [DOCTOR_ID]);
  const entH = await view(FN.getEntity, [HOSPITAL_ID]);
  console.log('STEP15_DOCTOR=' + JSON.stringify(entD));
  console.log('STEP15_HOSPITAL=' + JSON.stringify(entH));

  // STEP 16: authority add/remove
  r = await send(from, FN.addAuthority, [S.newAuth]);
  console.log('STEP16_ADD_AUTHORITY=' + (r.ok ? 'OK' : 'FAIL ' + r.err));
  r = await send(from, FN.removeAuthority, [S.newAuth]);
  console.log('STEP16_REMOVE_AUTHORITY=' + (r.ok ? 'OK' : 'FAIL ' + r.err));

  console.log('ERROR_SELECTORS skip=' + sel('InvalidStatusTransition(uint8,uint8)') + ' accessDenied=' + sel('AccessDenied()'));
  console.log('ALL_STEPS_DONE');
})().catch(e => console.log('SCRIPT_ERROR ' + ((e && (e.stack || e.message)) || String(e))));