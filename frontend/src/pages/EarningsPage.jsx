import { useEffect, useState } from 'react'
import { api } from '../api'

export default function EarningsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    api('/providers/me/earnings')
      .then((result) => {
        if (!ignore) setData(result)
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
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold">Earnings</h1>

      {error && <p className="mt-4 text-danger">{error}</p>}
      {loading && <p className="mt-4 text-muted">Loading...</p>}

      {data && (
        <>
          <div className="mt-4 max-w-sm rounded-lg border bg-surface p-4">
            <p className="text-sm text-muted">Total earned</p>
            <p className="text-3xl font-bold text-available">${data.total}</p>
            <p className="mt-1 text-xs text-muted">
              You are paid when a booking is made. A cancelled booking is taken back.
            </p>
          </div>

          <h2 className="mt-8 text-lg font-semibold">By GPU</h2>
          {data.gpus.length === 0 ? (
            <p className="mt-2 text-muted">You have not listed any GPUs yet.</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-lg border bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-raised text-muted">
                  <tr>
                    <th className="p-3">GPU</th>
                    <th className="p-3 text-right">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gpus.map((g) => (
                    <tr key={g.gpu_id} className="border-b last:border-0">
                      <td className="p-3">
                        {g.model} <span className="text-muted">#{g.gpu_id}</span>
                      </td>
                      <td className="p-3 text-right font-medium">${g.earned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}