"""
pages_ui/dashboard.py : halaman Dashboard.
Semua angka diambil dari smart contract (bukan dummy):
  - jumlah pasien / dokter+RS   -> patientIdOf(), entityIdOf(), getEntity()   (loop akun Hardhat)
  - jumlah rekam medis (NFT)    -> getRecordOwner(1), (2), ... sampai revert
  - izin akses aktif            -> hasAccess(targetId, patientId)             (loop dokter x pasien)
  - info token/kontrak          -> name(), symbol(), owner()
"""
import pandas as pd
import streamlit as st

from common import RPC_URL, PROJECT_DIR, ARTIFACT_PATH, DEPLOYMENT_PATH, HERO, show_hero, show_df, kv_html, short, when


def render(ctx):
    C, w3 = ctx.C, ctx.w3
    snap = ctx.snapshot()
    patients, entities = snap["patients"], snap["entities"]
    n_rec, links = len(snap["record_owners"]), snap["links"]
    latest = w3.eth.get_block("latest")

    # ---------- hero 3D (jumlah blok yang berputar mengikuti jumlah rekam medis) ----------
    show_hero(HERO.replace("__N__", str(min(max(n_rec, 8), 14))))

    # ---------- statistik ----------
    cells = [(latest["number"], "Blok terbaru"), (len(patients), "Pasien terdaftar"),
             (len(entities), "Dokter dan RS"), (n_rec, "Rekam medis (NFT)"), (len(links), "Izin akses aktif")]
    st.markdown('<div class="stat">' + "".join(
        f'<div><b class="cnt" style="--v:{v}" aria-label="{v}"></b><span class="l">{l}</span></div>'
        for v, l in cells) + '</div>'
        '<div class="flow"><span class="n"><i>1</i>Input</span><span class="a"></span><span class="n"><i>2</i>Validasi kontrak</span><span class="a"></span>'
        '<span class="n"><i>3</i>Authority menandatangani</span><span class="a"></span><span class="n"><i>4</i>Blok ditambahkan</span><span class="a"></span>'
        '<span class="n"><i>5</i>NFT dicetak</span></div>', unsafe_allow_html=True)

    left, right = st.columns([1, 1.2])

    # ---------- status koneksi blockchain ----------
    with left:
        st.markdown("#### Status koneksi blockchain")
        try:
            token = f"{C.functions.name().call()} ({C.functions.symbol().call()})"
            owner = C.functions.owner().call()
        except Exception:
            token, owner = "-", "-"
        st.markdown(kv_html([
            ("Proyek", "Rekam Medis Pasien (EHR) berbasis blockchain, konsensus Proof of Authority"),
            ("Status RPC", "Terhubung" if ctx.rpc_ok else "Terputus"),
            ("RPC URL", RPC_URL),
            ("Chain ID", w3.eth.chain_id),
            ("Token ERC-721", token),
            ("Owner kontrak", owner),
            ("Sumber ABI", ARTIFACT_PATH.relative_to(PROJECT_DIR).as_posix()),
            ("Sumber alamat", DEPLOYMENT_PATH.name),
        ]), unsafe_allow_html=True)
        st.caption("Alamat kontrak (klik ikon di kanan untuk menyalin):")
        st.code(ctx.address, language=None)

    # ---------- ringkasan aktivitas & izin akses ----------
    with right:
        st.markdown("#### Ringkasan izin akses")
        if not patients or not entities:
            st.info("Belum ada pasien atau dokter/RS. Daftarkan dulu di halaman 'Fitur lama (sementara)' tab Registrasi.")
        else:
            active = set(links)
            cols = {e["wallet"]: f"{'Dokter' if e['role'] == 1 else 'RS'} {e['nama']}" for e in entities}
            rows = []
            for p in patients:
                row = {"Pasien": f"{short(p['wallet'])} · ID {short(p['id'])}"}
                for e in entities:
                    row[cols[e["wallet"]]] = "AKTIF" if (p["wallet"], e["wallet"]) in active else "tidak aktif"
                rows.append(row)
            show_df(pd.DataFrame(rows))
            st.caption(f"{len(links)} dari {len(patients) * len(entities)} kemungkinan izin sedang AKTIF "
                       f"({len(patients)} pasien × {len(entities)} dokter/RS). Pasien yang mengatur izin ini.")

        st.markdown("##### Aktivitas jaringan")
        st.markdown(kv_html([
            ("Blok terbaru", f"#{latest['number']} · {when(latest['timestamp'])}"),
            ("Transaksi di blok itu", len(latest["transactions"])),
            ("Authority terdaftar", f"{len(snap['authorities'])} akun"),
        ]), unsafe_allow_html=True)
