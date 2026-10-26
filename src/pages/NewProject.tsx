import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store/store'
import type { Project } from '../domain/types'
import { gross, ils, startStage, uid } from '../domain/logic'
import { stagesFromTemplate } from '../domain/seed'
import { addMonths, today } from '../domain/dates'
import { Btn, SectionHead } from '../components/ui'

const TYPES = ['וילה פרטית', 'בית פרטי', 'דירה', 'דירת גג', 'מסחרי, משרדים', 'מבנה ציבור', 'שימור', 'תמ"א 38 / התחדשות', 'אחר']

export default function NewProject() {
  const { data, mutate } = useStore()
  const navigate = useNavigate()
  const st = data.settings
  const year = today().slice(0, 4)
  const nextCode = `${year}-${String(data.projects.filter((p) => p.code.startsWith(year)).length + 1).padStart(3, '0')}`
  const [f, setF] = useState({ name: '', type: TYPES[0], address: '', area: '', client: '', phone: '', email: '', fee: '', terms: String(st.defaultTerms), start: today(), target: addMonths(today(), 18), code: nextCode, begin: true })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })
  const fee = Number(f.fee) || 0
  const area = Number(f.area) || 0
  const total = st.stageTemplate.reduce((a, s) => a + s.pct, 0)
  const missing = [!f.name && 'שם', !f.client && 'לקוח', !(fee > 0) && 'שכר טרחה'].filter(Boolean) as string[]

  const create = () => {
    const id = uid()
    const p: Project = {
      id, code: f.code || nextCode, name: f.name.trim(), type: f.type, address: f.address, area,
      client: { name: f.client.trim(), phone: f.phone, email: f.email }, contractor: { name: '', phone: '' },
      fee, termsDays: Number(f.terms) || st.defaultTerms, startDate: f.start, targetDate: f.target,
      stages: stagesFromTemplate(st.stageTemplate), tasks: [], team: [], docs: [], notes: '', archived: false, createdAt: today(),
      log: [{ id: uid(), at: new Date().toISOString(), kind: 'edit', text: 'הפרויקט נפתח' }],
    }
    if (f.begin && p.stages[0]) startStage(p, p.stages[0])
    mutate((d) => { d.projects.unshift(p) }, 'הפרויקט נפתח. השלב הבא: להוסיף את החוזה ולקבוע יעד לשלב הראשון.')
    navigate(`/project/${id}`)
  }

  const preview = useMemo(() => st.stageTemplate.map((s) => ({ ...s, net: Math.round((fee * s.pct) / 100) })), [st.stageTemplate, fee])

  return (
    <div className="newp">
      <SectionHead title="פרויקט חדש" lead="ממלאים את העיקר. השלבים נבנים מתבנית הסטודיו, וכל שלב מקבל את הסכום שלו לבד. את השאר אפשר להשלים אחר כך." />
      <div className="two wide-first">
        <form className="card" onSubmit={(e) => { e.preventDefault(); if (!missing.length) create() }}>
          <div className="grid2">
            <div className="field"><label className="eyebrow" htmlFor="np-name">שם הפרויקט</label><input id="np-name" required value={f.name} onChange={set('name')} placeholder="למשל: בית משפחת אברהם" /></div>
            <div className="field"><label className="eyebrow" htmlFor="np-code">מספר תיק</label><input id="np-code" dir="ltr" value={f.code} onChange={set('code')} /></div>
            <div className="field"><label className="eyebrow" htmlFor="np-type">סוג</label><select id="np-type" value={f.type} onChange={set('type')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="field"><label className="eyebrow" htmlFor="np-area">שטח (מ"ר)</label><input id="np-area" type="number" min="0" value={f.area} onChange={set('area')} /></div>
          </div>
          <div className="field"><label className="eyebrow" htmlFor="np-addr">כתובת</label><input id="np-addr" value={f.address} onChange={set('address')} /></div>
          <div className="grid3">
            <div className="field"><label className="eyebrow" htmlFor="np-client">לקוח</label><input id="np-client" required value={f.client} onChange={set('client')} /></div>
            <div className="field"><label className="eyebrow" htmlFor="np-phone">טלפון</label><input id="np-phone" type="tel" dir="ltr" value={f.phone} onChange={set('phone')} /></div>
            <div className="field"><label className="eyebrow" htmlFor="np-email">אימייל</label><input id="np-email" type="email" dir="ltr" value={f.email} onChange={set('email')} /></div>
          </div>
          <div className="grid2">
            <div className="field"><label className="eyebrow" htmlFor="np-fee">שכר טרחה לפני מע"מ (₪)</label><input id="np-fee" type="number" min="0" required value={f.fee} onChange={set('fee')} /></div>
            <div className="field"><label className="eyebrow" htmlFor="np-terms">תנאי תשלום: שוטף +</label><input id="np-terms" type="number" min="0" value={f.terms} onChange={set('terms')} /></div>
            <div className="field"><label className="eyebrow" htmlFor="np-start">התחלה</label><input id="np-start" type="date" value={f.start} onChange={set('start')} /></div>
            <div className="field"><label className="eyebrow" htmlFor="np-target">יעד סיום</label><input id="np-target" type="date" value={f.target} onChange={set('target')} /></div>
          </div>
          <label className="check inline"><input type="checkbox" checked={f.begin} onChange={set('begin')} /><span className="box" aria-hidden />להתחיל את השלב הראשון כבר היום</label>
          {missing.length > 0 && <p className="small muted">חסר: {missing.join(', ')}.</p>}
          <div className="row"><Btn tone="ink" size="lg" type="submit" disabled={missing.length > 0}>פתיחת הפרויקט</Btn><Btn tone="quiet" to="/office">ביטול</Btn></div>
        </form>
        <aside className="card deep">
          <span className="eyebrow">כך יתחלק שכר הטרחה · מתבנית הסטודיו</span>
          <ul className="tpl">
            {preview.map((s, i) => (
              <li key={s.name}>
                <span className="mono muted">{String(i + 1).padStart(2, '0')}</span>
                <span>{s.name}</span>
                <span className="tpl-bar"><motion.i animate={{ width: `${s.pct * 3}%` }} /></span>
                <span className="mono">{s.pct}%</span>
                <span>{fee ? ils(gross(s.net, st.vatRate)) : '—'}</span>
              </li>
            ))}
          </ul>
          <p className="small muted">סה"כ {total}%{total !== 100 && ', צריך לתקן בהגדרות'}. סכומים כולל מע"מ {st.vatRate}%.{fee && area ? ` שכר טרחה למ"ר: ${ils(fee / area)}.` : ''} את התבנית משנים בהגדרות, ואת שלבי הפרויקט עצמו במצב עריכה.</p>
        </aside>
      </div>
    </div>
  )
}
