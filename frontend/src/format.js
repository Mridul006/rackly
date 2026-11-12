export function formatTime(iso) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export function bookingState(booking) {
  if (booking.status === 'cancelled') return 'cancelled'
  const now = new Date()
  if (new Date(booking.start_at) > now) return 'upcoming'
  if (new Date(booking.end_at) > now) return 'active'
  return 'completed'
}

export const STATE_BADGE = {
  upcoming: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-800',
}

export function formatSigned(value) {
  const n = Number(value)
  return `${n < 0 ? '-' : '+'}$${Math.abs(n).toFixed(2)}`
}