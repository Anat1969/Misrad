import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../store/store'
import { officeTotals, pipeline, projectSummary, risks, ils, ilsShort, STATE_META } from '../domain/logic'
import type { StageState } from '../domain/types'
import { Btn, Empty, Kpi, Level, SectionHead, Tag } from '../components/ui'
import { FeeRail, Pipeline, RailLegend } from '../components/viz'

const FILTERS = [
  { id: 'active', label: 'פעילים' },
  { id: 'late', label: 'באיחור תשלום' },
  { id: 'waiting', label: 'ממתינים לאישור' },
  { id: 'archived', label: 'בארכיון' },
  { id: 'all', label: 'הכול' },
] as const

const SORTS = [
  { id: 'attention', label: 'לפי דחיפות' },
  { id: 'name', label: 'לפי שם' },
  { id: 'progress', label: 'לפי התקדמות' },
  { id: 'outstanding', label: 'לפי יתרה פתוחה' },
] as const

export default function Office() {
  const { data } = useStore()
  const reduce = useReducedMotion()
  const [params, setParams] = useSearchParams()
  const filter = (params.get('f') || 'active') as (typeof FILTERS)[number]['id']
  const sort = (params.get('sort') || 'attention') as (typeof SORTS)[number]['id']
  const stateFilter = params.get('state') as StageState | null
  const [q, setQ] = useState('')
  const vat = data.settings.vatRate
  const t = officeTotals(data)
  const rs = risks(data)
  const set = (k: string, v: string | null) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }) }

  const rows = useMemo(() => {
    const list = data.projects.map((p) => ({ p, s: projectSummary(p, vat), r: rs.filter((x) => x.projectId === p.id) }))
      .filter(({ p, s }) => {
        if (filter === 'active' && p.archived) return false
        if (filter === 'archived' && !p.archived) return false
        if (filter === 'late' && !s.overdue) return false
        if (filter === 'waiting' && !p.stages.some((x) => x.state === 'submitted')) return false
        if (stateFilter && !p.stages.some((x) => x.state === stateFilter)) return false
        if (q && !`${p.name} ${p.client.name} ${p.code} ${p.address}`.includes(q.trim())) return false
        return true
      })
    const score = (r: typeof list[0]) => r.r.reduce((a, x) => a + (x.level === 'high' ? 100 : x.level === 'mid' ? 10 : 1), 0)
    return list.sort((a, b) =>
      sort === 'name' ? a.p.name.localeCompare(b.p.name, 'he')
        : sort === 'progress' ? b.s.progress - a.s.progress
          : sort === 'outstanding' ? b.s.outstanding - a.s.outstanding
            : score(b) - score(a))
  }, [data, vat, rs, filter, sort, stateFilter, q])

  return (
    <>
      <SectionHead title="המשרד" lead="כל הפרויקטים, וכל שלב בכל פרויקט, לפי מצב הכסף שלו.">
        <Btn tone="ink" to="/new">פרויקט חדש</Btn>
      </SectionHead>

      <section className="kpis" aria-label="סיכום">
        <Kpi label="פרויקטים פעילים" value={t.projects} />
        <Kpi label="פתוח לגבייה" value={t.outstanding} format={ilsShort} note="דרישות שיצאו ולא שולמו" />
        <Kpi label="אושר ולא חויב" value={t.unbilled} format={ilsShort} tone={t.unbilled ? 'bad' : undefined} note={t.unbilled ? 'להוציא דרישה' : 'הכול חויב'} />
        <Kpi label="באיחור" value={t.overdue} format={ilsShort} tone={t.overdue ? 'bad' : undefined} />
      </section>

      <div className="card deep">
        <Pipeline buckets={pipeline(data)} onPick={(b) => { const n = new URLSearchParams(params); if (stateFilter === b.state) n.delete('state'); else n.set('state', b.state); n.set('f', 'active'); setParams(n, { replace: true }) }} />
        {stateFilter && <p className="filter-note">מוצגים פרויקטים עם שלב במצב "{STATE_META[stateFilter].label}". <button className="linkish" onClick={() => set('state', null)}>ביטול הסינון</button></p>}
      </div>

      <div className="toolbar" role="toolbar" aria-label="סינון ומיון">
        <div className="chips" role="group" aria-label="סינון">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={`chip ${filter === f.id ? 'on' : ''}`} aria-pressed={filter === f.id} onClick={() => set('f', f.id)}>{f.label}</button>
          ))}
        </div>
        <div className="tool-right">
          <input className="search" type="search" placeholder="חיפוש: שם, לקוח, מספר תיק" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש פרויקט" />
          <select value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="מיון">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <RailLegend />

      {rows.length === 0 ? (
        <Empty title="אין פרויקטים שמתאימים לסינון">נסו סינון אחר, או פתחו פרויקט חדש מכפתור הלוגו או מהכפתור למעלה.</Empty>
      ) : (
        <ul className="projects">
          {rows.map(({ p, s, r }, i) => (
            <motion.li key={p.id} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/project/${p.id}`} className={`prow ${p.archived ? 'archived' : ''}`}>
                <div className="prow-id">
                  <span className="mono muted">{p.code}</span>
                  <strong className="prow-name">{p.name}</strong>
                  <span className="muted">{p.client.name} · {p.type}</span>
                </div>
                <div className="prow-rail">
                  <FeeRail project={p} vat={vat} />
                  <div className="prow-now">
                    {s.closed ? <span className="muted">כל השלבים שולמו</span> : s.current && (<>
                      <span className="mono muted">שלב {s.currentIndex}/{p.stages.length}</span>
                      <span>{s.current.name}</span>
                      <Tag state={s.current.state} small />
                    </>)}
                  </div>
                </div>
                <dl className="prow-nums">
                  <div><dt>אושר</dt><dd>{s.progress}%</dd></div>
                  <div><dt>נגבה</dt><dd>{ilsShort(s.collected)}</dd></div>
                  <div><dt>פתוח</dt><dd className={s.overdue ? 'bad' : ''}>{ilsShort(s.outstanding)}</dd></div>
                </dl>
                <div className="prow-flags">
                  {r.slice(0, 2).map((x) => <span key={x.id} className="flag"><Level level={x.level} />{x.title}</span>)}
                  {r.length > 2 && <span className="muted mono">+{r.length - 2}</span>}
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}

      <section className="section">
        <SectionHead num="סיכונים" title={`${rs.length} נקודות לטיפול`} lead="מחושב בקוד מתוך הנתונים: איחורי תשלום, אישורים שמתעכבים, שלבים שעברו יעד, חלוקה שלא מסתכמת ל-100%, ומסמכים חסרים." />
        <ol className="risk-list">
          {rs.map((x) => (
            <li key={x.id}>
              <Link to={`/project/${x.projectId}${x.stageId ? `?stage=${x.stageId}` : ''}`} className="risk">
                <Level level={x.level} />
                <div className="risk-body"><strong>{x.projectName}: {x.title}</strong><span>{x.why}</span></div>
                <span className="risk-act mono">{x.action}</span>
              </Link>
            </li>
          ))}
        </ol>
        {!rs.length && <p className="muted">אין סיכונים פתוחים.</p>}
        <p className="small muted">סכומים כוללים מע"מ {vat}%. {ils(t.waiting)} ממתינים כרגע לאישור לקוח.</p>
      </section>
    </>
  )
}
