import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { api } from '../lib/api'
import type { Event, FinanceSummary } from '../lib/types'
import { Loading, Badge, Button, EmptyState } from '../components/ui'
import { KpiCard, SectionCard, EmptyRow, StatusPill } from '../components/dash'
import { formatMoney } from '../lib/i18n'
import { Icon } from '../components/Icon'
import { loadSettings } from '../lib/theme'

const PERIODS = [
  { key: 'all', label: 'הכול' },
  { key: 'year', label: 'השנה' },
  { key: 'quarter', label: 'הרבעון' },
  { key: 'month', label: 'החודש' },
]

export default function FinanceDashboard() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [period, setPeriod] = useState('all')
  const nav = useNavigate()
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
    const [s, evs] = await Promise.all([api.financeSummary(period), api.events()])
    setSummary(s); setEvents(evs)
    } catch (err) { setError(err instanceof Error ? err.message : 'טעינת הנתונים נכשלה') }
  }, [period])
  useEffect(() => { load() }, [load])

  if (error) return <div className="card p-8 space-y-4" role="alert"><p>{error}</p><Button onClick={() => void load()}>נסו שוב</Button></div>
  if (!summary) return <Loading label="טוען דשבורד פיננסי…" />

  const nameByEvent = new Map(events.map(e => [e.id, e]))

  if (summary.jobs_count === 0 && summary.pipeline_value === 0) return (
    <div className="space-y-6 animate-fade-in">
      <div><h1 className="text-2xl font-bold text-ink">רווחיות ותשלומים</h1><p className="text-muted">הנתונים הפיננסיים יופיעו אחרי יצירת האירוע הראשון.</p></div>
      <EmptyState icon={<Icon name="chart" size={28}/>} title="עדיין אין נתונים פיננסיים" hint="צרו אירוע והזינו מחיר מוסכם. המערכת תחשב הכנסות, עלויות, רווח ויתרות לגבייה." action={<Button onClick={() => nav('/events/new')}><Icon name="plus" size={16}/>יצירת אירוע</Button>} />
      <TaxRoutine onSettings={() => nav('/settings')} />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">דשבורד פיננסי</h1>
          <p className="text-muted">ערך הרווחיות, הכנסות, עלויות ומעקב תשלומים.</p>
        </div>
        <div className="inline-flex bg-surface-2 rounded-full p-1 gap-1">
          {PERIODS.map(p => (
            <button key={p.key} type="button" onClick={() => setPeriod(p.key)}
              className={`tab-btn ${period === p.key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="הכנסות" value={formatMoney(summary.revenue)}
          sub={`${summary.jobs_count} עבודות בפרק`} />
        <KpiCard label="רווח משוער כולל" value={formatMoney(summary.net)}
          sub={
            summary.margin != null
              ? <span className={summary.margin >= 0 ? 'text-success' : 'text-danger'}>מרווח {summary.margin}%</span>
              : 'אין הכנסות'
          } />
        <KpiCard label="עלות כוללת" value={formatMoney(summary.total_cost)}
          sub={`מצרכים ${formatMoney(summary.cogs)}`} />
        <KpiCard label="יתרות לגבייה" value={formatMoney(summary.receivables)}
          sub={`נגבה ${formatMoney(summary.collected)}`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="ערך עסקאות פתוחות" value={formatMoney(summary.pipeline_value)} />
        <KpiCard label="עלות חומרי גלם" value={formatMoney(summary.cogs)} />
        <KpiCard label="מס" value={formatMoney(summary.tax)} />
      </div>

      <div className="card p-5 space-y-2">
        <h2 className="font-semibold">ביצוע מול תחזית · שקלים בלבד</h2>
        <p>רווח משוער מאירועים שבוצעו: <strong>{formatMoney(summary.completed_net)}</strong></p>
        <p>רווח צפוי מאירועים פתוחים: <strong>{formatMoney(summary.projected_net)}</strong></p>
        <p className="text-sm text-muted">החישוב מבוסס על העלויות שהוזנו, כולל רזרבת כמויות. יש לכלול עבודה, צוות, נסיעות וציוד בעלויות הנוספות של האירוע.</p>
        {summary.incomplete_estimates > 0 && <p className="text-warn">ב־{summary.incomplete_estimates} אירועים חסר תפריט או תמחור מלא; הרווח המוצג חלקי.</p>}
      </div>

      <TaxRoutine onSettings={() => nav('/settings')} />

      <SectionCard title="הכנסות מול עלויות — חודשי">
        {summary.monthly.length === 0 ? (
          <EmptyRow />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.monthly} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--edge))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip cursor={{ fill: 'rgb(var(--surface-2))' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid rgb(var(--edge))', background: 'rgb(var(--surface))', fontSize: 12 }}
                  formatter={(v: any, name: any) => [formatMoney(Number(v)), name === 'revenue' ? 'הכנסות' : 'עלויות']} />
                <Legend formatter={(v: string) => (v === 'revenue' ? 'הכנסות' : 'עלויות')} />
                <Bar dataKey="revenue" fill="rgb(var(--success))" radius={[6, 6, 0, 0]} maxBarSize={30} />
                <Bar dataKey="cost" fill="rgb(var(--accent))" radius={[6, 6, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title="פירוט עבודות">
        {summary.by_event.length === 0 ? (
          <EmptyRow message="אין עבודות בפרק זמן זה." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint uppercase tracking-wide">
                  <th className="font-semibold py-2 pe-3">עבודה</th>
                  <th className="font-semibold py-2 pe-3">סטטוס</th>
                  <th className="font-semibold py-2 pe-3 text-right">הכנסה</th>
                  <th className="font-semibold py-2 pe-3 text-right">עלות</th>
                  <th className="font-semibold py-2 pe-3 text-right">רווח</th>
                  <th className="font-semibold py-2 text-right">יתרה</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_event.map(f => {
                  const ev = nameByEvent.get(f.event_id)
                  return (
                    <tr key={f.event_id} className="border-t border-edge cursor-pointer hover:bg-surface-2/60"
                      onClick={() => ev && nav(`/events/${ev.id}`)}>
                      <td className="py-2.5 pe-3 font-medium text-ink">{ev?.name ?? `#${f.event_id}`}</td>
                      <td className="py-2.5 pe-3"><StatusPill status={f.status} /></td>
                      <td className="py-2.5 pe-3 text-right tabular-nums">{formatMoney(f.revenue)}</td>
                      <td className="py-2.5 pe-3 text-right tabular-nums">{formatMoney(f.total_cost)}</td>
                      <td className={`py-2.5 pe-3 text-right tabular-nums ${(f.net ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatMoney(f.net)}{!f.estimate_complete && <span className="block text-xs text-warn">תמחור חלקי</span>}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {f.balance > 0 ? <Badge tone="warn">{formatMoney(f.balance)}</Badge> : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function TaxRoutine({ onSettings }: { onSettings: () => void }) {
  const [settings] = useState(loadSettings)
  const [year] = useState(() => new Date().getFullYear())
  const reviewKey = `cochef.tax-review-${year}`
  const [reviewed, setReviewed] = useState(() => localStorage.getItem(reviewKey) === 'done')
  const monthLabel = new Intl.DateTimeFormat('he-IL', { month: 'long' }).format(new Date(year, settings.annualReviewMonth - 1, 1))
  const completeReview = () => { localStorage.setItem(reviewKey, 'done'); setReviewed(true) }
  return <section className="tax-routine" aria-labelledby="tax-routine-title">
    <div className="tax-routine-icon"><Icon name="wallet" size={20}/></div>
    <div className="flex-1 min-w-0"><p className="eyebrow">שגרת ניהול כספי</p><h2 id="tax-routine-title">לא משאירים מס לסוף השנה</h2><p>מע״מ ברירת מחדל: <strong>{settings.defaultTax}%</strong> · מחזור דיווח: <strong>{settings.vatReportCycle === 'monthly' ? 'חודשי' : 'דו־חודשי'}</strong>.</p><div className="tax-review-row"><span className={reviewed ? 'tax-review-done' : ''}>{reviewed ? `בדיקת המס של ${year} סומנה כהושלמה` : `ב${monthLabel}: ריכוז הוצאות, מסמכים ובדיקת זכאות להחזר מס לשנת ${year}`}</span>{!reviewed && <Button variant="secondary" className="!min-h-8 !px-3 text-xs" onClick={completeReview}>סימון נבדק</Button>}</div><small>זוהי תזכורת ניהולית בלבד. מועדי דיווח, חבות והחזר מס יש לאמת מול רו״ח ורשות המסים.</small></div>
    <Button variant="ghost" className="!min-h-8 !px-3 text-xs" onClick={onSettings}>הגדרת שגרה</Button>
  </section>
}
