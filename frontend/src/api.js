const BASE_URL = import.meta.env.VITE_API_URL

let onUnauthorized = null

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export function getToken() {
  return localStorage.getItem('token')
}

export function setToken(token) {
  localStorage.setItem('token', token)
}

export function clearToken() {
  localStorage.removeItem('token')
}

function formatError(data, status) {
  if (!data || !data.detail) return `Request failed (${status})`
  if (typeof data.detail === 'string') return data.detail
  return data.detail.map((e) => e.msg).join(', ')
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let payload
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    payload = new URLSearchParams(form)
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const response = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload })

  if (response.status === 401 && token && path !== '/auth/login') {
    clearToken()
    if (onUnauthorized) onUnauthorized()
  }

  if (response.status === 204) return null
  const data = await response.json().catch(() => null)

  if (!response.ok) throw new Error(formatError(data, response.status))
  return data
}