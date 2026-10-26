import { useRef, useState } from 'react'
import { useStore } from '../store/store'
import type { AppData } from '../domain/types'
import { seed } from '../domain/seed'
import { today } from '../domain/dates'
import { Btn, Field, SectionHead, Sheet } from '../components/ui'

export default function Settings() {
  const { data, mutate, replace, notify } = useStore()
  const st = data.settings
  const file = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState<'clear' | 'demo' | null>(null)
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
          {data.demo && <Btn tone="bad" onClick={() => setConfirm('clear')}>התחלה נקייה, בלי נתוני הדגמה</Btn>}
          <Btn tone="quiet" onClick={() => setConfirm('demo')}>טעינת נתוני ההדגמה מחדש</Btn>
        </div>
      </section>

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'clear' ? 'התחלה נקייה' : 'נתוני הדגמה'}>
        <p>{confirm === 'clear' ? 'כל פרויקטי ההדגמה יימחקו. ההגדרות ותבנית השלבים נשארות.' : 'כל הנתונים הנוכחיים יוחלפו בנתוני ההדגמה. כדאי לייצא גיבוי קודם.'}</p>
        <div className="row">
          <Btn tone="bad" onClick={() => {
            if (confirm === 'clear') mutate((d) => { d.projects = []; d.demo = false }, 'המשרד ריק ומוכן לפרויקט הראשון')
            else replace(seed(), 'נתוני ההדגמה נטענו')
            setConfirm(null)
          }}>אישור</Btn>
          <Btn tone="quiet" onClick={() => setConfirm(null)}>ביטול</Btn>
        </div>
      </Sheet>
    </>
  )
}
