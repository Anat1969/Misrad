import { useMemo, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AIMenu, { type MenuItem } from './AIMenu'
import { Notices } from './ui'
import { useStore } from '../store/store'

export const CHAT_URL = 'https://claude.ai/code/session_018dHjvGR3krMiMy7ua5cpaB'
export const RESEARCH_URL = (import.meta.env.VITE_RESEARCH_URL as string | undefined) || ''

const NAV = [
  { to: '/', label: 'בית', end: true },
  { to: '/office', label: 'משרד' },
  { to: '/cashflow', label: 'תזרים' },
  { to: '/settings', label: 'הגדרות' },
]

export function Mark({ size = 34 }: { size?: number }) {
  return <img src="/icons/icon.svg" width={size} height={size} alt="" />
}

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden>
      <div className="plane p1" /><div className="plane p2" /><div className="plane p3" />
      <div className="gridlines" />
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { data, savedAt, editMode, setEditMode } = useStore()
  const navigate = useNavigate()
  const status = savedAt ? `נשמר ${savedAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}` : data.demo ? 'נתוני הדגמה' : 'שמור במכשיר'
  const items = useMemo<MenuItem[]>(() => [
    { label: 'מצב עריכה', pressed: editMode, onSelect: () => setEditMode(!editMode) },
    { label: 'פרויקט חדש', onSelect: () => navigate('/new') },
  ], [editMode, setEditMode, navigate])
  return (
    <div className={`shell ${editMode ? 'editing' : ''}`}>
      <Backdrop />
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="ARCHI-TACT משרד, לדף הבית">
            <Mark />
            <span className="brand-name">ARCHI-TACT <span className="mono brand-sub">משרד</span></span>
          </Link>
          <nav className="navlinks" aria-label="ניווט ראשי">
            {NAV.map((n, i) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `navlink ${isActive ? 'on' : ''}`}>
                {({ isActive }) => (<>
                  <span className="arch-num">{String(i + 1).padStart(2, '0')}</span>{n.label}
                  {isActive && <motion.span layoutId="navrule" className="nav-rule" />}
                </>)}
              </NavLink>
            ))}
          </nav>
          <div className="owner"><AIMenu chat={CHAT_URL} research={RESEARCH_URL} items={items} status={status} /></div>
        </div>
        {editMode && <div className="editband" role="status">מצב עריכה פעיל: השדות פתוחים לעריכה, ונשמרים ביציאה מהשדה. מכבים מתוך כפתור הלוגו.</div>}
      </header>
      <main className="page" id="main">{children}</main>
      <footer className="foot">
        <span>ARCHI-TACT משרד: מהשלב, דרך אישור הלקוח, אל התשלום.</span>
        <span className="mono">הנתונים נשמרים במכשיר הזה. גיבוי וייצוא בהגדרות.</span>
      </footer>
      <Notices />
    </div>
  )
}

/** Pages for the client and the contractor: the studio's name, the logo without a menu. */
export function PortalShell({ studio, title, children }: { studio: string; title: string; children: ReactNode }) {
  return (
    <div className="shell portal">
      <Backdrop />
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand"><Mark /><span className="brand-name">{studio} <span className="mono brand-sub">{title}</span></span></span>
          <span className="owner static-logo" aria-label="אד׳ ענת שטיבלמן A&I"><span className="sl-name">אד׳ ענת שטיבלמן</span><span className="sl-mark mono">A&amp;I</span></span>
        </div>
      </header>
      <main className="page narrow" id="main">{children}</main>
      <footer className="foot"><span>מופעל על ידי ARCHI-TACT משרד</span></footer>
      <Notices />
    </div>
  )
}
