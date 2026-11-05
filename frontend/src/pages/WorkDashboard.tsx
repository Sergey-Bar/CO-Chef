import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../lib/api'
import type { Event, WorkSummary, Lead, Client } from '../lib/types'
import { Loading, Badge, Button, Modal, ConfirmDialog, EmptyState } from '../components/ui'
import { SectionCard } from '../components/dash'
import { useToast } from '../components/toast'
import { Icon } from '../components/Icon'
import {
  STATUS_LABELS, STATUS_LABELS_SINGULAR, formatMoney,
  LEAD_KIND_LABELS, LEAD_STATUS_LABELS, LEAD_STATUSES,
} from '../lib/i18n'

interface LeadDraft {
  id?: number
  client_id: number | null
  kind: string
  title: string
  event_type: string
  preferred_date: string
  guest_estimate: string
  amount: string
  status: string
  notes: string
}

const emptyLeadDraft = (kind = 'lead'): LeadDraft => ({
  client_id: null,
  kind,
  title: '',
  event_type: '',
  preferred_date: '',
  guest_estimate: '',
  amount: '',
  status: LEAD_STATUSES[kind][0],
  notes: '',
})

const COLUMNS = ['confirmed', 'production', 'completed', 'invoiced', 'paid', 'archived']
const NEXT: Record<string, Event['status']> = {
  confirmed: 'production', production: 'completed', completed: 'invoiced', invoiced: 'paid',
}

export default function WorkDashboard() {
  const [events, setEvents] = useState<Event[] | null>(null)
  const [work, setWork] = useState<WorkSummary | null>(null)
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [leadFilter, setLeadFilter] = useState('all')
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [leadDraft, setLeadDraft] = useState<LeadDraft>(emptyLeadDraft())
  const [leadSaving, setLeadSaving] = useState(false)
  const [leadError, setLeadError] = useState('')
  const [leadDelete, setLeadDelete] = useState<Lead | null>(null)
  const [loadError, setLoadError] = useState('')
  const nav = useNavigate()
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const [evs, w, lds, cls] = await Promise.all([api.events(), api.workSummary(), api.leads(), api.clients()])
      setEvents(evs); setWork(w); setLeads(lds); setClients(cls)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'טעינת לוח העבודה נכשלה')
    }
  }, [])
  useEffect(() => { load() }, [load])

  if (loadError) return <EmptyState icon={<Icon name="calendar" size={30} />} title="לא הצלחנו לטעון את לוח העבודה" hint={loadError} action={<Button onClick={() => void load()}>ניסיון נוסף</Button>} />
  if (!events || !work || !leads) return <Loading label="טוען את לוח העבודה…" />

  const chartData = work.workload.map(d => ({ label: fmtDay(d.date), hours: d.prep_hours }))

  const grouped: Record<string, Event[]> = { confirmed: [], production: [], completed: [], invoiced: [], paid: [], archived: [] }
  for (const e of events) {
    (grouped[e.status] ?? grouped.archived).push(e)
  }
  const sortedKeys = COLUMNS.filter(k => grouped[k]?.length)
  const activeCount = events.filter(e => ['confirmed', 'production'].includes(e.status)).length
  const actionCount = work.actions.new_leads.count + work.actions.open_quotes.count + work.actions.unpaid_invoices.count

  const advance = async (e: Event) => {
    const target = NEXT[e.status]
    if (!target) return
    try {
      await api.updateEvent(e.id, { status: target })
      await load()
      toast(`האירוע עבר לסטטוס "${STATUS_LABELS[target]}"`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'לא ניתן היה לקדם את האירוע', 'error')
    }
  }

  const openNewLead = (kind: string) => {
    setLeadDraft(emptyLeadDraft(kind))
    setLeadError('')
    setShowLeadModal(true)
  }

  const openEditLead = (l: Lead) => {
    setLeadDraft({
      id: l.id,
      client_id: l.client_id,
      kind: l.kind,
      title: l.title,
      event_type: l.event_type ?? '',
      preferred_date: l.preferred_date ?? '',
      guest_estimate: l.guest_estimate != null ? String(l.guest_estimate) : '',
      amount: l.amount > 0 ? String(l.amount) : '',
      status: l.status,
      notes: l.notes ?? '',
    })
    setLeadError('')
    setShowLeadModal(true)
  }

  const saveLead = async () => {
    if (!leadDraft.title.trim()) { setLeadError('הזינו כותרת.'); return }
    setLeadSaving(true); setLeadError('')
    try {
      const payload: Partial<Lead> = {
        client_id: leadDraft.client_id,
        kind: leadDraft.kind as 'lead' | 'quote',
        title: leadDraft.title.trim(),
        event_type: leadDraft.event_type.trim() || null,
        preferred_date: leadDraft.preferred_date || null,
        guest_estimate: leadDraft.guest_estimate ? Number(leadDraft.guest_estimate) : null,
        amount: leadDraft.amount ? Number(leadDraft.amount) : 0,
        status: leadDraft.status,
        notes: leadDraft.notes.trim() || null,
      }
      if (leadDraft.id) await api.updateLead(leadDraft.id, payload)
      else await api.createLead(payload)
      setShowLeadModal(false)
      toast(leadDraft.id ? 'השינויים נשמרו' : 'הליד או הצעת המחיר נוספו', 'success')
      await load()
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : 'לא ניתן היה לשמור')
    } finally {
      setLeadSaving(false)
    }
  }

  const changeLeadStatus = async (l: Lead, status: string) => {
    try { await api.updateLead(l.id, { status }); await load() }
    catch (err) { toast(err instanceof Error ? err.message : 'לא ניתן היה לעדכן סטטוס', 'error') }
  }

  const convertLead = async (l: Lead) => {
    try {
      const ev = await api.convertLead(l.id)
      toast('הצעת המחיר הומרה לעבודה', 'success')
      nav(`/events/${ev.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'לא ניתן היה להמיר', 'error')
    }
  }

  const filteredLeads = leadFilter === 'all' ? leads : leads.filter(l => l.kind === leadFilter)

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="work-heading">
        <div>
          <div className="eyebrow">מההזדמנות הראשונה ועד התשלום</div>
          <h1>אירועים ועבודה</h1>
          <p className="text-muted">כל העסק בתנועה אחת ברורה.</p>
        </div>
      </div>

      <div className="work-overview" aria-label="מצב העבודה">
        <div className="work-overview-item"><span>אירועים פעילים</span><strong>{activeCount}</strong><small>מאושרים ובהפקה</small></div>
        <div className="work-overview-item"><span>הזדמנויות פתוחות</span><strong>{work.actions.new_leads.count + work.actions.open_quotes.count}</strong><small>{formatMoney(work.actions.open_quotes.value)} בצנרת</small></div>
        <div className="work-overview-item"><span>פעולות שממתינות לך</span><strong className={actionCount ? 'text-warn' : ''}>{actionCount}</strong><small>{work.actions.unpaid_invoices.count ? `${formatMoney(work.actions.unpaid_invoices.total)} לגבייה` : 'הכול מעודכן'}</small></div>
        <div className="work-overview-item"><span>האירוע הבא</span><strong className="next-event-value">{work.next_event?.name ?? 'אין עדיין'}</strong><small>{work.next_event ? `${fmtDay(work.next_event.date)} · ${work.next_event.guests} אורחים` : 'אפשר להתחיל מאירוע חדש'}</small></div>
      </div>

      <section aria-labelledby="pipeline-title">
        <div className="section-heading"><div><h2 id="pipeline-title">מסלול האירועים</h2><p>התקדמות מהאישור ועד סגירת התשלום.</p></div>{events.length > 0 && <span className="section-count">{events.length} אירועים</span>}</div>
        {sortedKeys.length === 0 ? (
          <div className="work-empty card">
            <span className="work-empty-icon"><Icon name="calendar" size={27} /></span>
            <h3>העבודה הראשונה מתחילה כאן</h3>
            <p>צרו אירוע, הגדירו אורחים ותקציב — והמערכת תלווה אתכם עד התשלום.</p>
            <Button onClick={() => nav('/events/new')}><Icon name="plus" size={17} />יצירת אירוע ראשון</Button>
            <div className="work-steps" aria-label="שלבי העבודה"><span>01 · מאושר</span><i /><span>02 · בהפקה</span><i /><span>03 · הושלם</span><i /><span>04 · שולם</span></div>
          </div>
        ) : (
        <div className="work-board">
        {sortedKeys.map(status => (
          <div key={status} className="work-column">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink text-sm">{STATUS_LABELS_SINGULAR[status]}</h3>
              <Badge tone={status === 'paid' ? 'success' : status === 'archived' ? 'neutral' : 'accent'}>
                {grouped[status].length}
              </Badge>
            </div>
            {grouped[status].length === 0 ? (
              <p className="text-faint text-xs">אין עבודות בשלב זה.</p>
            ) : (
              <div className="space-y-2">
                {grouped[status].map(e => (
                  <div key={e.id} className="work-card"
                    onClick={() => nav(`/events/${e.id}`)}>
                    <p className="font-medium text-ink text-sm leading-snug">{e.name}</p>
                    {e.client?.name && <p className="text-xs text-muted mt-0.5">{e.client.name}</p>}
                    <div className="text-xs text-muted mt-1 space-y-0.5">
                      <p>{e.date}</p>
                      <p>{e.total_guests} אורחים</p>
                    </div>
                    {e.agreed_price > 0 && (
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-muted">סה"כ</span>
                        <span className="font-medium text-ink tabular-nums">{formatMoney(e.agreed_price)}</span>
                      </div>
                    )}
                    {e.status === 'invoiced' && e.balance > 0 && (
                      <div className="flex items-center justify-between mt-1 text-xs">
                        <span className="text-muted">יתרה</span>
                        <span className="font-medium text-warn tabular-nums">{formatMoney(e.balance)}</span>
                      </div>
                    )}
                    {NEXT[e.status] && (
                      <Button variant="subtle" className="w-full mt-2 !py-1.5 text-xs"
                        onClick={(ev) => { ev.stopPropagation(); advance(e) }}>
                        {e.status === 'completed' ? 'שליחת חשבונית' : e.status === 'invoiced' ? 'סימון שולם' : 'קידום'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        </div>)}
      </section>

      <SectionCard
        title={<div><h2 className="text-lg">לידים והצעות מחיר</h2><p className="text-xs text-muted font-normal mt-1">הזדמנויות לפני שהן הופכות לאירועים.</p></div>}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-surface-2 rounded-xl p-1 gap-1">
              {['all', 'lead', 'quote'].map(k => (
                <button key={k} onClick={() => setLeadFilter(k)}
                  className={`tab-btn px-3 py-1 text-xs rounded-lg ${leadFilter === k ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
                  {k === 'all' ? 'הכל' : LEAD_KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => openNewLead('lead')}><Icon name="plus" size={16} />ליד</Button>
              <Button variant="secondary" onClick={() => openNewLead('quote')}><Icon name="plus" size={16} />הצעת מחיר</Button>
            </div>
          </div>
        }
      >
        {filteredLeads.length === 0 ? (
          <EmptyState icon={<Icon name="mail" size={28}/>} title="אין רשומות בסינון זה" hint="הוסיפו ליד או הצעת מחיר כדי להתחיל לעקוב אחר ההזדמנויות." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint uppercase tracking-wide">
                  <th className="font-semibold py-2 pe-3">כותרת</th>
                  <th className="font-semibold py-2 pe-3">סוג</th>
                  <th className="font-semibold py-2 pe-3">לקוח</th>
                  <th className="font-semibold py-2 pe-3">תאריך מועדף</th>
                  <th className="font-semibold py-2 pe-3 text-right">סכום</th>
                  <th className="font-semibold py-2 pe-3">סטטוס</th>
                  <th className="font-semibold py-2"><span className="sr-only">פעולות</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(l => (
                  <tr key={l.id} className="border-t border-edge">
                    <td className="py-2.5 pe-3">
                      <button className="font-medium text-ink underline underline-offset-4 hover:text-accent"
                        onClick={() => openEditLead(l)}>
                        {l.title}
                      </button>
                      {l.event_type && <div className="text-xs text-muted">{l.event_type}</div>}
                    </td>
                    <td className="py-2.5 pe-3">
                      <Badge tone={l.kind === 'quote' ? 'accent' : 'neutral'}>{LEAD_KIND_LABELS[l.kind]}</Badge>
                    </td>
                    <td className="py-2.5 pe-3 text-muted">{l.client_name ?? '—'}</td>
                    <td className="py-2.5 pe-3 text-muted">{l.preferred_date ?? '—'}</td>
                    <td className="py-2.5 pe-3 text-right tabular-nums">{formatMoney(l.amount)}</td>
                    <td className="py-2.5 pe-3">
                      <select className="input !py-1.5 text-xs" value={l.status}
                        onChange={e => changeLeadStatus(l, e.target.value)}
                        aria-label="סטטוס">
                        {LEAD_STATUSES[l.kind].map(s => (
                          <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1">
                        {l.kind === 'quote' && l.status === 'accepted' && !l.converted_event_id && (
                          <Button variant="secondary" className="!px-2.5 text-xs" onClick={() => convertLead(l)}>
                            המר לעבודה
                          </Button>
                        )}
                        <Button variant="ghost" className="!px-2 text-danger" aria-label="מחק"
                          onClick={() => setLeadDelete(l)}><Icon name="trash" size={16}/></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="עומס הכנות — 14 הימים הבאים" action={<span className="text-xs text-muted">שעות הכנה משוערות</span>}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--edge))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} width={34} />
              <Tooltip cursor={{ fill: 'rgb(var(--surface-2))' }}
                contentStyle={{ borderRadius: 12, border: '1px solid rgb(var(--edge))', background: 'rgb(var(--surface))', fontSize: 12 }}
                formatter={(v: any) => [`${v} שעות`, 'הכנה']} />
              <Bar dataKey="hours" fill="rgb(var(--accent))" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <Modal open={showLeadModal} onClose={() => { if (!leadSaving) setShowLeadModal(false) }}
        title={leadDraft.id ? 'עריכת רשומה' : 'רשומה חדשה'}>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="lead-kind">סוג</label>
              <select id="lead-kind" className="input" value={leadDraft.kind}
                onChange={e => {
                  const kind = e.target.value
                  setLeadDraft({ ...leadDraft, kind, status: LEAD_STATUSES[kind][0] })
                }}>
                <option value="lead">{LEAD_KIND_LABELS.lead}</option>
                <option value="quote">{LEAD_KIND_LABELS.quote}</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="lead-status">סטטוס</label>
              <select id="lead-status" className="input" value={leadDraft.status}
                onChange={e => setLeadDraft({ ...leadDraft, status: e.target.value })}>
                {LEAD_STATUSES[leadDraft.kind].map(s => (
                  <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="lead-title">כותרת *</label>
            <input id="lead-title" className="input" value={leadDraft.title} placeholder="למשל: חתונת דניאל ונועה"
              onChange={e => setLeadDraft({ ...leadDraft, title: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="lead-client">לקוח</label>
              <select id="lead-client" className="input" value={leadDraft.client_id ?? ''}
                onChange={e => setLeadDraft({ ...leadDraft, client_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">ללא לקוח</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="lead-type">סוג אירוע</label>
              <input id="lead-type" className="input" value={leadDraft.event_type} placeholder="למשל: חתונה"
                onChange={e => setLeadDraft({ ...leadDraft, event_type: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="lead-date">תאריך מועדף</label>
              <input id="lead-date" type="date" className="input" value={leadDraft.preferred_date}
                onChange={e => setLeadDraft({ ...leadDraft, preferred_date: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="lead-guests">אומדן אורחים</label>
              <input id="lead-guests" type="number" min={0} className="input" value={leadDraft.guest_estimate}
                onChange={e => setLeadDraft({ ...leadDraft, guest_estimate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="lead-amount">סכום (₪)</label>
            <input id="lead-amount" type="number" min={0} step="0.01" className="input" value={leadDraft.amount}
              onChange={e => setLeadDraft({ ...leadDraft, amount: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="lead-notes">הערות</label>
            <textarea id="lead-notes" className="input" rows={3} value={leadDraft.notes}
              onChange={e => setLeadDraft({ ...leadDraft, notes: e.target.value })} />
          </div>
          {leadError && <p role="alert" className="text-danger text-sm">{leadError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" disabled={leadSaving} onClick={() => setShowLeadModal(false)}>ביטול</Button>
            <Button onClick={saveLead} disabled={leadSaving}>{leadSaving ? 'שומר…' : 'שמירה'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!leadDelete} onClose={() => setLeadDelete(null)}
        title="למחוק את הרשומה?" body={`"${leadDelete?.title}" תימחק לצמיתות.`}
        confirmLabel="מחיקה"
        onConfirm={async () => {
          if (leadDelete) { await api.deleteLead(leadDelete.id); setLeadDelete(null); await load() }
        }} />
    </div>
  )
}

function fmtDay(iso: string) {
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) }
  catch { return iso }
}
