import { createContext, useContext, useEffect, useState } from 'react'
import { api, clearToken, getToken, setToken } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loggedOut, setLoggedOut] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    api('/users/me')
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const data = await api('/auth/login', {
      method: 'POST',
      form: { username: email, password },
    })
    setToken(data.access_token)
    setUser(await api('/users/me'))
    setUser(await api('/users/me'))
    setLoggedOut(false)
  }

  async function signup(email, password, role) {
    await api('/auth/signup', { method: 'POST', body: { email, password, role } })
    await login(email, password)
  }

  function logout() {
    clearToken()
    setUser(null)
    setLoggedOut(true)
  }

  return (
    <AuthContext.Provider value={{ user, loading, loggedOut, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}