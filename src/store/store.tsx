import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppData, Project } from '../domain/types'
import { seed } from '../domain/seed'

const KEY = 'msr_data'
const EDIT_KEY = 'msr_edit'

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

type Notice = { id: number; text: string; tone: 'ok' | 'bad' | 'info' }

interface Store {
  data: AppData
  /** Change the data with a recipe that mutates a copy. Saved at once. */
  mutate: (recipe: (d: AppData) => void, notice?: string) => void
  replace: (d: AppData, notice?: string) => void
  project: (id?: string) => Project | undefined
  savedAt: Date | null
  editMode: boolean
  setEditMode: (v: boolean) => void
  notify: (text: string, tone?: Notice['tone']) => void
  notices: Notice[]
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(load)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [editMode, setEdit] = useState(() => { try { return localStorage.getItem(EDIT_KEY) === '1' } catch { return false } })
  const [notices, setNotices] = useState<Notice[]>([])
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* private mode */ } return }
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
      setSavedAt(new Date())
    } catch {
      setNotices((n) => [...n, { id: Date.now(), text: 'השמירה במכשיר נכשלה. כדאי לייצא גיבוי מההגדרות.', tone: 'bad' }])
    }
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
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* reported by the effect below */ }
      return next
    })
    if (notice) notify(notice)
  }, [notify])

  const replace = useCallback((d: AppData, notice?: string) => { setData(d); if (notice) notify(notice) }, [notify])

  const setEditMode = useCallback((v: boolean) => {
    setEdit(v)
    try { localStorage.setItem(EDIT_KEY, v ? '1' : '0') } catch { /* ignore */ }
  }, [])

  const value = useMemo<Store>(() => ({
    data, mutate, replace, savedAt, editMode, setEditMode, notify, notices,
    project: (id) => data.projects.find((p) => p.id === id),
  }), [data, mutate, replace, savedAt, editMode, setEditMode, notify, notices])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
