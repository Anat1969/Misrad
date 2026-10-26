import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppData, Project } from '../domain/types'
import { seed } from '../domain/seed'
import { applyResponse } from '../domain/logic'
import { clientSnapshot, contractorSnapshot } from '../domain/share'
import { CloudError, hebrew, rpc, type CloudResponse } from '../cloud/api'

const KEY = 'msr_data'
const EDIT_KEY = 'msr_edit'
const CLOUD_KEY = 'msr_cloud'

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw) as AppData
      if (d && d.version === 1 && Array.isArray(d.projects)) return d
    }
  } catch { /* fall through to the demo office */ }
  return seed()
}

const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch { return false } }

type Notice = { id: number; text: string; tone: 'ok' | 'bad' | 'info' }

export type CloudStatus = 'off' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error'
export interface Cloud {
  key: string | null
  version: number
  dirty: boolean
  status: CloudStatus
  at: Date | null
  error?: string
}

type Saved = { key: string | null; version: number; dirty: boolean }

function loadCloud(): Cloud {
  try {
    const c = JSON.parse(localStorage.getItem(CLOUD_KEY) || 'null') as Saved | null
    if (c?.key) return { ...c, status: 'syncing', at: null }
  } catch { /* none */ }
  return { key: null, version: 0, dirty: false, status: 'off', at: null }
}

/** Portal snapshots to republish with every save, so the client's and contractor's links stay current. */
const portalsOf = (d: AppData) => d.projects.flatMap((p) => [
  ...(p.portals?.client ? [{ project_id: p.id, kind: 'client', snapshot: clientSnapshot(p, d, () => '') }] : []),
  ...(p.portals?.contractor ? [{ project_id: p.id, kind: 'contractor', snapshot: contractorSnapshot(p, d) }] : []),
])

interface Store {
  data: AppData
  /** Change the data with a recipe that mutates a copy. Saved at once, and to the cloud when connected. */
  mutate: (recipe: (d: AppData) => void, notice?: string) => void
  replace: (d: AppData, notice?: string) => void
  project: (id?: string) => Project | undefined
  savedAt: Date | null
  editMode: boolean
  setEditMode: (v: boolean) => void
  notify: (text: string, tone?: Notice['tone']) => void
  notices: Notice[]
  cloud: Cloud
  connect: () => Promise<void>
  disconnect: () => void
  syncNow: () => Promise<void>
  resolve: (keep: 'cloud' | 'device') => Promise<void>
  publishPortal: (projectId: string, kind: 'client' | 'contractor') => Promise<string>
  personalLink: () => string | null
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [editMode, setEdit] = useState(() => { try { return localStorage.getItem(EDIT_KEY) === '1' } catch { return false } })
  const [notices, setNotices] = useState<Notice[]>([])
  const [cloud, setCloudState] = useState<Cloud>(loadCloud)
  const first = useRef(true)
  const dataRef = useRef(data)
  const cloudRef = useRef(cloud)
  const busy = useRef(false)
  dataRef.current = data

  const setCloud = useCallback((patch: Partial<Cloud>) => {
    const next = { ...cloudRef.current, ...patch }
    cloudRef.current = next
    setCloudState(next)
    write(CLOUD_KEY, { key: next.key, version: next.version, dirty: next.dirty } satisfies Saved)
  }, [])

  useEffect(() => {
    if (first.current) { first.current = false; write(KEY, data); return }
    if (write(KEY, data)) setSavedAt(new Date())
    else setNotices((n) => [...n, { id: Date.now(), text: 'השמירה במכשיר נכשלה. כדאי לייצא גיבוי מההגדרות.', tone: 'bad' }])
  }, [data])

  const notify = useCallback((text: string, tone: Notice['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setNotices((n) => [...n.slice(-2), { id, text, tone }])
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), 4200)
  }, [])

  const mutate = useCallback((recipe: (d: AppData) => void, notice?: string) => {
    setData((prev) => {
      const next = structuredClone(prev)
      recipe(next)
      // Write at once, so closing the tab right after an action loses nothing.
      write(KEY, next)
      return next
    })
    if (cloudRef.current.key && !cloudRef.current.dirty) setCloud({ dirty: true })
    if (notice) notify(notice)
  }, [notify, setCloud])

  const replace = useCallback((d: AppData, notice?: string) => {
    setData(d)
    if (cloudRef.current.key) setCloud({ dirty: true })
    if (notice) notify(notice)
  }, [notify, setCloud])

  // ---------- cloud ----------

  const fail = useCallback((e: unknown) => {
    const offline = e instanceof CloudError && e.offline
    setCloud({ status: offline ? 'offline' : 'error', error: hebrew(e) })
  }, [setCloud])

  /** Push the device's data. Applied response ids ride along so the server marks them done. */
  const push = useCallback(async (applied: string[] = []) => {
    const c = cloudRef.current
    if (!c.key) return
    const d = dataRef.current
    const r = await rpc<{ ok: boolean; version: number; conflict?: boolean }>('msr_office_save', {
      p_key: c.key, p_data: d, p_base_version: c.version, p_portals: portalsOf(d), p_applied: applied,
    })
    if (!r.ok) { setCloud({ status: 'conflict', error: 'המשרד עודכן ממכשיר אחר מאז הסנכרון האחרון.' }); return }
    // Changes made while the request was out stay dirty for the next round.
    setCloud({ version: r.version, dirty: dataRef.current !== d, status: 'synced', at: new Date(), error: undefined })
  }, [setCloud])

  /** Pull the cloud copy, take it when it is newer, and apply what clients and contractors sent. */
  const pull = useCallback(async () => {
    const c = cloudRef.current
    if (!c.key || busy.current) return
    busy.current = true
    setCloud({ status: 'syncing' })
    try {
      const r = await rpc<{ data: AppData; version: number; responses: CloudResponse[] }>('msr_office_get', { p_key: c.key })
      if (r.version > c.version) {
        if (cloudRef.current.dirty) { setCloud({ status: 'conflict', error: 'יש שינויים במכשיר הזה וגם בענן.' }); return }
        dataRef.current = r.data
        setData(r.data)
        setCloud({ version: r.version, dirty: false })
      }
      if (r.responses.length) {
        const lines: string[] = []
        const next = structuredClone(dataRef.current)
        for (const x of r.responses) { const line = applyResponse(next, x); if (line) lines.push(line) }
        dataRef.current = next
        setData(next)
        write(KEY, next)
        await push(r.responses.map((x) => x.id))
        lines.forEach((l) => notify(`מהפורטל: ${l}`, 'info'))
      } else if (cloudRef.current.dirty) {
        await push()
      } else {
        setCloud({ status: 'synced', at: new Date(), error: undefined })
      }
    } catch (e) { fail(e) } finally { busy.current = false }
  }, [setCloud, push, notify, fail])

  const syncNow = useCallback(async () => { await pull() }, [pull])

  // Pick up a personal link (?office=KEY): this device joins the office in the cloud.
  useEffect(() => {
    const url = new URL(location.href)
    const k = url.searchParams.get('office')
    if (!k) return
    url.searchParams.delete('office')
    history.replaceState(null, '', url.pathname + url.search + url.hash)
    if (k === cloudRef.current.key) return
    if (cloudRef.current.key && cloudRef.current.dirty) { notify('יש במכשיר שינויים שלא נשלחו למשרד הקודם. קודם מסנכרנים או מנתקים בהגדרות.', 'bad'); return }
    if (!dataRef.current.demo && !cloudRef.current.key) write(`msr_backup_${Date.now()}`, dataRef.current)
    setCloud({ key: k, version: 0, dirty: false, status: 'syncing' })
    notify('המכשיר מתחבר למשרד בענן...', 'info')
  }, [notify, setCloud])

  // Pull on start, when the tab comes back, and every minute while it is visible.
  useEffect(() => {
    if (!cloud.key) return
    pull()
    const onFocus = () => { if (document.visibilityState === 'visible') pull() }
    document.addEventListener('visibilitychange', onFocus)
    const t = setInterval(onFocus, 60_000)
    return () => { document.removeEventListener('visibilitychange', onFocus); clearInterval(t) }
  }, [cloud.key, pull])

  // Push local changes shortly after the last edit.
  useEffect(() => {
    if (!cloud.key || !cloud.dirty || cloud.status === 'conflict') return
    const t = setTimeout(async () => {
      if (busy.current) return
      busy.current = true
      setCloud({ status: 'syncing' })
      try { await push() } catch (e) { fail(e) } finally { busy.current = false }
    }, 1200)
    return () => clearTimeout(t)
  }, [data, cloud.key, cloud.dirty, cloud.status, push, fail, setCloud])

  const connect = useCallback(async () => {
    setCloud({ status: 'syncing' })
    try {
      const d = { ...dataRef.current, demo: false }
      const r = await rpc<{ key: string; version: number }>('msr_office_create', { p_data: d })
      dataRef.current = d
      setData(d)
      setCloud({ key: r.key, version: r.version, dirty: false, status: 'synced', at: new Date(), error: undefined })
      notify('המשרד מחובר לענן. שמרו את הקישור האישי: הוא המפתח למשרד.')
    } catch (e) { fail(e); notify(hebrew(e), 'bad') }
  }, [setCloud, notify, fail])

  const disconnect = useCallback(() => {
    setCloud({ key: null, version: 0, dirty: false, status: 'off', at: null, error: undefined })
    notify('המכשיר נותק מהענן. הנתונים נשארו במכשיר, והמשרד בענן לא נמחק.')
  }, [setCloud, notify])

  const resolve = useCallback(async (keep: 'cloud' | 'device') => {
    const c = cloudRef.current
    if (!c.key) return
    try {
      const r = await rpc<{ data: AppData; version: number }>('msr_office_get', { p_key: c.key })
      if (keep === 'cloud') {
        write(`msr_backup_${Date.now()}`, dataRef.current)
        dataRef.current = r.data
        setData(r.data)
        setCloud({ version: r.version, dirty: false, status: 'synced', at: new Date(), error: undefined })
        notify('נטענה הגרסה מהענן. הגרסה של המכשיר נשמרה כגיבוי מקומי.')
      } else {
        setCloud({ version: r.version, dirty: true, status: 'syncing', error: undefined })
        await push()
        notify('הגרסה של המכשיר הזה נשמרה בענן.')
      }
    } catch (e) { fail(e) }
  }, [setCloud, push, notify, fail])

  /** Give a project a stable cloud link for the client or the contractor. */
  const publishPortal = useCallback(async (projectId: string, kind: 'client' | 'contractor') => {
    const c = cloudRef.current
    const d = dataRef.current
    const p = d.projects.find((x) => x.id === projectId)
    if (!c.key || !p) throw new CloudError('not connected')
    const snapshot = kind === 'client' ? clientSnapshot(p, d, () => '') : contractorSnapshot(p, d)
    const token = await rpc<string>('msr_portal_publish', { p_key: c.key, p_project_id: projectId, p_kind: kind, p_snapshot: snapshot })
    if (p.portals?.[kind] !== token) mutate((x) => { const q = x.projects.find((y) => y.id === projectId)!; q.portals = { ...q.portals, [kind]: token } })
    return token
  }, [mutate])

  const personalLink = useCallback(() => (cloud.key ? `${location.origin}/?office=${cloud.key}` : null), [cloud.key])

  const setEditMode = useCallback((v: boolean) => {
    setEdit(v)
    try { localStorage.setItem(EDIT_KEY, v ? '1' : '0') } catch { /* ignore */ }
  }, [])

  const value = useMemo<Store>(() => ({
    data, mutate, replace, savedAt, editMode, setEditMode, notify, notices,
    project: (id) => data.projects.find((p) => p.id === id),
    cloud, connect, disconnect, syncNow, resolve, publishPortal, personalLink,
  }), [data, mutate, replace, savedAt, editMode, setEditMode, notify, notices, cloud, connect, disconnect, syncNow, resolve, publishPortal, personalLink])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
