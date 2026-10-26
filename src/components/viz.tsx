import { motion, useReducedMotion } from 'framer-motion'
import type { Project, StageState } from '../domain/types'
import { STATE_META, stageGross, ils, ilsShort, isOverdue, type Bucket, type MonthFlow } from '../domain/logic'
import { monthLabel, today } from '../domain/dates'

const ease = [0.2, 0.7, 0.2, 1] as const

/**
 * The fee rail: the project's fee as one beam, each stage a segment as wide as its share.
 * Colour = where the money of that stage stands.
 */
export function FeeRail({ project, vat, selected, onPick, tall }: { project: Project; vat: number; selected?: string; onPick?: (id: string) => void; tall?: boolean }) {
  const reduce = useReducedMotion()
  const on = today()
  return (
    <div className={`rail ${tall ? 'tall' : ''}`} role="list" aria-label={`חלוקת שכר הטרחה של ${project.name}`}>
      {project.stages.map((s, i) => {
        const late = isOverdue(s, on)
        const Tag = onPick ? 'button' : 'div'
        return (
          <motion.div key={s.id} role="listitem" className="rail-cell" style={{ flex: `${Math.max(s.pct, 0.5)} 1 0` }}
            initial={reduce ? false : { scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ delay: i * 0.06, duration: 0.5, ease }}>
            <Tag type={onPick ? 'button' : undefined} className={`rail-seg s-${STATE_META[s.state].tone} ${late ? 'late' : ''} ${selected === s.id ? 'on' : ''}`}
              onClick={onPick ? () => onPick(s.id) : undefined}
              title={`${i + 1}. ${s.name}: ${s.pct}% · ${ils(stageGross(project, s, vat))} · ${late ? 'באיחור' : STATE_META[s.state].label}`}
              aria-label={`שלב ${i + 1}, ${s.name}, ${STATE_META[s.state].label}${late ? ', באיחור' : ''}`}>
              <span className="rail-n mono">{String(i + 1).padStart(2, '0')}</span>
              {tall && <span className="rail-name">{s.name}</span>}
              {tall && <span className="rail-pct mono">{s.pct}%</span>}
            </Tag>
          </motion.div>
        )
      })}
    </div>
  )
}

export function RailLegend() {
  const states: StageState[] = ['future', 'active', 'submitted', 'approved', 'invoiced', 'paid']
  return (
    <ul className="legend" aria-label="מקרא מצבי שלב">
      {states.map((s) => <li key={s}><i className={`sw s-${STATE_META[s].tone}`} />{STATE_META[s].label}</li>)}
      <li><i className="sw late" />באיחור תשלום</li>
    </ul>
  )
}

/** Build, bridge, pay: where every shekel of the office's fees stands now. */
export function Pipeline({ buckets, onPick }: { buckets: Bucket[]; onPick?: (b: Bucket) => void }) {
  const reduce = useReducedMotion()
  // Future work is scaled out of the max, so it does not dwarf the money in motion.
  const max = Math.max(1, ...buckets.filter((b) => b.state !== 'future').map((b) => b.amount))
  const groups = [
    { title: 'בנייה', note: 'עבודה בסטודיו', states: ['future', 'active'] },
    { title: 'גשר', note: 'אישור הלקוח', states: ['submitted', 'approved'] },
    { title: 'תשלום', note: 'דרישה וגבייה', states: ['invoiced', 'paid'] },
  ]
  return (
    <div className="pipeline">
      {groups.map((g, gi) => (
        <div key={g.title} className="pipe-group">
          <div className="pipe-head"><span className="mono">{String(gi + 1).padStart(2, '0')}</span><strong>{g.title}</strong><span className="muted">{g.note}</span></div>
          <div className="pipe-cols">
            {buckets.filter((b) => g.states.includes(b.state)).map((b, i) => (
              <button key={b.state} type="button" className="pipe-col" onClick={() => onPick?.(b)} title={b.hint}>
                <div className="pipe-track">
                  <motion.div className={`pipe-bar s-${STATE_META[b.state].tone}`} initial={reduce ? false : { height: 0 }} animate={{ height: `${Math.min(100, Math.max(3, (b.amount / max) * 100))}%` }} transition={{ delay: 0.15 + (gi * 2 + i) * 0.08, duration: 0.8, ease }} />
                </div>
                <span className="pipe-amt">{ilsShort(b.amount)}</span>
                <span className="pipe-label">{b.label}</span>
                <span className="mono muted">{b.count} שלבים</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Monthly cash: collected (past), payment requests by due date, and forecast from work in progress. */
export function CashChart({ months }: { months: MonthFlow[] }) {
  const reduce = useReducedMotion()
  const W = 720, H = 260, padB = 36, padT = 16
  const max = Math.max(1, ...months.map((m) => m.collected + m.due + m.forecast))
  const bw = W / months.length
  const y = (v: number) => ((H - padB - padT) * v) / max
  const nowIdx = months.findIndex((m) => !m.past)
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="תזרים חודשי: נגבה, לפירעון ותחזית">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(42,138,90,0.10)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#2a8a5a" strokeWidth="2" />
          </pattern>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={H - padB - (H - padB - padT) * f} y2={H - padB - (H - padB - padT) * f} className="grid" />
        ))}
        {nowIdx > 0 && <line x1={W - nowIdx * bw} x2={W - nowIdx * bw} y1={padT - 6} y2={H - padB + 6} className="now" />}
        {months.map((m, i) => {
          // RTL: the first month sits on the right.
          const x = W - (i + 1) * bw + bw * 0.2
          const w = bw * 0.6
          let base = H - padB
          const parts: [number, string][] = [[m.collected, 'c'], [m.due, 'd'], [m.forecast, 'f']]
          return (
            <g key={m.key}>
              {parts.map(([v, k], j) => {
                if (!v) return null
                const h = y(v)
                base -= h
                return (
                  <motion.rect key={k} x={x} width={w} className={`bar-${k}`} fill={k === 'f' ? 'url(#hatch)' : undefined}
                    initial={reduce ? false : { y: H - padB, height: 0 }} animate={{ y: base, height: h }} transition={{ delay: i * 0.04 + j * 0.1, duration: 0.7, ease }}>
                    <title>{`${monthLabel(m.key)}: ${k === 'c' ? 'נגבה' : k === 'd' ? 'לפירעון' : 'תחזית'} ${ils(v)}`}</title>
                  </motion.rect>
                )
              })}
              <text x={x + w / 2} y={H - padB + 18} className="axis" textAnchor="middle">{monthLabel(m.key)}</text>
              {m.collected + m.due + m.forecast > 0 && <text x={x + w / 2} y={base - 6} className="val" textAnchor="middle">{ilsShort(m.collected + m.due + m.forecast)}</text>}
            </g>
          )
        })}
      </svg>
      <figcaption className="legend">
        <span><i className="sw bar-c" />נגבה בפועל</span>
        <span><i className="sw bar-d" />דרישות לפירעון</span>
        <span><i className="sw hatch" />תחזית משלבים פתוחים</span>
        <span><i className="sw now-sw" />היום</span>
      </figcaption>
    </figure>
  )
}

export function AgingBars({ buckets }: { buckets: { label: string; amount: number; count: number }[] }) {
  const reduce = useReducedMotion()
  const max = Math.max(1, ...buckets.map((b) => b.amount))
  return (
    <div className="aging">
      {buckets.map((b, i) => (
        <div key={b.label} className={`age-row a${i}`}>
          <span className="age-l">{b.label}</span>
          <div className="age-track"><motion.div className="age-bar" initial={reduce ? false : { width: 0 }} animate={{ width: `${(b.amount / max) * 100}%` }} transition={{ delay: i * 0.1, duration: 0.7, ease }} /></div>
          <span className="age-v">{ils(b.amount)} <span className="muted mono">· {b.count}</span></span>
        </div>
      ))}
    </div>
  )
}

export function Ring({ value, size = 92, label }: { value: number; size?: number; label: string }) {
  const reduce = useReducedMotion()
  const r = size / 2 - 7
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring" role="img" aria-label={`${label}: ${Math.round(v)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" />
      <motion.circle cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeDasharray={c} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={reduce ? false : { strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v / 100) }} transition={{ duration: 1, ease }} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="ring-t">{Math.round(v)}%</text>
    </svg>
  )
}

/** Home hero: a bridge of three piers. A stage travels from work, over the client's approval, to payment. */
export function BridgeHero() {
  const reduce = useReducedMotion()
  const piers = [
    { x: 520, label: 'בנייה', sub: 'הסטודיו מכין את תוצרי השלב' },
    { x: 300, label: 'גשר', sub: 'הלקוח מאשר בקישור אישי' },
    { x: 80, label: 'תשלום', sub: 'דרישה יוצאת לבד, הגבייה נמדדת' },
  ]
  return (
    <svg className="bridge" viewBox="0 0 640 300" role="img" aria-label="מסלול שלב: בנייה, אישור לקוח, תשלום">
      <defs>
        <linearGradient id="deck" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f6f5f2" /><stop offset="1" stopColor="#d9d6cf" /></linearGradient>
        <linearGradient id="pier" x1="0" x2="1"><stop offset="0" stopColor="#2b2e33" /><stop offset="1" stopColor="#15171a" /></linearGradient>
        <linearGradient id="water" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="rgba(34,50,79,0.10)" /><stop offset="1" stopColor="rgba(34,50,79,0)" /></linearGradient>
      </defs>
      <rect x="0" y="210" width="640" height="90" fill="url(#water)" />
      {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2="640" y1={226 + i * 16} y2={226 + i * 16} className="hair" />)}
      {piers.map((p, i) => (
        <motion.g key={p.label} initial={reduce ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.25, duration: 0.8, ease }}>
          <polygon points={`${p.x},120 ${p.x + 40},120 ${p.x + 48},112 ${p.x + 8},112`} fill="#c9c6bf" />
          <rect x={p.x} y="120" width="40" height="110" fill="url(#pier)" />
          <polygon points={`${p.x + 40},120 ${p.x + 48},112 ${p.x + 48},222 ${p.x + 40},230`} fill="#0d0e10" />
          <text x={p.x + 20} y="262" textAnchor="middle" className="pier-l">{p.label}</text>
          <text x={p.x + 20} y="282" textAnchor="middle" className="pier-s">{p.sub}</text>
        </motion.g>
      ))}
      <motion.path d="M 40 112 L 600 112 L 610 104 L 50 104 Z" fill="#b9b5ad" initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ delay: 0.9, duration: 0.6 }} />
      <motion.rect x="40" y="112" width="560" height="10" fill="url(#deck)" stroke="rgba(23,24,26,0.25)" initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} style={{ transformOrigin: '600px 112px' }} transition={{ delay: 0.9, duration: 0.9, ease }} />
      <motion.path d="M 60 112 Q 320 10 580 112" fill="none" stroke="#8a6a1f" strokeWidth="1.2" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.4, duration: 1.2 }} />
      {Array.from({ length: 13 }, (_, i) => {
        const x = 80 + i * 40
        const t = (x - 60) / 520
        const yy = (1 - t) * (1 - t) * 112 + 2 * (1 - t) * t * 10 + t * t * 112
        return <motion.line key={i} x1={x} x2={x} y1={yy} y2="112" stroke="rgba(138,106,31,0.55)" strokeWidth="0.8" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 + i * 0.04 }} />
      })}
      {!reduce && (
        <motion.g initial={{ x: 0 }} animate={{ x: [0, -220, -220, -440, -440] }} transition={{ duration: 7, times: [0, 0.35, 0.5, 0.85, 1], repeat: Infinity, repeatDelay: 0.8, delay: 2.2, ease: 'easeInOut' }}>
          <rect x="530" y="92" width="20" height="14" fill="#c79a3c" stroke="#8a6a1f" />
          <rect x="534" y="88" width="20" height="14" fill="none" stroke="rgba(138,106,31,0.6)" />
        </motion.g>
      )}
    </svg>
  )
}
