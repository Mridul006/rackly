import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'

const PAGE_SIZE = 10

const TYPE_LABELS = {
  deposit: 'Deposit',
  booking_charge: 'Booking payment',
  refund: 'Refund',
  provider_payout: 'Booking earnings',
  payout_reversal: 'Earnings reversed (cancelled booking)',
}

function formatTime(iso) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function formatSigned(value) {
  const n = Number(value)
  return `${n < 0 ? '-' : '+'}$${Math.abs(n).toFixed(2)}`
}

export default function WalletPage() {
  const { user } = useAuth()
  const isRenter = user.role === 'renter'

  const [balance, setBalance] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [offset, setOffset] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const [amount, setAmount] = useState('')
  const [depositError, setDepositError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')

    Promise.all([
      api('/wallet'),
      api(`/wallet/transactions?limit=${PAGE_SIZE + 1}&offset=${offset}`),
    ])
      .then(([wallet, rows]) => {
        if (ignore) return
        setBalance(wallet.balance)
        setHasNext(rows.length > PAGE_SIZE)
        setTransactions(rows.slice(0, PAGE_SIZE))
      })
      .catch((err) => {
        if (!ignore) setError(err.message)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [offset, reloadKey])

  async function handleDeposit(e) {
    e.preventDefault()
    setDepositError('')
    setNotice('')
    setSubmitting(true)
    try {
      await api('/wallet/deposits', { method: 'POST', body: { amount } })
      setNotice(`$${Number(amount).toFixed(2)} added to your wallet.`)
      setAmount('')
      setOffset(0)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setDepositError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Wallet</h1>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      <div className="mt-4 max-w-sm rounded-lg border bg-white p-4">
        <p className="text-sm text-gray-600">Current balance</p>
        <p className="text-3xl font-bold text-blue-600">
          {balance === null ? '...' : `$${balance}`}
        </p>
      </div>

      {isRenter && (
        <form onSubmit={handleDeposit} className="mt-6 max-w-sm space-y-3 rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold">Add money</h2>
          <p className="text-sm text-gray-500">
            This is a simulated deposit. No real payment is made.
          </p>
          <input
            type="number"
            min="0.01"
            max="10000"
            step="0.01"
            placeholder="Amount (max 10,000)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full rounded border p-2"
          />
          {depositError && <p className="text-red-600">{depositError}</p>}
          {notice && <p className="text-green-700">{notice}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-blue-600 p-2 text-white disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add money'}
          </button>
        </form>
      )}

      <h2 className="mt-8 text-lg font-semibold">History</h2>

      {loading && <p className="mt-4 text-gray-500">Loading...</p>}
      {!loading && !error && transactions.length === 0 && (
        <p className="mt-4 text-gray-500">No transactions yet.</p>
      )}

      {!loading && transactions.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-gray-600">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">What</th>
                <th className="p-3">Booking</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="p-3">{formatTime(t.created_at)}</td>
                  <td className="p-3">{TYPE_LABELS[t.type] ?? t.type}</td>
                  <td className="p-3">
                    {t.booking_id ? (
                      isRenter ? (
                        <Link to="/bookings" className="text-blue-600">
                          #{t.booking_id}
                        </Link>
                      ) : (
                        <span>#{t.booking_id}</span>
                      )
                    ) : (
                      '-'
                    )}
                  </td>
                  <td
                    className={`p-3 text-right font-medium ${
                      Number(t.amount) < 0 ? 'text-red-600' : 'text-green-700'
                    }`}
                  >
                    {formatSigned(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          disabled={offset === 0}
          className="rounded border bg-white px-4 py-2 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600">Page {offset / PAGE_SIZE + 1}</span>
        <button
          onClick={() => setOffset(offset + PAGE_SIZE)}
          disabled={!hasNext}
          className="rounded border bg-white px-4 py-2 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}