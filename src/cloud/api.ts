// Cloud sync in the CULTURA-GH Supabase project (tables msr_, access only through msr_ functions).
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://ktqmwpbzcnzkhjskqisy.supabase.co'
export const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || 'sb_publishable_IkreG7naPa1h-d4kGp1gpA_sLU4tg5q'

export class CloudError extends Error {
  constructor(message: string, public offline = false) { super(message) }
}

const HEBREW: [RegExp, string][] = [
  [/unknown office|invalid key/, 'מפתח המשרד לא מוכר. ייתכן שהקישור האישי נקטע.'],
  [/unknown portal/, 'הקישור לא מוכר. כדאי לבקש מהסטודיו קישור חדש.'],
  [/not waiting for approval/, 'השלב כבר לא ממתין לאישור. ייתכן שהסטודיו עדכן אותו.'],
  [/already sent/, 'התגובה כבר נשלחה, והסטודיו עוד לא עיבד אותה.'],
  [/too many/, 'נשלחו יותר מדי פניות בשעה האחרונה. נסו שוב מאוחר יותר.'],
  [/empty/, 'צריך לכתוב משהו לפני השליחה.'],
  [/too large|2MB/, 'הנתונים גדולים מדי לשמירה בענן.'],
]

export const hebrew = (e: unknown) => {
  if (e instanceof CloudError && e.offline) return 'אין חיבור לענן. השינויים נשמרים במכשיר ויישלחו כשהחיבור יחזור.'
  const m = e instanceof Error ? e.message : String(e)
  return HEBREW.find(([re]) => re.test(m))?.[1] || 'הפעולה בענן נכשלה. נסו שוב בעוד רגע.'
}

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
  } catch {
    throw new CloudError('offline', true)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new CloudError((body && (body.message || body.error)) || `HTTP ${res.status}`)
  return body as T
}

export type CloudResponse = { id: string; project_id: string; stage_id: string | null; kind: 'approve' | 'comment' | 'report' | 'attend'; name: string; note: string; created_at: string }
export type PortalSent = { stage_id: string | null; kind: CloudResponse['kind']; name: string; note: string; created_at: string; applied: boolean }
