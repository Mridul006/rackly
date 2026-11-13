import { createContext, useContext, useEffect, useState } from 'react'
import { api, clearToken, getToken, setToken, setUnauthorizedHandler } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loggedOut, setLoggedOut] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setSessionExpired(true)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

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

  useEffect(() => {
    function onStorage(e) {
      if (e.key !== null && e.key !== 'token') return

      if (!e.newValue) {
        setUser(null)
        setLoggedOut(true)
        setSessionExpired(false)
      } else if (e.oldValue && e.oldValue !== e.newValue) {
        window.location.reload()
      } else {
        setLoggedOut(false)
        setSessionExpired(false)
        api('/users/me')
          .then(setUser)
          .catch(() => {})
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  async function login(email, password) {
    const data = await api('/auth/login', {
      method: 'POST',
      form: { username: email, password },
    })
    setToken(data.access_token)
    setUser(await api('/users/me'))
    setLoggedOut(false)
    setSessionExpired(false)
  }

  async function signup(email, password, role) {
    await api('/auth/signup', { method: 'POST', body: { email, password, role } })
    await login(email, password)
  }

  function logout() {
    clearToken()
    setUser(null)
    setLoggedOut(true)
    setSessionExpired(false)
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, loggedOut, sessionExpired, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}