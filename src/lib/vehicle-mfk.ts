// Direct port of urs-android's VehicleMfk.kt: days until the next MFK
// (Swiss periodic vehicle inspection, due every 2 years) is due, computed
// from the last inspection date - negative once overdue. No due-date is
// stored server-side; this is a pure client-side derivation, recomputed on
// every render rather than cached.
export function daysUntilNextMfk(lastMfkDate: string): number | null {
  if (!lastMfkDate) return null
  const date = new Date(lastMfkDate)
  if (Number.isNaN(date.getTime())) return null
  const next = new Date(date.getFullYear() + 2, date.getMonth(), date.getDate())
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  next.setHours(0, 0, 0, 0)
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}
