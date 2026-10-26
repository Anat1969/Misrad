import { useEffect, useState } from 'react'
import type { AppData, Discipline, DocKind, Owner, PayMethod, Priority, Project, Stage } from '../../domain/types'
import { approvalCode, checkApprovalCode, ils, stageBalance, uid } from '../../domain/logic'
import { clientSnapshot, contractorSnapshot, encode, mailLink, waLink } from '../../domain/share'
import { today } from '../../domain/dates'
import { Btn, Sheet, copyText } from '../../components/ui'
import { useStore } from '../../store/store'

export async function clientUrl(p: Project, d: AppData) {
  const on = today()
  const hash = await encode(clientSnapshot(p, d, (id) => approvalCode(p, p.stages.find((s) => s.id === id)!, on)))
  return `${location.origin}/c#${hash}`
}

export async function contractorUrl(p: Project, d: AppData) {
  return `${location.origin}/k#${await encode(contractorSnapshot(p, d))}`
}

/** Send a portal link: copy, WhatsApp or email, with a ready message. */
export function ShareSheet({ open, onClose, project, who, stage }: { open: boolean; onClose: () => void; project: Project; who: 'client' | 'contractor'; stage?: Stage }) {
  const { data, notify, mutate } = useStore()
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!open) return
    setUrl('')
    ;(who === 'client' ? clientUrl(project, data) : contractorUrl(project, data)).then(setUrl)
  }, [open, who, project, data])
  const name = who === 'client' ? project.client.name : project.contractor.name || 'הקבלן'
  const phone = who === 'client' ? project.client.phone : project.contractor.phone
  const email = who === 'client' ? project.client.email : ''
  const text = who === 'client'
    ? stage
      ? `שלום ${name},\nהסתיים שלב "${stage.name}" בפרויקט ${project.name}.\nבקישור אפשר לראות מה הוגש, ולאשר או להעיר:\n${url}\n\n${data.settings.architectName}`
      : `שלום ${name},\nזה הקישור האישי לפרויקט ${project.name}: שלבים, אישורים ועדכונים.\n${url}\n\n${data.settings.architectName}`
    : `שלום ${name},\nזה הקישור לתיק הקבלן של ${project.name}: משימות, תוכניות בתוקף וביקור האתר הבא.\n${url}\n\n${data.settings.architectName}`
  const sent = (via: string) => mutate((d) => { const p = d.projects.find((x) => x.id === project.id)!; p.log.unshift({ id: uid(), at: new Date().toISOString(), kind: 'portal', text: `נשלח קישור ${who === 'client' ? 'לקוח' : 'קבלן'} ל${name} (${via})` }) })
  return (
    <Sheet open={open} onClose={onClose} title={who === 'client' ? 'קישור אישי ללקוח' : 'קישור לקבלן'}>
      <p className="muted">הקישור מכיל תמונת מצב של היום, לקריאה בלבד. אחרי כל שינוי שולחים קישור חדש. שום מידע לא נשמר בשרת.</p>
      <label className="eyebrow" htmlFor="share-text">ההודעה</label>
      <textarea id="share-text" className="share-text" readOnly rows={7} value={url ? text : 'מכין קישור...'} />
      <div className="row wrap">
        <Btn tone="ink" disabled={!url} onClick={async () => { if (await copyText(text)) { notify('ההודעה והקישור הועתקו'); sent('העתקה') } }}>העתקת ההודעה</Btn>
        <Btn disabled={!url || !phone} href={url && phone ? waLink(phone, text) : undefined} onClick={() => sent('וואטסאפ')}>וואטסאפ</Btn>
        <Btn disabled={!url || !email} href={url && email ? mailLink(email, `${project.name}: ${stage ? `אישור שלב ${stage.name}` : 'קישור לפרויקט'}`, text) : undefined} onClick={() => sent('אימייל')}>אימייל</Btn>
        <Btn tone="quiet" disabled={!url} href={url || undefined}>פתיחת הקישור</Btn>
      </div>
      {!phone && <p className="small muted">חסר מספר טלפון ל{name}. אפשר להשלים בלשונית "פרטים" במצב עריכה.</p>}
    </Sheet>
  )
}

/** The bridge: register the client's approval by code, by hand, or record that it came back with comments. */
export function ApproveSheet({ open, onClose, project, stage, onApprove, onReturn }: {
  open: boolean; onClose: () => void; project: Project; stage: Stage
  onApprove: (by: string, note: string) => void; onReturn: (note: string) => void
}) {
  const [mode, setMode] = useState<'code' | 'manual' | 'return'>('code')
  const [code, setCode] = useState('')
  const [by, setBy] = useState(project.client.name)
  const [how, setHow] = useState('בפגישה')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setCode(''); setErr(''); setNote(''); setBy(project.client.name) } }, [open, project.client.name])
  const submitCode = () => {
    const r = checkApprovalCode(project, code)
    if (!r.ok) return setErr(r.error)
    if (r.stage.id !== stage.id) return setErr(`הקוד שייך לשלב "${r.stage.name}".`)
    onApprove(by || project.client.name, `קוד ${code.trim().toUpperCase()}`)
  }
  return (
    <Sheet open={open} onClose={onClose} title={`אישור הלקוח: ${stage.name}`}>
      <div className="chips" role="tablist">
        {([['code', 'קוד מהפורטל'], ['manual', 'אישור בעל פה או במייל'], ['return', 'הוחזר עם הערות']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={mode === k} className={`chip ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>
      {mode === 'code' && (<>
        <p className="muted">כשהלקוח מאשר בפורטל, הוא שולח קוד אישור. מדביקים אותו כאן. ספרות הביקורת בודקות שהקוד שייך לפרויקט ולשלב הנכונים.</p>
        <div className="field"><label className="eyebrow" htmlFor="ap-code">קוד אישור</label><input id="ap-code" dir="ltr" className="mono" value={code} onChange={(e) => { setCode(e.target.value); setErr('') }} placeholder="A-2026-011-4-20261026-X7QK" /></div>
        <div className="field"><label className="eyebrow" htmlFor="ap-by">שם המאשר</label><input id="ap-by" value={by} onChange={(e) => setBy(e.target.value)} /></div>
        {err && <p className="error" role="alert">{err}</p>}
        <Btn tone="ink" disabled={!code.trim()} onClick={submitCode}>אימות ורישום האישור</Btn>
      </>)}
      {mode === 'manual' && (<>
        <p className="muted">כשהאישור הגיע בפגישה, בטלפון או במייל. כדאי לציין איך, כדי שיהיה תיעוד.</p>
        <div className="field"><label className="eyebrow" htmlFor="ap-by2">שם המאשר</label><input id="ap-by2" value={by} onChange={(e) => setBy(e.target.value)} /></div>
        <div className="field"><label className="eyebrow" htmlFor="ap-how">איך התקבל</label><select id="ap-how" value={how} onChange={(e) => setHow(e.target.value)}>{['בפגישה', 'בטלפון', 'במייל', 'בוואטסאפ', 'בחתימה על תוכנית'].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label className="eyebrow" htmlFor="ap-note">הערה</label><input id="ap-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="לא חובה" /></div>
        <Btn tone="ink" disabled={!by.trim()} onClick={() => onApprove(by, [how, note].filter(Boolean).join(', '))}>רישום האישור</Btn>
      </>)}
      {mode === 'return' && (<>
        <p className="muted">השלב חוזר לעבודה, וההערות נשמרות על השלב ומוצגות ללקוח בקישור הבא.</p>
        <div className="field"><label className="eyebrow" htmlFor="ap-ret">הערות הלקוח</label><textarea id="ap-ret" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <Btn tone="bad" disabled={!note.trim()} onClick={() => onReturn(note)}>החזרה לעבודה</Btn>
      </>)}
    </Sheet>
  )
}

export function PaySheet({ open, onClose, project, stage, vat, onPay }: { open: boolean; onClose: () => void; project: Project; stage: Stage; vat: number; onPay: (p: { date: string; amount: number; method: PayMethod; ref: string }) => void }) {
  const balance = stageBalance(project, stage, vat)
  const [date, setDate] = useState(today())
  const [amount, setAmount] = useState(String(balance))
  const [method, setMethod] = useState<PayMethod>('העברה')
  const [ref, setRef] = useState('')
  useEffect(() => { if (open) { setAmount(String(balance)); setDate(today()); setRef('') } }, [open, balance])
  const n = Number(amount)
  return (
    <Sheet open={open} onClose={onClose} title={`רישום תשלום: ${stage.name}`}>
      <p className="muted">יתרה לתשלום {ils(balance)} כולל מע"מ. תשלום חלקי משאיר את השלב פתוח עד שהיתרה נסגרת.</p>
      <div className="grid2">
        <div className="field"><label className="eyebrow" htmlFor="pay-d">תאריך</label><input id="pay-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label className="eyebrow" htmlFor="pay-a">סכום (₪, כולל מע"מ)</label><input id="pay-a" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="field"><label className="eyebrow" htmlFor="pay-m">אמצעי</label><select id="pay-m" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>{(['העברה', "צ'ק", 'אשראי', 'מזומן', 'אחר'] as PayMethod[]).map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label className="eyebrow" htmlFor="pay-r">אסמכתא</label><input id="pay-r" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="מספר העברה או צ'ק" /></div>
      </div>
      {n > balance && <p className="error">הסכום גבוה מהיתרה ב-{ils(n - balance)}.</p>}
      <Btn tone="ink" disabled={!(n > 0) || !date} onClick={() => onPay({ date, amount: n, method, ref })}>רישום התשלום</Btn>
    </Sheet>
  )
}

export function TaskSheet({ open, onClose, project, onAdd }: { open: boolean; onClose: () => void; project: Project; onAdd: (t: { title: string; due?: string; owner: Owner; priority: Priority; stageId?: string }) => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [owner, setOwner] = useState<Owner>('studio')
  const [priority, setPriority] = useState<Priority>('normal')
  const [stageId, setStageId] = useState('')
  useEffect(() => { if (open) { setTitle(''); setDue('') } }, [open])
  return (
    <Sheet open={open} onClose={onClose} title="משימה חדשה">
      <div className="field"><label className="eyebrow" htmlFor="t-title">משימה</label><input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="grid2">
        <div className="field"><label className="eyebrow" htmlFor="t-due">יעד</label><input id="t-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        <div className="field"><label className="eyebrow" htmlFor="t-owner">אחראי</label><select id="t-owner" value={owner} onChange={(e) => setOwner(e.target.value as Owner)}><option value="studio">הסטודיו</option><option value="contractor">הקבלן</option><option value="client">הלקוח</option></select></div>
        <div className="field"><label className="eyebrow" htmlFor="t-pr">עדיפות</label><select id="t-pr" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}><option value="urgent">דחוף</option><option value="normal">רגיל</option><option value="low">נמוך</option></select></div>
        <div className="field"><label className="eyebrow" htmlFor="t-stage">שלב</label><select id="t-stage" value={stageId} onChange={(e) => setStageId(e.target.value)}><option value="">כללי</option>{project.stages.map((s, i) => <option key={s.id} value={s.id}>{i + 1}. {s.name}</option>)}</select></div>
      </div>
      <p className="small muted">משימה של הקבלן מופיעה בקישור הקבלן הבא.</p>
      <Btn tone="ink" disabled={!title.trim()} onClick={() => onAdd({ title, due: due || undefined, owner, priority, stageId: stageId || undefined })}>הוספה</Btn>
    </Sheet>
  )
}

export function MemberSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (m: { name: string; role: string; phone: string; email: string }) => void }) {
  const [m, setM] = useState({ name: '', role: '', phone: '', email: '' })
  useEffect(() => { if (open) setM({ name: '', role: '', phone: '', email: '' }) }, [open])
  const f = (k: keyof typeof m, label: string, type = 'text', dir?: 'ltr') => (
    <div className="field"><label className="eyebrow" htmlFor={`m-${k}`}>{label}</label><input id={`m-${k}`} type={type} dir={dir} value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} /></div>
  )
  return (
    <Sheet open={open} onClose={onClose} title="איש צוות או יועץ">
      <div className="grid2">{f('name', 'שם')}{f('role', 'תפקיד')}{f('phone', 'טלפון', 'tel', 'ltr')}{f('email', 'אימייל', 'email', 'ltr')}</div>
      <Btn tone="ink" disabled={!m.name.trim()} onClick={() => onAdd(m)}>הוספה</Btn>
    </Sheet>
  )
}

export function DocSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (d: { name: string; kind: DocKind; discipline: Discipline; rev: string; url?: string }) => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<DocKind>('plan')
  const [discipline, setDiscipline] = useState<Discipline>('אדריכלות')
  const [rev, setRev] = useState('1')
  const [url, setUrl] = useState('')
  useEffect(() => { if (open) { setName(''); setRev('1'); setUrl('') } }, [open])
  return (
    <Sheet open={open} onClose={onClose} title="מסמך או תוכנית">
      <div className="field"><label className="eyebrow" htmlFor="d-name">שם</label><input id="d-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid2">
        <div className="field"><label className="eyebrow" htmlFor="d-kind">סוג</label><select id="d-kind" value={kind} onChange={(e) => setKind(e.target.value as DocKind)}><option value="plan">תוכנית</option><option value="permit">היתר</option><option value="contract">חוזה</option><option value="render">הדמיה</option><option value="other">אחר</option></select></div>
        <div className="field"><label className="eyebrow" htmlFor="d-disc">תחום</label><select id="d-disc" value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline)}>{(['אדריכלות', 'קונסטרוקציה', 'חשמל', 'אינסטלציה', 'מיזוג', 'כללי'] as Discipline[]).map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className="field"><label className="eyebrow" htmlFor="d-rev">גרסה</label><input id="d-rev" value={rev} onChange={(e) => setRev(e.target.value)} /></div>
        <div className="field"><label className="eyebrow" htmlFor="d-url">קישור לקובץ</label><input id="d-url" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Drive, Dropbox..." /></div>
      </div>
      <p className="small muted">גרסה חדשה של תוכנית קיימת (אותו שם ותחום) מסמנת את הקודמת כלא בתוקף.</p>
      <Btn tone="ink" disabled={!name.trim()} onClick={() => onAdd({ name, kind, discipline, rev, url: url || undefined })}>הוספה</Btn>
    </Sheet>
  )
}

export function ConfirmSheet({ open, onClose, title, text, action, onConfirm }: { open: boolean; onClose: () => void; title: string; text: string; action: string; onConfirm: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p>{text}</p>
      <div className="row"><Btn tone="bad" onClick={onConfirm}>{action}</Btn><Btn tone="quiet" onClick={onClose}>ביטול</Btn></div>
    </Sheet>
  )
}
