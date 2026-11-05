import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Event, EventPlan, PrepTask, PrepSuggestion, SmartMenuResult, Client, EventReadiness, Allergen } from '../lib/types'
import { Button, Loading, EmptyState, TabBar, Badge, ConfirmDialog, Spinner, Modal } from '../components/ui'
import { useToast } from '../components/toast'
import { STATUS_LABELS_SINGULAR, formatMoney, NUTRITION_LABELS, CUISINE_LABELS, statusTone, recipeLabel, ingredientLabel, allergenLabel } from '../lib/i18n'
import { Icon } from '../components/Icon'

type Tab = 'overview' | 'shopping' | 'costs' | 'allergens' | 'nutrition' | 'chef' | 'business' | 'readiness' | 'prep'

const stages: { label: string; description: string; tabs: Tab[] }[] = [
  { label: 'הצעה ותמחור', description: 'פרטי האירוע, המחיר המוסכם ועלויות צפויות.', tabs: ['overview', 'business', 'costs'] },
  { label: 'תכנון', description: 'תפריט, קניות והתאמה לצורכי האורחים.', tabs: ['chef', 'shopping', 'allergens', 'nutrition'] },
  { label: 'הכנות וביצוע', description: 'משימות ההכנה ובדיקת המוכנות לפני היציאה.', tabs: ['prep', 'readiness'] },
  { label: 'סגירת האירוע', description: 'עדכון הסטטוס, רישום תשלומים ובדיקת יתרה לגבייה.', tabs: ['business', 'costs', 'overview'] },
]

const tabs: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'סקירה' },
  { key: 'shopping', label: 'רשימת קניות' },
  { key: 'costs', label: 'עלויות' },
  { key: 'allergens', label: 'אלרגנים' },
  { key: 'nutrition', label: 'תזונה' },
  { key: 'chef', label: 'בונה תפריט' },
  { key: 'business', label: 'פרטי עבודה' },
  { key: 'readiness', label: 'מוכנות' },
  { key: 'prep', label: 'הכנות' },
]

export default function EventDetail() {
  const { id } = useParams()
  const eventId = Number(id)
  const nav = useNavigate()
  const { toast } = useToast()

  const [event, setEvent] = useState<Event | null>(null)
  const [plan, setPlan] = useState<EventPlan | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [stage, setStage] = useState(0)
  const [showBuffer, setShowBuffer] = useState(true)
  const [archiveTarget, setArchiveTarget] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [chefLoading, setChefLoading] = useState(false)
  const [chefCuisine, setChefCuisine] = useState('')
  const [chefCourses, setChefCourses] = useState(4)
  const [chefBudget, setChefBudget] = useState('')
  const [chefResult, setChefResult] = useState<SmartMenuResult | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState<number | null>(null)
  const [agreed, setAgreed] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState('')
  const [readiness, setReadiness] = useState<EventReadiness | null>(null)
  const [readinessLoading, setReadinessLoading] = useState(false)
  const [targetMargin, setTargetMargin] = useState('30')
  const [allergens, setAllergens] = useState<Allergen[]>([])
  const [showSegments, setShowSegments] = useState(false)
  const [segDraft, setSegDraft] = useState<SegDraft[]>([])
  const [segError, setSegError] = useState('')
  const [segSaving, setSegSaving] = useState(false)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setLoadError('')
    try {
    const e = await api.event(eventId)
    setEvent(e)
    setPlan(await api.plan(eventId))
    } catch (err) { setLoadError(err instanceof Error ? err.message : 'טעינת האירוע נכשלה') }
  }, [eventId])

  useEffect(() => { load() }, [load])

  useEffect(() => { api.clients().then(setClients) }, [])

  useEffect(() => { api.meta().then(m => setAllergens(m.allergens)) }, [])

  useEffect(() => {
    if (event) {
      setClientId(event.client_id)
      setAgreed(String(event.agreed_price > 0 ? event.agreed_price : ''))
      if (!payDate) setPayDate(todayISO())
    }
  }, [event, payDate])

  useEffect(() => {
    if (tab !== 'readiness' || readiness || readinessLoading) return
    setReadinessLoading(true)
    api.readiness(eventId).then(setReadiness).finally(() => setReadinessLoading(false))
  }, [tab, eventId, readiness, readinessLoading])

  const prepTasks = useMemo(() => event?.prep_tasks ?? [], [event])

  if (loadError) return <div role="alert" className="card p-6 space-y-4"><h1>לא ניתן לטעון את האירוע</h1><p>{loadError}</p><Button onClick={() => void load()}>ניסיון נוסף</Button><Button variant="ghost" onClick={() => nav('/work')}>חזרה לאירועים</Button></div>
  if (!event || !plan) return <Loading label="טוען את תוכנית האירוע…" />

  const openSegments = () => {
    setSegDraft(event.segments.map(s => ({
      id: s.id, name: s.name, guest_count: s.guest_count, restrictions: [...s.restrictions],
    })))
    setSegError('')
    setShowSegments(true)
  }

  const segmentsSum = segDraft.reduce((a, s) => a + (Number(s.guest_count) || 0), 0)

  const setSegField = (index: number, patch: Partial<SegDraft>) => {
    setSegDraft(draft => draft.map((s, i) => i === index ? { ...s, ...patch } : s))
    setSegError('')
  }

  const toggleSegRestriction = (index: number, key: string) => {
    setSegDraft(draft => draft.map((s, i) => {
      if (i !== index) return s
      const has = s.restrictions.includes(key)
      return { ...s, restrictions: has ? s.restrictions.filter(r => r !== key) : [...s.restrictions, key] }
    }))
    setSegError('')
  }

  const removeSegmentDraft = (index: number) => {
    setSegDraft(draft => draft.filter((_, i) => i !== index))
    setSegError('')
  }

  const saveSegments = async () => {
    if (segmentsSum !== event.total_guests) {
      setSegError(`סיכום הקבוצות הוא ${segmentsSum} מתוך ${event.total_guests} אורחים. סכום הקבוצות חייב להיות שווה לסך האורחים.`)
      return
    }
    setSegSaving(true)
    try {
      const existing = new Map(event.segments.map(s => [s.id, s]))
      for (const d of segDraft) {
        if (d.id != null && existing.has(d.id)) {
          const cur = existing.get(d.id)!
          const restrictionsChanged = JSON.stringify(cur.restrictions) !== JSON.stringify(d.restrictions)
          if (cur.name !== d.name || cur.guest_count !== d.guest_count || restrictionsChanged) {
            await api.updateSegment(d.id, { name: d.name, guest_count: d.guest_count, restrictions: d.restrictions })
          }
        } else {
          await api.addSegment(eventId, { name: d.name, guest_count: d.guest_count, restrictions: d.restrictions })
        }
      }
      for (const s of event.segments) {
        if (!segDraft.some(d => d.id === s.id)) await api.deleteSegment(s.id)
      }
      setShowSegments(false)
      await load()
    } finally {
      setSegSaving(false)
    }
  }

  const suggestAll = async () => {
    const existing = new Set(prepTasks.map(t => t.title))
    for (const s of plan.prep_suggestions) {
      if (existing.has(s.title)) continue
      await api.addPrepTask(eventId, {
        title: s.title, description: s.description,
        prep_min: s.prep_min, due_offset_hours: s.due_offset_hours,
      })
    }
    await load()
  }

  const generateSuggestions = async () => {
    const { suggestions } = await api.suggestPrepTasks(eventId)
    const existing = new Set(prepTasks.map(t => t.title))
    let added = 0
    for (const s of suggestions) {
      if (existing.has(s.title)) continue
      await api.addPrepTask(eventId, {
        title: s.title, description: s.description,
        prep_min: s.prep_min, due_offset_hours: s.due_offset_hours,
      })
      added += 1
    }
    await load()
    if (added === 0) toast('כל ההצעות כבר קיימות במשימות.', 'success')
  }

  const addManualTask = async () => {
    if (!newTaskTitle.trim()) return
    await api.addPrepTask(eventId, { title: newTaskTitle.trim() })
    setNewTaskTitle('')
    await load()
  }

  const toggleTask = async (t: PrepTask) => {
    await api.updatePrepTask(t.id, { done: !t.done })
    await load()
  }

  const archiveEvent = async () => {
    await api.updateEvent(eventId, { status: 'archived' })
    nav('/')
  }

  const summaryLines = [
    { label: 'תאריך', value: event.date },
    { label: 'מיקום', value: event.location || '—' },
    { label: 'אורחים', value: String(event.total_guests) },
    { label: 'חיץ', value: `${event.buffer_percent}%` },
    { label: 'מנות בתפריט', value: String(event.menu_items.length) },
    { label: 'סכום ביניים של מצרכים', value: formatMoney(plan.costs.ingredient_subtotal, event.currency) },
    { label: 'סה"כ (כולל אחר ומס)', value: formatMoney(plan.costs.total, event.currency) },
  ]

  const buildMenu = async () => {
    setChefLoading(true)
    try {
      const result = await api.suggestMenu(eventId, {
        preferred_cuisine: chefCuisine || undefined,
        course_count: chefCourses,
        budget: chefBudget ? Number(chefBudget) : undefined,
      })
      setChefResult(result)
    } finally {
      setChefLoading(false)
    }
  }

  const addSuggestion = async (recipeId: number) => {
    const exists = event.menu_items.some(mi => mi.recipe_id === recipeId)
    if (!exists) await api.addMenuItem(eventId, { recipe_id: recipeId, portions_per_guest: 1 })
    await load()
  }

  const addAllSuggestions = async () => {
    for (const s of chefResult?.suggestions ?? []) {
      await addSuggestion(s.recipe_id)
    }
  }

  const NEXT_STATUS: Record<string, Event['status']> = {
    confirmed: 'production', production: 'completed', completed: 'invoiced', invoiced: 'paid',
  }
  const advanceStatus = async () => {
    const target = NEXT_STATUS[event.status]
    if (!target) return
    try { await api.updateEvent(eventId, { status: target }); await load() } catch (err) { toast(err instanceof Error ? err.message : 'עדכון הסטטוס נכשל', 'error') }
  }
  const saveBusiness = async () => {
    await api.updateEvent(eventId, { client_id: clientId, agreed_price: Number(agreed) || 0 })
    await load()
  }
  const addPay = async () => {
    const amount = Number(payAmount)
    if (!amount || amount <= 0) return
    await api.addPayment(eventId, { amount, date: payDate || todayISO() })
    setPayAmount('')
    await load()
  }
  const sendTelegramBrief = async () => {
    try { await api.sendEventTelegramBrief(eventId); toast('נשלח סיכום האירוע ל־Telegram.', 'success') }
    catch (err) { toast(err instanceof Error ? err.message : 'לא ניתן היה לשלוח את הסיכום', 'error') }
  }

  const cuisineOptions = Object.keys(CUISINE_LABELS)

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <button className="text-sm text-muted hover:text-ink mb-2" onClick={() => nav('/')}>→ כל האירועים</button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-ink">{event.name}</h1>
            <Badge tone={event.status === 'completed' ? 'success' : event.status === 'archived' ? 'neutral' : 'accent'}>
              {STATUS_LABELS_SINGULAR[event.status]}
            </Badge>
          </div>
          <p className="text-muted mt-1">{event.date}{event.location ? ` · ${event.location}` : ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={() => void sendTelegramBrief()}><Icon name="mail" size={15}/>סיכום ל־Telegram</Button>
          <Button variant="secondary" onClick={() => nav(`/events/${eventId}/edit`)}>עריכה</Button>
          <Button variant="ghost" onClick={() => window.print()} className="print-hide">הדפסת התוכנית</Button>
          {event.status !== 'archived' && (
            <Button variant="ghost" onClick={() => setArchiveTarget(true)}>ארכיון</Button>
          )}
          <Button variant="ghost" className="text-danger" onClick={() => setDeleteTarget(true)}>מחיקה</Button>
        </div>
      </div>

      <section className="event-stages" aria-label="שלבי האירוע">
        <div className="stage-buttons">{stages.map((item, index) => <button key={item.label} aria-pressed={stage === index} onClick={() => { setStage(index); setTab(item.tabs[0]) }}><span>{index + 1}</span><strong>{item.label}</strong></button>)}</div>
        <p>{stages[stage].description}</p>
      </section>
      <TabBar tabs={stages[stage].tabs.map(key => ({ key, label: tabs.find(t => t.key === key)!.label }))} active={tab} onChange={(k) => setTab(k as Tab)} />

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-4">האירוע</h3>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              {summaryLines.map(l => (
                <div key={l.label}>
                  <dt className="text-muted">{l.label}</dt>
                  <dd className="font-medium text-ink">{l.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="space-y-4">
            <div className="card p-6">
              <h3 className="font-semibold text-ink mb-3">תפריט ({event.menu_items.length})</h3>
              {event.menu_items.length === 0 ? (
                <p className="text-faint text-sm">עדיין אין מנות.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {event.menu_items.map(mi => (
                    <div key={mi.id} className="flex justify-between gap-2">
                      <span className="text-ink">{recipeLabel(mi.recipe_name ?? '')}</span>
                      <span className="text-muted shrink-0">{mi.segment_name ?? 'כל האורחים'} · {mi.portions_per_guest}/אורח</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card p-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-semibold text-ink">קבוצות אורחים</h3>
                <Button variant="secondary" onClick={openSegments}>
                  {event.segments.length > 0 ? 'ניהול קבוצות' : 'הוספת קבוצה'}
                </Button>
              </div>
              {event.segments.length === 0 ? (
                <p className="text-faint text-sm">אין קבוצות — כל האורחים משרתוים כיחידה אחת.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {event.segments.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-ink">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted">{s.guest_count} אורחים</span>
                        {s.restrictions.map(r => <Badge key={r} tone="warn">{allergenLabel(r)}</Badge>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'shopping' && (
        <div className="card p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div>
              <h3 className="font-semibold text-ink">רשימת קניות</h3>
              <p className="text-muted text-sm">הכמויות מותאמות לאירוע שלך
                {event.buffer_percent > 0 ? ` כולל חיץ של ${event.buffer_percent}%.` : '.'}</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">הצגה:</span>
              <TabBar tabs={[
                { key: 'after', label: 'עם חיץ' },
                { key: 'before', label: 'לפני חיץ' },
              ]} active={showBuffer ? 'after' : 'before'} onChange={(k) => setShowBuffer(k === 'after')} />
            </div>
          </div>
          {plan.shopping_list.length === 0 ? (
            <EmptyState icon={<Icon name="box" size={28}/>} title="אין עדיין מצרכים" hint="הוסיפו מנות לתפריט כדי לבנות רשימת קניות." />
          ) : (
            <div className="space-y-6">
              {groupByCategory(plan.shopping_list).map(([cat, lines]) => (
                <div key={cat}>
                  <h4 className="text-xs uppercase tracking-wide text-faint font-semibold mb-2">{cat || 'אחר'}</h4>
                  <div className="divide-y divide-edge border border-edge rounded-2xl">
                    {lines.map(l => (
                      <div key={l.ingredient_id} className="p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{ingredientLabel(l.name)}</p>
                          <p className="text-xs text-muted truncate">{l.menu_items.join(' · ')}</p>
                          {l.flags.length > 0 && (
                            <p className="text-xs text-warn mt-1 flex items-center gap-1">
                              דורש בדיקה: {l.flags[0]}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-semibold text-ink">
                            {l.display.text} <span className="text-sm font-medium text-muted">{l.display.unit || ''}</span>
                          </p>
                          {l.display.rounded_up && (
                            <Badge tone="warn">עוגל כלפי מעלה</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'costs' && (
        <div className="card p-6 max-w-xl">
          <h3 className="font-semibold text-ink mb-5">הערכת עלויות</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted">סכום ביניים של מצרכים</span><b>{formatMoney(plan.costs.ingredient_subtotal, event.currency)}</b></div>
            <div className="flex justify-between"><span className="text-muted">עלויות אחרות</span><b>{formatMoney(plan.costs.other_costs, event.currency)}</b></div>
            <div className="flex justify-between">
              <span className="text-muted">מס ({plan.costs.tax_percent}%)</span><b>{formatMoney(plan.costs.tax, event.currency)}</b>
            </div>
            <div className="border-t border-edge pt-3 flex justify-between text-base">
              <span className="font-semibold text-ink">סה"כ</span>
              <b className="text-accent">{formatMoney(plan.costs.total, event.currency)}</b>
            </div>
          </div>
          <p className="text-xs text-faint mt-4">עלויות המצרכים מבוססות על כמויות לפני חיץ, ביחידת הרכישה של כל מצרך. שורות ללא מחיר לא נכללות ומסומנות.</p>
          <div className="mt-6">
            <p className="font-medium text-ink mb-2">לפי מצרך</p>
            <div className="divide-y divide-edge border border-edge rounded-2xl">
              {plan.shopping_list.map(l => (
                <div key={l.ingredient_id} className="p-3 flex justify-between text-sm">
                  <span className="text-muted">{ingredientLabel(l.name)}</span>
                  <span className={l.cost_ok ? 'text-ink' : 'text-warn'}>
                    {l.cost_ok ? formatMoney(l.cost, event.currency) : 'ללא מחיר'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'allergens' && (
        <div className="space-y-4">
          {plan.allergen_report.length === 0 ? (
            <EmptyState icon={<Icon name="check" size={28}/>} title="אין קבוצות עם הגבלות"
              hint="הוסיפו קבוצות עם הגבלות כדי לראות אילו מנות עלולות להתנגש." />
          ) : (
            plan.allergen_report.map(seg => (
              <div key={seg.segment_id} className="card p-6">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <h3 className="font-semibold text-ink">{seg.segment_name}</h3>
                  <div className="flex gap-1.5">
                    {seg.restrictions.map(r => <Badge key={r} tone="warn">{allergenLabel(r)}</Badge>)}
                  </div>
                </div>
                <p className="text-muted text-sm mb-4">{seg.guest_count} אורחים</p>
                {seg.flagged_items.length === 0 ? (
                  <p className="text-success text-sm">אין מנות מסומנות — התפריט נראה בטוח לקבוצה זו.</p>
                ) : (
                  <div className="divide-y divide-edge border border-edge rounded-2xl">
                    {seg.flagged_items.map(f => (
                      <div key={f.menu_item_id} className="p-3.5 flex justify-between items-center gap-2">
                        <span className="font-medium text-ink">{recipeLabel(f.recipe_name)}</span>
                        <div className="flex gap-1.5">
                          {f.allergens.map(a => <Badge key={a} tone="danger">{allergenLabel(a)}</Badge>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'nutrition' && (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-1">סיכום תזונתי</h3>
            <p className="text-muted text-sm mb-4">אומדן כולל לכל האירוע וליחידת מנה.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-faint font-semibold mb-2">סה"כ לאירוע</p>
                <dl className="space-y-2 text-sm">
                  {Object.keys(NUTRITION_LABELS).map(k => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-muted">{NUTRITION_LABELS[k]}</dt>
                      <dd className="font-medium text-ink">{Math.round(plan.nutrition.totals[k] ?? 0)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-faint font-semibold mb-2">לכל מנה (ממוצע)</p>
                <dl className="space-y-2 text-sm">
                  {Object.keys(NUTRITION_LABELS).map(k => (
                    <div key={k} className="flex justify-between">
                      <dt className="text-muted">{NUTRITION_LABELS[k]}</dt>
                      <dd className="font-medium text-ink">{Math.round(plan.nutrition.per_portion[k] ?? 0)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            {plan.nutrition.missing_nutrition.length > 0 && (
              <p className="text-xs text-warn mt-4">
                חסרים נתוני תזונה: {plan.nutrition.missing_nutrition.map(ingredientLabel).join(' · ')}
              </p>
            )}
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-3">לפי מנה</h3>
            {plan.nutrition.per_dish.length === 0 ? (
              <p className="text-faint text-sm">אין מנות בתפריט.</p>
            ) : (
              <div className="divide-y divide-edge border border-edge rounded-2xl">
                {plan.nutrition.per_dish.map(d => (
                  <div key={d.recipe_id} className="p-4">
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <span className="font-medium text-ink">{recipeLabel(d.recipe_name)}</span>
                      <Badge tone="neutral">{d.portions} מנות</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                      {Object.keys(NUTRITION_LABELS).map(k => (
                        <div key={k} className="flex justify-between">
                          <span className="text-muted text-xs">{NUTRITION_LABELS[k]}</span>
                          <span className="text-ink">{Math.round(d.nutrition[k] ?? 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'chef' && (
        <div className="card p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-ink">בונה תפריט חכם</h3>
            <p className="text-muted text-sm">האלגוריתם יציע תפריט מגוון שמתחשב בהגבלות האורחים, עונתיות, עלות ותקציב.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label" htmlFor="chef-cuisine">מטבח מועדף <span className="text-faint">(אופציונלי)</span></label>
              <select id="chef-cuisine" className="input" value={chefCuisine}
                onChange={e => setChefCuisine(e.target.value)}>
                <option value="">הכל</option>
                {cuisineOptions.map(c => (
                  <option key={c} value={c}>{CUISINE_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="chef-courses">מספר מנות</label>
              <input id="chef-courses" type="number" min={1} max={12} className="input"
                value={chefCourses} onChange={e => setChefCourses(Math.max(1, Number(e.target.value) || 4))} />
            </div>
            <div>
              <label className="label" htmlFor="chef-budget">תקציב (₪) <span className="text-faint">(אופציונלי)</span></label>
              <input id="chef-budget" type="number" min={0} step="0.01" className="input"
                value={chefBudget} onChange={e => setChefBudget(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={buildMenu} disabled={chefLoading}>
              {chefLoading ? <Spinner className="h-4 w-4" /> : 'בנה לי תפריט'}
            </Button>
            {chefResult && (
              <Button variant="secondary" onClick={addAllSuggestions}>הוספת כל ההצעות לתפריט</Button>
            )}
          </div>

          {chefResult && (
            <div className="border-t border-edge pt-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={chefResult.within_budget ? 'success' : 'warn'}>
                    {chefResult.within_budget ? 'במסגרת התקציב' : 'חריגה מהתקציב'}
                  </Badge>
                  <span className="text-sm text-muted">
                    עלות מוערכת: <b className="text-ink">{formatMoney(chefResult.total_cost, chefResult.currency)}</b>
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {chefResult.suggestions.map(s => {
                  const inMenu = event.menu_items.some(mi => mi.recipe_id === s.recipe_id)
                  return (
                    <div key={s.recipe_id} className="flex items-start justify-between gap-3 border border-edge rounded-2xl p-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-ink">{recipeLabel(s.name)}</p>
                          <Badge tone="accent">{CUISINE_LABELS[s.cuisine ?? ''] ?? s.cuisine}</Badge>
                          <span className="text-xs text-muted">{s.category}</span>
                        </div>
                        {s.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {s.reasons.map((r, i) => (
                              <Badge key={i} tone="neutral">{r}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-medium text-ink">{formatMoney(s.cost, chefResult.currency)}</span>
                        <Button variant="ghost" className="!px-3 text-success"
                          disabled={inMenu} onClick={() => addSuggestion(s.recipe_id)}>
                          {inMenu ? 'בתפריט' : 'הוספה'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'business' && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-ink">מצב העבודה</h3>
                <p className="text-muted text-sm">מעקב שלבי ביצוע ותשלום.</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={statusTone(event.status)}>{STATUS_LABELS_SINGULAR[event.status]}</Badge>
                {NEXT_STATUS[event.status] && (
                  <Button variant="secondary" onClick={advanceStatus}>
                    {event.status === 'completed' ? 'שליחת חשבונית' : event.status === 'invoiced' ? 'סימון שולם' : 'קידום שלב'}
                  </Button>
                )}
              </div>
            </div>
            <div className="grid sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-faint uppercase tracking-wide font-semibold mb-1">הסכם מוסכם</div>
                <div className="text-xl font-bold text-ink tabular-nums">{formatMoney(event.agreed_price)}</div>
              </div>
              <div>
                <div className="text-xs text-faint uppercase tracking-wide font-semibold mb-1">נגבה</div>
                <div className="text-xl font-bold text-success tabular-nums">{formatMoney(event.paid_total)}</div>
              </div>
              <div>
                <div className="text-xs text-faint uppercase tracking-wide font-semibold mb-1">יתרה</div>
                <div className={`text-xl font-bold tabular-nums ${event.balance > 0 ? 'text-warn' : 'text-success'}`}>
                  {formatMoney(event.balance)}
                </div>
              </div>
              <div>
                <div className="text-xs text-faint uppercase tracking-wide font-semibold mb-1">חשבונית</div>
                <div className="text-xl font-bold text-ink">{event.invoice_number ?? '—'}</div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-4">פרטי לקוח וסכומים</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="label" htmlFor="biz-client">לקוח</label>
                <select id="biz-client" className="input" value={clientId ?? ''}
                  onChange={e => setClientId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">ללא לקוח</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="biz-agreed">מחיר מוסכם (₪)</label>
                <input id="biz-agreed" type="number" min={0} step="0.01" className="input"
                  value={agreed} onChange={e => setAgreed(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button onClick={saveBusiness} className="w-full">שמירת פרטים</Button>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-4">תשלומים</h3>
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label" htmlFor="pay-amount">סכום (₪)</label>
                <input id="pay-amount" type="number" min={0} step="0.01" className="input"
                  value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="pay-date">תאריך</label>
                <input id="pay-date" type="date" className="input" value={payDate}
                  onChange={e => setPayDate(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button onClick={addPay} disabled={!payAmount || Number(payAmount) <= 0} className="w-full">הוספת תשלום</Button>
              </div>
            </div>
            {event.payments.length === 0 ? (
              <p className="text-faint text-sm">אין תשלומים עדיין.</p>
            ) : (
              <div className="divide-y divide-edge border border-edge rounded-2xl">
                {event.payments.map(p => (
                  <div key={p.id} className="p-3.5 flex justify-between items-center text-sm">
                    <div>
                      <span className="font-medium text-ink tabular-nums">{formatMoney(p.amount)}</span>
                      {p.method && <span className="text-muted ms-2">{p.method}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted">{p.date}</span>
                      <Button variant="ghost" className="!px-2 text-danger" aria-label="מחק תשלום"
                        onClick={async () => { await api.deletePayment(p.id); await load() }}><Icon name="trash" size={16}/></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'readiness' && (
        <div className="space-y-4">
          {readinessLoading && !readiness ? (
            <Loading label="טוען מוכנות לאירוע…" />
          ) : !readiness ? (
            <EmptyState icon={<Icon name="list" size={28}/>} title="אין נתוני מוכנות" hint="וודאו שהאירוע מכיל תפריט ופרטים." />
          ) : (
            <>
              <div className="card p-6">
                <h3 className="font-semibold text-ink mb-4">תחזית רווחיות לאירוע</h3>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <div className="text-xs text-faint uppercase tracking-wide font-semibold mb-1">הכנסה</div>
                    <div className="text-xl font-bold text-ink tabular-nums">{formatMoney(readiness.finance.revenue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-faint uppercase tracking-wide font-semibold mb-1">עלות כוללת</div>
                    <div className="text-xl font-bold text-ink tabular-nums">{formatMoney(readiness.finance.total_cost)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-faint uppercase tracking-wide font-semibold mb-1">רווח משוער</div>
                    <div className={`text-xl font-bold tabular-nums ${(readiness.finance.net ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatMoney(readiness.finance.net)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-faint uppercase tracking-wide font-semibold mb-1">מרווח</div>
                    <div className="text-xl font-bold text-ink tabular-nums">
                      {readiness.finance.margin != null ? `${readiness.finance.margin}%` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-faint uppercase tracking-wide font-semibold mb-1">קניות</div>
                    <div className="text-xl font-bold text-ink tabular-nums">{formatMoney(readiness.shopping_cost)}</div>
                  </div>
                </div>
                {readiness.missing_prices.length > 0 && (
                  <p className="text-xs text-warn mt-3">
                    חסר מחיר עבור: {readiness.missing_prices.slice(0, 5).map(ingredientLabel).join(' · ')}
                  </p>
                )}
              </div>

              <div className="card p-6 space-y-4">
                <h3 className="font-semibold text-ink">תכנון מחיר לפי יעד הרווח שלכם</h3>
                <p className="text-sm text-muted">בחרו שיעור רווח מתוך מחיר המכירה. 30% הוא ערך התחלתי שניתן לשנות; החישוב מבוסס על העלויות שהוזנו בלבד.</p>
                <label className="label" htmlFor="target-margin">יעד רווח (%)</label>
                <input id="target-margin" type="number" min="0" max="99" step="1" className="input max-w-40" value={targetMargin} onChange={e => setTargetMargin(e.target.value)} />
                {!readiness.finance.estimate_complete ? <p className="text-warn">השלימו תפריט ותמחור לכל המצרכים לפני חישוב מחיר היעד.</p> : targetMargin.trim() !== '' && Number(targetMargin) >= 0 && Number(targetMargin) < 100 ? (
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div><p className="text-sm text-muted">מחיר לאיזון</p><strong>{formatMoney(readiness.finance.total_cost, event.currency)}</strong></div>
                    <div><p className="text-sm text-muted">מחיר להשגת היעד</p><strong>{formatMoney(readiness.finance.total_cost / (1 - Number(targetMargin) / 100), event.currency)}</strong></div>
                    <div><p className="text-sm text-muted">מחיר לאורח להשגת היעד</p><strong>{formatMoney(readiness.finance.total_cost / (1 - Number(targetMargin) / 100) / event.total_guests, event.currency)}</strong></div>
                  </div>
                ) : <p className="text-danger" role="alert">הזינו אחוז בין 0 ל־99.</p>}
                <p className="text-sm text-muted">לפני שליחת הצעה, כללו בעלויות הנוספות גם את זמן העבודה שלכם, צוות, נסיעות והשכרת ציוד.</p>
              </div>

              <div className="card p-6">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div>
                    <h3 className="font-semibold text-ink">תוכנית הכנות חכמה</h3>
                    <p className="text-muted text-sm">{readiness.prep.total_hours} שעות הכנה · {readiness.prep.tasks.length} משימות</p>
                  </div>
                  {readiness.prep.recommended_start_date && (
                    <Badge tone="accent">מומלץ להתחיל: {readiness.prep.recommended_start_date}</Badge>
                  )}
                </div>
                {readiness.prep.days.length === 0 ? (
                  <p className="text-faint text-sm">אין משימות הכנה (המתכונים ללא זמן הכנה).</p>
                ) : (
                  <div className="space-y-4">
                    {readiness.prep.days.map(day => (
                      <div key={day.day} className="border border-edge rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-ink text-sm">{day.label}</span>
                          <Badge tone="neutral">{day.hours} שעות</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {day.tasks.map(t => (
                            <Badge key={t.title} tone="accent">{t.title}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="card p-5">
                  <div className="text-xs text-faint uppercase tracking-wide font-semibold mb-1">מנות בתפריט</div>
                  <div className="text-2xl font-bold text-ink tabular-nums">{readiness.menu_count}</div>
                </div>
                <div className="card p-5">
                  <div className="text-xs text-faint uppercase tracking-wide font-semibold mb-1">אזהרות אלרגן</div>
                  <div className="text-2xl font-bold text-ink tabular-nums">{readiness.allergen_warnings}</div>
                </div>
                <div className="card p-5">
                  <div className="text-xs text-faint uppercase tracking-wide font-semibold mb-1">קלוריות (סה"כ)</div>
                  <div className="text-2xl font-bold text-ink tabular-nums">{Math.round(readiness.nutrition_calories)}</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'prep' && (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-semibold text-ink">לוח הכנות</h3>
                <p className="text-muted text-sm">משימות מוצעות מתוזמנות לאחור מהאירוע.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="secondary" onClick={generateSuggestions}>צור משימות מוצעות</Button>
                {plan.prep_suggestions.length > 0 && (
                  <Button variant="secondary" onClick={suggestAll}>הוספת כל ההצעות</Button>
                )}
              </div>
            </div>
            {plan.prep_suggestions.length > 0 && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-faint font-semibold mb-2">מוצע</p>
                <div className="space-y-2">
                  {plan.prep_suggestions.map((s: PrepSuggestion, i) => (
                    <div key={i} className="flex justify-between items-center border border-edge rounded-xl px-4 py-3 text-sm gap-2">
                      <div>
                        <p className="font-medium text-ink">{s.title}</p>
                        <p className="text-xs text-muted">{s.prep_min} דקות · מועד ~{s.due_offset_hours}ש לפני האירוע</p>
                      </div>
                      <Button variant="ghost" className="!px-3 text-success" onClick={suggestAll}>+ הוספה</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-4">משימות ההכנה שלך</h3>
            <div className="flex gap-2 mb-4">
              <input className="input" placeholder="הוסיפו משימה ידנית (למשל: השריית עוף)"
                value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addManualTask()} />
              <Button onClick={addManualTask} disabled={!newTaskTitle.trim()}>הוספה</Button>
            </div>
            {prepTasks.length === 0 ? (
              <p className="text-faint text-sm">אין עדיין משימות.</p>
            ) : (
              <div className="divide-y divide-edge border border-edge rounded-2xl">
                {prepTasks.map(t => (
                  <div key={t.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <input type="checkbox" checked={t.done} onChange={() => toggleTask(t)}
                        className="w-5 h-5 rounded accent-[rgb(var(--accent))]" aria-label={`סמן את ${t.title} כבוצע`} />
                      <div>
                        <p className={`font-medium ${t.done ? 'line-through text-faint' : 'text-ink'}`}>{t.title}</p>
                        <p className="text-xs text-muted">{t.prep_min > 0 ? `${t.prep_min} דקות · ` : ''}מועד {t.due_offset_hours}ש לפני</p>
                      </div>
                    </div>
                    <Button variant="ghost" className="!px-3 text-danger" aria-label="מחק משימה"
                      onClick={async () => { await api.deletePrepTask(t.id); await load() }}><Icon name="trash" size={16}/></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={showSegments} onClose={() => { if (!segSaving) setShowSegments(false) }} title="ניהול קבוצות אורחים" wide>
        <div className="space-y-4">
          <p className="text-sm text-muted">
            סה"כ אורחים באירוע: <b className="text-ink">{event.total_guests}</b>. סכום הקבוצות חייב להיות שווה לסך האורחים.
          </p>
          <div className="space-y-3">
            {segDraft.map((s, i) => (
              <div key={i} className="border border-edge rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid sm:grid-cols-2 gap-3 flex-1">
                    <div>
                      <label className="label" htmlFor={`seg-name-${i}`}>שם הקבוצה</label>
                      <input id={`seg-name-${i}`} className="input" value={s.name}
                        onChange={e => setSegField(i, { name: e.target.value })} />
                    </div>
                    <div>
                      <label className="label" htmlFor={`seg-count-${i}`}>מספר אורחים</label>
                      <input id={`seg-count-${i}`} type="number" min={0} className="input" value={s.guest_count}
                        onChange={e => setSegField(i, { guest_count: Number(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <Button variant="ghost" className="!px-2 text-danger shrink-0" aria-label="הסרת קבוצה"
                    onClick={() => removeSegmentDraft(i)}><Icon name="close" size={15}/></Button>
                </div>
                <div>
                  <p className="label">הגבלות אלרגן</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {allergens.length === 0 ? (
                      <span className="text-faint text-xs">אין הגבלות מוגדרות במערכת.</span>
                    ) : (
                      allergens.map(a => {
                        const active = s.restrictions.includes(a.key)
                        return (
                          <button key={a.key} type="button" onClick={() => toggleSegRestriction(i, a.key)}
                            className={`filter-chip ${active ? 'selected' : ''}`} aria-pressed={active}>
                            {a.label}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={() => setSegDraft(d => [...d, { name: '', guest_count: 0, restrictions: [] }])}>
            + הוספת קבוצה
          </Button>
          {segError && <p role="alert" className="text-danger text-sm">{segError}</p>}
          <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
            <div className="text-sm">
              <span className="text-muted">סיכום:</span>{' '}
              <b className={segmentsSum === event.total_guests ? 'text-success' : 'text-danger'}>{segmentsSum}</b>
              <span className="text-muted"> / {event.total_guests}</span>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" disabled={segSaving} onClick={() => setShowSegments(false)}>ביטול</Button>
              <Button onClick={saveSegments} disabled={segSaving}>{segSaving ? 'שומר…' : 'שמירה'}</Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={archiveTarget} onClose={() => setArchiveTarget(false)}
        title="לאחסן את האירוע בארכיון?" body="הוא יוסתר מהלוח הראשי אך יישמר לצורך מעקב."
        confirmLabel="ארכיון" onConfirm={archiveEvent} />
      <ConfirmDialog open={deleteTarget} onClose={() => setDeleteTarget(false)}
        title="למחוק את האירוע?" body="פעולה זו מוחקת לצמיתות את האירוע, התפריט ומשימות ההכנה."
        onConfirm={async () => { await api.deleteEvent(eventId); nav('/') }} />
    </div>
  )
}

interface SegDraft {
  id?: number
  name: string
  guest_count: number
  restrictions: string[]
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function groupByCategory(lines: EventPlan['shopping_list']): [string, EventPlan['shopping_list']][] {
  const map = new Map<string, EventPlan['shopping_list']>()
  for (const l of lines) {
    const key = l.category || 'אחר'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(l)
  }
  return [...map.entries()]
}
