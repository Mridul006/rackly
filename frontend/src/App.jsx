import { useEffect, useState } from 'react'
import { api } from './api'

function App() {
  const [status, setStatus] = useState('loading...')

  useEffect(() => {
    api('/health')
      .then((data) => setStatus(data.status))
      .catch((err) => setStatus(err.message))
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-blue-600">Rackly</h1>
      <p className="mt-2">API status: {status}</p>
    </div>
  )
}

export default App