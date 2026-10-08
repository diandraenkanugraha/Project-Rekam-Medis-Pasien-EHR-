// EHR end-to-end functional test — steps 4-13 (steps 0-3 done via Deploy & Run: deploy, addAuthority(acc5), registerEntity hospital, registerEntity doctor)
const ADDR = '0xd2a5bC10698FD955D1Fe6cb468a17809A08fd005';
const HOSPITAL_ID = '0xf3c35f7b5c8822b660527362766d9a181dac2d3f558090cada81cadfc900cb2e';
const DOCTOR_ID = '0x779205009816d307026893fbb2e7a98584b744b35fb745e22723f6987f3b4c2e';
const OFFCHAIN_REF = 'ipfs://QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o';

let pass = 0, fail = 0;
const failures = [];
function log(name, ok, detail) {
  if (ok) { pass++; console.log(`PASS | ${name} | ${detail}`); }
  else { fail++; failures.push(`${name}: ${detail}`); console.log(`FAIL | ${name} | ${detail}`); }
}
function shortErr(e) {
  let m = String((e && (e.reason || e.message)) || e).replace(/\s+/g, ' ');
  return m.length > 220 ? m.slice(0, 220) + '...' : m;
}
async function expectRevert(name, fn) {
  try { await fn(); log(name, false, 'expected revert but call SUCCEEDED'); }
  catch (e) { log(name, true, `reverted as expected -> ${shortErr(e)}`); }
}
const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

(async () => {
  const ehr = await ethers.getContractAt('EHR', ADDR);
  const signers = await ethers.getSigners();
  const [acc0, acc1, acc2, acc3, acc4, acc5] = signers;
  console.log(`acc0(deployer)=${acc0.address}`);
  console.log(`acc2(doctor)=${acc2.address} acc3(patient)=${acc3.address} acc4=${acc4.address} acc5(authority)=${acc5.address}`);

  // ================= STEP 4: registerPatient =================
  let PATIENT_ID;
  try {
    const tx = await ehr.connect(acc0).registerPatient(acc3.address,
      ['Andi', '3201234567890001', '1990-01-01', 'Bandung', 'O', '0811']);
    const r = await tx.wait();
    PATIENT_ID = await ehr.connect(acc0).patientIdOf(acc3.address);
    log('STEP 4 registerPatient', r.status === 1 && PATIENT_ID !== ethers.ZeroHash,
      `patientId=${PATIENT_ID} gas=${r.gasUsed}`);
  } catch (e) { log('STEP 4 registerPatient', false, shortErr(e)); }

  // ================= PREREQ: addAuthority(acc2) =================
  // ADAPTATION NOTE: createRecord & updateRecordStatus are `onlyAuthority` in the actual ABI;
  // to let the doctor (account 2) execute them as the task intends, deployer adds acc2 as authority.
  try {
    const tx = await ehr.connect(acc0).addAuthority(acc2.address);
    const r = await tx.wait();
    log('PREREQ addAuthority(acc2)', r.status === 1, 'so doctor(acc2) can call onlyAuthority record fns');
  } catch (e) { log('PREREQ addAuthority(acc2)', false, shortErr(e)); }

  // ================= STEP 5 PREREQ: grantAccess =================
  // ADAPTATION NOTE: createRecord requires accessActive[patient][doctor] (AccessDenied otherwise).
  try {
    const tx = await ehr.connect(acc3).grantAccess(PATIENT_ID, DOCTOR_ID);
    const r = await tx.wait();
    log('PREREQ grantAccess(patient,doctor)', r.status === 1, 'required by createRecord');
  } catch (e) { log('PREREQ grantAccess', false, shortErr(e)); }

  // ================= STEP 5: createRecord =================
  // ACTUAL ABI: createRecord(bytes32 patientId, bytes32 doctorId, bytes32 dataHash, string offChainRef, string metadata)
  // No hospitalId param exists -> hospitalId is passed as dataHash (reused in step 9 integrity checks).
  let RECORD_ID;
  try {
    const tx = await ehr.connect(acc2).createRecord(PATIENT_ID, DOCTOR_ID, HOSPITAL_ID,
      OFFCHAIN_REF, 'Rawat Jalan - Poli Umum');
    const r = await tx.wait();
    let rid = 0n;
    for (const l of r.logs) {
      try { const p = ehr.interface.parseLog(l); if (p && p.name === 'RecordCreated') rid = p.args.recordId; } catch (_) {}
    }
    RECORD_ID = rid;
    log('STEP 5 createRecord', r.status === 1 && rid > 0n, `recordId/tokenId=${rid} gas=${r.gasUsed}`);
  } catch (e) { log('STEP 5 createRecord', false, shortErr(e)); }

  // ================= STEP 6: ownerOf =================
  try {
    const o = await ehr.connect(acc0).ownerOf(RECORD_ID);
    log('STEP 6 ownerOf(recordId)', eq(o, acc3.address), `owner=${o} expected(patient)=${acc3.address}`);
  } catch (e) { log('STEP 6 ownerOf', false, shortErr(e)); }

  // ================= STEP 7: tokenURI + balanceOf =================
  try {
    const uri = await ehr.connect(acc0).tokenURI(RECORD_ID);
    log('STEP 7a tokenURI(recordId)', uri.indexOf('Rawat Jalan - Poli Umum') >= 0, `tokenURI="${uri}"`);
  } catch (e) { log('STEP 7a tokenURI', false, shortErr(e)); }
  try {
    const bal = await ehr.connect(acc0).balanceOf(acc3.address);
    log('STEP 7b balanceOf(acc3)', bal === 1n, `balance=${bal} expected=1`);
  } catch (e) { log('STEP 7b balanceOf', false, shortErr(e)); }

  // ================= STEP 8: grant/has/revoke access =================
  // Prereq access (needed by createRecord) is active -> revoke it first so the
  // grant -> true -> revoke -> false sequence below starts from clean state.
  try {
    const tx = await ehr.connect(acc3).revokeAccess(PATIENT_ID, DOCTOR_ID);
    await tx.wait();
    log('PREREQ revokeAccess(reset)', true, 'cleared prereq access for clean step-8 test');
  } catch (e) { log('PREREQ revokeAccess(reset)', false, shortErr(e)); }

  try {
    const tx = await ehr.connect(acc3).grantAccess(PATIENT_ID, DOCTOR_ID);
    const r = await tx.wait();
    const has = await ehr.connect(acc0).hasAccess(DOCTOR_ID, PATIENT_ID);
    log('STEP 8a grantAccess + hasAccess(doctor,patient)', r.status === 1 && has === true, `hasAccess=${has} expected=true`);
  } catch (e) { log('STEP 8a grantAccess + hasAccess', false, shortErr(e)); }

  try {
    const tx = await ehr.connect(acc3).revokeAccess(PATIENT_ID, DOCTOR_ID);
    const r = await tx.wait();
    const has = await ehr.connect(acc0).hasAccess(DOCTOR_ID, PATIENT_ID);
    log('STEP 8b revokeAccess + hasAccess(doctor,patient)', r.status === 1 && has === false, `hasAccess=${has} expected=false`);
  } catch (e) { log('STEP 8b revokeAccess + hasAccess', false, shortErr(e)); }

  // ================= PREREQ for 9-12: grant access again (record functions need it) =================
  try {
    const tx = await ehr.connect(acc3).grantAccess(PATIENT_ID, DOCTOR_ID);
    await tx.wait();
    log('PREREQ grantAccess(restored for 9-12)', true, 'doctor can read/update record again');
  } catch (e) { log('PREREQ grantAccess(restored)', false, shortErr(e)); }

  // ================= STEP 9: getRecord + verifyRecordIntegrity =================
  try {
    // readable by patient wallet (acc3) or authorized entity; called from acc3
    const rec = await ehr.connect(acc3).getRecord(RECORD_ID);
    const okMeta = rec.metadata === 'Rawat Jalan - Poli Umum';
    const okStatus = String(rec.status) === '0'; // RecordStatus.ADDED
    log('STEP 9a getRecord(recordId)', okMeta && okStatus,
      `patientId=${rec.patientId} doctorId=${rec.doctorId} dataHash=${rec.dataHash} status=${rec.status}(ADDED) metadata="${rec.metadata}" offChainRef=${rec.offChainRef}`);
  } catch (e) { log('STEP 9a getRecord', false, shortErr(e)); }

  try {
    // NOTE: onlyAuthority callers aren't readers; verifyRecordIntegrity checks _canRead -> use patient wallet acc3
    const vH = await ehr.connect(acc3).verifyRecordIntegrity(RECORD_ID, HOSPITAL_ID);
    const vD = await ehr.connect(acc3).verifyRecordIntegrity(RECORD_ID, DOCTOR_ID);
    log('STEP 9b verifyRecordIntegrity', vH === true && vD === false,
      `verify(recordId, hospitalId)=${vH}  |  verify(recordId, doctorId)=${vD}  -> TRUE for hospitalId (stored as dataHash)`);
  } catch (e) { log('STEP 9b verifyRecordIntegrity', false, shortErr(e)); }

  // ================= STEP 10: getStatusHistory (empty) =================
  try {
    const h = await ehr.connect(acc3).getStatusHistory(RECORD_ID);
    log('STEP 10 getStatusHistory(empty)', Array.isArray(h) && h.length === 0, `history.length=${h.length} expected=0`);
  } catch (e) { log('STEP 10 getStatusHistory', false, shortErr(e)); }

  // ================= STEP 11: updateRecordStatus x3 =================
  try {
    const tx = await ehr.connect(acc2).updateRecordStatus(RECORD_ID, DOCTOR_ID, 1);
    await tx.wait();
    log('STEP 11a updateRecordStatus(1=DIAGNOSED)', true, 'ADDED -> DIAGNOSED by doctorId(acc2)');
  } catch (e) { log('STEP 11a updateRecordStatus(DIAGNOSED)', false, shortErr(e)); }
  try {
    const tx = await ehr.connect(acc2).updateRecordStatus(RECORD_ID, DOCTOR_ID, 2);
    await tx.wait();
    log('STEP 11b updateRecordStatus(2=TREATED)', true, 'DIAGNOSED -> TREATED');
  } catch (e) { log('STEP 11b updateRecordStatus(TREATED)', false, shortErr(e)); }
  try {
    const tx = await ehr.connect(acc2).updateRecordStatus(RECORD_ID, DOCTOR_ID, 3);
    await tx.wait();
    log('STEP 11c updateRecordStatus(3=DISCHARGED)', true, 'TREATED -> DISCHARGED');
  } catch (e) { log('STEP 11c updateRecordStatus(DISCHARGED)', false, shortErr(e)); }

  try {
    const h = await ehr.connect(acc3).getStatusHistory(RECORD_ID);
    const rec = await ehr.connect(acc3).getRecord(RECORD_ID);
    const ok = h.length === 3 && String(rec.status) === '3';
    log('STEP 11d history=3 && status=DISCHARGED', ok,
      `history.length=${h.length} expected=3; record.status=${rec.status} expected=3; last change: ${h.length ? h[h.length-1].previousStatus + '->' + h[h.length-1].newStatus : 'n/a'}`);
  } catch (e) { log('STEP 11d history/status check', false, shortErr(e)); }

  // ================= STEP 12: negative tests (must revert) =================
  await expectRevert('STEP 12a updateRecordStatus(3) again (invalid transition)',
    async () => { const t = await ehr.connect(acc2).updateRecordStatus(RECORD_ID, DOCTOR_ID, 3); await t.wait(); });

  await expectRevert('STEP 12b createRecord by acc3 (patient, not authority/doctor)',
    async () => { const t = await ehr.connect(acc3).createRecord(PATIENT_ID, DOCTOR_ID, HOSPITAL_ID, 'ipfs://x', 'm'); await t.wait(); });

  await expectRevert('STEP 12c transferFrom by acc4 (not owner, not approved)',
    async () => { const t = await ehr.connect(acc4).transferFrom(acc3.address, acc4.address, RECORD_ID); await t.wait(); });

  await expectRevert('STEP 12d ownerOf(999) (nonexistent token)',
    async () => { await ehr.connect(acc0).ownerOf(999); });

  // ================= STEP 13: NFT transfer acc3 -> acc4 =================
  try {
    const tx = await ehr.connect(acc3).safeTransferFrom(acc3.address, acc4.address, RECORD_ID);
    const r = await tx.wait();
    const o = await ehr.connect(acc0).ownerOf(RECORD_ID);
    const b3 = await ehr.connect(acc0).balanceOf(acc3.address);
    const b4 = await ehr.connect(acc0).balanceOf(acc4.address);
    const ro = await ehr.connect(acc0).getRecordOwner(RECORD_ID);
    const ok = r.status === 1 && eq(o, acc4.address) && b3 === 0n && b4 === 1n && eq(ro, acc4.address);
    log('STEP 13 safeTransferFrom(acc3->acc4)', ok,
      `ownerOf=${o} balanceOf(acc3)=${b3} balanceOf(acc4)=${b4} getRecordOwner=${ro}`);
  } catch (e) { log('STEP 13 safeTransferFrom', false, shortErr(e)); }

  console.log('SUMMARY| pass=' + pass + ' fail=' + fail);
  failures.forEach(f => console.log('FAILURE| ' + f));
})();
