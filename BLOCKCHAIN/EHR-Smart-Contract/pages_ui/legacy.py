"""
pages_ui/legacy.py : 5 tab lama (Registrasi, Rekam medis, Hak akses, Baca dan verifikasi, Ledger).
SEMENTARA: dibiarkan utuh supaya tidak ada fungsi yang hilang. Di tahap berikutnya
tiap bagian dipindah ke halaman yang sesuai, lalu file ini dihapus.
"""
import html as H
import json

import pandas as pd
import streamlit as st
from web3 import Web3

from common import (STORE, STATUS, ZERO32, Fernet, cipher, logo, hx, when)


def render(ctx):
    # nama-nama lama dipetakan ke ctx supaya kode tab tidak perlu diubah
    C, w3, accts, actor = ctx.C, ctx.w3, ctx.accts, ctx.actor
    send, pick, lab = ctx.send, ctx.pick, ctx.lab
    pid_of, eid_of, explain = ctx.pid_of, ctx.eid_of, ctx.explain
    rows = ctx.ledger()

    t1, t2, t3, t4, t5 = st.tabs(["Registrasi", "Rekam medis", "Hak akses", "Baca dan verifikasi", "Ledger"])

    # ---------- A. Registrasi ----------
    with t1:
        st.caption("Hanya authority yang boleh mendaftarkan pasien, dokter, dan rumah sakit.")
        c1, c2 = st.columns(2)
        with c1:
            st.markdown("#### Pasien baru")
            with st.form("f_pasien"):
                w = pick("Wallet pasien", "rp_w")
                nama = st.text_input("Nama lengkap", "Siti Aminah")
                nik = st.text_input("NIK (16 digit)", "3209012345670001", max_chars=16)
                tgl = st.text_input("Tanggal lahir", "2001-05-17")
                alamat = st.text_input("Alamat", "Jl. Pemuda No. 12 Cirebon")
                gol = st.selectbox("Golongan darah", ["A", "B", "AB", "O"], index=3)
                tel = st.text_input("No. telepon", "081234567890")
                go = st.form_submit_button("Daftarkan pasien", type="primary")
            if go:
                if len(nik) != 16 or not nik.isdigit():
                    st.error("NIK harus tepat 16 digit angka.")
                else:
                    send(C.functions.registerPatient(w, (nama, nik, tgl, alamat, gol, tel)), "Pasien terdaftar",
                         lambda rc: f"ID pasien: {hx(pid_of(w))}")
        with c2:
            st.markdown("#### Dokter atau rumah sakit")
            with st.form("f_entity"):
                w = pick("Wallet dokter / RS", "re_w")
                role = st.radio("Peran", ["Dokter", "Rumah Sakit"], horizontal=True)
                en = st.text_input("Nama", "dr. Hamdan, M.Kom")
                izin = st.text_input("Nomor izin", "STR-3209-0001")
                det = st.text_input("Spesialisasi (dokter) atau alamat (RS)", "Spesialis Penyakit Dalam")
                go = st.form_submit_button("Daftarkan", type="primary")
            if go:
                send(C.functions.registerEntity(w, en, izin, det, 1 if role == "Dokter" else 2), f"{role} terdaftar",
                     lambda rc: f"ID: {hx(eid_of(w))}")

    # ---------- B. Rekam medis ----------
    with t2:
        st.caption("Data medis dienkripsi dan disimpan off-chain. Blockchain hanya menyimpan hash-nya, lalu NFT dicetak ke wallet pasien.")
        c1, c2 = st.columns(2)
        with c1:
            st.markdown("#### Buat rekam medis")
            if Fernet is None:
                st.error("Pasang library enkripsi dulu: python -m pip install cryptography")
            with st.form("f_rec"):
                pw = pick("Pasien", "cr_p")
                dw = pick("Dokter", "cr_d")
                dx = st.text_area("Diagnosis", "Hipertensi stadium 1", height=70)
                lb = st.text_area("Hasil lab", "Tekanan darah 150/95 mmHg", height=70)
                rx = st.text_area("Resep obat", "Amlodipine 5 mg, 1x sehari", height=70)
                meta = st.text_input("Metadata publik (non-sensitif)", "Rawat Jalan - Poli Umum")
                go = st.form_submit_button("Simpan dan cetak NFT", type="primary", disabled=Fernet is None)
            if go:
                pid, did = pid_of(pw), eid_of(dw)
                if pid == ZERO32:
                    st.error("Wallet pasien belum terdaftar sebagai pasien.")
                elif did == ZERO32:
                    st.error("Wallet dokter belum terdaftar.")
                else:
                    enc = cipher().encrypt(json.dumps({"diagnosis": dx, "hasil_lab": lb, "resep_obat": rx}).encode())
                    dh = Web3.keccak(enc)
                    f = STORE / (hx(dh)[2:] + ".enc")
                    f.write_bytes(enc)
                    rc = send(C.functions.createRecord(pid, did, dh, "local://" + f.name, meta), "Rekam medis dibuat",
                              lambda rc: "Token ID: " + str(C.events.RecordCreated().process_receipt(rc)[0]["args"]["recordId"]))
                    if rc is None and f.exists():
                        f.unlink()
        with c2:
            st.markdown("#### Perbarui status")
            with st.form("f_status"):
                rid = st.number_input("Token ID rekam medis", min_value=1, value=1, step=1, key="us_id")
                dw = pick("Dokter", "us_d")
                ns = st.selectbox("Status baru", [1, 2, 3], format_func=lambda i: STATUS[i])
                go = st.form_submit_button("Perbarui status", type="primary")
            if go:
                did = eid_of(dw)
                if did == ZERO32:
                    st.error("Wallet dokter belum terdaftar.")
                else:
                    send(C.functions.updateRecordStatus(int(rid), did, ns), f"Status menjadi {STATUS[ns]}")
            st.markdown("#### Transfer NFT")
            with st.form("f_tf"):
                tid = st.number_input("Token ID", min_value=1, value=1, step=1, key="tf_id")
                to = pick("Penerima", "tf_to")
                go = st.form_submit_button("Transfer NFT")
            if go:
                send(C.functions.transferFrom(actor, to, int(tid)), f"NFT #{int(tid)} dipindah")
            st.caption("Transfer hanya memindahkan kepemilikan token. Hak akses data tetap melekat pada ID pasien.")

    # ---------- C. Hak akses ----------
    with t3:
        st.caption("Pasien yang mengendalikan siapa yang boleh membaca datanya. Pilih akun pasien di 'Bertindak sebagai'.")
        c1, c2 = st.columns(2)
        pw = c1.selectbox("Pasien", accts, format_func=lab, key="ac_p")
        tw = c2.selectbox("Dokter / RS", accts, format_func=lab, key="ac_t")
        pid, tid_ = pid_of(pw), eid_of(tw)
        if pid == ZERO32 or tid_ == ZERO32:
            st.warning("Pilih wallet pasien dan wallet dokter/RS yang sudah terdaftar.")
        else:
            active = C.functions.hasAccess(tid_, pid).call()
            st.markdown(
                f'<div class="step"><span class="dot" style="background:{"#2DD4A7" if active else "#FF7A6B"};'
                f'box-shadow:0 0 12px {"#2DD4A7" if active else "#FF7A6B"}"></span>'
                f'Akses saat ini: <b>{"AKTIF" if active else "tidak aktif"}</b></div>', unsafe_allow_html=True)
            b1, b2, _ = st.columns([1, 1, 3])
            if b1.button("Beri akses", type="primary"):
                send(C.functions.grantAccess(pid, tid_), "Akses diberikan")
            if b2.button("Cabut akses"):
                send(C.functions.revokeAccess(pid, tid_), "Akses dicabut")

    # ---------- D. Baca dan verifikasi ----------
    with t4:
        st.caption("Pembacaan memakai akun yang sedang aktif. Hanya pasien pemilik data atau dokter/RS berizin yang boleh membaca.")
        rid = st.number_input("Token ID rekam medis", min_value=1, value=1, step=1, key="rd_id")
        if st.button("Baca rekam medis", type="primary"):
            try:
                rec = C.functions.getRecord(int(rid)).call({"from": actor})
                owner = C.functions.getRecordOwner(int(rid)).call()
                hist = C.functions.getStatusHistory(int(rid)).call({"from": actor})
                cl, cr = st.columns([1, 1.25])
                cl.markdown(
                    f'<div class="nftwrap"><div class="nft"><div class="nft-top">{logo("lgc")}<span>EHR NFT</span>'
                    f'<em class="badge s{rec[6]}">{STATUS[rec[6]]}</em></div>'
                    f'<div class="holo"><svg viewBox="0 0 64 64"><path d="M28 12h8v16h16v8H36v16h-8V36H12v-8h16z" fill="#22D3EE"/></svg></div>'
                    f'<div class="nft-id">#{rec[0]}</div><p>{H.escape(rec[3])}</p><small>{hx(rec[4])}</small></div></div>', unsafe_allow_html=True)
                cr.markdown(
                    f'<dl class="kv"><dt>Pemilik NFT</dt><dd>{owner}</dd><dt>ID pasien</dt><dd>{hx(rec[1])}</dd>'
                    f'<dt>ID dokter</dt><dd>{hx(rec[2])}</dd><dt>Referensi off-chain</dt><dd>{H.escape(rec[5])}</dd>'
                    f'<dt>Dibuat</dt><dd>{when(rec[7])}</dd><dt>Diperbarui</dt><dd>{when(rec[8])}</dd></dl>', unsafe_allow_html=True)
                st.markdown("##### Perjalanan status")
                steps = [f'<div class="step"><span class="dot"></span>ADDED · {when(rec[7])}</div>']
                steps += [f'<div class="step"><span class="dot"></span>{STATUS[h[1]]} · {when(h[3])}</div>' for h in hist]
                st.markdown("".join(steps), unsafe_allow_html=True)
                st.markdown("##### Data medis off-chain")
                f = STORE / rec[5].replace("local://", "")
                if not f.exists():
                    st.info("File terenkripsi tidak ada di folder offchain_store pada komputer ini.")
                else:
                    raw = f.read_bytes()
                    ok = C.functions.verifyRecordIntegrity(int(rid), Web3.keccak(raw)).call({"from": actor})
                    if ok and Fernet:
                        st.success("Integritas terverifikasi: hash file cocok dengan hash di blockchain.")
                        d = json.loads(cipher().decrypt(raw))
                        st.write("**Diagnosis:**", d["diagnosis"])
                        st.write("**Hasil lab:**", d["hasil_lab"])
                        st.write("**Resep obat:**", d["resep_obat"])
                    else:
                        st.error("Integritas data gagal: hash file tidak cocok dengan blockchain.")
            except Exception as e:
                st.error(explain(e))
        st.divider()
        st.markdown("#### Riwayat pasien")
        hp = st.selectbox("Pasien", accts, format_func=lab, key="hp")
        if st.button("Tampilkan riwayat"):
            pid = pid_of(hp)
            if pid == ZERO32:
                st.warning("Wallet ini bukan pasien terdaftar.")
            else:
                try:
                    h = C.functions.getPatientHistory(pid).call({"from": actor})
                    st.dataframe(pd.DataFrame([{"Token": r[0], "Metadata": r[3], "Status": STATUS[r[6]],
                                                "Dibuat": when(r[7]), "Diperbarui": when(r[8])} for r in h]),
                                 use_container_width=True, hide_index=True)
                except Exception as e:
                    st.error(explain(e))

    # ---------- E. Ledger ----------
    with t5:
        st.caption("Jejak audit dari seluruh event kontrak, terbaru di atas.")
        if rows:
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)
        else:
            st.info("Belum ada transaksi. Mulai dari tab Registrasi.")
