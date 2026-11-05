import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Event, HomeSummary } from '../lib/types'
import { Button, EmptyState, Loading, TabBar, Badge, ConfirmDialog } from '../components/ui'
import { KpiCard } from '../components/dash'
import { useToast } from '../components/toast'
import { STATUS_LABELS, formatMoney, statusTone } from '../lib/i18n'
import { PersonalWelcome } from '../components/PersonalWelcome'
import { Icon } from '../components/Icon'
import { HomeAgenda } from '../components/HomeAgenda'

function formatDate(iso: string) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('he-IL', {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function Dashboard() {
  const [events, setEvents] = useState<Event[] | null>(null)
  const [home, setHome] = useState<HomeSummary | null>(null)
  const [tab, setTab] = useState('confirmed')
  const [deleting, setDeleting] = useState<Event | null>(null)
  const nav = useNavigate()
  const { toast } = useToast()
  const [error, setError] = useState('')
  const [showAllActions, setShowAllActions] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
    const [evs, h] = await Promise.all([api.events(), api.homeSummary()])
    setEvents(evs); setHome(h)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'טעינת הנתונים נכשלה')
    }
  }, [])
  useEffect(() => { load() }, [load])

  if (error) return <div className="card p-8 space-y-4" role="alert"><h1 className="text-xl font-semibold">לא ניתן לטעון את לוח הבקרה</h1><p className="text-muted">{error}</p><Button onClick={() => void load()}>נסו שוב</Button></div>

  if (!events || !home) return <Loading label="טוען את כל האירועים שלך…" />

  const counts = {
    confirmed: events.filter(e => e.status === 'confirmed').length,
    production: events.filter(e => e.status === 'production').length,
    completed: events.filter(e => e.status === 'completed').length,
    invoiced: events.filter(e => e.status === 'invoiced').length,
    paid: events.filter(e => e.status === 'paid').length,
    archived: events.filter(e => e.status === 'archived').length,
  }
  const tabOptions = ['confirmed', 'production', 'completed', 'invoiced', 'paid', 'archived']
  const shown = events.filter(e => e.status === tab)
  const primary = home.briefing.primary
  const focus = primary
    ? { eyebrow: 'תדריך Co‑Chef · הפעולה החשובה עכשיו', title: primary.title, body: primary.detail, label: primary.label, to: primary.href }
    : home.work.next_event
      ? { eyebrow: 'מבט קדימה · האירוע הבא', title: home.work.next_event.name, body: `${formatDate(home.work.next_event.date)} · ${home.work.next_event.guests} אורחים · ${home.work.next_event.prep_hours} שעות הכנה`, label: 'פתיחת תוכנית האירוע', to: `/events/${home.work.next_event.event_id}` }
      : { eyebrow: 'הצעד הבא שלך', title: 'לתכנן את האירוע הבא', body: 'כמה פרטים קצרים, והמערכת תבנה בסיס לתפריט, לעלויות ולהכנות.', label: 'יצירת אירוע', to: '/events/new' }


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <PersonalWelcome />
        <Button onClick={() => nav('/events/new')}>אירוע חדש</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="הכנסות מוסכמות החודש" value={formatMoney(home.finance_month.revenue)} />
        <KpiCard label="רווח מחושב החודש" value={formatMoney(home.finance_month.completed_net)} />
        <KpiCard label="יתרות לאירועי החודש" value={formatMoney(home.finance_month.receivables)} />
        <KpiCard label="אירועים קרובים" value={home.work.upcoming_events.length} />
      </div>

      <section className="focus-card" aria-labelledby="focus-title">
        <div className="focus-copy"><span>{focus.eyebrow}</span><h2 id="focus-title">{focus.title}</h2><p>{focus.body}</p><Button onClick={() => nav(focus.to)}>{focus.label}</Button></div>
        <div className="focus-orbit" aria-hidden="true"><span>{home.briefing.summary.urgent ? 'דחוף' : 'עכשיו'}</span></div>
      </section>

      <section className="briefing-panel" aria-labelledby="briefing-title">
        <div className="briefing-head">
          <div><p className="eyebrow">תמונה אמיתית מהנתונים שלך</p><h2 id="briefing-title">התדריך היומי</h2></div>
          <div className="briefing-summary" aria-label="סיכום התדריך">
            {home.briefing.summary.urgent > 0 && <Badge tone="danger">{home.briefing.summary.urgent} דחופות</Badge>}
            {home.briefing.summary.warnings > 0 && <Badge tone="warn">{home.briefing.summary.warnings} לבדיקתך</Badge>}
            {home.briefing.summary.ready_events > 0 && <Badge tone="success">{home.briefing.summary.ready_events} אירועים מוכנים</Badge>}
            {home.briefing.actions.length === 0 && <Badge tone="success">אין חסמים פעילים</Badge>}
          </div>
        </div>
        {home.briefing.actions.length > 1 ? (
          <div className="briefing-actions">
            {home.briefing.actions.slice(1, showAllActions ? undefined : 3).map(action => (
              <button key={action.key} className={`briefing-action ${action.severity}`} onClick={() => nav(action.href)}>
                <span className="briefing-dot" aria-hidden="true" />
                <span><strong>{action.title}</strong><small>{action.detail}</small></span>
                <Icon name="chevron" size={17}/>
              </button>
            ))}
          </div>
        ) : <p className="briefing-clear"><Icon name="check" size={17}/>{primary ? 'הפעולה שבראש המסך היא היחידה שממתינה כרגע לטיפול.' : 'אין כרגע התראות לפי הנתונים שהוזנו.'}</p>}
        {home.briefing.actions.length > 3 && <Button variant="ghost" className="mt-3" onClick={() => setShowAllActions(value => !value)} aria-expanded={showAllActions}>{showAllActions ? 'הצגת החשוב בלבד' : `עוד ${home.briefing.actions.length - 3} תובנות`}</Button>}
        {home.agent_updates.length > 0 && <div className="dashboard-agent-feed">
          <div className="dashboard-agent-head"><span><Icon name="bot" size={15}/>עדכונים מסוכנים מחוברים</span><button onClick={() => nav('/agents')}>כל הסוכנים</button></div>
          {home.agent_updates.map(update => <button key={update.id} className="dashboard-agent-item" onClick={() => nav(update.href || '/agents')}><span className={`briefing-dot ${update.severity}`} aria-hidden="true"/><span><strong>{update.title}</strong><small>{update.agent_name}</small></span><Icon name="chevron" size={15}/></button>)}
        </div>}
        <p className="briefing-note"><Icon name="spark" size={14}/>ללא ניחושים: כל המלצה מחושבת מהמידע המקומי ונפתחת ישירות במקום שבו מטפלים בה.</p>
      </section>

      <HomeAgenda events={events} />



      <section className="personal-insights" aria-labelledby="personal-insights-title">
        <div className="personal-insights-head"><div><p className="eyebrow">העסק שלך, במבט אחד</p><h2 id="personal-insights-title">תובנות אישיות</h2></div><span>מתעדכן מהנתונים המקומיים</span></div>
        <div className="personal-insights-grid">
          <button onClick={() => nav('/work')}><Icon name="calendar" size={18}/><span>יש לך <strong>{home.insights.future_events}</strong> אירועים בעתיד</span><Icon name="chevron" size={15}/></button>
          <button onClick={() => nav('/finance')}><Icon name="wallet" size={18}/><span>רווח מחושב מאירועים שבוצעו <strong>{formatMoney(home.insights.earned_to_date)}</strong><small className="block">לפי העלויות שהוזנו</small></span><Icon name="chevron" size={15}/></button>
          <button onClick={() => nav('/pantry')}><Icon name="box" size={18}/><span>{home.insights.low_stock_count ? <><strong>{home.insights.low_stock_count}</strong> פריטים רשומים עם מלאי אפס</> : 'בדיקת ועדכון המלאי'}<small className="block">אינו כולל השוואה לצורכי האירועים</small></span><Icon name="chevron" size={15}/></button>
          <button onClick={() => nav('/ingredients')}><Icon name="chart" size={18}/><span>{priceInsightCopy(home.insights.price_increases, home.insights.price_decreases)}</span><Icon name="chevron" size={15}/></button>
        </div>
        {home.insights.menu_missing.length > 0 && <div className="missing-menu-row"><Icon name="alert" size={16}/><span>עדיין לא נבנה תפריט ל־{home.insights.menu_missing.map(event => event.name).join(' · ')}</span><Button variant="secondary" className="!min-h-8 !px-3 text-xs" onClick={() => nav(`/events/${home.insights.menu_missing[0].id}`)}>לבניית תפריט</Button></div>}
      </section>

      <details className="card p-5 space-y-2"><summary className="cursor-pointer font-semibold">תחזית רווח ופעולות עסקיות</summary>
        <p>רווח צפוי מאירועים פתוחים החודש: <strong>{formatMoney(home.finance_month.projected_net)}</strong></p>
        <p className="text-sm text-muted">הרווח מחושב לפי העלויות שהוזנו, כולל רזרבת כמויות. הוסיפו גם עבודה, נסיעות, צוות וציוד לעלויות הנוספות בכל אירוע. הסכומים בשקלים.</p>
        {home.finance_month.incomplete_estimates > 0 && <p className="text-warn" role="status">ב־{home.finance_month.incomplete_estimates} אירועים החודש חסר תפריט או תמחור מלא. הרווח עדיין אינו סופי.</p>}
        <Button variant="secondary" onClick={() => nav('/finance')}>פירוט הרווחיות</Button>

      {home.work.actions && (home.work.actions.unpaid_invoices.count > 0 || home.work.actions.open_quotes.count > 0) && (
        <div className="card p-5">
          <h3 className="font-semibold text-ink mb-3">פעולות נדרשות</h3>
          <div className="flex flex-wrap gap-2">
            {home.work.actions.unpaid_invoices.count > 0 && (
              <Badge tone="warn">{home.work.actions.unpaid_invoices.count} חשבוניות ביתרה ({formatMoney(home.work.actions.unpaid_invoices.total)})</Badge>
            )}
            {home.work.actions.open_quotes.count > 0 && (
              <Badge tone="accent">{home.work.actions.open_quotes.count} הצעות מחיר פתוחות ({formatMoney(home.work.actions.open_quotes.value)})</Badge>
            )}
          </div>
        </div>
      )}

      </details>

      <details className="card p-5 space-y-4"><summary className="cursor-pointer font-semibold">כל האירועים · {events.length}</summary>
      <TabBar tabs={tabOptions.map(k => ({ key: k, label: STATUS_LABELS[k], count: counts[k as keyof typeof counts] }))}
        active={tab} onChange={setTab} />

      {shown.length === 0 ? (
        <EmptyState icon={<Icon name="calendar" size={28}/>} title={`אין אירועים ${STATUS_LABELS[tab]}`}
          hint={tab === 'confirmed' ? 'צרו אירוע כדי להתחיל.' : undefined}
          action={tab === 'confirmed' ? <Button onClick={() => nav('/events/new')}>אירוע חדש</Button> : undefined} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shown.map(e => (
            <div key={e.id} className="card p-5 flex flex-col gap-3 hover:shadow-card-dark hover:-translate-y-0.5 transition-all cursor-pointer animate-fade-in"
              onClick={() => nav(`/events/${e.id}`)}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-ink leading-snug">{e.name}</h3>
                <Badge tone={statusTone(e.status)}>
                  {STATUS_LABELS[e.status]}
                </Badge>
              </div>
              <div className="text-sm text-muted space-y-1">
                <p>{formatDate(e.date)}</p>
                <p>{e.total_guests} {e.total_guests === 1 ? 'אורח' : 'אורחים'}</p>
                {e.menu_items.length > 0 && (
                  <p>{e.menu_items.length} {e.menu_items.length === 1 ? 'מנה בתפריט' : 'מנות בתפריט'}</p>
                )}
              </div>
              <div className="flex gap-2 mt-auto border-t border-edge pt-3">
                <Button variant="subtle" className="flex-1 !py-1.5"
                  onClick={(ev) => { ev.stopPropagation(); nav(`/events/${e.id}`) }}>
                  {e.status === 'completed' ? 'צפייה בתוכנית' : 'פתיחה'}
                </Button>
                <Button variant="ghost" className="!px-3 text-danger" aria-label="מחק אירוע"
                  onClick={(ev) => { ev.stopPropagation(); setDeleting(e) }}><Icon name="trash" size={16}/></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      </details>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)}
        title="למחוק את האירוע?"
        body={`"${deleting?.name}" וכל פרטי התפריט וההכנות שלו יימחקו לצמיתות.`}
        onConfirm={async () => {
          if (deleting) { await api.deleteEvent(deleting.id); await load(); toast('האירוע נמחק', 'success') }
        }} />
    </div>
  )
}

function priceInsightCopy(increases: { name: string; change_percent: number }[], decreases: { name: string; change_percent: number }[]) {
  if (increases[0]) return <>מחיר <strong>{increases[0].name}</strong> עלה ב־<strong>{increases[0].change_percent}%</strong></>
  if (decreases[0]) return <>מחיר <strong>{decreases[0].name}</strong> ירד ב־<strong>{Math.abs(decreases[0].change_percent)}%</strong></>
  return 'אין עדיין מספיק היסטוריית מחירים להשוואה'
}
