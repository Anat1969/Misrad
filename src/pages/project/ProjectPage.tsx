import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../../store/store'
import type { AppData, Project, Stage } from '../../domain/types'
import {
  NEXT_ACTION, STATE_META, approveStage, claudePrompt, completeness, daysOverdue, ils, isOverdue, issueInvoice, pctTotal,
  projectSummary, registerPayment, returnStage, revertStage, risks, stageBalance, stageGross, stageNet, startStage, submitStage, uid,
} from '../../domain/logic'
import { fmtDate, today } from '../../domain/dates'
import { waLink } from '../../domain/share'
import { useMenuItems, type MenuItem } from '../../components/AIMenu'
import { Btn, Empty, Field, Level, Sheet, Tag, copyText } from '../../components/ui'
import { FeeRail, RailLegend, Ring } from '../../components/viz'
import { ApproveSheet, ConfirmSheet, DocSheet, MemberSheet, PaySheet, ShareSheet, TaskSheet } from './sheets'

const TABS = [
  { id: 'stages', label: 'שלבים ותשלומים' },
  { id: 'tasks', label: 'משימות' },
  { id: 'team', label: 'צוות ומסמכים' },
  { id: 'log', label: 'יומן' },
  { id: 'details', label: 'פרטים' },
] as const
type Tab = (typeof TABS)[number]['id']

type SheetState =
  | { kind: 'share'; who: 'client' | 'contractor'; stage?: Stage }
  | { kind: 'approve'; stage: Stage }
  | { kind: 'pay'; stage: Stage }
  | { kind: 'task' | 'member' | 'doc' | 'delete' | 'claude' }
  | null

export default function ProjectPage() {
  const { id } = useParams()
  const { data, mutate, editMode, notify } = useStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') || 'stages') as Tab
  const p = data.projects.find((x) => x.id === id)
  const selected = params.get('stage') || p?.stages.find((s) => s.state === 'submitted' || s.state === 'active' || s.state === 'invoiced')?.id
  const [sheet, setSheet] = useState<SheetState>(null)
  const close = useCallback(() => setSheet(null), [])
  const vat = data.settings.vatRate

  /** Change this project in a copy of the data. */
  const change = useCallback((fn: (p: Project, d: AppData) => void, msg?: string) => {
    mutate((d) => { const x = d.projects.find((q) => q.id === id); if (x) fn(x, d) }, msg)
  }, [mutate, id])
  const st = (p: Project, sid: string) => p.stages.find((s) => s.id === sid)!

  const items = useMemo<MenuItem[] | null>(() => p ? [
    { label: 'הוספת שלב', onSelect: () => change((x) => { x.stages.push({ id: uid(), name: 'שלב חדש', pct: 0, deliverables: '', state: 'future', payments: [] }) }, 'נוסף שלב. מתקנים את האחוזים כך שיסתכמו ל-100%.') },
    { label: 'הוספת משימה', onSelect: () => setSheet({ kind: 'task' }) },
    { label: 'הוספת איש צוות', onSelect: () => setSheet({ kind: 'member' }) },
    { label: 'הוספת מסמך', onSelect: () => setSheet({ kind: 'doc' }) },
    { label: 'שכפול הפרויקט', onSelect: () => {
      const nid = uid()
      mutate((d) => {
        const src = d.projects.find((q) => q.id === id)!
        const copy: Project = { ...structuredClone(src), id: nid, code: `${src.code}-ע`, name: `${src.name} (עותק)`, archived: false, createdAt: today(), log: [], stages: src.stages.map((s) => ({ id: uid(), name: s.name, pct: s.pct, deliverables: s.deliverables, state: 'future', payments: [] })), tasks: [] }
        d.projects.unshift(copy)
      }, 'נוצר עותק עם אותם שלבים, בלי מצב ותשלומים')
      navigate(`/project/${nid}?tab=details`)
    } },
    { label: p.archived ? 'החזרה מהארכיון' : 'העברה לארכיון', onSelect: () => change((x) => { x.archived = !x.archived }, p.archived ? 'הפרויקט חזר לפעילים' : 'הפרויקט עבר לארכיון') },
    { label: 'מחיקת הפרויקט', onSelect: () => setSheet({ kind: 'delete' }) },
  ] : null, [p, change, mutate, id, navigate])
  useMenuItems('project', items)

  if (!p) return <Empty title="הפרויקט לא נמצא">ייתכן שנמחק, או שהקישור שגוי. <Link to="/office">חזרה למשרד</Link></Empty>

  const sum = projectSummary(p, vat)
  const rs = risks(data).filter((r) => r.projectId === p.id)
  const setTab = (t: Tab) => { const n = new URLSearchParams(params); n.set('tab', t); setParams(n, { replace: true }) }
  const pick = (sid: string) => { const n = new URLSearchParams(params); n.set('stage', sid); n.set('tab', 'stages'); setParams(n, { replace: true }); setTimeout(() => document.getElementById(`stage-${sid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }

  const act = (s: Stage) => {
    switch (s.state) {
      case 'future': return change((x) => startStage(x, st(x, s.id)), `התחיל שלב "${s.name}"`)
      case 'active':
        change((x) => submitStage(x, st(x, s.id)), `"${s.name}" הוגש. עכשיו שולחים ללקוח את קישור האישור.`)
        return setSheet({ kind: 'share', who: 'client', stage: s })
      case 'submitted': return setSheet({ kind: 'approve', stage: s })
      case 'approved': return change((x, d) => issueInvoice(x, st(x, s.id), d.settings), 'יצאה דרישת תשלום')
      case 'invoiced': return setSheet({ kind: 'pay', stage: s })
    }
  }

  return (
    <div className="project">
      <nav className="crumbs" aria-label="פירורי לחם"><Link to="/office">המשרד</Link><span aria-hidden>/</span><span>{p.name}</span></nav>

      <header className="phead">
        <div className="phead-id">
          <span className="mono muted">{p.code} · {p.type} · {p.area} מ"ר</span>
          <h1 className="ptitle">{p.name}</h1>
          <p className="muted">{p.client.name} · {p.address}{p.archived && ' · בארכיון'}</p>
        </div>
        <div className="phead-nums">
          <Ring value={sum.progress} label="שכר טרחה שאושר" />
          <dl className="metrics compact">
            <div><dt>שכר טרחה</dt><dd>{ils(sum.feeGross)}</dd></div>
            <div><dt>נגבה</dt><dd className="ok">{ils(sum.collected)}</dd></div>
            <div><dt>פתוח</dt><dd className={sum.overdue ? 'bad' : ''}>{ils(sum.outstanding)}</dd></div>
          </dl>
        </div>
        <div className="phead-actions">
          <Btn tone="ink" onClick={() => setSheet({ kind: 'share', who: 'client' })}>קישור ללקוח</Btn>
          <Btn onClick={() => setSheet({ kind: 'share', who: 'contractor' })}>קישור לקבלן</Btn>
          <Btn tone="quiet" onClick={() => setSheet({ kind: 'claude' })}>ניתוח עם Claude</Btn>
        </div>
      </header>

      <section className="card deep rail-card" aria-label="שכר הטרחה לפי שלבים">
        <div className="rail-head"><span className="eyebrow">שכר הטרחה לפי שלבים · רוחב = חלק משכר הטרחה</span>
          {Math.abs(pctTotal(p) - 100) > 0.01 && <span className="error mono">סך האחוזים {pctTotal(p)}%</span>}</div>
        <FeeRail project={p} vat={vat} tall selected={selected} onPick={pick} />
        <RailLegend />
      </section>

      <div className="tabs" role="tablist" aria-label="לשוניות הפרויקט">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'tasks' && sum.openTasks > 0 && <span className="mono count">{sum.openTasks}</span>}
            {tab === t.id && <motion.span layoutId="tabrule" className="tab-rule" />}
          </button>
        ))}
      </div>

      <div className="pgrid">
        <div className="pmain">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {tab === 'stages' && <StagesTab p={p} vat={vat} selected={selected} onAct={act} change={change} editMode={editMode} onShare={(s) => setSheet({ kind: 'share', who: 'client', stage: s })} onPick={pick} />}
              {tab === 'tasks' && <TasksTab p={p} change={change} editMode={editMode} onAdd={() => setSheet({ kind: 'task' })} />}
              {tab === 'team' && <TeamTab p={p} change={change} editMode={editMode} onAddMember={() => setSheet({ kind: 'member' })} onAddDoc={() => setSheet({ kind: 'doc' })} />}
              {tab === 'log' && <LogTab p={p} change={change} />}
              {tab === 'details' && <DetailsTab p={p} change={change} />}
            </motion.div>
          </AnimatePresence>
        </div>
        <aside className="pside" aria-label="המלצות">
          <div className="card">
            <span className="eyebrow">מה הקוד מזהה כאן</span>
            {rs.length === 0 ? <p className="muted">אין סיכונים פתוחים בפרויקט.</p> : (
              <ul className="side-risks">
                {rs.map((r) => (
                  <li key={r.id}>
                    <Level level={r.level} />
                    <strong>{r.title}</strong>
                    <span className="muted">{r.why}</span>
                    {r.stageId && <button className="linkish" onClick={() => pick(r.stageId!)}>{r.action}</button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Completeness p={p} />
          {p.nextMeeting && (
            <div className="card"><span className="eyebrow">פגישה קרובה</span><strong>{fmtDate(p.nextMeeting.date)} · {p.nextMeeting.time}</strong><span className="muted">{p.nextMeeting.place}</span></div>
          )}
        </aside>
      </div>

      {sheet?.kind === 'share' && <ShareSheet open onClose={close} project={p} who={sheet.who} stage={sheet.stage} />}
      {sheet?.kind === 'approve' && (
        <ApproveSheet open onClose={close} project={p} stage={sheet.stage}
          onApprove={(by, note) => { change((x, d) => approveStage(x, st(x, sheet.stage.id), d.settings, by, note), data.settings.autoInvoice ? 'האישור נרשם, יצאה דרישת תשלום והשלב הבא נפתח' : 'האישור נרשם'); close() }}
          onReturn={(note) => { change((x) => returnStage(x, st(x, sheet.stage.id), note), 'השלב חזר לעבודה עם הערות הלקוח'); close() }} />
      )}
      {sheet?.kind === 'pay' && (
        <PaySheet open onClose={close} project={p} stage={sheet.stage} vat={vat}
          onPay={(pay) => { change((x) => registerPayment(x, st(x, sheet.stage.id), pay, vat), 'התשלום נרשם'); close() }} />
      )}
      {sheet?.kind === 'task' && <TaskSheet open onClose={close} project={p} onAdd={(t) => { change((x) => { x.tasks.unshift({ id: uid(), done: false, ...t }) }, 'המשימה נוספה'); close(); setTab('tasks') }} />}
      {sheet?.kind === 'member' && <MemberSheet open onClose={close} onAdd={(m) => { change((x) => { x.team.push({ id: uid(), ...m }) }, 'נוסף לצוות'); close(); setTab('team') }} />}
      {sheet?.kind === 'doc' && <DocSheet open onClose={close} onAdd={(doc) => {
        change((x) => {
          x.docs.forEach((o) => { if (o.name === doc.name && o.discipline === doc.discipline) o.current = false })
          x.docs.unshift({ id: uid(), date: today(), current: true, ...doc })
        }, 'המסמך נוסף'); close(); setTab('team')
      }} />}
      {sheet?.kind === 'delete' && <ConfirmSheet open onClose={close} title="מחיקת הפרויקט" text={`"${p.name}" יימחק עם כל השלבים, התשלומים והיומן. אי אפשר לבטל. אם רק סיימתם, עדיף להעביר לארכיון.`} action="מחיקה לצמיתות"
        onConfirm={() => { mutate((d) => { d.projects = d.projects.filter((x) => x.id !== p.id) }, 'הפרויקט נמחק'); navigate('/office') }} />}
      {sheet?.kind === 'claude' && <ClaudeSheet p={p} data={data} onClose={close} notify={notify} />}
    </div>
  )
}

// ---------- stages ----------

function StagesTab({ p, vat, selected, onAct, change, editMode, onShare, onPick }: {
  p: Project; vat: number; selected?: string; onAct: (s: Stage) => void; editMode: boolean; onPick: (id: string) => void
  change: (fn: (p: Project, d: AppData) => void, msg?: string) => void; onShare: (s: Stage) => void
}) {
  const on = today()
  const { data } = useStore()
  return (
    <ol className="stages">
      {p.stages.map((s, i) => {
        const late = isOverdue(s, on)
        const open = selected === s.id
        const next = NEXT_ACTION[s.state]
        const compact = s.state === 'paid' && !open && !editMode
        const edit = (k: keyof Stage) => (v: string) => change((x) => { const y = x.stages.find((q) => q.id === s.id)! as unknown as Record<string, unknown>; y[k] = k === 'pct' ? Number(v) : v || undefined })
        return (
          <li key={s.id} id={`stage-${s.id}`} className={`stage s-${STATE_META[s.state].tone} ${open ? 'open' : ''} ${late ? 'late' : ''} ${compact ? 'compact' : ''}`}>
            <div className="stage-top">
              <span className="stage-n mono">{String(i + 1).padStart(2, '0')}</span>
              <div className="stage-title">
                <strong>{s.name}</strong>
                <span className="muted">{s.pct}% · {ils(stageNet(p, s))} + מע"מ = {ils(stageGross(p, s, vat))}</span>
              </div>
              {late ? <span className="tag lv-high"><i />באיחור {daysOverdue(s, on)} ימים</span> : <Tag state={s.state} />}
            </div>

            {compact ? (
              <div className="stage-actions">
                <span className="muted small">שולם {fmtDate(s.payments.map((x) => x.date).sort().at(-1))} · דרישה {s.invoiceNo}</span>
                <button className="linkish" onClick={() => onPick(s.id)}>פירוט</button>
              </div>
            ) : <>
            <Timeline s={s} />

            {s.returnedNote && s.state === 'active' && <p className="returned"><span className="eyebrow">הערות הלקוח</span>{s.returnedNote}</p>}
            {s.deliverables && <p className="deliv"><span className="eyebrow">תוצרי השלב</span>{s.deliverables}</p>}

            {editMode && (
              <div className="grid4 stage-edit">
                <Field label="שם השלב" value={s.name} onSave={edit('name')} />
                <Field label="אחוז משכר הטרחה" type="number" value={s.pct} onSave={edit('pct')} />
                <Field label="יעד" type="date" value={s.targetDate} onSave={edit('targetDate')} />
                <Field label="תוצרים" value={s.deliverables} onSave={edit('deliverables')} />
              </div>
            )}

            <div className="stage-actions">
              {next && <Btn tone="ink" onClick={() => onAct(s)}>{next}</Btn>}
              {s.state === 'submitted' && <Btn onClick={() => onShare(s)}>שליחת קישור האישור</Btn>}
              {(s.state === 'invoiced' || s.state === 'paid') && <Btn to={`/invoice/${p.id}/${s.id}`}>דרישת תשלום {s.invoiceNo}</Btn>}
              {s.state === 'invoiced' && p.client.phone && (
                <Btn tone="quiet" href={waLink(p.client.phone, `שלום ${p.client.name},\nתזכורת לדרישת תשלום ${s.invoiceNo} על שלב "${s.name}" בפרויקט ${p.name}: ${ils(stageBalance(p, s, vat))}, לפירעון עד ${fmtDate(s.dueAt)}.\nתודה,\n${data.settings.architectName}`)}>תזכורת בוואטסאפ</Btn>
              )}
              {s.state === 'future' && !editMode && !s.targetDate && <span className="muted small">אין יעד. אפשר לקבוע במצב עריכה.</span>}
              {editMode && s.state !== 'future' && <Btn tone="quiet" onClick={() => change((x) => revertStage(x, x.stages.find((q) => q.id === s.id)!), 'השלב הוחזר למצב הקודם')}>החזרה למצב הקודם</Btn>}
              {editMode && s.state === 'future' && <Btn tone="bad" onClick={() => change((x) => { x.stages = x.stages.filter((q) => q.id !== s.id) }, 'השלב נמחק')}>מחיקת השלב</Btn>}
            </div>
            <p className="stage-hint small muted">{STATE_META[s.state].hint}{s.state === 'submitted' && data.settings.autoInvoice ? ' רישום האישור יוציא דרישת תשלום ויפתח את השלב הבא.' : ''}</p>
            </>}
          </li>
        )
      })}
    </ol>
  )
}

function Timeline({ s }: { s: Stage }) {
  const paidAt = s.payments.map((x) => x.date).sort().at(-1)
  const steps = [
    { l: 'התחלה', d: s.startedAt },
    { l: 'הגשה', d: s.submittedAt },
    { l: 'אישור', d: s.approvedAt, by: s.approvedBy },
    { l: 'דרישה', d: s.invoicedAt },
    { l: 'פירעון', d: s.dueAt, due: true },
    { l: 'תשלום', d: s.state === 'paid' ? paidAt : undefined },
  ]
  return (
    <ol className="tl">
      {steps.map((x) => (
        <li key={x.l} className={x.d ? (x.due && s.state !== 'paid' ? 'due' : 'done') : ''}>
          <span className="tl-dot" />
          <span className="eyebrow">{x.l}</span>
          <span className="mono">{x.d ? fmtDate(x.d) : '—'}</span>
        </li>
      ))}
      {s.targetDate && !['approved', 'invoiced', 'paid'].includes(s.state) && <li className="target"><span className="tl-dot" /><span className="eyebrow">יעד הגשה</span><span className="mono">{fmtDate(s.targetDate)}</span></li>}
    </ol>
  )
}

// ---------- tasks ----------

const OWNERS = [{ id: 'studio', label: 'הסטודיו' }, { id: 'contractor', label: 'הקבלן' }, { id: 'client', label: 'הלקוח' }] as const
const PRI = { urgent: 'דחוף', normal: 'רגיל', low: 'נמוך' }

function TasksTab({ p, change, editMode, onAdd }: { p: Project; change: (fn: (p: Project) => void, msg?: string) => void; editMode: boolean; onAdd: () => void }) {
  const on = today()
  if (!p.tasks.length) return <Empty title="אין משימות">מוסיפים משימה מכפתור הלוגו, "הוספת משימה". <button className="linkish" onClick={onAdd}>הוספת משימה עכשיו</button></Empty>
  return (
    <div className="owners">
      {OWNERS.map((o) => {
        const list = p.tasks.filter((t) => t.owner === o.id).sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9').localeCompare(b.due || '9'))
        if (!list.length) return null
        return (
          <section key={o.id} className="owner-group">
            <h3>{o.label} <span className="mono muted">{list.filter((t) => !t.done).length} פתוחות</span></h3>
            <ul className="tasks">
              {list.map((t) => {
                const late = !t.done && t.due && t.due < on
                return (
                  <li key={t.id} className={`task ${t.done ? 'done' : ''} ${late ? 'late' : ''}`}>
                    <label className="check">
                      <input type="checkbox" checked={t.done} onChange={() => change((x) => { const y = x.tasks.find((q) => q.id === t.id)!; y.done = !y.done }, t.done ? 'המשימה נפתחה מחדש' : 'המשימה סומנה כבוצעה')} />
                      <span className="box" aria-hidden />
                      <span className="task-t">{t.title}</span>
                    </label>
                    <span className={`pri p-${t.priority} mono`}>{PRI[t.priority]}</span>
                    <span className="mono muted">{t.stageId ? p.stages.find((s) => s.id === t.stageId)?.name : ''}</span>
                    <span className={`mono ${late ? 'bad' : 'muted'}`}>{t.due ? fmtDate(t.due) : ''}{late ? ' · עבר' : ''}</span>
                    {editMode && <button className="linkish bad" onClick={() => change((x) => { x.tasks = x.tasks.filter((q) => q.id !== t.id) }, 'המשימה נמחקה')}>מחיקה</button>}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

// ---------- team and documents ----------

const KIND = { plan: 'תוכנית', permit: 'היתר', contract: 'חוזה', render: 'הדמיה', other: 'אחר' }

function TeamTab({ p, change, editMode, onAddMember, onAddDoc }: { p: Project; change: (fn: (p: Project) => void, msg?: string) => void; editMode: boolean; onAddMember: () => void; onAddDoc: () => void }) {
  return (
    <div className="two">
      <section>
        <h3>צוות ויועצים</h3>
        {p.team.length === 0 ? <Empty title="אין אנשי צוות"><button className="linkish" onClick={onAddMember}>הוספת איש צוות</button></Empty> : (
          <ul className="people">
            {p.team.map((m) => (
              <li key={m.id} className="person">
                <span className="initial" aria-hidden>{m.name.charAt(0)}</span>
                <div><strong>{m.name}</strong><span className="muted">{m.role}</span></div>
                <div className="contact">
                  {m.phone && <a href={`tel:${m.phone}`} dir="ltr" className="mono">{m.phone}</a>}
                  {m.email && <a href={`mailto:${m.email}`} dir="ltr" className="mono">{m.email}</a>}
                </div>
                {editMode && <button className="linkish bad" onClick={() => change((x) => { x.team = x.team.filter((q) => q.id !== m.id) }, 'הוסר מהצוות')}>הסרה</button>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3>מסמכים ותוכניות</h3>
        {p.docs.length === 0 ? <Empty title="אין מסמכים">חוזה שכר הטרחה הוא המסמך הראשון שכדאי להוסיף. <button className="linkish" onClick={onAddDoc}>הוספת מסמך</button></Empty> : (
          <table className="table">
            <thead><tr><th>מסמך</th><th>סוג</th><th>תחום</th><th>גרסה</th><th>תאריך</th><th>מצב</th></tr></thead>
            <tbody>
              {p.docs.map((d) => (
                <tr key={d.id} className={d.current ? '' : 'stale'}>
                  <td>{d.url ? <a href={d.url} target="_blank" rel="noreferrer">{d.name}</a> : d.name}</td>
                  <td>{KIND[d.kind]}</td>
                  <td>{d.discipline}</td>
                  <td className="mono">Rev.{d.rev}</td>
                  <td className="mono">{fmtDate(d.date)}</td>
                  <td>
                    {editMode ? <button className="linkish" onClick={() => change((x) => { const y = x.docs.find((q) => q.id === d.id)!; y.current = !y.current })}>{d.current ? 'בתוקף' : 'לא בתוקף'}</button> : d.current ? 'בתוקף' : 'לא בתוקף'}
                    {editMode && <> · <button className="linkish bad" onClick={() => change((x) => { x.docs = x.docs.filter((q) => q.id !== d.id) }, 'המסמך הוסר')}>מחיקה</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="small muted">הקבלן רואה רק תוכניות והיתרים. גרסה שאינה בתוקף מסומנת אצלו בבירור.</p>
      </section>
    </div>
  )
}

// ---------- log ----------

const LOGK = { stage: 'שלב', approval: 'אישור', invoice: 'דרישה', payment: 'תשלום', note: 'עדכון', portal: 'קישור', edit: 'תיקון' }

function LogTab({ p, change }: { p: Project; change: (fn: (p: Project) => void, msg?: string) => void }) {
  const [text, setText] = useState('')
  const [shared, setShared] = useState(true)
  return (
    <div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; change((x) => { x.log.unshift({ id: uid(), at: new Date().toISOString(), kind: 'note', text: text.trim(), shared }) }, shared ? 'העדכון נשמר ויופיע בקישור הלקוח הבא' : 'ההערה נשמרה'); setText('') }}>
        <label className="eyebrow" htmlFor="log-text">עדכון חדש</label>
        <textarea id="log-text" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="למשל: הוגשה הבקשה לוועדה המקומית" />
        <div className="row">
          <label className="check inline"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /><span className="box" aria-hidden />להציג ללקוח</label>
          <Btn tone="ink" type="submit" disabled={!text.trim()}>שמירה ביומן</Btn>
        </div>
      </form>
      <ol className="log">
        {p.log.map((l) => (
          <li key={l.id} className={`log-${l.kind}`}>
            <span className="mono muted">{fmtDate(l.at.slice(0, 10))}</span>
            <span className="log-k mono">{LOGK[l.kind]}</span>
            <span>{l.text}</span>
            {l.shared && <span className="mono muted">גלוי ללקוח</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}

// ---------- details ----------

function DetailsTab({ p, change }: { p: Project; change: (fn: (p: Project) => void, msg?: string) => void }) {
  const { editMode } = useStore()
  const set = (fn: (x: Project, v: string) => void) => (v: string) => change((x) => fn(x, v))
  return (
    <div>
      {!editMode && <p className="muted">לעריכת הפרטים: כפתור הלוגו, "מצב עריכה".</p>}
      <h3>הפרויקט</h3>
      <div className="grid3">
        <Field label="שם" value={p.name} onSave={set((x, v) => { x.name = v })} />
        <Field label="מספר תיק" value={p.code} dir="ltr" onSave={set((x, v) => { x.code = v })} />
        <Field label="סוג" value={p.type} onSave={set((x, v) => { x.type = v })} />
        <Field label="כתובת" value={p.address} onSave={set((x, v) => { x.address = v })} />
        <Field label="שטח" type="number" value={p.area} suffix='מ"ר' onSave={set((x, v) => { x.area = Number(v) })} />
        <Field label='שכר טרחה לפני מע"מ' type="number" value={p.fee} onSave={set((x, v) => { x.fee = Number(v) })} />
        <Field label="תנאי תשלום (שוטף + ימים)" type="number" value={p.termsDays} onSave={set((x, v) => { x.termsDays = Number(v) })} />
        <Field label="התחלה" type="date" value={p.startDate} onSave={set((x, v) => { x.startDate = v })} />
        <Field label="יעד סיום" type="date" value={p.targetDate} onSave={set((x, v) => { x.targetDate = v })} />
      </div>
      <h3>לקוח וקבלן</h3>
      <div className="grid3">
        <Field label="לקוח" value={p.client.name} onSave={set((x, v) => { x.client.name = v })} />
        <Field label="טלפון לקוח" type="tel" dir="ltr" value={p.client.phone} onSave={set((x, v) => { x.client.phone = v })} />
        <Field label="אימייל לקוח" type="email" dir="ltr" value={p.client.email} onSave={set((x, v) => { x.client.email = v })} />
        <Field label="קבלן ראשי" value={p.contractor.name} onSave={set((x, v) => { x.contractor.name = v })} />
        <Field label="טלפון קבלן" type="tel" dir="ltr" value={p.contractor.phone} onSave={set((x, v) => { x.contractor.phone = v })} />
      </div>
      <h3>פגישה קרובה</h3>
      <div className="grid3">
        <Field label="תאריך" type="date" value={p.nextMeeting?.date} onSave={set((x, v) => { x.nextMeeting = v ? { time: '', place: '', ...x.nextMeeting, date: v } : undefined })} />
        <Field label="שעה" value={p.nextMeeting?.time} dir="ltr" onSave={set((x, v) => { if (x.nextMeeting) x.nextMeeting.time = v })} />
        <Field label="מקום" value={p.nextMeeting?.place} onSave={set((x, v) => { if (x.nextMeeting) x.nextMeeting.place = v })} />
      </div>
      <Field label="הערות פנימיות" multiline value={p.notes} onSave={set((x, v) => { x.notes = v })} />
    </div>
  )
}

function Completeness({ p }: { p: Project }) {
  const c = completeness(p)
  return (
    <div className="card">
      <span className="eyebrow">שלמות נתוני הפרויקט · {Math.round(c.score * 100)}%</span>
      <div className="meter"><motion.span initial={{ width: 0 }} animate={{ width: `${c.score * 100}%` }} transition={{ duration: 0.8 }} /></div>
      <ul className="checks">
        {c.checks.map(([l, v]) => <li key={l} className={v ? 'ok' : 'miss'}><span className="mono">{v ? 'יש' : 'חסר'}</span>{l}</li>)}
      </ul>
      <p className="small muted">ככל שהנתונים שלמים, הסיכונים והתזרים מדויקים יותר.</p>
    </div>
  )
}

function ClaudeSheet({ p, data, onClose, notify }: { p: Project; data: AppData; onClose: () => void; notify: (t: string) => void }) {
  const text = claudePrompt(p, data)
  return (
    <Sheet open title="ניתוח עם Claude" onClose={onClose} wide>
      <p className="muted">שלוש שכבות: הקוד חישב את המספרים והסיכונים. Claude מוסיף פרשנות ונוסחי הודעות. ההחלטה נשארת אצלך. הפרומפט כולל את נתוני הפרויקט בלבד, בלי טלפונים ואימיילים.</p>
      <textarea className="share-text" readOnly rows={14} value={text} aria-label="פרומפט לניתוח" />
      <div className="row">
        <Btn tone="ink" onClick={async () => { if (await copyText(text)) notify('הפרומפט הועתק. מדביקים בשיחה חדשה ב-Claude.') }}>העתקת הפרומפט</Btn>
        <Btn href="https://claude.ai/new">פתיחת Claude</Btn>
      </div>
    </Sheet>
  )
}
