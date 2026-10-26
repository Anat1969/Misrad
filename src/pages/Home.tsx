import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../store/store'
import { officeTotals, risks, reliability, pipeline, ilsShort, approvalCode } from '../domain/logic'
import { clientSnapshot, contractorSnapshot, encode } from '../domain/share'
import { today } from '../domain/dates'
import { BridgeHero, Pipeline } from '../components/viz'
import { Btn, Kpi, Level, SectionHead } from '../components/ui'

const STEPS = [
  { t: 'שכר טרחה לפי שלבים', d: 'כל פרויקט נפתח מתבנית השלבים של הסטודיו. כל שלב מקבל אחוז משכר הטרחה ותוצרים מוגדרים. הסכום של כל שלב מחושב לבד, כולל מע"מ.' },
  { t: 'הגשה ואישור בקישור', d: 'בסיום שלב שולחים ללקוח קישור אישי. הוא רואה מה הוגש, מאשר או מחזיר עם הערות. האישור חוזר לסטודיו עם קוד ביקורת.' },
  { t: 'דרישת תשלום יוצאת לבד', d: 'רישום האישור מוציא דרישת תשלום ממוספרת עם מועד פירעון, ופותח את השלב הבא. בלי לזכור, בלי לבקש.' },
  { t: 'גבייה שנמדדת', d: 'כל תשלום נרשם מול השלב. המערכת מחשבת איחורים, תזרים צפוי, וכמה זמן לוקח ללקוחות לאשר ולשלם.' },
]

export default function Home() {
  const { data } = useStore()
  const reduce = useReducedMotion()
  const t = officeTotals(data)
  const rs = risks(data)
  const rel = reliability(data)
  const [links, setLinks] = useState<{ c: string; k: string } | null>(null)
  const sample = data.projects.find((p) => !p.archived && p.stages.some((s) => s.state === 'submitted')) || data.projects.find((p) => !p.archived)

  useEffect(() => {
    if (!sample) return
    let live = true
    Promise.all([
      encode(clientSnapshot(sample, data, (id) => approvalCode(sample, sample.stages.find((s) => s.id === id)!, today()))),
      encode(contractorSnapshot(sample, data)),
    ]).then(([c, k]) => { if (live) setLinks({ c: `/c#${c}`, k: `/k#${k}` }) })
    return () => { live = false }
  }, [sample, data])

  const rise = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.1 + i * 0.08, duration: 0.6 } })

  return (
    <>
      <section className="hero home-hero">
        <div className="hero-text">
          <motion.span className="eyebrow" {...rise(0)}>ניהול משרד אדריכלות · שלבים, אישורים ותשלומים</motion.span>
          <motion.h1 {...rise(1)}>מהשלב אל התשלום, <span className="inkt">בלי לרדוף</span> אחרי אף אחד.</motion.h1>
          <motion.p className="lead" {...rise(2)}>
            שכר הטרחה של אדריכל נתקע בדרך כלל באותו מקום: בין סיום העבודה לבין אישור הלקוח. הכלי בונה גשר על הפער הזה.
            כל שלב מוגש בקישור, האישור מוציא דרישת תשלום, וכל שקל במשרד נראה במקום אחד.
          </motion.p>
          <motion.div className="hero-cta" {...rise(3)}>
            <Btn tone="ink" size="lg" to="/office">כניסה למשרד</Btn>
            <Btn size="lg" to="/new">פרויקט חדש</Btn>
          </motion.div>
        </div>
        <motion.div className="hero-visual" initial={reduce ? false : { opacity: 0, rotateX: 18 }} animate={{ opacity: 1, rotateX: 0 }} transition={{ duration: 1 }}>
          <BridgeHero />
        </motion.div>
      </section>

      <section className="kpis" aria-label="מצב המשרד עכשיו">
        <Kpi label="שכר טרחה בפרויקטים פעילים" value={t.fee} format={ilsShort} note={`${t.projects} פרויקטים, כולל מע"מ`} />
        <Kpi label="נגבה עד היום" value={t.collected} format={ilsShort} tone="ok" />
        <Kpi label="ממתין לאישור לקוח" value={t.waiting} format={ilsShort} tone="warn" note="כסף שתקוע בגשר" />
        <Kpi label="באיחור תשלום" value={t.overdue} format={ilsShort} tone={t.overdue ? 'bad' : undefined} note={t.overdue ? 'עבר מועד הפירעון' : 'אין איחורים'} />
      </section>

      <section className="section">
        <SectionHead num="01" title="איפה הכסף עומד עכשיו" lead="כל שלב בכל פרויקט פעיל, לפי המצב שלו. העמודה גבוהה ככל שהסכום גדול. לחיצה מובילה למשרד." />
        <div className="card deep"><Pipeline buckets={pipeline(data)} /></div>
      </section>

      <section className="section">
        <SectionHead num="02" title="מה דורש טיפול היום" lead="הקוד עובר על כל הפרויקטים ומסמן רק מה שמשפיע על כסף או על לוח זמנים. לכל סימון יש סיבה.">
          <Btn size="sm" to="/office">לכל הרשימה</Btn>
        </SectionHead>
        {rs.length === 0 ? <p className="muted">אין כרגע דבר דחוף. כל השלבים בזמן וכל הדרישות בתוקף.</p> : (
          <ol className="risk-list">
            {rs.slice(0, 4).map((r, i) => (
              <motion.li key={r.id} {...rise(i)}>
                <Link to={`/project/${r.projectId}${r.stageId ? `?stage=${r.stageId}` : ''}`} className="risk">
                  <Level level={r.level} />
                  <div className="risk-body">
                    <strong>{r.projectName}: {r.title}</strong>
                    <span>{r.why}</span>
                  </div>
                  <span className="risk-act mono">{r.action}</span>
                </Link>
              </motion.li>
            ))}
          </ol>
        )}
      </section>

      <section className="section">
        <SectionHead num="03" title="איך זה עובד" lead="ארבעה צעדים קבועים לכל שלב בכל פרויקט." />
        <ol className="steps">
          {STEPS.map((s, i) => (
            <motion.li key={s.t} className="step" {...rise(i)}>
              <span className="step-n mono">{String(i + 1).padStart(2, '0')}</span>
              <strong>{s.t}</strong>
              <p>{s.d}</p>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="section">
        <SectionHead num="04" title="שלושה מבטים על אותו פרויקט" lead="הסטודיו מנהל. הלקוח והקבלן מקבלים קישור שמראה רק את מה שנוגע להם, בלי הרשמה." />
        <div className="roles">
          <div className="role dark"><span className="eyebrow">הסטודיו</span><strong>תמונה מלאה</strong><p>שלבים, שכר טרחה, דרישות תשלום, תזרים, משימות, צוות ומסמכים. כל עריכה נשמרת מיד.</p><Btn tone="gold" to="/office">למשרד</Btn></div>
          <div className="role"><span className="eyebrow">הלקוח</span><strong>מה הוגש ומה מחכה לו</strong><p>ציר השלבים, התוצרים לאישור, דרישות התשלום והעדכונים. אישור בלחיצה, הערות במשפט.</p>{links && <Btn to={links.c}>הפורטל כפי שהלקוח רואה</Btn>}</div>
          <div className="role"><span className="eyebrow">הקבלן</span><strong>מה לבנות, לפי איזו תוכנית</strong><p>משימות באתר, רק התוכניות בתוקף, ביקור האתר הבא, ודיווח תקלה שמגיע ישר לסטודיו.</p>{links && <Btn to={links.k}>הפורטל כפי שהקבלן רואה</Btn>}</div>
        </div>
      </section>

      <section className="section">
        <SectionHead num="05" title="על מה הכלי נשען, ואיך הוא מודד את עצמו" />
        <div className="trust">
          <div className="card">
            <span className="eyebrow">שיטה</span>
            <ul className="plain">
              <li>חוזה שכר טרחה שמחולק לשלבים, ותשלום שנפתח רק אחרי אישור תוצרי השלב. זו הפרקטיקה המקובלת בחוזי אדריכלים. אחוזי השלבים הם תבנית של הסטודיו, לא תעריף רשמי.</li>
              <li>מע"מ {data.settings.vatRate}% ותנאי תשלום "שוטף + ימים" מוגדרים בהגדרות.</li>
              <li>דרישת התשלום היא חשבון עסקה, לא חשבונית מס. את החשבונית מפיקים בתוכנת הנהלת החשבונות אחרי התשלום.</li>
            </ul>
          </div>
          <div className="card">
            <span className="eyebrow">מדדי אמינות, מהנתונים שלך</span>
            <dl className="metrics">
              <div><dt>שלמות הנתונים</dt><dd>{Math.round(rel.completeness * 100)}%</dd></div>
              <div><dt>שולם עד מועד הפירעון</dt><dd>{rel.onTimeRate === null ? '—' : `${Math.round(rel.onTimeRate * 100)}%`} <small className="mono">n={rel.onTimeN}</small></dd></div>
              <div><dt>ימים מדרישה לתשלום</dt><dd>{rel.collectionDays === null ? '—' : Math.round(rel.collectionDays)} <small className="mono">n={rel.collectionN}</small></dd></div>
              <div><dt>ימים מהגשה לאישור</dt><dd>{rel.approvalDays === null ? '—' : Math.round(rel.approvalDays)} <small className="mono">n={rel.approvalN}</small></dd></div>
            </dl>
            <p className="small muted">התחזית בתזרים משתמשת בזמן האישור הנמדד. ככל שיש יותר מקרים, התחזית מדויקת יותר.</p>
          </div>
          <div className="card">
            <span className="eyebrow">מה הכלי לא עושה</span>
            <ul className="plain">
              <li>לא מפיק חשבונית מס ולא מחובר לבנק.</li>
              <li>אישור בקישור נרשם עם שם ותאריך. הוא תיעוד, לא חתימה משפטית.</li>
              <li>בלי חיבור לענן, הנתונים נשמרים רק במכשיר הזה. עם חיבור, הם נשמרים גם בענן, אבל אין עדיין היסטוריית גרסאות: גיבוי שבועי בהגדרות.</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}
