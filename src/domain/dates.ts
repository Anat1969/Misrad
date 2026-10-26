// Dates are stored as YYYY-MM-DD strings, compared as local calendar days.

const pad = (n: number) => String(n).padStart(2, '0')

export const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const today = () => toDay(new Date())

export const parseDay = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export const addDays = (s: string, n: number) => {
  const d = parseDay(s)
  d.setDate(d.getDate() + n)
  return toDay(d)
}

export const addMonths = (s: string, n: number) => {
  const d = parseDay(s)
  d.setMonth(d.getMonth() + n)
  return toDay(d)
}

/** Whole days from a to b (positive when b is later). */
export const daysBetween = (a: string, b: string) =>
  Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000)

export const monthKey = (s: string) => s.slice(0, 7)

const MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳']
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`
}

export const fmtDate = (s?: string) => {
  if (!s) return '—'
  const d = parseDay(s)
  if (isNaN(d.getTime())) return '—'
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`
}

export const fmtDateLong = (s?: string) => {
  if (!s) return '—'
  return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }).format(parseDay(s))
}

export const nowIso = () => new Date().toISOString()
