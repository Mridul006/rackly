import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="mt-16 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">404</p>
      <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
      <Link to="/browse" className="mt-4 inline-block text-brand">
        Back to browse
      </Link>
    </div>
  )
}