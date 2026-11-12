import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import BrowsePage from './pages/BrowsePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import GPUDetailPage from './pages/GPUDetailPage'
import RoleRoute from './components/RoleRoute'
import BookingsPage from './pages/BookingsPage'
import WalletPage from './pages/WalletPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<BrowsePage />} />
        <Route path="/gpus/:gpuId" element={<GPUDetailPage />} />
        <Route
          path="/bookings"
          element={
            <RoleRoute role="renter">
              <BookingsPage />
            </RoleRoute>
          }
        />
        <Route path="/wallet" element={<WalletPage />} />
        <Route
          path="/dashboard"
          element={
            <RoleRoute role="provider">
              <DashboardPage />
            </RoleRoute>
          }
        />
      </Route>
    </Routes>
  )
}