import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Shell } from './components/Shell'
import Home from './pages/Home'
import Office from './pages/Office'
import { Empty } from './components/ui'

const ProjectPage = lazy(() => import('./pages/project/ProjectPage'))
const Cashflow = lazy(() => import('./pages/Cashflow'))
const Invoice = lazy(() => import('./pages/Invoice'))
const NewProject = lazy(() => import('./pages/NewProject'))
const Settings = lazy(() => import('./pages/Settings'))
const ClientPortal = lazy(() => import('./pages/Portals').then((m) => ({ default: m.ClientPortal })))
const ContractorPortal = lazy(() => import('./pages/Portals').then((m) => ({ default: m.ContractorPortal })))

const TITLES: Record<string, string> = { '/': 'בית', '/office': 'משרד', '/cashflow': 'תזרים', '/settings': 'הגדרות', '/new': 'פרויקט חדש' }

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    scrollTo(0, 0)
    document.title = `${TITLES[pathname] || (pathname.startsWith('/c') ? 'פורטל לקוח' : pathname.startsWith('/k') ? 'תיק קבלן' : 'פרויקט')} · ARCHI-TACT משרד`
  }, [pathname])
  return null
}

const Loading = () => <p className="muted loading">טוען...</p>

export default function App() {
  return (
    <>
      <ScrollTop />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/c" element={<ClientPortal />} />
          <Route path="/c/:token" element={<ClientPortal />} />
          <Route path="/k" element={<ContractorPortal />} />
          <Route path="/k/:token" element={<ContractorPortal />} />
          <Route path="*" element={
            <Shell>
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/office" element={<Office />} />
                  <Route path="/project/:id" element={<ProjectPage />} />
                  <Route path="/cashflow" element={<Cashflow />} />
                  <Route path="/invoice/:pid/:sid" element={<Invoice />} />
                  <Route path="/new" element={<NewProject />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Empty title="הדף לא נמצא">אולי הקישור ישן. אפשר לחזור לדף הבית מהשם למעלה.</Empty>} />
                </Routes>
              </Suspense>
            </Shell>
          } />
        </Routes>
      </Suspense>
    </>
  )
}
