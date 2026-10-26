import { Link, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { ils, stageBalance, stageGross, stageNet, stagePaid } from '../domain/logic'
import { fmtDateLong, fmtDate } from '../domain/dates'
import { mailLink, waLink } from '../domain/share'
import { Btn, Empty, copyText } from '../components/ui'

/** Payment request (חשבון עסקה) for one stage. Printable; not a tax invoice. */
export default function Invoice() {
  const { pid, sid } = useParams()
  const { data, notify } = useStore()
  const p = data.projects.find((x) => x.id === pid)
  const s = p?.stages.find((x) => x.id === sid)
  if (!p || !s || !s.invoiceNo) return <Empty title="דרישת התשלום לא נמצאה">ייתכן שהשלב הוחזר לאחור. <Link to="/cashflow">לכל הדרישות</Link></Empty>
  const st = data.settings
  const net = stageNet(p, s)
  const vatAmt = stageGross(p, s, st.vatRate) - net
  const total = net + vatAmt
  const balance = stageBalance(p, s, st.vatRate)
  const idx = p.stages.indexOf(s) + 1
  const message = `שלום ${p.client.name},\nמצורפת דרישת תשלום ${s.invoiceNo} על שלב "${s.name}" בפרויקט ${p.name}.\nלתשלום: ${ils(balance)} כולל מע"מ, עד ${fmtDate(s.dueAt)}.\nתודה,\n${st.architectName}`
  return (
    <div className="invoice-page">
      <div className="no-print row wrap inv-tools">
        <Btn tone="ink" onClick={() => print()}>הדפסה או שמירה כ-PDF</Btn>
        <Btn href={p.client.phone ? waLink(p.client.phone, message) : undefined} disabled={!p.client.phone}>שליחה בוואטסאפ</Btn>
        <Btn href={p.client.email ? mailLink(p.client.email, `דרישת תשלום ${s.invoiceNo}: ${p.name}`, message) : undefined} disabled={!p.client.email}>שליחה באימייל</Btn>
        <Btn tone="quiet" onClick={async () => { if (await copyText(message)) notify('נוסח ההודעה הועתק') }}>העתקת הנוסח</Btn>
        <Btn tone="quiet" to={`/project/${p.id}?stage=${s.id}`}>חזרה לפרויקט</Btn>
      </div>
      <article className="invoice" aria-label={`דרישת תשלום ${s.invoiceNo}`}>
        <header className="inv-head">
          <div>
            <strong className="inv-studio">{st.studioName}</strong>
            <span>{st.architectName}</span>
            <span>{st.address}</span>
            <span dir="ltr">{st.phone} · {st.email}</span>
            {st.businessId && <span>עוסק / ח"פ {st.businessId}</span>}
          </div>
          <div className="inv-title">
            <span className="eyebrow">דרישת תשלום · חשבון עסקה</span>
            <strong className="mono">{s.invoiceNo}</strong>
            <span>תאריך: {fmtDateLong(s.invoicedAt)}</span>
          </div>
        </header>
        <section className="inv-to">
          <span className="eyebrow">לכבוד</span>
          <strong>{p.client.name}</strong>
          <span>פרויקט: {p.name} ({p.code}), {p.address}</span>
        </section>
        <table className="table inv-table">
          <thead><tr><th>פירוט</th><th>חלק משכר הטרחה</th><th>סכום</th></tr></thead>
          <tbody>
            <tr><td>שלב {idx}: {s.name}{s.deliverables && <><br /><small className="muted">{s.deliverables}</small></>}{s.approvedAt && <><br /><small className="muted">אושר ב-{fmtDate(s.approvedAt)}{s.approvedBy ? ` על ידי ${s.approvedBy}` : ''}</small></>}</td><td>{s.pct}% מתוך {ils(p.fee)}</td><td>{ils(net)}</td></tr>
          </tbody>
          <tfoot>
            <tr><td colSpan={2}>מע"מ {st.vatRate}%</td><td>{ils(vatAmt)}</td></tr>
            <tr className="total"><td colSpan={2}>סה"כ לתשלום</td><td>{ils(total)}</td></tr>
            {stagePaid(s) > 0 && <tr><td colSpan={2}>שולם עד כה</td><td>{ils(stagePaid(s))}</td></tr>}
            {stagePaid(s) > 0 && <tr className="total"><td colSpan={2}>יתרה</td><td>{ils(balance)}</td></tr>}
          </tfoot>
        </table>
        <p className="inv-due">מועד פירעון: <strong>{fmtDateLong(s.dueAt)}</strong> (שוטף + {p.termsDays})</p>
        {s.state === 'paid' && <p className="inv-paid">שולם במלואו. תודה.</p>}
        <p className="inv-legal small">מסמך זה הוא דרישת תשלום ואינו חשבונית מס. חשבונית מס תופק עם קבלת התשלום.</p>
      </article>
    </div>
  )
}
