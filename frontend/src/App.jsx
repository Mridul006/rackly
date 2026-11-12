import { Route, Routes } from 'react-router-dom'
import FullLayout from './components/FullLayout'
import GuestRoute from './components/GuestRoute'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'
import BookingsPage from './pages/BookingsPage'
import BrowsePage from './pages/BrowsePage'
import DashboardPage from './pages/DashboardPage'
import DatacenterPage from './pages/DatacenterPage'
import EarningsPage from './pages/EarningsPage'
import GPUDetailPage from './pages/GPUDetailPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import ProviderBookingsPage from './pages/ProviderBookingsPage'
import SignupPage from './pages/SignupPage'
import WalletPage from './pages/WalletPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestRoute>
            <SignupPage />
          </GuestRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/gpus/:gpuId" element={<GPUDetailPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route
          path="/bookings"
          element={
            <RoleRoute role="renter">
              <BookingsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RoleRoute role="provider">
              <DashboardPage />
            </RoleRoute>
          }
        />
        <Route
          path="/dashboard/bookings"
          element={
            <RoleRoute role="provider">
              <ProviderBookingsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/dashboard/earnings"
          element={
            <RoleRoute role="provider">
              <EarningsPage />
            </RoleRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <FullLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/datacenter" element={<DatacenterPage />} />
      </Route>
    </Routes>
  )
}