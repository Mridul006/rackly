import { Link } from 'react-router-dom'
import AuthBackdrop from './AuthBackdrop'

export default function AuthLayout({ eyebrow, title, notice, footer, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,32rem)_1fr]">
      <div className="flex flex-col border-r border-line bg-surface/95 px-8 py-8 sm:px-12">
        <Link
          to="/"
          className="flex items-center gap-2 font-mono text-sm font-semibold uppercase tracking-widest text-brand"
        >
          <span className="h-2 w-2 rounded-full bg-available" />
          Rackly
        </Link>

        <div className="flex flex-1 flex-col justify-center py-12">
          <p className="font-mono text-xs uppercase tracking-widest text-muted">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-light tracking-tight">{title}</h1>
          {notice}
          <div className="mt-8">{children}</div>
          {footer && <p className="mt-6 text-sm text-muted">{footer}</p>}
        </div>

        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          Portfolio project · payments are simulated
        </p>
      </div>

      <AuthBackdrop />
    </div>
  )
}   