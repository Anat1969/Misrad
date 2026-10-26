import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/store'
import { aging, cashflow, daysOverdue, ils, ilsShort, isOverdue, reliability, stageBalance, stageGross, stagePaid } from '../domain/logic'
import { fmtDate, today } from '../domain/dates'
import { AgingBars, CashChart } from '../components/viz'
import { Btn, Empty, Kpi, SectionHead, Tag } from '../components/ui'

const VIEWS = [{ id: 'open', label: 'פתוחות' }, { id: 'late', label: 'באיחור' }, { id: 'paid', label: 'שולמו' }, { id: 'all', label: 'הכול' }] as const

export default function Cashflow() {
  const { data } = useStore()
  const [view, setView] = useState<(typeof VIEWS)[number]['id']>('open')
  const vat = data.settings.vatRate
  const on = today()
  const months = cashflow(data)
  const rel = reliability(data)
  const next90 = months.filter((m) => !m.past).slice(0, 3)
  const bills = data.projects.flatMap((p) => p.stages.filter((s) => s.invoiceNo).map((s) => ({ p, s })))
    .filter(({ s }) => view === 'all' || (view === 'open' && s.state === 'invoiced') || (view === 'late' && isOverdue(s, on)) || (view === 'paid' && s.state === 'paid'))
    .sort((a, b) => (b.s.invoiceNo || 0) - (a.s.invoiceNo || 0))
  const exportCsv = () => {
    const rows = [['מספר', 'פרויקט', 'לקוח', 'שלב', 'תאריך', 'פירעון', 'סכום כולל מע"מ', 'שולם', 'יתרה', 'מצב']]
    for (const { p, s } of data.projects.flatMap((p) => p.stages.filter((s) => s.invoiceNo).map((s) => ({ p, s }))))
      rows.push([String(s.invoiceNo), p.name, p.client.name, s.name, s.invoicedAt || '', s.dueAt || '', String(stageGross(p, s, vat)), String(stagePaid(s)), String(stageBalance(p, s, vat)), s.state === 'paid' ? 'שולם' : isOverdue(s, on) ? 'באיחור' : 'פתוח'])
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${c.replaceAll('"', '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `דרישות-תשלום-${on}.csv`
    a.click()
  }
  return (
    <>
      <SectionHead title="תזרים" lead="מה נכנס, מה צפוי להיכנס, ומה מתעכב. הכול נגזר מהשלבים, מהאישורים ומהתשלומים שנרשמו.">
        <Btn onClick={exportCsv}>ייצוא לאקסל</Btn>
      </SectionHead>

      <section className="kpis">
        <Kpi label="צפוי ב-90 הימים הקרובים" value={next90.reduce((a, m) => a + m.due + m.forecast, 0)} format={ilsShort} note="דרישות + תחזית" />
        <Kpi label="מתוכם דרישות שכבר יצאו" value={next90.reduce((a, m) => a + m.due, 0)} format={ilsShort} tone="ok" />
        <Kpi label="נגבה בחצי השנה האחרונה" value={months.filter((m) => m.past).reduce((a, m) => a + m.collected, 0) + (months.find((m) => !m.past)?.collected || 0)} format={ilsShort} />
        <Kpi label="ימים מדרישה לתשלום" value={rel.collectionDays ?? 0} note={`ממוצע, n=${rel.collectionN}`} />
      </section>

      <div className="card deep"><CashChart months={months} /></div>
      <p className="small muted">איך מחושבת התחזית: שלב שאושר ולא חויב נכנס לפי היום + תנאי התשלום. שלב שממתין לאישור נכנס לפי זמן האישור הנמדד ({Math.round(rel.approvalDays ?? 10)} ימים, n={rel.approvalN}) + תנאי התשלום. שלב בעבודה נכנס לפי היעד שלו. שלב בלי יעד נספר מהיום, ולכן התחזית שלו אופטימית.</p>

      <div className="two section">
        <section>
          <h3>גיול חובות</h3>
          <AgingBars buckets={aging(data)} />
        </section>
        <section>
          <h3>אמינות התחזית</h3>
          <dl className="metrics">
            <div><dt>שולם עד מועד הפירעון</dt><dd>{rel.onTimeRate === null ? '—' : `${Math.round(rel.onTimeRate * 100)}%`} <small className="mono">n={rel.onTimeN}</small></dd></div>
            <div><dt>ימים מהגשה לאישור</dt><dd>{rel.approvalDays === null ? '—' : Math.round(rel.approvalDays)} <small className="mono">n={rel.approvalN}</small></dd></div>
            <div><dt>שלמות הנתונים</dt><dd>{Math.round(rel.completeness * 100)}%</dd></div>
          </dl>
          <p className="small muted">מתחת ל-10 מקרים, המדדים הם כיוון בלבד.</p>
        </section>
      </div>

      <section className="section">
        <div className="sh-row"><h3>דרישות תשלום</h3>
          <div className="chips">{VIEWS.map((v) => <button key={v.id} className={`chip ${view === v.id ? 'on' : ''}`} aria-pressed={view === v.id} onClick={() => setView(v.id)}>{v.label}</button>)}</div>
        </div>
        {bills.length === 0 ? <Empty title="אין דרישות בתצוגה הזו" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>מספר</th><th>פרויקט</th><th>שלב</th><th>תאריך</th><th>פירעון</th><th>סכום</th><th>יתרה</th><th>מצב</th></tr></thead>
              <tbody>
                {bills.map(({ p, s }) => (
                  <tr key={s.id} className={isOverdue(s, on) ? 'late' : ''}>
                    <td className="mono"><Link to={`/invoice/${p.id}/${s.id}`}>{s.invoiceNo}</Link></td>
                    <td><Link to={`/project/${p.id}?stage=${s.id}`}>{p.name}</Link></td>
                    <td>{s.name}</td>
                    <td className="mono">{fmtDate(s.invoicedAt)}</td>
                    <td className="mono">{fmtDate(s.dueAt)}</td>
                    <td>{ils(stageGross(p, s, vat))}</td>
                    <td>{ils(stageBalance(p, s, vat))}</td>
                    <td>{isOverdue(s, on) ? <span className="tag lv-high"><i />באיחור {daysOverdue(s, on)} ימים</span> : <Tag state={s.state} small />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
