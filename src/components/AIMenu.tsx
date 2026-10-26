import { createElement, useEffect, useRef, useSyncExternalStore } from 'react'

export type MenuItem = { label: string; pressed?: boolean; onSelect: () => void }

// Editing actions that a page adds to the menu while it is shown.
const pageItems = new Map<string, MenuItem[]>()
const subs = new Set<() => void>()
let snapshot: MenuItem[] = []
const publish = () => { snapshot = [...pageItems.values()].flat(); subs.forEach((f) => f()) }

export function useMenuItems(key: string, items: MenuItem[] | null) {
  useEffect(() => {
    if (!items || !items.length) return
    pageItems.set(key, items)
    publish()
    return () => { pageItems.delete(key); publish() }
  }, [key, items])
}

/**
 * The A&I logo button (<ai-menu> from https://appofapp-gh.vercel.app/ai-menu.js).
 * Every editing and development action lives inside it.
 */
export default function AIMenu({ chat, research, items = [], status = '' }: { chat?: string; research?: string; items?: MenuItem[]; status?: string }) {
  const ref = useRef<HTMLElement & { items?: MenuItem[]; status?: string }>(null)
  const fromPages = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => snapshot)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.items = [...items, ...fromPages]
    el.status = status
  }, [items, fromPages, status])
  return createElement('ai-menu', { ref, chat: chat || undefined, research: research || undefined })
}
