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
  upcoming: 'bg-brand/15 text-brand',
  active: 'bg-available/15 text-available',
  completed: 'bg-offline/20 text-muted',
  cancelled: 'bg-danger/15 text-danger',
}

export function formatSigned(value) {
  const n = Number(value)
  return `${n < 0 ? '-' : '+'}$${Math.abs(n).toFixed(2)}`
}