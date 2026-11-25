import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Access from './pages/Access'
import AddRecord from './pages/AddRecord'
import ComingSoon from './pages/ComingSoon'
import Dashboard from './pages/Dashboard'
import PatientDetail from './pages/PatientDetail'
import Patients from './pages/Patients'
import RecordDetail from './pages/RecordDetail'
import Records from './pages/Records'
import Register from './pages/Register'
import Verify from './pages/Verify'
import Wallet from './pages/Wallet'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="records" element={<Records />} />
        <Route path="records/new" element={<AddRecord />} />
        <Route path="records/:id" element={<RecordDetail />} />
        <Route path="register" element={<Register />} />
        <Route path="access" element={<Access />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="verify" element={<Verify />} />
        <Route path="verify/:id" element={<Verify />} />
        <Route path="*" element={<ComingSoon />} />
      </Route>
    </Routes>
  )
}
