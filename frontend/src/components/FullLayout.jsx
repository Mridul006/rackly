import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function FullLayout() {
  return (
    <div className="flex h-dvh flex-col">
      <Navbar />
      <main className="relative min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}