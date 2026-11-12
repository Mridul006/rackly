const FALLBACK = {
  available: '#9dc95e',
  rented: '#ff9f1c',
  offline: '#5f5f66',
  idle: '#4d5d50',
  empty: '#1c1c1f',
}

export function themeColor(name) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-${name}`)
    .trim()
  return value || FALLBACK[name]
}

export function statusColors() {
  return {
    available: themeColor('available'),
    rented: themeColor('rented'),
    offline: themeColor('offline'),
    idle: FALLBACK.idle,
    empty: FALLBACK.empty,
  }
}