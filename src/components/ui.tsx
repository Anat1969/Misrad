import { useEffect, useId, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion, animate } from 'framer-motion'
import type { StageState } from '../domain/types'
import { STATE_META } from '../domain/logic'
import { useStore } from '../store/store'

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'ink' | 'gold' | 'quiet' | 'line' | 'bad'; size?: 'sm' | 'md' | 'lg'; to?: string; href?: string }

/** Square button: hairline, ink that fills on hover, crop marks at the corners. */
export function Btn({ tone = 'line', size = 'md', to, href, className = '', children, ...rest }: BtnProps) {
  const cls = `btn ${tone} ${size} ${className}`
  if (to && !rest.disabled) return <Link className={cls} to={to}>{children}</Link>
  if (href && !rest.disabled) return <a className={cls} href={href} target="_blank" rel="noreferrer" onClick={rest.onClick as never}>{children}</a>
  return <button type="button" className={cls} {...rest}>{children}</button>
}

export function Tag({ state, small }: { state: StageState; small?: boolean }) {
  const m = STATE_META[state]
  return <span className={`tag t-${m.tone} ${small ? 'sm' : ''}`} title={m.hint}><i aria-hidden />{m.label}</span>
}

export function Level({ level }: { level: 'high' | 'mid' | 'low' }) {
  const label = { high: 'דחוף', mid: 'חשוב', low: 'לטיפול' }[level]
  return <span className={`tag lv-${level}`}><i aria-hidden />{label}</span>
}

/** A number that counts up when it appears. */
export function Count({ value, format = (n: number) => String(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  const prev = useRef(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) { el.textContent = format(value); prev.current = value; return }
    const c = animate(prev.current, value, { duration: 0.9, ease: [0.2, 0.7, 0.2, 1], onUpdate: (v) => { el.textContent = format(v) } })
    prev.current = value
    return () => c.stop()
  }, [value, reduce, format])
  return <span ref={ref}>{format(value)}</span>
}

export function Kpi({ label, value, format, note, tone }: { label: string; value: number; format?: (n: number) => string; note?: string; tone?: 'bad' | 'warn' | 'ok' }) {
  return (
    <div className={`kpi ${tone || ''}`}>
      <span className="eyebrow">{label}</span>
      <strong className="kpi-v"><Count value={value} format={format} /></strong>
      {note && <span className="kpi-note">{note}</span>}
    </div>
  )
}

export function SectionHead({ num, title, lead, children }: { num?: string; title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="section-head">
      <div className="sh-row">
        <div>
          {num && <span className="eyebrow">{num}</span>}
          <h2>{title}</h2>
        </div>
        {children && <div className="sh-actions">{children}</div>}
      </div>
      {lead && <p className="lead">{lead}</p>}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

/** A field that is text, and an input in edit mode. Saves on blur. */
export function Field({ label, value, onSave, type = 'text', dir, suffix, options, multiline, always }: {
  label: string
  value: string | number | undefined
  onSave: (v: string) => void
  type?: 'text' | 'number' | 'date' | 'tel' | 'email'
  dir?: 'ltr' | 'rtl'
  suffix?: string
  options?: string[]
  multiline?: boolean
  always?: boolean
}) {
  const { editMode } = useStore()
  const id = useId()
  const [v, setV] = useState(value ?? '')
  useEffect(() => setV(value ?? ''), [value])
  const commit = () => { if (String(v) !== String(value ?? '')) onSave(String(v)) }
  const editing = editMode || always
  return (
    <div className="field">
      <label htmlFor={id} className="eyebrow">{label}</label>
      {editing ? (
        options ? (
          <select id={id} value={String(v)} onChange={(e) => { setV(e.target.value); onSave(e.target.value) }}>
            {options.map((o) => <option key={o}>{o}</option>)}
          </select>
        ) : multiline ? (
          <textarea id={id} value={String(v)} rows={3} onChange={(e) => setV(e.target.value)} onBlur={commit} />
        ) : (
          <input id={id} type={type} dir={dir} value={String(v)} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
        )
      ) : (
        <span id={id} className="field-v" dir={dir}>{value === '' || value === undefined ? '—' : value}{suffix && value !== '' ? ` ${suffix}` : ''}</span>
      )}
    </div>
  )
}

/** A dialog that opens under the top bar. Closes on Escape and on the backdrop. */
export function Sheet({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', onKey)
    setTimeout(() => box.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus(), 60)
    return () => removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="sheet-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
          <motion.div ref={box} role="dialog" aria-modal="true" aria-label={title} className={`sheet ${wide ? 'wide' : ''}`} initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="sheet-head">
              <h3>{title}</h3>
              <Btn tone="quiet" size="sm" onClick={onClose} aria-label="סגירה">סגירה</Btn>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Notices() {
  const { notices } = useStore()
  return (
    <div className="notices" aria-live="polite">
      <AnimatePresence>
        {notices.map((n) => (
          <motion.div key={n.id} className={`notice ${n.tone}`} data-testid="notice" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>
            {n.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy'); ta.remove(); return ok
  }
}
