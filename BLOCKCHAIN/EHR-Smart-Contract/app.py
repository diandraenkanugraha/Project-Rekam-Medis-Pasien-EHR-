"""
app.py : pintu masuk aplikasi (multi-halaman).
Tugasnya hanya: pasang tampilan, koneksi ke blockchain, sidebar (wallet + peran), dan navigasi.
Isi tiap halaman ada di folder pages_ui/.
Jalankan:  streamlit run app.py
"""
import html as H

import streamlit as st

# set_page_config WAJIB jadi perintah Streamlit pertama, jadi dipanggil sebelum import lain milik kita
st.set_page_config(page_title="Rekam Medis Pasien", page_icon="🩺", layout="wide")

import common  # noqa: E402
from common import wallet_component, logo, short  # noqa: E402
from pages_ui import dashboard, legacy  # noqa: E402
from web3 import Web3  # noqa: E402

common.apply_style()

# =========================================================
# KONEKSI (dibuat ulang tiap rerun: deploy ulang cukup refresh halaman)
# =========================================================
ctx = common.Ctx()

# =========================================================
# NAVBAR (tampil di semua halaman)
# =========================================================
st.markdown(
    f'<div class="nav">{logo("lgn")}<b>MEDICHAIN EHR</b><span class="sp"></span>'
    f'<span class="pill"><span class="live{"" if ctx.rpc_ok else " off"}"></span>'
    f'Hardhat {"online" if ctx.rpc_ok else "offline"}</span>'
    '<span class="pill">Proof of Authority</span></div>', unsafe_allow_html=True)

if "flash" in st.session_state:          # hasil transaksi terakhir (dari ctx.send)
    msg, tx = st.session_state.pop("flash")
    st.success(msg)
    if tx:
        st.code(tx)

if ctx.error:
    st.error(ctx.error)
    st.stop()

# =========================================================
# NAVIGASI : satu fungsi per halaman, lalu didaftarkan ke st.navigation
# =========================================================
def page_dashboard():
    dashboard.render(ctx)


def page_legacy():
    legacy.render(ctx)


pages = [
    st.Page(page_dashboard, title="Dashboard", icon="📊", url_path="dashboard", default=True),
    st.Page(page_legacy, title="Fitur lama (sementara)", icon="🧩", url_path="fitur-lama"),
]
pg = st.navigation(pages)     # dipanggil sebelum sidebar lain supaya menu tampil paling atas

# =========================================================
# SIDEBAR : wallet MetaMask + "Bertindak sebagai" (berlaku untuk SEMUA halaman)
# =========================================================
with st.sidebar:
    st.markdown("### Dompet dan peran")
    wr = wallet_component(key="ehr_mm", default={"wallet": {"address": "", "chainId": "", "connected": False}},
                          on_wallet_change=lambda: None)
    wl = wr.wallet
    mm = None
    if wl and wl.get("connected") and wl.get("address"):
        mm = Web3.to_checksum_address(wl["address"])
        try:
            cid = int(wl["chainId"], 16)
        except (ValueError, TypeError):
            cid = None
        if cid != ctx.w3.eth.chain_id:
            st.warning("Jaringan MetaMask berbeda dengan Hardhat. Pilih jaringan Hardhat Local.")
        elif mm in ctx.accts:
            bal = ctx.w3.from_wei(ctx.w3.eth.get_balance(mm), "ether")
            st.caption(f"Saldo MetaMask: {float(bal):,.4f} ETH · peran: {ctx.role_of(mm)}")
        else:
            st.caption("Wallet ini bukan akun bawaan Hardhat, jadi belum bisa dipakai menandatangani di demo ini.")

    # kalau MetaMask baru terhubung, jadikan akun itu sebagai "Bertindak sebagai"
    if mm and mm in ctx.accts and st.session_state.get("last_mm") != mm:
        st.session_state["actor"] = mm
        st.session_state["last_mm"] = mm
    ctx.actor = st.selectbox("Bertindak sebagai", ctx.accts, format_func=ctx.lab, key="actor",
                             help="Akun ini yang menekan tombol (msg.sender). Salah peran akan ditolak kontrak.")
    st.markdown(f'<div class="me">{H.escape(ctx.actor)}</div>', unsafe_allow_html=True)

    st.divider()
    st.caption(f"RPC: {common.RPC_URL}")
    st.caption("Setelah deploy ulang, cukup refresh halaman. Alamat kontrak dibaca otomatis dari deployment.json.")

# =========================================================
# JALANKAN HALAMAN YANG DIPILIH
# =========================================================
pg.run()