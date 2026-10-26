// Portal links carry a read-only snapshot in the URL hash. Nothing goes to a server:
// the client sees only what the studio chose to send, as of the moment the link was made.
import type { AppData, Project, StageState, Priority, Discipline } from './types'
import { stageGross, stageBalance, STATE_META, uid } from './logic'
import { today } from './dates'

export interface ClientSnapshot {
  v: 1
  at: string
  studio: { name: string; architect: string; phone: string; email: string }
  project: { id: string; code: string; name: string; address: string; client: string; targetDate: string }
  stages: { id: string; name: string; state: StageState; pct: number; deliverables: string; targetDate?: string; submittedAt?: string; returnedNote?: string }[]
  bills: { no: number; stage: string; gross: number; balance: number; dueAt: string; paid: boolean }[]
  updates: { at: string; text: string }[]
  meeting?: { date: string; time: string; place: string }
  /** Check data for the approval code, computed on the studio side. */
  codes: Record<string, string>
}

export interface ContractorSnapshot {
  v: 1
  at: string
  studio: { name: string; architect: string; phone: string; email: string }
  project: { name: string; code: string; address: string; contractor: string; stage: string; stageIndex: number; stageCount: number }
  tasks: { id: string; title: string; due?: string; priority: Priority; done: boolean }[]
  docs: { name: string; rev: string; date: string; discipline: Discipline; current: boolean; url?: string }[]
  meeting?: { date: string; time: string; place: string }
}

const b64url = (bytes: Uint8Array) => {
  let s = ''
  bytes.forEach((b) => (s += String.fromCharCode(b)))
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
const unb64url = (s: string) => {
  const bin = atob(s.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}

export async function encode(obj: unknown) {
  const raw = new TextEncoder().encode(JSON.stringify(obj))
  if (typeof CompressionStream !== 'undefined') return 'z' + b64url(await pipe(raw, new CompressionStream('deflate-raw')))
  return 'j' + b64url(raw)
}

export async function decode<T>(hash: string): Promise<T> {
  const s = hash.replace(/^#/, '')
  const body = unb64url(s.slice(1))
  const bytes = s[0] === 'z' ? await pipe(body, new DecompressionStream('deflate-raw')) : body
  return JSON.parse(new TextDecoder().decode(bytes)) as T
}

const studio = (d: AppData) => ({ name: d.settings.studioName, architect: d.settings.architectName, phone: d.settings.phone, email: d.settings.email })

export function clientSnapshot(p: Project, d: AppData, codeFor: (stageId: string) => string): ClientSnapshot {
  const vat = d.settings.vatRate
  return {
    v: 1,
    at: today(),
    studio: studio(d),
    project: { id: p.id, code: p.code, name: p.name, address: p.address, client: p.client.name, targetDate: p.targetDate },
    stages: p.stages.map((s) => ({ id: s.id, name: s.name, state: s.state, pct: s.pct, deliverables: s.deliverables, targetDate: s.targetDate, submittedAt: s.submittedAt, returnedNote: s.returnedNote })),
    bills: p.stages.filter((s) => s.invoiceNo).map((s) => ({ no: s.invoiceNo!, stage: s.name, gross: stageGross(p, s, vat), balance: stageBalance(p, s, vat), dueAt: s.dueAt || '', paid: s.state === 'paid' })),
    updates: p.log.filter((l) => l.shared).slice(0, 8).map((l) => ({ at: l.at.slice(0, 10), text: l.text })),
    meeting: p.nextMeeting,
    codes: Object.fromEntries(p.stages.filter((s) => s.state === 'submitted').map((s) => [s.id, codeFor(s.id)])),
  }
}

export function contractorSnapshot(p: Project, d: AppData): ContractorSnapshot {
  const cur = p.stages.find((s) => s.state === 'active' || s.state === 'submitted') || p.stages.find((s) => s.state === 'future')
  return {
    v: 1,
    at: today(),
    studio: studio(d),
    project: { name: p.name, code: p.code, address: p.address, contractor: p.contractor.name, stage: cur?.name || 'הושלם', stageIndex: cur ? p.stages.indexOf(cur) + 1 : p.stages.length, stageCount: p.stages.length },
    tasks: p.tasks.filter((t) => t.owner === 'contractor').map((t) => ({ id: t.id || uid(), title: t.title, due: t.due, priority: t.priority, done: t.done })),
    docs: p.docs.filter((x) => x.kind === 'plan' || x.kind === 'permit').map((x) => ({ name: x.name, rev: x.rev, date: x.date, discipline: x.discipline, current: x.current, url: x.url })),
    meeting: p.nextMeeting,
  }
}

export const stateLabel = (s: StageState) => STATE_META[s].label

export const waLink = (phone: string, text: string) => {
  const digits = phone.replace(/\D/g, '').replace(/^0/, '972')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export const mailLink = (to: string, subject: string, body: string) =>
  `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
