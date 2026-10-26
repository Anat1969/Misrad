import type { AppData, LogKind, Payment, Project, Settings, Stage, StageState } from './types'
import { addDays, daysBetween, monthKey, nowIso, today, addMonths } from './dates'

export const uid = () => Math.random().toString(36).slice(2, 10)

export const ils = (n: number) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(Math.round(n || 0))

export const ilsShort = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `₪${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (a >= 10_000) return `₪${Math.round(n / 1000)}K`
  return ils(n)
}

// ---------- stage life cycle ----------

export const STATES: StageState[] = ['future', 'active', 'submitted', 'approved', 'invoiced', 'paid']

export const STATE_META: Record<StageState, { label: string; tone: 'idle' | 'work' | 'wait' | 'ok' | 'bill' | 'paid'; hint: string }> = {
  future: { label: 'עתידי', tone: 'idle', hint: 'השלב עוד לא התחיל.' },
  active: { label: 'בעבודה', tone: 'work', hint: 'הסטודיו עובד על תוצרי השלב.' },
  submitted: { label: 'ממתין לאישור', tone: 'wait', hint: 'התוצרים הוגשו ללקוח. בלי אישור אין דרישת תשלום.' },
  approved: { label: 'אושר, לא חויב', tone: 'ok', hint: 'הלקוח אישר. צריך להוציא דרישת תשלום.' },
  invoiced: { label: 'נשלחה דרישה', tone: 'bill', hint: 'דרישת התשלום יצאה. ממתינים לתשלום עד מועד הפירעון.' },
  paid: { label: 'שולם', tone: 'paid', hint: 'השלב סגור: אושר ושולם במלואו.' },
}

export const stageNet = (p: Project, s: Stage) => Math.round((p.fee * s.pct) / 100)
export const gross = (net: number, vatRate: number) => Math.round(net * (1 + vatRate / 100))
export const stageGross = (p: Project, s: Stage, vatRate: number) => gross(stageNet(p, s), vatRate)
export const stagePaid = (s: Stage) => s.payments.reduce((a, x) => a + x.amount, 0)
export const stageBalance = (p: Project, s: Stage, vat: number) => Math.max(0, stageGross(p, s, vat) - stagePaid(s))

export const isOverdue = (s: Stage, on = today()) => s.state === 'invoiced' && !!s.dueAt && s.dueAt < on
export const daysOverdue = (s: Stage, on = today()) => (isOverdue(s, on) && s.dueAt ? daysBetween(s.dueAt, on) : 0)

export const pctTotal = (p: Project) => p.stages.reduce((a, s) => a + (Number(s.pct) || 0), 0)

const log = (p: Project, kind: LogKind, text: string, shared = false) => {
  p.log.unshift({ id: uid(), at: nowIso(), kind, text, shared })
}

/** The next action the studio can take on a stage, as shown on its button. */
export const NEXT_ACTION: Partial<Record<StageState, string>> = {
  future: 'התחלת השלב',
  active: 'הגשה לאישור הלקוח',
  submitted: 'רישום אישור הלקוח',
  approved: 'הוצאת דרישת תשלום',
  invoiced: 'רישום תשלום',
}

export function startStage(p: Project, s: Stage, on = today()) {
  s.state = 'active'
  s.startedAt = on
  s.returnedNote = undefined
  log(p, 'stage', `התחיל שלב "${s.name}"`, true)
}

export function submitStage(p: Project, s: Stage, on = today()) {
  s.state = 'submitted'
  s.submittedAt = on
  log(p, 'stage', `שלב "${s.name}" הוגש לאישור הלקוח`, true)
}

export function returnStage(p: Project, s: Stage, note: string) {
  s.state = 'active'
  s.returnedNote = note
  s.submittedAt = undefined
  log(p, 'approval', `הלקוח החזיר את "${s.name}" עם הערות: ${note}`, true)
}

export function issueInvoice(p: Project, s: Stage, settings: Settings, on = today()) {
  s.state = 'invoiced'
  s.invoiceNo = settings.nextInvoiceNo
  settings.nextInvoiceNo += 1
  s.invoicedAt = on
  s.dueAt = addDays(on, p.termsDays)
  log(p, 'invoice', `יצאה דרישת תשלום ${s.invoiceNo} על "${s.name}": ${ils(stageGross(p, s, settings.vatRate))}, לפירעון עד ${s.dueAt}`, true)
}

/** The bridge: client approval. With automation on it bills and opens the next stage in one step. */
export function approveStage(p: Project, s: Stage, settings: Settings, by: string, note = '', on = today()) {
  s.state = 'approved'
  s.approvedAt = on
  s.approvedBy = by
  s.approvalNote = note
  log(p, 'approval', `${by || 'הלקוח'} אישר/ה את "${s.name}"${note ? ` (${note})` : ''}`, true)
  if (settings.autoInvoice) issueInvoice(p, s, settings, on)
  if (settings.autoAdvance) {
    const next = p.stages[p.stages.indexOf(s) + 1]
    if (next && next.state === 'future') startStage(p, next, on)
  }
}

export function registerPayment(p: Project, s: Stage, pay: Omit<Payment, 'id'>, vat: number) {
  s.payments.push({ ...pay, id: uid() })
  const done = stagePaid(s) >= stageGross(p, s, vat) - 1
  if (done) s.state = 'paid'
  log(p, 'payment', `התקבל תשלום ${ils(pay.amount)} (${pay.method}) על "${s.name}"${done ? '. השלב נסגר.' : ''}`, true)
}

/** Edit mode: step a stage back one state, for corrections. */
export function revertStage(p: Project, s: Stage) {
  const order: StageState[] = ['future', 'active', 'submitted', 'approved', 'invoiced', 'paid']
  const i = order.indexOf(s.state)
  if (i <= 0) return
  const prev = order[i - 1]
  if (s.state === 'paid') s.payments = []
  if (s.state === 'invoiced') { s.invoiceNo = undefined; s.invoicedAt = undefined; s.dueAt = undefined }
  if (s.state === 'approved') { s.approvedAt = undefined; s.approvedBy = undefined }
  if (s.state === 'submitted') s.submittedAt = undefined
  if (s.state === 'active') s.startedAt = undefined
  s.state = prev
  log(p, 'edit', `תיקון: "${s.name}" הוחזר למצב ${STATE_META[prev].label}`)
}

// ---------- summaries ----------

export function projectSummary(p: Project, vat: number, on = today()) {
  const done = p.stages.filter((s) => ['approved', 'invoiced', 'paid'].includes(s.state))
  const progress = done.reduce((a, s) => a + s.pct, 0)
  const feeGross = gross(p.fee, vat)
  const collected = p.stages.reduce((a, s) => a + stagePaid(s), 0)
  const outstanding = p.stages.filter((s) => s.state === 'invoiced').reduce((a, s) => a + stageBalance(p, s, vat), 0)
  const overdueStages = p.stages.filter((s) => isOverdue(s, on))
  const overdue = overdueStages.reduce((a, s) => a + stageBalance(p, s, vat), 0)
  const unbilled = p.stages.filter((s) => s.state === 'approved').reduce((a, s) => a + stageGross(p, s, vat), 0)
  const current = p.stages.find((s) => s.state === 'submitted') || p.stages.find((s) => s.state === 'active') || p.stages.find((s) => s.state === 'approved') || p.stages.find((s) => s.state === 'future')
  const currentIndex = current ? p.stages.indexOf(current) + 1 : p.stages.length
  const maxOverdue = overdueStages.reduce((a, s) => Math.max(a, daysOverdue(s, on)), 0)
  const openTasks = p.tasks.filter((t) => !t.done).length
  return { progress, feeGross, collected, outstanding, overdue, unbilled, current, currentIndex, maxOverdue, openTasks, closed: p.stages.length > 0 && p.stages.every((s) => s.state === 'paid') }
}

export type Bucket = { state: StageState; label: string; amount: number; count: number; hint: string }

/** The office pipeline: where every shekel of fee stands right now. */
export function pipeline(data: AppData): Bucket[] {
  const vat = data.settings.vatRate
  const map = new Map<StageState, Bucket>()
  for (const st of STATES) map.set(st, { state: st, label: STATE_META[st].label, amount: 0, count: 0, hint: STATE_META[st].hint })
  for (const p of active(data)) {
    for (const s of p.stages) {
      const b = map.get(s.state)!
      b.count += 1
      b.amount += s.state === 'invoiced' ? stageBalance(p, s, vat) : s.state === 'paid' ? stagePaid(s) : stageGross(p, s, vat)
    }
  }
  return STATES.map((s) => map.get(s)!)
}

export const active = (data: AppData) => data.projects.filter((p) => !p.archived)

export function officeTotals(data: AppData, on = today()) {
  const vat = data.settings.vatRate
  const ps = active(data)
  let fee = 0, collected = 0, outstanding = 0, overdue = 0, unbilled = 0, waiting = 0
  for (const p of ps) {
    const s = projectSummary(p, vat, on)
    fee += s.feeGross
    collected += s.collected
    outstanding += s.outstanding
    overdue += s.overdue
    unbilled += s.unbilled
    waiting += p.stages.filter((x) => x.state === 'submitted').reduce((a, x) => a + stageGross(p, x, vat), 0)
  }
  return { projects: ps.length, fee, collected, outstanding, overdue, unbilled, waiting }
}

// ---------- risks: computed in code, every one with its reason ----------

export type Risk = {
  id: string
  level: 'high' | 'mid' | 'low'
  projectId: string
  projectName: string
  stageId?: string
  title: string
  why: string
  action: string
}

export function risks(data: AppData, on = today()): Risk[] {
  const vat = data.settings.vatRate
  const out: Risk[] = []
  for (const p of active(data)) {
    const add = (r: Omit<Risk, 'id' | 'projectId' | 'projectName'>) =>
      out.push({ ...r, id: `${p.id}-${out.length}`, projectId: p.id, projectName: p.name })
    for (const s of p.stages) {
      const d = daysOverdue(s, on)
      if (d > 0) add({ level: d > 30 ? 'high' : 'mid', stageId: s.id, title: `תשלום באיחור של ${d} ימים`, why: `דרישה ${s.invoiceNo} על "${s.name}", יתרה ${ils(stageBalance(p, s, vat))}, מועד פירעון ${s.dueAt}.`, action: 'לשלוח תזכורת ללקוח' })
      if (s.state === 'submitted' && s.submittedAt) {
        const w = daysBetween(s.submittedAt, on)
        if (w >= 7) add({ level: w > 21 ? 'high' : 'mid', stageId: s.id, title: `ממתין לאישור ${w} ימים`, why: `"${s.name}" הוגש ב-${s.submittedAt}. כל יום בלי אישור דוחה את דרישת התשלום על ${ils(stageGross(p, s, vat))}.`, action: 'לשלוח ללקוח את קישור האישור שוב' })
      }
      if (s.state === 'approved') add({ level: 'high', stageId: s.id, title: 'אושר ולא חויב', why: `"${s.name}" אושר ב-${s.approvedAt} ועדיין לא יצאה דרישת תשלום על ${ils(stageGross(p, s, vat))}.`, action: 'להוציא דרישת תשלום' })
      if (s.state === 'active' && s.targetDate && s.targetDate < on) add({ level: 'mid', stageId: s.id, title: `שלב באיחור של ${daysBetween(s.targetDate, on)} ימים`, why: `יעד "${s.name}" היה ${s.targetDate}.`, action: 'לעדכן יעד או להגיש' })
    }
    const total = pctTotal(p)
    if (Math.abs(total - 100) > 0.01) add({ level: 'mid', title: `חלוקת שכר הטרחה מסתכמת ב-${total}%`, why: 'סכום אחוזי השלבים חייב להיות 100%, אחרת חלק משכר הטרחה לא ייגבה.', action: 'לתקן את אחוזי השלבים' })
    const late = p.tasks.filter((t) => !t.done && t.due && t.due < on)
    if (late.length) add({ level: late.length > 2 ? 'mid' : 'low', title: `${late.length} משימות עברו את היעד`, why: late.slice(0, 3).map((t) => t.title).join(', '), action: 'לעבור על המשימות' })
    const started = p.stages.some((s) => s.state !== 'future')
    if (started && !p.docs.some((d) => d.kind === 'contract')) add({ level: 'mid', title: 'אין חוזה במסמכים', why: 'העבודה התחילה, ואין חוזה חתום שמעגן את חלוקת שכר הטרחה.', action: 'להוסיף את החוזה למסמכים' })
    if (!p.client.phone && !p.client.email) add({ level: 'low', title: 'חסרים פרטי קשר של הלקוח', why: 'בלי טלפון או אימייל אי אפשר לשלוח קישור אישור או דרישת תשלום.', action: 'להשלים פרטי לקוח' })
  }
  const rank = { high: 0, mid: 1, low: 2 }
  return out.sort((a, b) => rank[a.level] - rank[b.level])
}

// ---------- cash flow ----------

export type MonthFlow = { key: string; collected: number; due: number; forecast: number; past: boolean }

/**
 * Six months back (collected by payment date) and six ahead:
 * due = payment requests by due date; forecast = approved-not-billed and work in progress,
 * placed at the stage target date + the measured approval lag + payment terms.
 */
export function cashflow(data: AppData, on = today()): MonthFlow[] {
  const vat = data.settings.vatRate
  const rel = reliability(data, on)
  const lag = Math.round(rel.approvalDays ?? 10)
  const months: MonthFlow[] = []
  for (let i = -5; i <= 6; i++) {
    const key = monthKey(addMonths(on.slice(0, 8) + '01', i))
    months.push({ key, collected: 0, due: 0, forecast: 0, past: i < 0 })
  }
  const at = (d: string) => months.find((m) => m.key === monthKey(d))
  const nowKey = monthKey(on)
  for (const p of data.projects) {
    for (const s of p.stages) {
      for (const pay of s.payments) { const m = at(pay.date); if (m) m.collected += pay.amount }
      if (s.state === 'invoiced' && s.dueAt) {
        const key = s.dueAt < on ? nowKey : monthKey(s.dueAt)
        const m = months.find((x) => x.key === key); if (m) m.due += stageBalance(p, s, vat)
      }
      if (!p.archived && (s.state === 'approved' || s.state === 'active' || s.state === 'submitted')) {
        const base = s.state === 'approved' ? on : s.state === 'submitted' ? addDays(on, lag) : addDays(s.targetDate && s.targetDate > on ? s.targetDate : on, lag)
        const when = addDays(base, p.termsDays)
        const m = at(when); if (m) m.forecast += stageGross(p, s, vat)
      }
    }
  }
  return months
}

export function aging(data: AppData, on = today()) {
  const vat = data.settings.vatRate
  const buckets = [
    { label: 'טרם הגיע מועד', min: -Infinity, max: 0, amount: 0, count: 0 },
    { label: '1-30 ימים', min: 1, max: 30, amount: 0, count: 0 },
    { label: '31-60 ימים', min: 31, max: 60, amount: 0, count: 0 },
    { label: '61+ ימים', min: 61, max: Infinity, amount: 0, count: 0 },
  ]
  for (const p of data.projects) for (const s of p.stages) {
    if (s.state !== 'invoiced' || !s.dueAt) continue
    const d = daysBetween(s.dueAt, on)
    const b = buckets.find((x) => d >= x.min && d <= x.max)!
    b.amount += stageBalance(p, s, vat); b.count += 1
  }
  return buckets
}

// ---------- reliability: how far the numbers can be trusted ----------

export function reliability(data: AppData, on = today()) {
  const paid: number[] = [], onTime: boolean[] = [], approval: number[] = []
  for (const p of data.projects) for (const s of p.stages) {
    if (s.state === 'paid' && s.invoicedAt && s.payments.length) {
      const last = s.payments.map((x) => x.date).sort().at(-1)!
      paid.push(daysBetween(s.invoicedAt, last))
      if (s.dueAt) onTime.push(last <= s.dueAt)
    }
    if (s.submittedAt && s.approvedAt) approval.push(daysBetween(s.submittedAt, s.approvedAt))
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
  const required = (p: Project) => [p.name, p.address, p.client.name, p.client.phone || p.client.email, p.fee > 0, p.startDate, p.targetDate, Math.abs(pctTotal(p) - 100) < 0.01, p.docs.some((d) => d.kind === 'contract'), p.stages.every((s) => s.state === 'future' || s.state === 'paid' || !!s.targetDate)]
  const fields = active(data).flatMap(required)
  return {
    collectionDays: avg(paid),
    collectionN: paid.length,
    onTimeRate: onTime.length ? onTime.filter(Boolean).length / onTime.length : null,
    onTimeN: onTime.length,
    approvalDays: avg(approval),
    approvalN: approval.length,
    completeness: fields.length ? fields.filter(Boolean).length / fields.length : 1,
    asOf: on,
  }
}

export function completeness(p: Project) {
  const checks: [string, boolean][] = [
    ['שם וכתובת', !!p.name && !!p.address],
    ['פרטי לקוח', !!p.client.name && !!(p.client.phone || p.client.email)],
    ['שכר טרחה', p.fee > 0],
    ['תאריכי התחלה ויעד', !!p.startDate && !!p.targetDate],
    ['חלוקה ל-100%', Math.abs(pctTotal(p) - 100) < 0.01],
    ['חוזה במסמכים', p.docs.some((d) => d.kind === 'contract')],
    ['יעד לכל שלב פתוח', p.stages.every((s) => s.state === 'future' || s.state === 'paid' || !!s.targetDate)],
  ]
  return { checks, score: checks.filter(([, v]) => v).length / checks.length }
}

// ---------- approval code (the client confirms from the portal, the studio registers it) ----------

const fnv = (s: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36).toUpperCase().slice(-4).padStart(4, '0')
}

/** A check code against typing mistakes and mix-ups between stages. Not a signature. */
export const approvalCode = (p: Project, s: Stage, date: string) =>
  `A-${p.code}-${p.stages.indexOf(s) + 1}-${date.replaceAll('-', '')}-${fnv(p.id + s.id + date)}`

export function checkApprovalCode(p: Project, code: string): { ok: true; stage: Stage; date: string } | { ok: false; error: string } {
  const m = code.trim().toUpperCase().match(/^A-(.+)-(\d+)-(\d{8})-([0-9A-Z]{4})$/)
  if (!m) return { ok: false, error: 'הקוד לא בפורמט הנכון. הוא נראה כך: A-2026-014-3-20261026-X7QK' }
  const [, code_, idx, ymd, chk] = m
  if (code_ !== p.code.toUpperCase()) return { ok: false, error: `הקוד שייך לפרויקט ${code_}, לא לפרויקט הזה.` }
  const stage = p.stages[Number(idx) - 1]
  if (!stage) return { ok: false, error: `אין שלב מספר ${idx} בפרויקט.` }
  const date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
  if (fnv(p.id + stage.id + date) !== chk) return { ok: false, error: 'ספרות הביקורת לא תואמות. כנראה טעות בהעתקה.' }
  if (stage.state !== 'submitted') return { ok: false, error: `שלב "${stage.name}" לא ממתין לאישור (מצב: ${STATE_META[stage.state].label}).` }
  return { ok: true, stage, date }
}

// ---------- Claude prompt: the model layer, built from the code layer ----------

export function claudePrompt(p: Project, data: AppData) {
  const vat = data.settings.vatRate
  const sum = projectSummary(p, vat)
  const rs = risks(data).filter((r) => r.projectId === p.id)
  const lines = p.stages.map((s, i) => `${i + 1}. ${s.name} | ${s.pct}% | ${ils(stageGross(p, s, vat))} | ${STATE_META[s.state].label}${s.targetDate ? ` | יעד ${s.targetDate}` : ''}${s.dueAt ? ` | פירעון ${s.dueAt}` : ''}`)
  return [
    'אתה שותף מקצועי למשרד אדריכלות בישראל. זקק את מצב הפרויקט, חשוף סיכונים שהקוד לא רואה, והתווה שלושה צעדים לשבוע הקרוב.',
    'כללים: עברית ישירה ומקצועית. כל טענה נשענת על מספר מהנתונים. הפרד בין עובדה, הערכה והנחה. אל תמציא תקנות.',
    '',
    `פרויקט: ${p.name} (${p.code}), ${p.type}, ${p.area} מ"ר, ${p.address}`,
    `לקוח: ${p.client.name}. שכר טרחה: ${ils(p.fee)} לפני מע"מ (${vat}%). תנאי תשלום: שוטף + ${p.termsDays}.`,
    `התקדמות: ${sum.progress}% אושר. נגבה ${ils(sum.collected)}, פתוח ${ils(sum.outstanding)}, באיחור ${ils(sum.overdue)}.`,
    '',
    'שלבים:',
    ...lines,
    '',
    'סיכונים שהקוד זיהה:',
    ...(rs.length ? rs.map((r) => `- ${r.title}: ${r.why}`) : ['- אין']),
    '',
    `משימות פתוחות: ${p.tasks.filter((t) => !t.done).map((t) => t.title).join('; ') || 'אין'}`,
    '',
    'פלט: 1) תמונת מצב בשלוש שורות. 2) סיכונים נוספים. 3) שלושה צעדים, ולכל אחד נוסח הודעה מוכן ללקוח או לקבלן.',
  ].join('\n')
}
