import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth'

function NavItem({ to, end, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `font-mono text-xs uppercase tracking-wider transition-colors ${
          isActive ? 'text-brand' : 'text-muted hover:text-ink'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <NavLink
            to="/browse"
            className="flex items-center gap-2 font-mono text-sm font-semibold uppercase tracking-widest text-brand"
          >
            <span className="h-2 w-2 rounded-full bg-available" />
            Rackly
          </NavLink>
          <NavItem to="/browse" >
            Browse
          </NavItem>
          <NavItem to="/datacenter">Datacenter</NavItem>
          {user.role === 'renter' && <NavItem to="/bookings">My bookings</NavItem>}
          {user.role === 'provider' && (
            <>
              <NavItem to="/dashboard" end>
                My GPUs
              </NavItem>
              <NavItem to="/dashboard/bookings">Rentals</NavItem>
              <NavItem to="/dashboard/earnings">Earnings</NavItem>
            </>
          )}
          <NavItem to="/wallet">Wallet</NavItem>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted">
            {user.email} · {user.role}
          </span>
          <button
            onClick={logout}
            className="rounded border border-line px-3 py-1 font-mono text-xs uppercase tracking-wider text-ink hover:border-brand hover:text-brand"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  )
}