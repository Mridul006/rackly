import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import SceneBackdrop from '../components/SceneBackdrop'

const REPO_URL = 'https://github.com/Mridul006/rackly'
const API_DOCS = `${import.meta.env.VITE_API_URL}/docs`

const navLink =
  'font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-ink'
const primaryBtn =
  'rounded-sm bg-brand px-4 py-2 font-mono text-xs font-medium uppercase tracking-wider text-page transition-opacity hover:opacity-90'
const ghostBtn =
  'rounded-sm border border-line px-4 py-2 font-mono text-xs uppercase tracking-wider text-ink transition-colors hover:border-brand hover:text-brand'

const RENTER_STEPS = [
  { title: 'Add funds', text: 'Top up your wallet. Payments are simulated, so no real money moves.' },
  { title: 'Pick a GPU and a time', text: 'Filter by price, model and size, then book from one hour upward.' },
  { title: 'Cancel before it starts', text: 'Cancel an upcoming booking and the full amount returns to your wallet.' },
]

const PROVIDER_STEPS = [
  { title: 'List your GPU', text: 'Add the model, memory, count and hourly price. Rackly assigns its place in the room.' },
  { title: 'Open availability', text: 'Choose the windows when renters are allowed to book it.' },
  { title: 'Get paid per booking', text: 'Earnings arrive when a booking is made, and you can see every one.' },
]

const FACTS = [
  { label: 'Range', title: 'One hour to a year', text: 'Book for as long as a provider has opened up, in whole hours.' },
  { label: 'Integrity', title: 'No double bookings', text: 'Enforced by a PostgreSQL constraint, not only by application code.' },
  { label: 'Money', title: 'A ledger, not a balance', text: 'Every deposit, charge, refund and payout is a row you can trace.' },
]

const STACK = ['FastAPI', 'PostgreSQL', 'React', 'Three.js', 'Docker']

function Cross({ className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute select-none font-mono text-xs leading-none text-muted ${className}`}
    >
      +
    </span>
  )
}

function AuthButtons() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) {
    return (
      <Link to="/browse" className={primaryBtn}>
        Open app
      </Link>
    )
  }
  return (
    <>
      <Link to="/signup" className={primaryBtn}>
        Sign up
      </Link>
      <Link to="/login" className={ghostBtn}>
        Log in
      </Link>
    </>
  )
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-page/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          to="/"
          className="flex items-center gap-2 font-mono text-sm font-semibold uppercase tracking-widest text-brand"
        >
          <span className="h-2 w-2 rounded-full bg-available" />
          Rackly
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <a href="#how" className={navLink}>
            How it works
          </a>
          <a href="#under-the-hood" className={navLink}>
            Under the hood
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={navLink}>
            GitHub ↗
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <AuthButtons />
        </div>
      </div>
    </header>
  )
}

function StepColumn({ title, steps, className = '' }) {
  return (
    <div className={`p-8 ${className}`}>
      <h3 className="font-mono text-xs uppercase tracking-widest text-brand">{title}</h3>
      <ol className="mt-6 space-y-6">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="mt-1 text-sm text-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen">
      <SceneBackdrop />

      <div className="relative z-10">
        <LandingNav />

        <div className="mx-auto max-w-7xl border-x border-line">
          <section className="relative border-b border-line">
            <Cross className="-left-[5px] -top-[7px]" />
            <Cross className="-right-[5px] -top-[7px]" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-linear-to-r from-page/85 via-page/35 to-transparent"
            />
            <div className="relative flex min-h-[85vh] flex-col justify-end px-8 pb-16 pt-24">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">GPU marketplace</p>
              <h1 className="mt-4 text-5xl font-light leading-[1.05] tracking-tight sm:text-7xl">
                Rent GPUs
                <br />
                by the hour.
              </h1>
              <p className="mt-6 max-w-md text-muted">
                A marketplace for datacenter GPUs. List your hardware, or book someone else's from one
                hour to a year.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <AuthButtons />
              </div>
            </div>
            <div className="relative flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-line bg-page/50 px-8 py-4 font-mono text-xs uppercase tracking-widest text-muted">
              {STACK.map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <i className="h-1 w-1 rounded-full bg-brand" />
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section id="how" className="border-b border-line bg-page/90">
            <div className="px-8 pt-16">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">How it works</p>
              <h2 className="mt-3 max-w-xl text-3xl font-light tracking-tight sm:text-4xl">
                Two sides of one room.
              </h2>
            </div>
            <div className="mt-12 grid border-t border-line md:grid-cols-2">
              <StepColumn
                title="For renters"
                steps={RENTER_STEPS}
                className="border-b border-line md:border-b-0 md:border-r"
              />
              <StepColumn title="For providers" steps={PROVIDER_STEPS} />
            </div>
          </section>

          <section id="under-the-hood" className="border-b border-line bg-page/90">
            <div className="px-8 pt-16">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">Under the hood</p>
              <h2 className="mt-3 max-w-xl text-3xl font-light tracking-tight sm:text-4xl">
                Built to be trusted.
              </h2>
            </div>
            <div className="mt-12 grid border-t border-line md:grid-cols-3">
              {FACTS.map((fact, i) => (
                <div
                  key={fact.title}
                  className={`p-8 ${
                    i < FACTS.length - 1 ? 'border-b border-line md:border-b-0 md:border-r' : ''
                  }`}
                >
                  <p className="font-mono text-xs uppercase tracking-widest text-muted">{fact.label}</p>
                  <p className="mt-3 text-xl font-light">{fact.title}</p>
                  <p className="mt-2 text-sm text-muted">{fact.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-page/90 px-8 py-24">
            <h2 className="max-w-2xl text-4xl font-light leading-tight tracking-tight sm:text-6xl">
              Your GPUs. Their workloads. One room.
            </h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <AuthButtons />
            </div>
          </section>
        </div>

        <footer className="border-t border-line bg-page">
          <div className="mx-auto grid max-w-7xl gap-8 px-8 py-10 text-sm text-muted md:grid-cols-3">
            <p>Payments are simulated and no real money moves.</p>
            <div className="flex flex-col gap-2">
              <a href={REPO_URL} target="_blank" rel="noreferrer" className={navLink}>
                Source on GitHub ↗
              </a>
              <a href={API_DOCS} target="_blank" rel="noreferrer" className={navLink}>
                API documentation ↗
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}