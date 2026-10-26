// Three teaching examples, with dates relative to today so that delays and due dates stay meaningful.
// Each tells one story and covers other stage states; together they show every state the tool knows.
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
  bill?: boolean // a payment request went out on the approval day
  pay?: number // payment day
  part?: number // share of the amount paid on that day, when not the whole of it
  target?: number
  returned?: string // client comments that sent the stage back to work
}

/** Examples get their own request numbers (9001 and up), so a real office's numbering stays intact. */
const EXAMPLE_NO = 9001

export const isExample = (p: Project) => !!p.example

export function examples(vat = 18): Project[] {
  const t = today()
  const d = (n?: number) => (n === undefined ? undefined : addDays(t, n))
  let no = EXAMPLE_NO

  const build = (base: Omit<Project, 'stages' | 'id' | 'log' | 'archived' | 'createdAt' | 'notes'> & { notes?: string }, specs: Spec[]): Project => {
    const stages = stagesFromTemplate(DEFAULT_TEMPLATE)
    const p: Project = { ...base, id: uid(), stages, log: [], archived: false, createdAt: base.startDate, notes: base.notes ?? '' }
    specs.forEach((sp, i) => {
      const s = stages[i]
      s.state = sp.state
      s.startedAt = d(sp.start)
      s.submittedAt = d(sp.submit)
      s.approvedAt = d(sp.approve)
      s.approvedBy = sp.approve !== undefined ? p.client.name : undefined
      s.targetDate = d(sp.target)
      s.returnedNote = sp.returned
      if (sp.bill && sp.approve !== undefined) {
        s.invoiceNo = no++
        s.invoicedAt = d(sp.approve)
        s.dueAt = d(sp.approve + p.termsDays)
      }
      if (sp.pay !== undefined) {
        const full = gross(Math.round((p.fee * s.pct) / 100), vat)
        s.payments.push({ id: uid(), date: d(sp.pay)!, amount: sp.part ? Math.round(full * sp.part) : full, method: 'העברה', ref: `אסמכתא ${4100 + i * 7}` })
      }
    })
    const ev: { at: string; text: string; kind: Project['log'][0]['kind'] }[] = []
    for (const s of stages) {
      if (s.startedAt) ev.push({ at: s.startedAt, kind: 'stage', text: `התחיל שלב "${s.name}"` })
      if (s.submittedAt) ev.push({ at: s.submittedAt, kind: 'stage', text: `שלב "${s.name}" הוגש לאישור הלקוח` })
      if (s.approvedAt) ev.push({ at: s.approvedAt, kind: 'approval', text: `${p.client.name} אישר/ה את "${s.name}"` })
      if (s.invoiceNo) ev.push({ at: s.invoicedAt!, kind: 'invoice', text: `יצאה דרישת תשלום ${s.invoiceNo} על "${s.name}"` })
      for (const pay of s.payments) ev.push({ at: pay.date, kind: 'payment', text: `התקבל תשלום על "${s.name}"` })
      if (s.returnedNote && s.startedAt) ev.push({ at: s.startedAt, kind: 'approval', text: `הלקוח החזיר את "${s.name}" עם הערות: ${s.returnedNote}` })
    }
    p.log = ev.sort((a, b) => (a.at < b.at ? 1 : -1)).map((e) => ({ id: uid(), at: e.at + 'T09:00:00.000Z', kind: e.kind, text: e.text, shared: true }))
    return p
  }

  const bridge = build({
    code: 'EX-01', name: 'פרויקט לדוגמה א: וילה בכרמל', type: 'וילה פרטית', address: 'רחוב הזית 14, חיפה', area: 320,
    client: { name: 'משפחת לוי', phone: '050-1234567', email: 'levi.family@example.com' },
    contractor: { name: 'שלמה בר', phone: '052-7778899' },
    fee: 280000, termsDays: 30, startDate: d(-260)!, targetDate: d(320)!,
    nextMeeting: { date: d(6)!, time: '10:00', place: 'משרד הסטודיו' },
    notes: 'הלקוח ביקש לבחון חלון נוסף בחדר השינה הראשי.',
    example: {
      theme: 'הגשר: שלב שמחכה לאישור הלקוח',
      story: 'תיק ההיתר הוגש ללקוח לפני 9 ימים, ועוד לא אושר. כל עוד אין אישור, אין דרישת תשלום על 66 אלף שקל. זה המקום שבו שכר טרחה נתקע.',
      show: [
        'שלב 4, "היתר בנייה": המצב "ממתין לאישור", והסיכון בצד.',
        'שליחת קישור האישור: הודעה מוכנה ללקוח בוואטסאפ או באימייל.',
        'מהבית: "הפורטל כפי שהלקוח רואה". מאשרים כמו לקוח.',
        'רישום האישור: יוצאת דרישת תשלום, והשלב הבא נפתח לבד.',
      ],
    },
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
    { state: 'paid', start: -260, submit: -235, approve: -230, bill: true, pay: -205 },
    { state: 'paid', start: -229, submit: -170, approve: -165, bill: true, pay: -123 },
    { state: 'paid', start: -164, submit: -95, approve: -92, bill: true, pay: -66 },
    { state: 'submitted', start: -91, submit: -9, target: -12 },
    { state: 'future', target: 90 },
    { state: 'future', target: 130 },
    { state: 'future', target: 320 },
  ])

  const collect = build({
    code: 'EX-02', name: 'פרויקט לדוגמה ב: דירת גג בתל אביב', type: 'דירת גג', address: 'שדרות רוטשילד 88, תל אביב-יפו', area: 180,
    client: { name: 'רונית שמעוני', phone: '050-5556677', email: 'ronit.s@example.com' },
    contractor: { name: 'יוסי ברק', phone: '052-7770000' },
    fee: 165000, termsDays: 30, startDate: d(-420)!, targetDate: d(150)!,
    nextMeeting: { date: d(3)!, time: '08:30', place: 'באתר' },
    example: {
      theme: 'גבייה: דרישה באיחור, תשלום חלקי והערות לקוח',
      story: 'הלקוחה שילמה רק מחצית מהדרישה על תכניות העבודה, והיתרה באיחור של יותר מחודש. במקביל היא החזירה את שלב המכרז עם הערות, והקבלן מחכה להחלטות.',
      show: [
        'מסילת שכר הטרחה: הקטע האדום הוא הכסף שבאיחור.',
        'שלב 5: יתרה אחרי תשלום חלקי, ותזכורת מנוסחת בוואטסאפ.',
        'רישום התשלום שנותר: השלב נסגר, והתזרים מתעדכן.',
        'שלב 6: הערות הלקוחה שהחזירו את השלב לעבודה.',
        'קישור לקבלן: רק המשימות שלו והתוכניות בתוקף.',
      ],
    },
    tasks: [
      { id: uid(), title: 'דוח פיקוח שבועי', due: d(2), done: false, owner: 'studio', priority: 'normal' },
      { id: uid(), title: 'חלופה לריצוף המרפסת', due: d(5), done: false, owner: 'studio', priority: 'urgent' },
      { id: uid(), title: 'איטום מרפסת לפי פרט 12', due: d(-5), done: false, owner: 'contractor', priority: 'urgent' },
      { id: uid(), title: 'התקנת מעקה זכוכית', due: d(18), done: false, owner: 'contractor', priority: 'normal' },
      { id: uid(), title: 'פירוק מחיצות', due: d(-80), done: true, owner: 'contractor', priority: 'normal' },
    ],
    team: [
      { id: uid(), name: 'יוסי ברק', role: 'קבלן ראשי', phone: '052-7770000', email: 'yossi@example.com' },
      { id: uid(), name: 'שרה מזרחי', role: 'מעצבת פנים', phone: '054-1122334', email: 'sara@example.com' },
    ],
    docs: [
      { id: uid(), name: 'חוזה שכר טרחה חתום', kind: 'contract', discipline: 'כללי', rev: '1', date: d(-421)!, current: true },
      { id: uid(), name: 'היתר בנייה', kind: 'permit', discipline: 'כללי', rev: '1', date: d(-200)!, current: true },
      { id: uid(), name: 'תוכנית חשמל', kind: 'plan', discipline: 'חשמל', rev: '2', date: d(-70)!, current: true },
      { id: uid(), name: 'פרט איטום מרפסת', kind: 'plan', discipline: 'אדריכלות', rev: '3', date: d(-25)!, current: true },
      { id: uid(), name: 'פרט איטום מרפסת', kind: 'plan', discipline: 'אדריכלות', rev: '2', date: d(-90)!, current: false },
    ],
  }, [
    { state: 'paid', start: -420, submit: -400, approve: -397, bill: true, pay: -372 },
    { state: 'paid', start: -396, submit: -340, approve: -336, bill: true, pay: -310 },
    { state: 'paid', start: -335, submit: -280, approve: -277, bill: true, pay: -240 },
    { state: 'paid', start: -276, submit: -220, approve: -205, bill: true, pay: -190 },
    { state: 'invoiced', start: -204, submit: -75, approve: -68, bill: true, pay: -40, part: 0.5 },
    { state: 'active', start: -20, submit: undefined, target: 10, returned: 'להוסיף חלופה זולה יותר לריצוף המרפסת' },
    { state: 'future', target: 150 },
  ])

  const unbilled = build({
    code: 'EX-03', name: 'פרויקט לדוגמה ג: שימור בית העם', type: 'מבנה ציבור, שימור', address: 'רחוב המייסדים 40, זכרון יעקב', area: 410,
    client: { name: 'המועצה המקומית', phone: '04-6300000', email: 'handasa@example.com' },
    contractor: { name: 'מ. גל שימור מבנים', phone: '050-4440000' },
    fee: 420000, termsDays: 60, startDate: d(-700)!, targetDate: d(120)!,
    nextMeeting: { date: d(9)!, time: '09:00', place: 'אתר בית העם' },
    example: {
      theme: 'כסף שנשכח: אושר ולא חויב',
      story: 'המועצה אישרה את המכרז בפגישה לפני 5 ימים, ואף אחד לא הוציא דרישת תשלום. בפרויקט ציבורי עם שוטף + 60, כל שבוע של שכחה דוחה את הכסף בשבוע נוסף.',
      show: [
        'במשרד: הסיכון "אושר ולא חויב" בראש הרשימה.',
        'שלב 6: "הוצאת דרישת תשלום" בלחיצה אחת, ומסמך מוכן להדפסה.',
        'שלב 5: דרישה שעוד לא הגיע מועד הפירעון שלה.',
        'תזרים: איך התחזית נבנית מהשלבים הפתוחים, ומדדי האמינות.',
      ],
    },
    tasks: [
      { id: uid(), title: 'דוח פיקוח: שחזור טיח היסטורי', due: d(4), done: false, owner: 'studio', priority: 'normal' },
      { id: uid(), title: 'דגימת גוון טיח לאישור', due: d(12), done: false, owner: 'contractor', priority: 'normal' },
      { id: uid(), title: 'פרוטוקול ועדת שימור', due: d(-15), done: true, owner: 'studio', priority: 'normal' },
    ],
    team: [
      { id: uid(), name: 'דנה אורן', role: 'יועצת שימור', phone: '054-3332211', email: 'dana@example.com' },
      { id: uid(), name: 'עמית שגב', role: 'קונסטרוקטור', phone: '052-6665544', email: 'amit@example.com' },
    ],
    docs: [
      { id: uid(), name: 'חוזה התקשרות', kind: 'contract', discipline: 'כללי', rev: '1', date: d(-701)!, current: true },
      { id: uid(), name: 'היתר בנייה', kind: 'permit', discipline: 'כללי', rev: '1', date: d(-380)!, current: true },
      { id: uid(), name: 'תיק תיעוד שימור', kind: 'other', discipline: 'אדריכלות', rev: '2', date: d(-520)!, current: true },
      { id: uid(), name: 'חזיתות לשחזור', kind: 'plan', discipline: 'אדריכלות', rev: '4', date: d(-50)!, current: true },
    ],
  }, [
    { state: 'paid', start: -700, submit: -680, approve: -672, bill: true, pay: -610 },
    { state: 'paid', start: -671, submit: -600, approve: -590, bill: true, pay: -515 },
    { state: 'paid', start: -589, submit: -520, approve: -508, bill: true, pay: -470 },
    { state: 'paid', start: -507, submit: -430, approve: -410, bill: true, pay: -330 },
    { state: 'invoiced', start: -409, submit: -60, approve: -40, bill: true },
    { state: 'approved', start: -39, submit: -12, approve: -5 },
    { state: 'active', start: -5, target: 120 },
  ])

  return [bridge, collect, unbilled]
}

/** A fresh office: default settings and the three teaching examples. */
export function seed(): AppData {
  const settings: Settings = { ...DEFAULT_SETTINGS, stageTemplate: DEFAULT_TEMPLATE.map((x) => ({ ...x })) }
  return { version: 1, demo: true, settings, projects: examples(settings.vatRate) }
}

/** Replace the examples in an office with fresh ones, keeping every real project. */
export function resetExamples(d: AppData) {
  d.projects = [...examples(d.settings.vatRate), ...d.projects.filter((p) => !p.example)]
}

export function removeExamples(d: AppData) {
  d.projects = d.projects.filter((p) => !p.example)
}
