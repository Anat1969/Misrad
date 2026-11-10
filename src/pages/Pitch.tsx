import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CONTACT, LIMITS, OUTCOMES, PAINS, PILOT, PITCH, STEPS } from '../content/pitch'
import { examples } from '../domain/seed'
import { useStore } from '../store/store'
import { Btn, copyText } from '../components/ui'

/** The sales page: one story, ready to send as a link or to print as a PDF. */
export default function Pitch() {
  const { notify, data } = useStore()
  const cases = useMemo(() => examples(data.settings.vatRate).map((p) => ({ code: p.code, name: p.name.replace(/^פרויקט לדוגמה .: /, ''), ...p.example! })), [data.settings.vatRate])
  return (
    <div className="pitch-page">
      <div className="no-print row wrap inv-tools">
        <Btn tone="ink" onClick={() => print()}>הדפסה או שמירה כ-PDF</Btn>
        <Btn onClick={async () => { if (await copyText(location.href)) notify('הקישור לדף המכירה הועתק') }}>העתקת הקישור</Btn>
        <Btn tone="quiet" to="/">לדף הפתיחה עם הסרט</Btn>
      </div>
      <article className="pitch">
        <header className="pitch-head">
          <div className="pitch-brand"><img src="/icons/icon.svg" width="56" height="56" alt="" /><div><strong>ARCHI-TACT <span className="mono">משרד</span></strong><span className="muted">ניהול משרד אדריכלות: שלבים, אישורים, תשלומים</span></div></div>
          <h1>{PITCH.headline}</h1>
          <p className="lead">{PITCH.lead}</p>
        </header>

        <section className="pitch-film">
          <Link to="/" className="pitch-poster"><img src="/media/poster.jpg" alt="פריים מסרט הפתיחה" /><span>סרט של 30 שניות בדף הפתיחה</span></Link>
          <p className="vision">{PITCH.vision}</p>
        </section>

        <section>
          <h2>איפה שכר הטרחה נתקע</h2>
          <ol className="pains">{PAINS.map((x, i) => <li key={x.t} className="pain"><span className="mono">{String(i + 1).padStart(2, '0')}</span><strong>{x.t}</strong><p>{x.d}</p></li>)}</ol>
        </section>

        <section>
          <h2>איך זה עובד</h2>
          <ol className="steps">{STEPS.map((s, i) => <li key={s.t} className="step"><span className="step-n mono">{String(i + 1).padStart(2, '0')}</span><strong>{s.t}</strong><p>{s.d}</p></li>)}</ol>
        </section>

        <section className="pitch-break">
          <h2>שלושה מקרים מכל משרד</h2>
          <p className="muted">שלושה פרויקטים לדוגמה שמחכים באפליקציה, כל אחד עם הצעדים להדגמה.</p>
          <ol className="examples">
            {cases.map((c) => (
              <li key={c.code} className="example-card"><span className="mono muted">{c.code} · {c.name}</span><strong>{c.theme}</strong><p>{c.story}</p></li>
            ))}
          </ol>
        </section>

        <section>
          <h2>מה משרד מרוויח</h2>
          <div className="outcomes">{OUTCOMES.map((x) => <div key={x.t} className="outcome"><strong>{x.t}</strong><p>{x.d}</p></div>)}</div>
        </section>

        <section className="pilot">
          <div>
            <span className="eyebrow">{PILOT.cta}</span>
            <h2>{PILOT.title}</h2>
            <ol className="plain">{PILOT.points.map((x) => <li key={x}>{x}</li>)}</ol>
          </div>
          <div className="pilot-cta">
            <strong>אד׳ ענת שטיבלמן · A&amp;I</strong>
            {CONTACT.whatsapp && <span dir="ltr">wa.me/{CONTACT.whatsapp}</span>}
            {CONTACT.email && <span dir="ltr">{CONTACT.email}</span>}
            <span dir="ltr" className="mono">archi-tact-misrad.vercel.app</span>
          </div>
        </section>

        <footer className="pitch-foot small muted">
          <span>בכנות: </span>{LIMITS.join(' ')}
        </footer>
      </article>
    </div>
  )
}
