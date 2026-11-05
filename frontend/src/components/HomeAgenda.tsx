import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Event } from '../lib/types'
import { Button } from './ui'

function key(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }

export function HomeAgenda({ events }: { events: Event[] }) {
  const nav = useNavigate()
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selected, setSelected] = useState<string | null>(null)
  const today = key(new Date())
  const active = events.filter(e => e.status !== 'archived')
  const upcoming = active.filter(e => selected ? e.date === selected : e.date >= today && ['confirmed', 'production'].includes(e.status)).sort((a,b) => a.date.localeCompare(b.date))
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay())
  return <section className="grid lg:grid-cols-2 gap-4" aria-label="היומן והאירועים שלך">
    <div className="card p-5"><div className="flex items-center justify-between mb-4"><Button variant="ghost" aria-label="חודש קודם" onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1)); setSelected(null) }}>→</Button><h2 className="font-semibold">{month.toLocaleDateString('he-IL',{month:'long',year:'numeric'})}</h2><Button variant="ghost" aria-label="חודש הבא" onClick={() => { setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1)); setSelected(null) }}>←</Button></div>
      <div className="grid grid-cols-7 gap-1">{['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'].map(day => <span key={day} className="text-center text-xs text-muted py-2">{day}</span>)}{Array.from({length:42},(_,i) => { const day = new Date(start); day.setDate(start.getDate()+i); const iso = key(day); const count = active.filter(e => e.date === iso).length; return <button key={iso} aria-label={`${day.toLocaleDateString('he-IL')} — ${count} אירועים`} aria-pressed={selected === iso} onClick={() => setSelected(selected === iso ? null : iso)} className={`rounded-xl min-h-12 text-sm border ${selected === iso ? 'border-accent bg-surface-2' : 'border-transparent'} ${iso === today ? 'font-bold text-accent' : day.getMonth() !== month.getMonth() ? 'text-faint' : 'text-ink'}`}>{day.getDate()}<span className="block text-xs text-accent h-4">{count ? `${count} אירועים` : ''}</span></button> })}</div>
    </div>
    <div className="card p-5"><div className="flex justify-between items-center mb-4"><h2 className="font-semibold">{selected ? `אירועים ב־${new Date(selected+'T00:00:00').toLocaleDateString('he-IL')}` : 'האירועים הבאים שלך'}</h2><Button variant="ghost" onClick={() => selected ? setSelected(null) : nav('/calendar')}>{selected ? 'כל הקרובים' : 'ליומן המלא'}</Button></div><div className="space-y-2">{upcoming.slice(0,4).map(event => <button key={event.id} className="w-full text-start border border-edge rounded-xl p-4 hover:bg-surface-2" onClick={() => nav(`/events/${event.id}`)}><strong className="block">{event.name}</strong><span className="text-sm text-muted">{new Date(event.date+'T00:00:00').toLocaleDateString('he-IL')} · {event.total_guests} אורחים</span></button>)}{upcoming.length === 0 && <p className="text-muted py-6">{selected ? 'אין אירועים ביום הזה.' : 'היומן פנוי. אפשר להתחיל לתכנן את האירוע הבא.'}</p>}</div></div>
  </section>
}
