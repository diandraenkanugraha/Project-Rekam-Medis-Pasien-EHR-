import sys, json
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from fastapi.testclient import TestClient
import main

cl = TestClient(main.app)
A = main.w3.eth.accounts
AUTH, PAT, DOC, FAM = A[0], A[1], A[2], A[3]


def show(t, r):
    ct = r.headers.get("content-type", "")
    j = r.json() if ct.startswith("application/json") else {"bytes": len(r.content)}
    print(f"[{r.status_code}] {t}:", json.dumps(j, default=str)[:230])
    return j


show("health", cl.get("/api/health"))
j = show("register patient (authority)", cl.post("/api/patients", json=dict(
    actor=AUTH, wallet=PAT, nama="Siti Aminah", nik="3209012345670001", tglLahir="2001-05-17",
    alamat="Jl. Pemuda 12 Cirebon", golDarah="O", noTelepon="081234567890")))
pid = j["patientId"]
show("register patient by NON-authority", cl.post("/api/patients", json=dict(
    actor=DOC, wallet=A[5], nama="X", nik="3209012345670002", tglLahir="2000-01-01",
    alamat="a", golDarah="A", noTelepon="081234567891")))
show("NIK invalid", cl.post("/api/patients", json=dict(
    actor=AUTH, wallet=A[5], nama="X", nik="123", tglLahir="2000-01-01",
    alamat="a", golDarah="A", noTelepon="081234567891")))
j = show("register doctor", cl.post("/api/entities", json=dict(
    actor=AUTH, wallet=DOC, role="doctor", nama="dr. Hamdan, M.Kom",
    nomorIzin="STR-3209-0001", detail="Spesialis Penyakit Dalam")))
did = j["entityId"]
show("createRecord tanpa izin pasien", cl.post("/api/records", data=dict(
    actor=DOC, patient_id=pid, diagnosis="d", hasil_lab="l", resep_obat="r", metadata="Rawat Jalan")))
show("grant by non-patient", cl.post("/api/access/grant", json=dict(actor=AUTH, target_id=did)))
show("grant by patient", cl.post("/api/access/grant", json=dict(actor=PAT, target_id=did)))
show("grant lagi", cl.post("/api/access/grant", json=dict(actor=PAT, target_id=did)))
pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
j = show("createRecord by dokter + PDF", cl.post("/api/records", data=dict(
    actor=DOC, patient_id=pid, diagnosis="Hipertensi stadium 1", hasil_lab="TD 150/95",
    resep_obat="Amlodipine 5 mg", metadata="Rawat Jalan - Poli Umum"),
    files={"file": ("lab.pdf", pdf, "application/pdf")}))
rid = j["recordId"]
show("PDF palsu ditolak", cl.post("/api/records", data=dict(
    actor=DOC, patient_id=pid, diagnosis="d", hasil_lab="l", resep_obat="r", metadata="m"),
    files={"file": ("x.pdf", b"bukan pdf", "application/pdf")}))
show("records (pasien)", cl.get("/api/records", params=dict(actor=PAT)))
show("records (authority) - terkunci", cl.get("/api/records", params=dict(actor=AUTH)))
j = show("record detail (dokter)", cl.get(f"/api/records/{rid}", params=dict(actor=DOC)))
show("record detail (authority) -> AccessDenied", cl.get(f"/api/records/{rid}", params=dict(actor=AUTH)))
show("attachment", cl.get(f"/api/records/{rid}/attachment", params=dict(actor=PAT)))
show("status lompat ke 3", cl.post(f"/api/records/{rid}/status", json=dict(actor=DOC, new_status=3)))
for s in (1, 2, 3):
    show(f"status -> {s}", cl.post(f"/api/records/{rid}/status", json=dict(actor=DOC, new_status=s)))
show("patients (authority)", cl.get("/api/patients", params=dict(actor=AUTH)))
show("patient detail (pasien)", cl.get(f"/api/patients/{pid}", params=dict(actor=PAT)))
show("patient detail (keluarga) ditolak", cl.get(f"/api/patients/{pid}", params=dict(actor=FAM)))
show("transfer NFT", cl.post(f"/api/records/{rid}/transfer", json=dict(actor=PAT, to=FAM)))
show("transfer oleh bukan pemilik", cl.post(f"/api/records/{rid}/transfer", json=dict(actor=AUTH, to=FAM)))
j = show("detail (pasien) setelah transfer", cl.get(f"/api/records/{rid}", params=dict(actor=PAT)))
print("   integrity:", j.get("integrity"), "| offchain:", j.get("offchain"))
show("verify publik", cl.get(f"/api/verify/{rid}"))
show("verify token tidak ada", cl.get("/api/verify/99"))
show("revoke", cl.post("/api/access/revoke", json=dict(actor=PAT, target_id=did)))
show("patients milik dokter setelah revoke", cl.get("/api/patients", params=dict(actor=DOC)))
s = show("stats", cl.get("/api/stats"))
print("   blocks:", len(s["blocks"]))
show("accounts", cl.get("/api/accounts"))
