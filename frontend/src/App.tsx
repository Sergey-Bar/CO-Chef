import { lazy, Suspense, useState, useEffect } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Loading } from './components/ui'
import { Icon, type IconName } from './components/Icon'
import { loadSettings } from './lib/theme'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const WorkDashboard = lazy(() => import('./pages/WorkDashboard'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const ClientsPage = lazy(() => import('./pages/ClientsPage'))
const TeamPage = lazy(() => import('./pages/TeamPage'))
const FinanceDashboard = lazy(() => import('./pages/FinanceDashboard'))
const EventWizard = lazy(() => import('./pages/EventWizard'))
const EventDetail = lazy(() => import('./pages/EventDetail'))
const RecipeLibrary = lazy(() => import('./pages/RecipeLibrary'))
const MenuStudio = lazy(() => import('./pages/MenuStudio'))
const IngredientLibrary = lazy(() => import('./pages/IngredientLibrary'))
const PantryPage = lazy(() => import('./pages/PantryPage'))
const ImportPage = lazy(() => import('./pages/ImportPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AgentsPage = lazy(() => import('./pages/AgentsPage'))

const nav: { to: string; label: string; icon: IconName; group: string; end?: boolean }[] = [
  { to: '/', label: 'האזור האישי', icon: 'home', group: 'העסק שלי', end: true },
  { to: '/work', label: 'אירועים ועבודה', icon: 'calendar', group: 'העסק שלי' },
  { to: '/calendar', label: 'יומן', icon: 'chart', group: 'העסק שלי' },
  { to: '/clients', label: 'לקוחות', icon: 'people', group: 'העסק שלי' },
  { to: '/team', label: 'צוות', icon: 'people', group: 'העסק שלי' },
  { to: '/finance', label: 'רווחיות ותשלומים', icon: 'chart', group: 'העסק שלי' },
  { to: '/recipes', label: 'מתכונים', icon: 'book', group: 'המטבח שלי' },
  { to: '/menu-studio', label: 'בניית תפריט', icon: 'plus', group: 'המטבח שלי' },
  { to: '/ingredients', label: 'מצרכים', icon: 'leaf', group: 'המטבח שלי' },
  { to: '/pantry', label: 'מלאי', icon: 'box', group: 'המטבח שלי' },
  { to: '/import', label: 'ייבוא חכם', icon: 'upload', group: 'המטבח שלי' },
  { to: '/agents', label: 'סוכנים', icon: 'bot', group: 'אישי' },
  { to: '/settings', label: 'הגדרות', icon: 'settings', group: 'אישי' },
]

export default function App() {
  const location = useLocation()
  const personal = loadSettings()
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', close)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', close); document.body.style.overflow = previous }
  }, [menuOpen])
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])
  const current = nav.find(n => n.to === location.pathname)
  const pageLabel = current?.label ?? (location.pathname === '/events/new' ? 'אירוע חדש' : 'תכנון אירוע')
  const sections: { label: string; to: string; icon: IconName; paths: string[] }[] = [
    { label: 'היום שלי', to: '/', icon: 'home', paths: ['/'] },
    { label: 'האירועים שלי', to: '/work', icon: 'calendar', paths: ['/work', '/calendar'] },
    { label: 'המטבח שלי', to: '/recipes', icon: 'book', paths: ['/recipes', '/menu-studio', '/ingredients', '/pantry', '/import'] },
    { label: 'העסק שלי', to: '/finance', icon: 'chart', paths: ['/finance', '/clients', '/team'] },
    { label: 'העוזר שלי', to: '/agents', icon: 'bot', paths: ['/agents'] },
  ]
  const section = sections.find(s => s.paths.includes(location.pathname) || (s.to === '/work' && location.pathname.startsWith('/events/')))
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">דלגו לתוכן</a>
      {menuOpen && <button className="sidebar-scrim" aria-label="סגירת תפריט" onClick={() => setMenuOpen(false)} />}
      <aside id="app-navigation" className={`app-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <NavLink to="/" className="app-brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-symbol"><Icon name="leaf" size={25} /></span>
          <span><strong dir="ltr">CO / CHEF</strong><small>{personal.businessName || 'מרחב העבודה שלך'}</small></span>
        </NavLink>
        <button className="mobile-menu btn btn-ghost mb-4" aria-label="סגירת תפריט" onClick={() => setMenuOpen(false)}><Icon name="close" size={16}/>סגירה</button>
        <nav aria-label="תפריט ראשי" className="sidebar-navigation">
          {sections.map(s => <NavLink key={s.to} to={s.to} onClick={() => setMenuOpen(false)} className={`nav-item ${section === s ? 'active' : ''}`} aria-current={section === s ? 'page' : undefined}><Icon name={s.icon} size={19}/><span>{s.label}</span></NavLink>)}
          <NavLink to="/settings" onClick={() => setMenuOpen(false)} className={({isActive}) => `nav-item mt-8 ${isActive ? 'active' : ''}`}><Icon name="settings" size={19}/><span>הגדרות וחיבורים</span></NavLink>
        </nav>
        <div className="sidebar-footer"><span className="local-dot" /><div><strong>מרחב העבודה האישי</strong><small>הנתונים נשמרים במחשב שלך</small></div></div>
      </aside>
      <div className="workspace">
        <header className="workspace-bar">
          <div className="flex items-center gap-3">
            <button className="mobile-menu btn btn-ghost !px-2" aria-label="פתיחת תפריט" aria-expanded={menuOpen} aria-controls="app-navigation" onClick={() => setMenuOpen(v => !v)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
            <span className="text-muted text-sm hidden sm:inline">מרחב העבודה</span><span className="text-faint hidden sm:inline">/</span><span className="text-sm font-medium">{pageLabel}</span>
          </div>
          <NavLink to="/events/new" className="quick-create"><Icon name="plus" size={17} />אירוע חדש</NavLink>
        </header>
        <main id="main-content" tabIndex={-1} className="workspace-content">
        {section && section.paths.length > 1 && <nav aria-label={`ניווט ${section.label}`} className="flex flex-wrap gap-2 mb-6">{section.paths.map(path => <NavLink key={path} to={path} className={({isActive}) => `btn ${isActive ? 'btn-primary' : 'btn-ghost'}`}>{nav.find(n => n.to === path)?.label}</NavLink>)}</nav>}
        <ErrorBoundary key={location.pathname}>
        <Suspense fallback={<Loading label="טוען…" />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/work" element={<WorkDashboard />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/finance" element={<FinanceDashboard />} />
            <Route path="/events/new" element={<EventWizard />} />
            <Route path="/events/:id/edit" element={<EventWizard />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/recipes" element={<RecipeLibrary />} />
            <Route path="/menu-studio" element={<MenuStudio />} />
            <Route path="/ingredients" element={<IngredientLibrary />} />
            <Route path="/pantry" element={<PantryPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<div className="card p-8 space-y-4"><h1 className="text-2xl font-bold">העמוד לא נמצא</h1><NavLink className="btn btn-primary" to="/">חזרה לבית</NavLink></div>} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
