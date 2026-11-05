import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Client, ClientSummary, Event } from '../lib/types'
import { Loading, Button, EmptyState, Modal } from '../components/ui'
import { KpiCard, SectionCard } from '../components/dash'
import { formatMoney, STATUS_LABELS_SINGULAR } from '../lib/i18n'
import { Icon } from '../components/Icon'

type ClientRow = Client & { summary: ClientSummary }

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[] | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<ClientRow | null>(null)
  const [clientEvents, setClientEvents] = useState<Event[] | null>(null)
  const [clientLoading, setClientLoading] = useState(false)
  const nav = useNavigate()

  const load = useCallback(async () => { setClients(await api.clients()) }, [])
  useEffect(() => { load() }, [load])

  if (!clients) return <Loading label="טוען לקוחות…" />

  const revenue = clients.reduce((a, c) => a + (c.summary?.revenue ?? 0), 0)
  const outstanding = clients.reduce((a, c) => a + (c.summary?.outstanding ?? 0), 0)

  const add = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await api.createClient({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null })
      setName(''); setPhone(''); setEmail(''); setShowAdd(false)
      await load()
    } finally { setSaving(false) }
  }

  const openDetail = async (c: ClientRow) => {
    setSelected(c)
    setClientEvents(null)
    setClientLoading(true)
    try {
      const [summary, events] = await Promise.all([api.clientSummary(c.id), api.events()])
      setSelected({ ...c, summary })
      setClientEvents(events.filter(e => e.client_id === c.id))
    } finally {
      setClientLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">לקוחות</h1>
          <p className="text-muted">ניהול הלקוחות וההיסטוריה העסקית שלהם.</p>
        </div>
        <Button onClick={() => setShowAdd(v => !v)}>{showAdd ? 'ביטול' : <><Icon name="plus" size={16}/>לקוח חדש</>}</Button>
      </div>

      {clients.length > 0 && <div className="grid grid-cols-3 gap-4">
        <KpiCard label="לקוחות" value={clients.length} />
        <KpiCard label="הכנסה מצטברת" value={formatMoney(revenue)} />
        <KpiCard label="יתרות פתוחות" value={formatMoney(outstanding)} />
      </div>}

      {showAdd && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-ink">לקוח חדש</h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="cl-name">שם *</label>
              <input id="cl-name" className="input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="cl-phone">טלפון</label>
              <input id="cl-phone" className="input" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="cl-email">אימייל</label>
              <input id="cl-email" className="input" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={add} disabled={!name.trim() || saving}>{saving ? 'שומר…' : 'הוספה'}</Button>
          </div>
        </div>
      )}

      <SectionCard title={`כל הלקוחות (${clients.length})`}>
        {clients.length === 0 ? (
          <EmptyState icon={<Icon name="people" size={28}/>} title="אין לקוחות עדיין"
            hint="הוסיפו לקוח חדש כדי לקשר אירועים וחשבוניות." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint uppercase tracking-wide">
                  <th className="font-semibold py-2 pe-3">שם</th>
                  <th className="font-semibold py-2 pe-3">יצירת קשר</th>
                  <th className="font-semibold py-2 pe-3 text-right">עבודות</th>
                  <th className="font-semibold py-2 pe-3 text-right">הכנסה</th>
                  <th className="font-semibold py-2 pe-3 text-right">יתרה</th>
                  <th className="font-semibold py-2"><span className="sr-only">פעולות</span></th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id} className="border-t border-edge">
                    <td className="py-2.5 pe-3 font-medium text-ink">
                      <button className="underline underline-offset-4 hover:text-accent" onClick={() => void openDetail(c)}>
                        {c.name}
                      </button>
                    </td>
                    <td className="py-2.5 pe-3 text-muted">
                      {c.phone ?? c.email ?? '—'}
                    </td>
                    <td className="py-2.5 pe-3 text-right tabular-nums">{c.summary?.jobs_count ?? 0}</td>
                    <td className="py-2.5 pe-3 text-right tabular-nums">{formatMoney(c.summary?.revenue ?? 0)}</td>
                    <td className="py-2.5 pe-3 text-right tabular-nums">
                      {(c.summary?.outstanding ?? 0) > 0
                        ? <span className="text-warn">{formatMoney(c.summary?.outstanding ?? 0)}</span>
                        : <span className="text-faint">—</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      <Button variant="ghost" className="!px-2.5 text-sm" onClick={() => void openDetail(c)}>פרטים</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? 'פרטי לקוח'} wide>
        {selected && (
          <div className="space-y-5">
            <div className="text-sm text-muted flex flex-wrap gap-x-4 gap-y-1">
              {selected.phone && <span>טלפון: {selected.phone}</span>}
              {selected.email && <span>אימייל: {selected.email}</span>}
              {selected.address && <span>כתובת: {selected.address}</span>}
              {!selected.phone && !selected.email && !selected.address && <span>אין פרטי קשר.</span>}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="עבודות" value={String(selected.summary?.jobs_count ?? 0)} />
              <KpiCard label="הכנסה" value={formatMoney(selected.summary?.revenue ?? 0)} />
              <KpiCard label="יתרה פתוחה" value={formatMoney(selected.summary?.outstanding ?? 0)} />
              <KpiCard label="האירוע האחרון" value={selected.summary?.last_job_date ?? '—'} />
            </div>
            <div>
              <h3 className="font-semibold text-ink mb-3">אירועים של הלקוח</h3>
              {clientLoading ? (
                <Loading label="טוען אירועים…" />
              ) : !clientEvents || clientEvents.length === 0 ? (
                <p className="text-faint text-sm">אין אירועים מקושרים ללקוח זה.</p>
              ) : (
                <div className="divide-y divide-edge border border-edge rounded-2xl">
                  {clientEvents.map(e => (
                    <div key={e.id} className="p-3.5 flex items-center justify-between gap-3 text-sm">
                      <div>
                        <button className="font-medium text-ink underline underline-offset-4 hover:text-accent"
                          onClick={() => { setSelected(null); nav(`/events/${e.id}`) }}>
                          {e.name}
                        </button>
                        <div className="text-xs text-muted mt-0.5">{e.date} · {e.total_guests} אורחים</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted">{STATUS_LABELS_SINGULAR[e.status]}</span>
                        <span className="font-medium text-ink tabular-nums">{formatMoney(e.agreed_price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
