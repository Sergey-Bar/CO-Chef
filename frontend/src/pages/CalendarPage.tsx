import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Event } from '../lib/types'
import { Button, EmptyState, Loading } from '../components/ui'
import { PageHeader } from '../components/dash'
import { STATUS_LABELS, statusTone } from '../lib/i18n'
import { Icon } from '../components/Icon'

const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

function pad(n: number) { return String(n).padStart(2, '0') }
function isoof(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

function toneColor(tone: string): string {
  switch (tone) {
    case 'success': return 'rgb(var(--success))'
    case 'danger': return 'rgb(var(--danger))'
    case 'warn': return 'rgb(var(--warn))'
    case 'accent': return 'rgb(var(--accent))'
    default: return 'rgb(var(--muted))'
  }
}

export default function CalendarPage() {
  const nav = useNavigate()
  const [today] = useState(() => new Date())
  const [year, setYear] = useState(() => today.getFullYear())
  const [month, setMonth] = useState(() => today.getMonth())
  const [events, setEvents] = useState<Event[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setError('')
    api.events()
      .then(evs => { if (alive) setEvents(evs) })
      .catch(() => { if (alive) setError('לא הצלחנו לטעון את היומן. האירועים השמורים לא השתנו.') })
    return () => { alive = false }
  }, [attempt])

  const byDate = useMemo(() => {
    const m = new Map<string, Event[]>()
    for (const e of events ?? []) {
      const arr = m.get(e.date) ?? []
      arr.push(e)
      m.set(e.date, arr)
    }
    return m
  }, [events])

  const first = new Date(year, month, 1)
  const gridStart = new Date(year, month, 1 - first.getDay())
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
  const todayKey = isoof(today)

  if (error) return <div role="alert" className="card p-6 space-y-4"><h1>היומן לא נטען</h1><p>{error}</p><Button onClick={() => setAttempt(value => value + 1)}>ניסיון נוסף</Button></div>

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="יומן"
        subtitle="כל האירועים והעבודות על ציר הזמן."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => shift(-1)} aria-label="חודש קודם">←</Button>
            <span className="text-sm font-medium min-w-32 text-center tabular-nums">{monthLabel}</span>
            <Button variant="secondary" onClick={() => shift(1)} aria-label="חודש הבא">→</Button>
          </div>
        }
      />

      {!events ? (
        <Loading label="טוען את היומן…" />
      ) : events.length === 0 ? (
        <EmptyState icon={<Icon name="calendar" size={28}/>} title="אין עדיין אירועים"
          hint="צרו אירוע כדי לראות אותו ביומן."
          action={<Button onClick={() => nav('/events/new')}>אירוע חדש</Button>} />
      ) : (
        <div className="card p-4 sm:p-6">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs text-faint font-semibold py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              const key = isoof(d)
              const inMonth = d.getMonth() === month
              const dayEvents = byDate.get(key) ?? []
              const isToday = key === todayKey
              return (
                <div key={i}
                  className={`min-h-24 rounded-xl border p-1.5 flex flex-col gap-1 ${inMonth ? 'bg-surface' : 'bg-bg opacity-45'} ${isToday ? 'border-accent' : 'border-edge'}`}>
                  <span className={`text-xs font-medium self-start px-1.5 py-0.5 rounded-full ${isToday ? 'bg-accent text-accent-ink' : 'text-muted'}`}>
                    {d.getDate()}
                  </span>
                  {dayEvents.slice(0, 3).map(e => (
                    <button key={e.id} type="button" onClick={() => nav(`/events/${e.id}`)}
                      className="text-left text-xs leading-snug truncate rounded-lg px-1.5 py-1 hover:bg-surface-2 flex items-center gap-1.5"
                      title={`${e.name} · ${STATUS_LABELS[e.status]}${e.client?.name ? ` · ${e.client.name}` : ''}`}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: toneColor(statusTone(e.status)) }} />
                      <span className="truncate">{e.name}</span>
                    </button>
                  ))}
                  {dayEvents.length > 3 && <span className="text-[11px] text-faint px-1.5">+{dayEvents.length - 3} נוספים</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
