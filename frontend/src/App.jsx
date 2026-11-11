import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import BrowsePage from './pages/BrowsePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import GPUDetailPage from './pages/GPUDetailPage'

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
      </Route>
    </Routes>
  )
}