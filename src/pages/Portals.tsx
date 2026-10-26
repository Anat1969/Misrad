import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { decode, mailLink, waLink, type ClientSnapshot, type ContractorSnapshot } from '../domain/share'
import { STATE_META, ils } from '../domain/logic'
import { fmtDate, today } from '../domain/dates'
import { PortalShell } from '../components/Shell'
import { Btn, Empty, copyText } from '../components/ui'
import type { StageState } from '../domain/types'

const CLIENT_LABEL: Record<StageState, [string, string]> = {
  future: ['עתידי', 'idle'], active: ['בעבודה בסטודיו', 'work'], submitted: ['ממתין לאישורכם', 'wait'],
  approved: ['אושר', 'paid'], invoiced: ['אושר', 'paid'], paid: ['אושר', 'paid'],
}
import { useStore } from '../store/store'

function useSnapshot<T>() {
  const { hash } = useLocation()
  const [state, setState] = useState<{ data?: T; error?: boolean }>({})
  useEffect(() => {
    if (!hash || hash.length < 4) { setState({ error: true }); return }
    decode<T>(hash).then((data) => setState({ data })).catch(() => setState({ error: true }))
  }, [hash])
  return state
}

function Broken({ who }: { who: string }) {
  return (
    <PortalShell studio="ARCHI-TACT" title={who}>
      <Empty title="הקישור לא תקין">ייתכן שהוא נקטע בהעתקה. כדאי לבקש מהסטודיו לשלוח אותו שוב, ולפתוח אותו בלחיצה ישירה מההודעה.</Empty>
    </PortalShell>
  )
}

const remember = (key: string, v?: string) => {
  try { if (v === undefined) return localStorage.getItem(key); localStorage.setItem(key, v) } catch { /* private mode */ }
  return null
}

// ---------- client ----------

export function ClientPortal() {
  const { data: snap, error } = useSnapshot<ClientSnapshot>()
  const reduce = useReducedMotion()
  if (error) return <Broken who="פורטל לקוח" />
  if (!snap) return <PortalShell studio="ARCHI-TACT" title="פורטל לקוח"><p className="muted">טוען את הפרויקט...</p></PortalShell>
  const doneIdx = snap.stages.filter((s) => ['approved', 'invoiced', 'paid'].includes(s.state)).length
  const cur = snap.stages.findIndex((s) => s.state === 'submitted' || s.state === 'active')
  const pending = snap.stages.filter((s) => s.state === 'submitted')
  const open = snap.bills.filter((b) => !b.paid)
  return (
    <PortalShell studio={snap.studio.name} title="פורטל לקוח">
      <section className="portal-hello">
        <span className="eyebrow">{snap.project.code} · מעודכן ל-{fmtDate(snap.at)}</span>
        <h1 className="ptitle">שלום {snap.project.client}</h1>
        <p className="lead">זה הדף של {snap.project.name}, {snap.project.address}. כאן רואים איפה הפרויקט עומד, מה מחכה לאישור שלכם, ומה לתשלום.</p>
      </section>

      <section className="card deep">
        <div className="sh-row"><span className="eyebrow">שלב {cur >= 0 ? cur + 1 : snap.stages.length} מתוך {snap.stages.length}</span><span className="mono muted">{doneIdx} שלבים אושרו</span></div>
        <ol className="crail">
          {snap.stages.map((s, i) => (
            <motion.li key={s.id} className={`s-${STATE_META[s.state].tone} ${i === cur ? 'cur' : ''}`} style={{ flex: `${Math.max(s.pct, 1)} 1 0` }}
              initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <span className="crail-bar" />
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              <span className="crail-name">{s.name}</span>
            </motion.li>
          ))}
        </ol>
      </section>

      {pending.length > 0 && (
        <section className="section">
          <h2>מחכה לאישור שלכם</h2>
          {pending.map((s) => <ApproveBox key={s.id} snap={snap} stageId={s.id} />)}
        </section>
      )}

      {snap.stages.filter((s) => s.state === 'active' && s.returnedNote).map((s) => (
        <p key={s.id} className="returned"><span className="eyebrow">ההערות שלכם על "{s.name}" בטיפול</span>{s.returnedNote}</p>
      ))}

      <section className="section">
        <h2>השלבים</h2>
        <ol className="client-stages">
          {snap.stages.map((s, i) => (
            <li key={s.id} className={`s-${STATE_META[s.state].tone}`}>
              <span className="mono muted">{String(i + 1).padStart(2, '0')}</span>
              <div><strong>{s.name}</strong>{s.deliverables && <span className="muted">{s.deliverables}</span>}</div>
              <span className="mono muted">{s.targetDate && s.state !== 'paid' ? `יעד ${fmtDate(s.targetDate)}` : ''}</span>
              <span className={`tag sm t-${CLIENT_LABEL[s.state][1]}`}><i />{CLIENT_LABEL[s.state][0]}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="section">
        <h2>תשלומים</h2>
        {snap.bills.length === 0 ? <p className="muted">עדיין לא יצאו דרישות תשלום.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>דרישה</th><th>שלב</th><th>סכום</th><th>לפירעון עד</th><th>מצב</th></tr></thead>
              <tbody>{snap.bills.map((b) => (
                <tr key={b.no} className={!b.paid && b.dueAt < today() ? 'late' : ''}>
                  <td className="mono">{b.no}</td><td>{b.stage}</td><td>{ils(b.gross)}</td><td className="mono">{fmtDate(b.dueAt)}</td>
                  <td>{b.paid ? 'שולם' : b.balance < b.gross ? `יתרה ${ils(b.balance)}` : 'פתוח'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {open.length > 0 && <p className="small muted">סה"כ פתוח: {ils(open.reduce((a, b) => a + b.balance, 0))} כולל מע"מ.</p>}
      </section>

      {snap.meeting && (
        <section className="card"><span className="eyebrow">פגישה קרובה</span><strong>{fmtDate(snap.meeting.date)} · {snap.meeting.time}</strong><span className="muted">{snap.meeting.place}</span></section>
      )}

      <section className="section">
        <h2>עדכונים מהסטודיו</h2>
        <ol className="feed">{snap.updates.map((u, i) => <li key={i}><span className="mono muted">{fmtDate(u.at)}</span><span>{u.text}</span></li>)}</ol>
      </section>

      <section className="card contact-card">
        <span className="eyebrow">שאלות</span>
        <strong>{snap.studio.architect}</strong>
        <div className="row wrap">
          {snap.studio.phone && <Btn href={`tel:${snap.studio.phone}`}>{snap.studio.phone}</Btn>}
          {snap.studio.phone && <Btn href={waLink(snap.studio.phone, `שלום, לגבי ${snap.project.name}: `)}>וואטסאפ</Btn>}
          {snap.studio.email && <Btn href={`mailto:${snap.studio.email}`}>אימייל</Btn>}
        </div>
      </section>
    </PortalShell>
  )
}

function ApproveBox({ snap, stageId }: { snap: ClientSnapshot; stageId: string }) {
  const s = snap.stages.find((x) => x.id === stageId)!
  const key = `msr_sent_${snap.project.id}_${stageId}`
  const { notify } = useStore()
  const [mode, setMode] = useState<'idle' | 'approve' | 'comment'>(() => (remember(key) ? 'approve' : 'idle'))
  const [name, setName] = useState(snap.project.client)
  const [note, setNote] = useState('')
  const code = snap.codes[stageId]
  const approveMsg = `אני מאשר/ת את שלב "${s.name}" בפרויקט ${snap.project.name}.\nשם: ${name}\nקוד אישור: ${code}`
  const commentMsg = `יש לי הערות על שלב "${s.name}" בפרויקט ${snap.project.name}:\n${note}\n\n${name}`
  const send = (msg: string, subject: string) => (
    <div className="row wrap">
      {snap.studio.phone && <Btn tone="ink" href={waLink(snap.studio.phone, msg)} onClick={() => remember(key, '1')}>שליחה בוואטסאפ</Btn>}
      {snap.studio.email && <Btn href={mailLink(snap.studio.email, subject, msg)} onClick={() => remember(key, '1')}>שליחה באימייל</Btn>}
      <Btn tone="quiet" onClick={async () => { if (await copyText(msg)) { remember(key, '1'); notify('הנוסח הועתק') } }}>העתקה</Btn>
    </div>
  )
  return (
    <article className="approve-box">
      <div className="sh-row"><strong>{s.name}</strong><span className="mono muted">הוגש {fmtDate(s.submittedAt)}</span></div>
      {s.deliverables && <p><span className="eyebrow">מה הוגש</span>{s.deliverables}</p>}
      {mode === 'idle' && (
        <div className="row wrap">
          <Btn tone="ink" onClick={() => setMode('approve')}>מאשר/ת את השלב</Btn>
          <Btn onClick={() => setMode('comment')}>יש לי הערות</Btn>
        </div>
      )}
      {mode === 'approve' && (
        <div className="approve-step">
          <div className="field"><label className="eyebrow" htmlFor={`n-${stageId}`}>שם המאשר/ת</label><input id={`n-${stageId}`} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <p className="code-line"><span className="eyebrow">קוד האישור שלכם</span><code dir="ltr" data-testid="approval-code">{code}</code></p>
          <p className="small muted">שולחים את ההודעה לסטודיו. הקוד מוודא שהאישור נרשם לשלב הנכון. רק אחרי שהסטודיו רושם אותו תצא דרישת התשלום על השלב.</p>
          {send(approveMsg, `אישור שלב: ${s.name}`)}
          <button className="linkish" onClick={() => setMode('idle')}>חזרה</button>
        </div>
      )}
      {mode === 'comment' && (
        <div className="approve-step">
          <div className="field"><label className="eyebrow" htmlFor={`c-${stageId}`}>ההערות</label><textarea id={`c-${stageId}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          {note.trim() ? send(commentMsg, `הערות על שלב: ${s.name}`) : <p className="small muted">כותבים את ההערות, ואז בוחרים איך לשלוח.</p>}
          <button className="linkish" onClick={() => setMode('idle')}>חזרה</button>
        </div>
      )}
    </article>
  )
}

// ---------- contractor ----------

const PRI = { urgent: 'דחוף', normal: 'רגיל', low: 'נמוך' }

export function ContractorPortal() {
  const { data: snap, error } = useSnapshot<ContractorSnapshot>()
  const [report, setReport] = useState('')
  const [showDone, setShowDone] = useState(false)
  if (error) return <Broken who="תיק קבלן" />
  if (!snap) return <PortalShell studio="ARCHI-TACT" title="תיק קבלן"><p className="muted">טוען...</p></PortalShell>
  const on = today()
  const open = snap.tasks.filter((t) => !t.done).sort((a, b) => (a.priority === 'urgent' ? -1 : 0) - (b.priority === 'urgent' ? -1 : 0) || (a.due || '9').localeCompare(b.due || '9'))
  const done = snap.tasks.filter((t) => t.done)
  const msg = `דיווח מהאתר, ${snap.project.name} (${snap.project.address}):\n${report}\n\n${snap.project.contractor}`
  return (
    <PortalShell studio={snap.studio.name} title="תיק קבלן">
      <section className="portal-hello">
        <span className="eyebrow">{snap.project.code} · מעודכן ל-{fmtDate(snap.at)}</span>
        <h1 className="ptitle">{snap.project.name}</h1>
        <p className="lead">{snap.project.contractor ? `שלום ${snap.project.contractor}. ` : ''}{snap.project.address}</p>
      </section>
      <section className="kpis">
        <div className="kpi"><span className="eyebrow">שלב נוכחי</span><strong className="kpi-v">{snap.project.stageIndex}/{snap.project.stageCount}</strong><span className="kpi-note">{snap.project.stage}</span></div>
        <div className="kpi"><span className="eyebrow">משימות פתוחות</span><strong className="kpi-v">{open.length}</strong></div>
        <div className="kpi"><span className="eyebrow">ביקור הבא</span><strong className="kpi-v sm">{snap.meeting ? fmtDate(snap.meeting.date) : '—'}</strong><span className="kpi-note">{snap.meeting?.time}</span></div>
      </section>

      <section className="section">
        <h2>משימות</h2>
        {open.length === 0 ? <p className="muted">אין משימות פתוחות.</p> : (
          <ul className="tasks">
            {open.map((t) => (
              <li key={t.id} className={`task ${t.due && t.due < on ? 'late' : ''}`}>
                <span className="task-t">{t.title}</span>
                <span className={`pri p-${t.priority} mono`}>{PRI[t.priority]}</span>
                <span className={`mono ${t.due && t.due < on ? 'bad' : 'muted'}`}>{t.due ? fmtDate(t.due) : ''}</span>
              </li>
            ))}
          </ul>
        )}
        {done.length > 0 && <button className="linkish" onClick={() => setShowDone(!showDone)}>{showDone ? 'הסתרת משימות שבוצעו' : `משימות שבוצעו (${done.length})`}</button>}
        {showDone && <ul className="tasks">{done.map((t) => <li key={t.id} className="task done"><span className="task-t">{t.title}</span></li>)}</ul>}
      </section>

      <section className="section">
        <h2>תוכניות</h2>
        <p className="muted">עובדים רק לפי תוכנית בתוקף. גרסה ישנה מסומנת.</p>
        <ul className="drawings">
          {snap.docs.map((d, i) => (
            <li key={i} className={d.current ? '' : 'stale'}>
              <strong>{d.url ? <a href={d.url} target="_blank" rel="noreferrer">{d.name}</a> : d.name}</strong>
              <span className="muted">{d.discipline}</span>
              <span className="mono">Rev.{d.rev} · {fmtDate(d.date)}</span>
              <span className={`tag ${d.current ? 't-paid' : 'lv-high'} sm`}><i />{d.current ? 'בתוקף' : 'לא בתוקף'}</span>
            </li>
          ))}
        </ul>
      </section>

      {snap.meeting && (
        <section className="card">
          <span className="eyebrow">ביקור באתר</span>
          <strong>{fmtDate(snap.meeting.date)} · {snap.meeting.time} · {snap.meeting.place}</strong>
          {snap.studio.phone && <Btn href={waLink(snap.studio.phone, `מאשר הגעה לביקור ב-${fmtDate(snap.meeting.date)} ${snap.meeting.time}, ${snap.project.name}.`)}>אישור הגעה</Btn>}
        </section>
      )}

      <section className="section card">
        <h2>דיווח תקלה או בקשת שינוי</h2>
        <textarea rows={3} value={report} onChange={(e) => setReport(e.target.value)} placeholder="מה קרה, איפה, ומה צריך מהאדריכל" aria-label="תיאור הדיווח" />
        <div className="row wrap">
          <Btn tone="ink" disabled={!report.trim() || !snap.studio.phone} href={report.trim() && snap.studio.phone ? waLink(snap.studio.phone, msg) : undefined}>שליחה בוואטסאפ</Btn>
          <Btn disabled={!report.trim() || !snap.studio.email} href={report.trim() && snap.studio.email ? mailLink(snap.studio.email, `דיווח מהאתר: ${snap.project.name}`, msg) : undefined}>שליחה באימייל</Btn>
        </div>
        <p className="small muted">מומלץ לצרף תמונה בהודעה עצמה.</p>
      </section>
    </PortalShell>
  )
}
