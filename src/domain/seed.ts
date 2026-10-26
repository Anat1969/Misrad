// Demo office, with dates relative to today so that delays and due dates stay meaningful.
import type { AppData, Project, Settings, Stage, StageState, StageTemplate } from './types'
import { addDays, today } from './dates'
import { gross, uid } from './logic'

/** The studio's own stage split. A working default, not an official fee schedule. */
export const DEFAULT_TEMPLATE: StageTemplate[] = [
  { name: 'סקר ופרוגרמה', pct: 5, deliverables: 'מדידה, סקר מצב קיים, פרוגרמה מאושרת' },
  { name: 'תכנון רעיוני', pct: 15, deliverables: 'שתי חלופות תכנון, סקיצות והדמיה ראשונית' },
  { name: 'תכנון מוקדם', pct: 15, deliverables: 'תוכניות, חתכים וחזיתות בקנה מידה 1:100' },
  { name: 'היתר בנייה', pct: 20, deliverables: 'תיק בקשה להיתר והגשה לוועדה המקומית' },
  { name: 'תכניות עבודה ופרטים', pct: 25, deliverables: 'תכניות עבודה 1:50, פרטים ותיאום יועצים' },
  { name: 'מכרז ובחירת קבלן', pct: 5, deliverables: 'כתב כמויות, השוואת הצעות והמלצה' },
  { name: 'פיקוח עליון', pct: 15, deliverables: 'ביקורי אתר, דוחות פיקוח ומסירה' },
]

export const DEFAULT_SETTINGS: Settings = {
  studioName: 'סטודיו ARCHI-TACT',
  architectName: 'ענת שטיבלמן',
  phone: '052-0000000',
  email: 'studio@example.com',
  address: 'תל אביב-יפו',
  businessId: '',
  vatRate: 18,
  defaultTerms: 30,
  nextInvoiceNo: 1001,
  autoInvoice: true,
  autoAdvance: true,
  stageTemplate: DEFAULT_TEMPLATE,
}

export const stagesFromTemplate = (t: StageTemplate[]): Stage[] =>
  t.map((x) => ({ id: uid(), name: x.name, pct: x.pct, deliverables: x.deliverables, state: 'future', payments: [] }))

type Spec = {
  state: StageState
  start?: number
  submit?: number
  approve?: number
  due?: number // invoice due offset; invoice date = approve
  pay?: number // payment offset (full)
  target?: number
}

export function seed(): AppData {
  const t = today()
  const d = (n?: number) => (n === undefined ? undefined : addDays(t, n))
  const settings: Settings = { ...DEFAULT_SETTINGS, stageTemplate: DEFAULT_TEMPLATE.map((x) => ({ ...x })) }
  const vat = settings.vatRate

  const build = (base: Omit<Project, 'stages' | 'id' | 'log' | 'archived' | 'createdAt' | 'notes'> & { notes?: string; archived?: boolean }, specs: Spec[]): Project => {
    const stages = stagesFromTemplate(DEFAULT_TEMPLATE)
    const p: Project = { ...base, id: uid(), stages, log: [], archived: base.archived ?? false, createdAt: base.startDate, notes: base.notes ?? '' }
    specs.forEach((sp, i) => {
      const s = stages[i]
      s.state = sp.state
      s.startedAt = d(sp.start)
      s.submittedAt = d(sp.submit)
      s.approvedAt = d(sp.approve)
      s.approvedBy = sp.approve !== undefined ? p.client.name : undefined
      s.targetDate = d(sp.target)
      if (sp.due !== undefined && sp.approve !== undefined) {
        s.invoiceNo = settings.nextInvoiceNo++
        s.invoicedAt = d(sp.approve)
        s.dueAt = d(sp.approve + p.termsDays)
      }
      if (sp.pay !== undefined) {
        s.payments.push({ id: uid(), date: d(sp.pay)!, amount: gross(Math.round((p.fee * s.pct) / 100), vat), method: 'העברה', ref: `אסמכתא ${1000 + i * 7}` })
      }
    })
    // Log, newest first.
    const ev: { at: string; text: string; kind: Project['log'][0]['kind'] }[] = []
    for (const s of stages) {
      if (s.startedAt) ev.push({ at: s.startedAt, kind: 'stage', text: `התחיל שלב "${s.name}"` })
      if (s.submittedAt) ev.push({ at: s.submittedAt, kind: 'stage', text: `שלב "${s.name}" הוגש לאישור הלקוח` })
      if (s.approvedAt) ev.push({ at: s.approvedAt, kind: 'approval', text: `${p.client.name} אישר/ה את "${s.name}"` })
      if (s.invoiceNo) ev.push({ at: s.invoicedAt!, kind: 'invoice', text: `יצאה דרישת תשלום ${s.invoiceNo} על "${s.name}"` })
      for (const pay of s.payments) ev.push({ at: pay.date, kind: 'payment', text: `התקבל תשלום על "${s.name}"` })
    }
    p.log = ev.sort((a, b) => (a.at < b.at ? 1 : -1)).map((e) => ({ id: uid(), at: e.at + 'T09:00:00.000Z', kind: e.kind, text: e.text, shared: true }))
    return p
  }

  const villa = build({
    code: '2026-011', name: 'וילה כרמל', type: 'וילה פרטית', address: 'רחוב הזית 14, חיפה', area: 320,
    client: { name: 'משפחת לוי', phone: '050-1234567', email: 'levi.family@example.com' },
    contractor: { name: 'שלמה בר', phone: '052-7778899' },
    fee: 280000, termsDays: 30, startDate: d(-260)!, targetDate: d(320)!,
    nextMeeting: { date: d(6)!, time: '10:00', place: 'משרד הסטודיו' },
    notes: 'הלקוח ביקש לבחון חלון נוסף בחדר השינה הראשי.',
    tasks: [
      { id: uid(), title: 'השלמת חישובי שטחים לוועדה', due: d(-3), done: false, owner: 'studio', priority: 'urgent' },
      { id: uid(), title: 'אישור יועץ נגישות', due: d(10), done: false, owner: 'studio', priority: 'normal' },
      { id: uid(), title: 'סימון גבולות מגרש באתר', due: d(14), done: false, owner: 'contractor', priority: 'normal' },
      { id: uid(), title: 'בדיקת קרקע', due: d(-40), done: true, owner: 'contractor', priority: 'normal' },
    ],
    team: [
      { id: uid(), name: 'אבי כהן', role: 'קונסטרוקטור', phone: '052-1112233', email: 'avi@example.com' },
      { id: uid(), name: 'מיכל רוזן', role: 'יועצת אינסטלציה', phone: '054-9988776', email: 'michal@example.com' },
    ],
    docs: [
      { id: uid(), name: 'חוזה שכר טרחה חתום', kind: 'contract', discipline: 'כללי', rev: '1', date: d(-262)!, current: true },
      { id: uid(), name: 'תוכנית קומת קרקע', kind: 'plan', discipline: 'אדריכלות', rev: '5', date: d(-12)!, current: true },
      { id: uid(), name: 'תוכנית יסודות', kind: 'plan', discipline: 'קונסטרוקציה', rev: '3', date: d(-20)!, current: true },
      { id: uid(), name: 'תוכנית קומת קרקע', kind: 'plan', discipline: 'אדריכלות', rev: '4', date: d(-60)!, current: false },
      { id: uid(), name: 'הדמיית חזית', kind: 'render', discipline: 'אדריכלות', rev: '2', date: d(-90)!, current: true },
    ],
  }, [
    { state: 'paid', start: -260, submit: -235, approve: -230, due: 1, pay: -205 },
    { state: 'paid', start: -229, submit: -170, approve: -165, due: 1, pay: -123 },
    { state: 'paid', start: -164, submit: -95, approve: -92, due: 1, pay: -66 },
    { state: 'submitted', start: -91, submit: -9, target: -12 },
    { state: 'future', target: 90 },
    { state: 'future', target: 130 },
    { state: 'future', target: 320 },
  ])

  const herzl = build({
    code: '2026-014', name: 'בית פרטי הרצליה', type: 'בית פרטי', address: 'רחוב הים 28, הרצליה פיתוח', area: 240,
    client: { name: 'דוד כהן', phone: '050-7654321', email: 'david.cohen@example.com' },
    contractor: { name: '', phone: '' },
    fee: 195000, termsDays: 30, startDate: d(-130)!, targetDate: d(420)!,
    tasks: [
      { id: uid(), title: 'פגישת בחירת חלופה עם הלקוח', due: d(4), done: false, owner: 'studio', priority: 'urgent' },
      { id: uid(), title: 'מדידה מעודכנת', due: d(-30), done: true, owner: 'studio', priority: 'normal' },
    ],
    team: [{ id: uid(), name: 'רן לוי', role: 'קונסטרוקטור', phone: '052-3334455', email: 'ran@example.com' }],
    docs: [
      { id: uid(), name: 'חוזה שכר טרחה חתום', kind: 'contract', discipline: 'כללי', rev: '1', date: d(-131)!, current: true },
      { id: uid(), name: 'סקיצות ראשוניות', kind: 'plan', discipline: 'אדריכלות', rev: '1', date: d(-40)!, current: true },
    ],
  }, [
    { state: 'paid', start: -130, submit: -110, approve: -105, due: 1, pay: -78 },
    { state: 'invoiced', start: -104, submit: -22, approve: -18, due: 1 },
    { state: 'active', start: -18, target: 24 },
  ])

  const roof = build({
    code: '2025-031', name: 'דירת גג תל אביב', type: 'דירת גג', address: 'שדרות רוטשילד 88, תל אביב-יפו', area: 180,
    client: { name: 'רונית שמעוני', phone: '050-5556677', email: 'ronit.s@example.com' },
    contractor: { name: 'יוסי ברק', phone: '052-7770000' },
    fee: 165000, termsDays: 30, startDate: d(-520)!, targetDate: d(60)!,
    nextMeeting: { date: d(3)!, time: '08:30', place: 'באתר' },
    tasks: [
      { id: uid(), title: 'דוח פיקוח שבועי', due: d(2), done: false, owner: 'studio', priority: 'normal' },
      { id: uid(), title: 'איטום מרפסת לפי פרט 12', due: d(-5), done: false, owner: 'contractor', priority: 'urgent' },
      { id: uid(), title: 'התקנת מעקה זכוכית', due: d(18), done: false, owner: 'contractor', priority: 'normal' },
      { id: uid(), title: 'פירוק מחיצות', due: d(-80), done: true, owner: 'contractor', priority: 'normal' },
    ],
    team: [
      { id: uid(), name: 'יוסי ברק', role: 'קבלן ראשי', phone: '052-7770000', email: 'yossi@example.com' },
      { id: uid(), name: 'שרה מזרחי', role: 'מעצבת פנים', phone: '054-1122334', email: 'sara@example.com' },
    ],
    docs: [
      { id: uid(), name: 'חוזה שכר טרחה חתום', kind: 'contract', discipline: 'כללי', rev: '1', date: d(-521)!, current: true },
      { id: uid(), name: 'היתר בנייה', kind: 'permit', discipline: 'כללי', rev: '1', date: d(-300)!, current: true },
      { id: uid(), name: 'תוכנית חשמל', kind: 'plan', discipline: 'חשמל', rev: '2', date: d(-70)!, current: true },
      { id: uid(), name: 'פרט איטום מרפסת', kind: 'plan', discipline: 'אדריכלות', rev: '3', date: d(-25)!, current: true },
    ],
  }, [
    { state: 'paid', start: -520, submit: -500, approve: -497, due: 1, pay: -470 },
    { state: 'paid', start: -496, submit: -440, approve: -436, due: 1, pay: -404 },
    { state: 'paid', start: -435, submit: -380, approve: -377, due: 1, pay: -350 },
    { state: 'paid', start: -376, submit: -320, approve: -305, due: 1, pay: -290 },
    { state: 'paid', start: -304, submit: -200, approve: -196, due: 1, pay: -151 },
    { state: 'invoiced', start: -195, submit: -75, approve: -68, due: 1 },
    { state: 'active', start: -68, target: 60 },
  ])

  const offices = build({
    code: '2026-019', name: 'משרדים רמת גן', type: 'מסחרי, משרדים', address: "רחוב ז'בוטינסקי 35, רמת גן", area: 600,
    client: { name: 'אלפא בע"מ', phone: '03-7654321', email: 'info@alpha.example.com' },
    contractor: { name: '', phone: '' },
    fee: 420000, termsDays: 45, startDate: d(-25)!, targetDate: d(600)!,
    notes: 'החוזה בבדיקה משפטית אצל הלקוח.',
    tasks: [
      { id: uid(), title: 'סקר מערכות קיימות בקומה', due: d(5), done: false, owner: 'studio', priority: 'normal' },
      { id: uid(), title: 'ראיונות עם ראשי צוותים לפרוגרמה', due: d(-2), done: false, owner: 'studio', priority: 'normal' },
    ],
    team: [],
    docs: [],
  }, [
    { state: 'active', start: -25, target: 5 },
  ])

  const hall = build({
    code: '2025-007', name: 'שימור בית העם', type: 'מבנה ציבור, שימור', address: 'רחוב המייסדים 40, זכרון יעקב', area: 410,
    client: { name: 'המועצה המקומית', phone: '04-6300000', email: 'handasa@example.com' },
    contractor: { name: '', phone: '' },
    fee: 120000, termsDays: 60, startDate: d(-700)!, targetDate: d(-40)!, archived: true,
    tasks: [], team: [],
    docs: [{ id: uid(), name: 'חוזה התקשרות', kind: 'contract', discipline: 'כללי', rev: '1', date: d(-701)!, current: true }],
  }, [
    { state: 'paid', start: -700, submit: -680, approve: -672, due: 1, pay: -610 },
    { state: 'paid', start: -671, submit: -600, approve: -590, due: 1, pay: -515 },
    { state: 'paid', start: -589, submit: -520, approve: -508, due: 1, pay: -470 },
    { state: 'paid', start: -507, submit: -430, approve: -410, due: 1, pay: -330 },
    { state: 'paid', start: -409, submit: -300, approve: -291, due: 1, pay: -228 },
    { state: 'paid', start: -290, submit: -250, approve: -246, due: 1, pay: -180 },
    { state: 'paid', start: -245, submit: -50, approve: -45, due: 1, pay: -40 },
  ])

  return { version: 1, demo: true, settings, projects: [villa, herzl, roof, offices, hall] }
}
