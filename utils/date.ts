/**
 * Format an ISO date as a quiet "Mon YYYY" — used in indexes and timestamps.
 * Numeric prose uses tabular figures via the .tnum class, not this helper.
 */
export function formatMonth(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

export function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}
