import { useRef, useState } from 'react'
import { useStore } from '../store/store'
import type { AppData } from '../domain/types'
import { isExample, removeExamples, resetExamples } from '../domain/seed'

const d0 = (d: AppData) => (d.projects.some((p) => !p.example) ? 'הפרויקטים לדוגמה הוסרו' : 'המשרד ריק ומוכן לפרויקט הראשון')
import { today } from '../domain/dates'
import { Btn, Field, SectionHead, Sheet, copyText } from '../components/ui'

export default function Settings() {
  const { data, mutate, replace, notify } = useStore()
  const st = data.settings
  const file = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState<'clear' | null>(null)
  const set = (fn: (d: AppData, v: string) => void) => (v: string) => mutate((d) => fn(d, v), 'נשמר')
  const total = st.stageTemplate.reduce((a, s) => a + (Number(s.pct) || 0), 0)

  const exportJson = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = `archi-tact-גיבוי-${today()}.json`
    a.click()
    notify('הגיבוי ירד למכשיר')
  }
  const importJson = async (f: File) => {
    try {
      const d = JSON.parse(await f.text()) as AppData
      if (d.version !== 1 || !Array.isArray(d.projects) || !d.settings) throw new Error('bad')
      replace(d, `הגיבוי נטען: ${d.projects.length} פרויקטים`)
    } catch { notify('הקובץ אינו גיבוי תקין של ARCHI-TACT', 'bad') }
  }

  return (
    <>
      <SectionHead title="הגדרות" lead="פרטי הסטודיו מופיעים בדרישות התשלום ובקישורים ללקוח. השינויים נשמרים ביציאה מכל שדה." />

      <CloudCard />

      <section className="card">
        <h3>הסטודיו</h3>
        <div className="grid3">
          <Field always label="שם הסטודיו" value={st.studioName} onSave={set((d, v) => { d.settings.studioName = v })} />
          <Field always label="שם האדריכל/ית" value={st.architectName} onSave={set((d, v) => { d.settings.architectName = v })} />
          <Field always label="עוסק מורשה / ח״פ" value={st.businessId} dir="ltr" onSave={set((d, v) => { d.settings.businessId = v })} />
          <Field always label="טלפון" type="tel" dir="ltr" value={st.phone} onSave={set((d, v) => { d.settings.phone = v })} />
          <Field always label="אימייל" type="email" dir="ltr" value={st.email} onSave={set((d, v) => { d.settings.email = v })} />
          <Field always label="כתובת" value={st.address} onSave={set((d, v) => { d.settings.address = v })} />
        </div>
      </section>

      <section className="card">
        <h3>כסף</h3>
        <div className="grid3">
          <Field always label='מע"מ (%)' type="number" value={st.vatRate} onSave={set((d, v) => { d.settings.vatRate = Number(v) })} />
          <Field always label="תנאי תשלום ברירת מחדל (שוטף + ימים)" type="number" value={st.defaultTerms} onSave={set((d, v) => { d.settings.defaultTerms = Number(v) })} />
          <Field always label="מספר דרישת התשלום הבאה" type="number" value={st.nextInvoiceNo} onSave={set((d, v) => { d.settings.nextInvoiceNo = Number(v) })} />
        </div>
        <p className="small muted">שיעור המע"מ בישראל הוא 18% מינואר 2025. שינוי כאן מעדכן את כל הסכומים בכל המסכים, כולל דרישות שכבר יצאו.</p>
      </section>

      <section className="card">
        <h3>אוטומציה</h3>
        <label className="check inline"><input type="checkbox" checked={st.autoInvoice} onChange={(e) => mutate((d) => { d.settings.autoInvoice = e.target.checked }, 'נשמר')} /><span className="box" aria-hidden />אישור לקוח מוציא דרישת תשלום מיד</label>
        <label className="check inline"><input type="checkbox" checked={st.autoAdvance} onChange={(e) => mutate((d) => { d.settings.autoAdvance = e.target.checked }, 'נשמר')} /><span className="box" aria-hidden />אישור לקוח פותח את השלב הבא</label>
        <p className="small muted">כשהאוטומציה כבויה, שלב שאושר נשאר במצב "אושר, לא חויב" ומסומן כסיכון עד שמוציאים דרישה.</p>
      </section>

      <section className="card">
        <div className="sh-row"><h3>תבנית השלבים</h3><span className={`mono ${total === 100 ? 'muted' : 'error'}`}>סה"כ {total}%</span></div>
        <p className="small muted">ממנה נבנה כל פרויקט חדש. פרויקטים קיימים לא משתנים. האחוזים הם הנוהג של הסטודיו, לא תעריף רשמי.</p>
        <ol className="tpl-edit">
          {st.stageTemplate.map((s, i) => (
            <li key={i}>
              <span className="mono muted">{String(i + 1).padStart(2, '0')}</span>
              <input aria-label={`שם שלב ${i + 1}`} value={s.name} onChange={(e) => mutate((d) => { d.settings.stageTemplate[i].name = e.target.value })} />
              <input aria-label={`אחוז שלב ${i + 1}`} type="number" className="pct" value={s.pct} onChange={(e) => mutate((d) => { d.settings.stageTemplate[i].pct = Number(e.target.value) })} />
              <input aria-label={`תוצרי שלב ${i + 1}`} value={s.deliverables} onChange={(e) => mutate((d) => { d.settings.stageTemplate[i].deliverables = e.target.value })} />
              <button className="linkish bad" onClick={() => mutate((d) => { d.settings.stageTemplate.splice(i, 1) }, 'השלב הוסר מהתבנית')}>הסרה</button>
            </li>
          ))}
        </ol>
        <Btn onClick={() => mutate((d) => { d.settings.stageTemplate.push({ name: 'שלב חדש', pct: 0, deliverables: '' }) })}>הוספת שלב לתבנית</Btn>
      </section>

      <section className="card">
        <h3>נתונים</h3>
        <p className="small muted">הכול נשמר בדפדפן של המכשיר הזה. כדאי לייצא גיבוי פעם בשבוע, ולפני החלפת מכשיר.</p>
        <div className="row wrap">
          <Btn tone="ink" onClick={exportJson}>ייצוא גיבוי</Btn>
          <Btn onClick={() => file.current?.click()}>טעינת גיבוי</Btn>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = '' }} />
        </div>
      </section>

      <section className="card" id="examples">
        <h3>פרויקטים לדוגמה</h3>
        <p>שלושה פרויקטים להדגמה ולהוראה: שלב שמחכה לאישור הלקוח, גבייה באיחור עם תשלום חלקי, ושלב שאושר ולא חויב. התאריכים נבנים ביחס להיום, ולכן כדאי לאפס אותם לפני כל הדגמה.</p>
        <p className="small muted">האיפוס וההסרה נוגעים רק בפרויקטים לדוגמה. פרויקטים אמיתיים, הגדרות ומספור הדרישות לא משתנים. כרגע במשרד: {data.projects.filter(isExample).length} פרויקטים לדוגמה.</p>
        <div className="row wrap">
          <Btn tone="ink" onClick={() => mutate(resetExamples, 'הפרויקטים לדוגמה אופסו ומוכנים להדגמה')}>{data.projects.some(isExample) ? 'איפוס הפרויקטים לדוגמה' : 'הוספת הפרויקטים לדוגמה'}</Btn>
          {data.projects.some(isExample) && <Btn tone="bad" onClick={() => setConfirm('clear')}>הסרת הפרויקטים לדוגמה</Btn>}
        </div>
      </section>

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title="הסרת הפרויקטים לדוגמה">
        <p>שלושת הפרויקטים לדוגמה יוסרו. פרויקטים אמיתיים, הגדרות ותבנית השלבים נשארים. אפשר להחזיר אותם מכאן בכל רגע.</p>
        <div className="row">
          <Btn tone="bad" onClick={() => {
            mutate((d) => { removeExamples(d); d.demo = false }, d0(data))
            setConfirm(null)
          }}>הסרה</Btn>
          <Btn tone="quiet" onClick={() => setConfirm(null)}>ביטול</Btn>
        </div>
      </Sheet>
    </>
  )
}

const CLOUD_LABEL = { off: 'לא מחובר', syncing: 'מסנכרן', synced: 'מסונכרן', offline: 'בלי חיבור', conflict: 'התנגשות', error: 'שגיאה' }

/** Cloud sync: one office in the cloud, any number of devices, portals that stay current. */
function CloudCard() {
  const { cloud, connect, disconnect, syncNow, resolve, personalLink, notify, data } = useStore()
  const [busy, setBusy] = useState(false)
  const [ask, setAsk] = useState(false)
  const run = async (f: () => Promise<void>) => { setBusy(true); try { await f() } finally { setBusy(false) } }
  const link = personalLink()
  return (
    <section className="card deep" id="cloud">
      <div className="sh-row"><h3>סנכרון בענן</h3><span className={`tag ${cloud.key ? (cloud.status === 'synced' ? 't-paid' : cloud.status === 'conflict' || cloud.status === 'error' ? 'lv-high' : 't-wait') : 't-idle'}`} data-testid="cloud-status"><i />{CLOUD_LABEL[cloud.status]}</span></div>
      {!cloud.key ? (<>
        <p>חיבור לענן שומר את המשרד גם מחוץ למכשיר, מאפשר לעבוד מכמה מכשירים, ונותן ללקוח ולקבלן קישור קבוע שמתעדכן לבד. הלקוח מאשר שלב ישירות בקישור, והאישור נרשם כאן ומוציא דרישת תשלום.</p>
        <p className="small muted">אין הרשמה ואין סיסמה. המשרד מזוהה במפתח פרטי שנשמר במכשיר ובקישור האישי שלך. מי שמחזיק בקישור האישי רואה את כל המשרד, ולכן שומרים אותו כמו סיסמה.{data.demo ? ' הפרויקטים לדוגמה יעלו לענן יחד עם המשרד. אפשר להסיר אותם (למטה) לפני החיבור או אחריו.' : ''}</p>
        <div className="row"><Btn tone="ink" disabled={busy} onClick={() => run(connect)}>חיבור המשרד לענן</Btn></div>
      </>) : (<>
        {cloud.error && <p className={cloud.status === 'conflict' || cloud.status === 'error' ? 'error' : 'muted'} role="status">{cloud.error}</p>}
        {cloud.status === 'conflict' && (
          <div className="row wrap">
            <Btn tone="ink" disabled={busy} onClick={() => run(() => resolve('cloud'))}>לקחת את הגרסה מהענן</Btn>
            <Btn disabled={busy} onClick={() => run(() => resolve('device'))}>לשמור את הגרסה של המכשיר הזה</Btn>
          </div>
        )}
        <dl className="metrics compact">
          <div><dt>סנכרון אחרון</dt><dd>{cloud.at ? cloud.at.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div>
          <div><dt>גרסה</dt><dd>{cloud.version}</dd></div>
          <div><dt>שינויים שממתינים</dt><dd>{cloud.dirty ? 'יש' : 'אין'}</dd></div>
        </dl>
        <label className="eyebrow" htmlFor="personal-link">הקישור האישי שלך</label>
        <input id="personal-link" className="mono share-text" dir="ltr" readOnly value={link || ''} onFocus={(e) => e.target.select()} />
        <p className="small muted">פותחים אותו בטלפון או במחשב אחר, והמכשיר מצטרף לאותו משרד. לא שולחים אותו ללקוחות.</p>
        <div className="row wrap">
          <Btn tone="ink" onClick={async () => { if (link && await copyText(link)) notify('הקישור האישי הועתק') }}>העתקת הקישור האישי</Btn>
          <Btn disabled={busy} onClick={() => run(syncNow)}>סנכרון עכשיו</Btn>
          <Btn tone="quiet" onClick={() => setAsk(true)}>ניתוק המכשיר</Btn>
        </div>
      </>)}
      <Sheet open={ask} onClose={() => setAsk(false)} title="ניתוק המכשיר מהענן">
        <p>המכשיר יפסיק לסנכרן. הנתונים נשארים במכשיר, והמשרד בענן נשאר כמו שהוא. אפשר להתחבר שוב עם הקישור האישי. {cloud.dirty ? 'יש שינויים שעוד לא נשלחו, והם יישארו רק במכשיר.' : ''}</p>
        <div className="row"><Btn tone="bad" onClick={() => { disconnect(); setAsk(false) }}>ניתוק</Btn><Btn tone="quiet" onClick={() => setAsk(false)}>ביטול</Btn></div>
      </Sheet>
    </section>
  )
}
