// Data model. One source of truth: every screen derives from these records.

/** Stage life cycle: work, client approval (the bridge), payment request, payment. */
export type StageState = 'future' | 'active' | 'submitted' | 'approved' | 'invoiced' | 'paid'

export type PayMethod = 'העברה' | "צ'ק" | 'אשראי' | 'מזומן' | 'אחר'

export interface Payment {
  id: string
  date: string // YYYY-MM-DD
  amount: number // gross, incl. VAT
  method: PayMethod
  ref: string
}

export interface Stage {
  id: string
  name: string
  pct: number // share of the fee, 0-100
  deliverables: string // what the client receives at the end of the stage
  state: StageState
  targetDate?: string
  startedAt?: string
  submittedAt?: string
  approvedAt?: string
  approvedBy?: string
  approvalNote?: string
  returnedNote?: string
  invoiceNo?: number
  invoicedAt?: string
  dueAt?: string
  payments: Payment[]
}

export type Owner = 'studio' | 'contractor' | 'client'
export type Priority = 'urgent' | 'normal' | 'low'

export interface Task {
  id: string
  title: string
  stageId?: string
  due?: string
  done: boolean
  owner: Owner
  priority: Priority
}

export type DocKind = 'plan' | 'permit' | 'contract' | 'render' | 'other'
export type Discipline = 'אדריכלות' | 'קונסטרוקציה' | 'חשמל' | 'אינסטלציה' | 'מיזוג' | 'כללי'

export interface Doc {
  id: string
  name: string
  kind: DocKind
  discipline: Discipline
  rev: string
  date: string
  current: boolean
  url?: string
}

export interface Member {
  id: string
  name: string
  role: string
  phone: string
  email: string
}

export type LogKind = 'stage' | 'approval' | 'invoice' | 'payment' | 'note' | 'portal' | 'edit'

export interface LogEntry {
  id: string
  at: string // ISO
  kind: LogKind
  text: string
  /** Shown to the client in the portal. */
  shared?: boolean
}

export interface Project {
  id: string
  code: string // e.g. 2026-014
  name: string
  type: string
  address: string
  area: number
  client: { name: string; phone: string; email: string }
  contractor: { name: string; phone: string }
  fee: number // net fee, before VAT
  termsDays: number // payment terms: שוטף + N
  startDate: string
  targetDate: string
  stages: Stage[]
  tasks: Task[]
  team: Member[]
  docs: Doc[]
  log: LogEntry[]
  nextMeeting?: { date: string; time: string; place: string }
  notes: string
  archived: boolean
  createdAt: string
}

export interface StageTemplate {
  name: string
  pct: number
  deliverables: string
}

export interface Settings {
  studioName: string
  architectName: string
  phone: string
  email: string
  address: string
  businessId: string
  vatRate: number // percent
  defaultTerms: number
  nextInvoiceNo: number
  autoInvoice: boolean // approval creates the payment request at once
  autoAdvance: boolean // approval opens the next stage
  stageTemplate: StageTemplate[]
}

export interface AppData {
  version: 1
  demo: boolean
  settings: Settings
  projects: Project[]
}
