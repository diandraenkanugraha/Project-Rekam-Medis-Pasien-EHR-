# MediChain EHR - Frontend (React + Three.js)

Tampilan untuk Modul 11-12. Semua data berasal dari smart contract lewat backend FastAPI (Web3.py).

## Urutan menjalankan (4 terminal, dari root project)
1. `npx hardhat node`
2. `npx hardhat run scripts/deploy.js --network localhost`
3. Backend: `cd backend` lalu `uvicorn main:app --reload --port 8000`
4. Frontend: `cd frontend` lalu `npm install` (sekali saja) dan `npm run dev`

Buka http://localhost:5173

## Teknologi
Vite, React 18, Tailwind CSS, Framer Motion, React Three Fiber (three.js), Recharts, qrcode.react.
Panggilan `/api/*` diteruskan oleh Vite ke backend di port 8000 (lihat vite.config.js).
