import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Allergen, Event, GuestSegment, Recipe } from '../lib/types'
import { Button, Loading, FieldError, Badge, ConfirmDialog } from '../components/ui'
import { loadSettings } from '../lib/theme'
import { Icon } from '../components/Icon'
import { recipeLabel } from '../lib/i18n'

interface MenuDraft {
  recipe: Recipe
  segment_id: number | null
  portions: number
}

const STEPS = ['פרטים', 'אורחים', 'תפריט', 'סיכום']

export default function EventWizard() {
  const { id } = useParams()
  const isEdit = !!id
  const nav = useNavigate()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [allergens, setAllergens] = useState<Allergen[]>([])
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [guests, setGuests] = useState(0)
  const [buffer, setBuffer] = useState(0)
  const [otherCosts, setOtherCosts] = useState(0)
  const [tax, setTax] = useState(0)
  const [notes, setNotes] = useState('')

  const [segments, setSegments] = useState<GuestSegment[]>([])
  const [menu, setMenu] = useState<MenuDraft[]>([])
  const [removeTarget, setRemoveTarget] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([api.recipes(), api.allergens()]).then(([r, a]) => {
      setRecipes(r); setAllergens(a)
    })
  }, [])

  useEffect(() => {
    if (!isEdit) {
      const s = loadSettings()
      setBuffer(s.defaultBuffer)
      setTax(s.defaultTax)
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
      setDate(tomorrow)
      return
    }
    let cancelled = false
    Promise.all([api.event(Number(id)), api.recipes()]).then(([e, rs]) => {
      if (cancelled) return
      const map = new Map(rs.map(r => [r.id, r]))
      setName(e.name); setDate(e.date); setLocation(e.location ?? '')
      setGuests(e.total_guests); setBuffer(e.buffer_percent)
      setOtherCosts(e.other_costs); setTax(e.tax_percent); setNotes(e.notes ?? '')
      setSegments(e.segments)
      setMenu(e.menu_items.map(mi => ({
        recipe: map.get(mi.recipe_id)!,
        segment_id: mi.segment_id,
        portions: mi.portions_per_guest,
      })))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [isEdit, id])

  const segSum = useMemo(() => segments.reduce((a, s) => a + s.guest_count, 0), [segments])
  const segError = segments.length
    ? (segSum !== guests
        ? `סה"כ הקבוצות הוא ${segSum}, אבל כמות האורחים באירוע היא ${guests}. הוסיפו או התאימו קבוצות כך שהן מסתכמות.`
        : null)
    : null

  const canNext = useMemo(() => {
    if (step === 0) return name.trim() && date && guests >= 1
    if (step === 1) return !segError
    if (step === 2) return menu.length > 0
    return true
  }, [step, name, date, guests, segError, menu])

  if (loading) return <Loading label="טוען אירוע…" />

  const addSegment = () => {
    setSegments([...segments, { id: -Date.now(), event_id: 0, name: '', guest_count: 0, restrictions: [] }])
  }

  const patchSegment = (i: number, patch: Partial<GuestSegment>) => {
    setSegments(segments.map((s, j) => j === i ? { ...s, ...patch } : s))
  }

  const toggleRestriction = (i: number, key: string) => {
    const s = segments[i]
    const restrictions = s.restrictions.includes(key)
      ? s.restrictions.filter(k => k !== key)
      : [...s.restrictions, key]
    patchSegment(i, { restrictions })
  }

  const addMenuItem = (recipe: Recipe) => {
    if (menu.some(m => m.recipe.id === recipe.id)) return
    setMenu([...menu, { recipe, segment_id: null, portions: 1 }])
  }

  const save = async () => {
    setSaving(true); setError(null)
    try {
      const payload = {
        name, date, location: location || null, total_guests: guests,
        buffer_percent: buffer, other_costs: otherCosts, tax_percent: tax,
        notes: notes || null,
      }
      const event: Event = isEdit
        ? await api.updateEvent(Number(id), payload)
        : await api.createEvent(payload)
      await api.replaceSegments(event.id, segments.map(s => ({
        name: s.name, guest_count: s.guest_count, restrictions: s.restrictions,
      })))
      if (isEdit) {
        const existing = await api.event(event.id)
        for (const mi of existing.menu_items) await api.deleteMenuItem(mi.id)
      }
      for (const m of menu) {
        await api.addMenuItem(event.id, {
          recipe_id: m.recipe.id, segment_id: m.segment_id, portions_per_guest: m.portions,
        })
      }
      nav(`/events/${event.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא ניתן היה לשמור את האירוע')
    } finally {
      setSaving(false)
    }
  }

  const availableRecipes = recipes.filter(r => !menu.some(m => m.recipe.id === r.id))

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <button className="text-sm text-muted hover:text-ink mb-4" onClick={() => nav(isEdit ? `/events/${id}` : '/')}>
        → חזרה
      </button>
      <h1 className="text-2xl font-bold text-ink mb-1">{isEdit ? 'עריכת אירוע' : 'אירוע חדש'}</h1>
      <p className="text-muted mb-6">{STEPS[step]}</p>

      <div className="flex items-center gap-2 mb-8" aria-label={`שלב ${step + 1} מתוך ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <button onClick={() => i < step && setStep(i)} disabled={i > step}
              className={`w-8 h-8 rounded-full grid place-items-center text-sm font-medium transition-colors ${
                i === step ? 'bg-accent text-accent-ink' : i < step ? 'bg-success text-white' : 'bg-surface-2 text-faint'}`}
              aria-current={i === step ? 'step' : undefined}>
              {i < step ? <Icon name="check" size={15}/> : i + 1}
            </button>
            <span className={`text-sm ${i === step ? 'text-ink font-medium' : 'text-faint'} hidden sm:block`}>{s}</span>
            {i < STEPS.length - 1 && <span className="flex-1 h-px bg-edge" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="card p-6 space-y-5">
          <div>
            <label className="label" htmlFor="ev-name">שם האירוע</label>
            <input id="ev-name" className="input" placeholder="למשל: חתונת אנדרסן"
              value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="ev-date">תאריך האירוע</label>
              <input id="ev-date" type="date" className="input" value={date}
                onChange={e => setDate(e.target.value)} />
              <div className="quick-choice" aria-label="בחירת תאריך מהירה"><button type="button" onClick={() => setDate(new Date().toISOString().slice(0, 10))}>היום</button><button type="button" onClick={() => setDate(new Date(Date.now() + 86400000).toISOString().slice(0, 10))}>מחר</button></div>
            </div>
            <div>
              <label className="label" htmlFor="ev-loc">מיקום <span className="text-faint">(אופציונלי)</span></label>
              <input id="ev-loc" className="input" placeholder="למשל: האסם בגבעת היל"
                value={location} onChange={e => setLocation(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="ev-guests">כמות אורחים</label>
            <input id="ev-guests" type="number" min={1} className="input" value={guests || ''}
              placeholder="למשל: 80" onChange={e => setGuests(Math.max(0, Number(e.target.value)))} />
            <div className="quick-choice" aria-label="כמות אורחים מהירה">{[10, 25, 50, 100].map(amount => <button type="button" key={amount} onClick={() => setGuests(amount)}>{amount}</button>)}</div>
          </div>
          <div>
            <label className="label" htmlFor="ev-buffer">אחוז חיץ <span className="text-faint">(רשת ביטחון)</span></label>
            <input id="ev-buffer" type="number" min={0} className="input" value={buffer}
              onChange={e => setBuffer(Number(e.target.value) || 0)} />
            <p className="hint">מוסיף אחוז זה לכמויות כמרחב תכנון.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="ev-other">עלויות אחרות (השכרות, צוות)</label>
              <input id="ev-other" type="number" min={0} step="0.01" className="input" value={otherCosts}
                onChange={e => setOtherCosts(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className="label" htmlFor="ev-tax">מע״מ</label>
              <input id="ev-tax" type="number" min={0} step="0.1" className="input" value={tax}
                onChange={e => setTax(Number(e.target.value) || 0)} />
              <div className="quick-choice" aria-label="בחירת מע״מ מהירה"><button type="button" onClick={() => setTax(18)}>18%</button><button type="button" onClick={() => setTax(0)}>ללא מע״מ</button></div>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="ev-notes">הערות <span className="text-faint">(אופציונלי)</span></label>
            <textarea id="ev-notes" className="input min-h-24 py-3" placeholder="פרטים נוספים…"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="card p-6">
            <p className="text-muted text-sm mb-4">
              חלקו את האורחים לקבוצות (למשל: טבעונים, ילדים) שעשויות להיות להן הגבלות תזונתיות.
              כמות האורחים בכל קבוצה חייבת להסתכם לסך הכולל של <b className="text-ink">{guests}</b>.
              מנות שלא שויכו לקבוצה מוגשות <b className="text-ink">לכל האורחים</b>.
            </p>
            {segments.length === 0 && (
              <p className="text-faint text-sm mb-4">עדיין אין קבוצות — וזה בסדר, הכל מוגש לכולם.</p>
            )}
            {segments.map((s, i) => (
              <div key={s.id} className="border border-edge rounded-2xl p-4 mb-4 space-y-3">
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor={`seg-name-${i}`}>שם הקבוצה</label>
                    <input id={`seg-name-${i}`} className="input" placeholder="למשל: טבעונים"
                      value={s.name} onChange={e => patchSegment(i, { name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`seg-count-${i}`}>אורחים</label>
                    <input id={`seg-count-${i}`} type="number" min={0} className="input"
                      value={s.guest_count || ''} onChange={e => patchSegment(i, { guest_count: Math.max(0, Number(e.target.value)) })} />
                  </div>
                </div>
                <div>
                  <span className="label">הגבלות תזונתיות <span className="text-faint">(אלרגנים)</span></span>
                  <div className="flex flex-wrap gap-2">
                    {allergens.map(a => (
                      <button key={a.key} type="button"
                        onClick={() => toggleRestriction(i, a.key)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                          s.restrictions.includes(a.key)
                            ? 'bg-warn/15 border-warn text-warn'
                            : 'bg-surface border-edge text-muted hover:text-ink'}`}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" className="!px-3 text-danger" onClick={() => setSegments(segments.filter((_, j) => j !== i))}>
                    הסרת קבוצה
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button variant="secondary" onClick={addSegment}>+ הוספת קבוצה</Button>
              {segments.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted">סה"כ: </span>
                  <b className={segError ? 'text-danger' : 'text-success'}>{segSum}</b>
                  <span className="text-muted"> / {guests}</span>
                </div>
              )}
            </div>
            <FieldError message={segError ?? undefined} />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-1">תפריט</h3>
            <p className="text-muted text-sm mb-4">בחרו מתכונים ומי מקבל כל מנה.</p>
            {menu.length === 0 ? (
              <p className="text-faint text-sm">עדיין אין מנות. הוסיפו מתכונים מהספרייה למטה.</p>
            ) : (
              <div className="space-y-3">
                {menu.map((m, i) => (
                  <div key={i} className="border border-edge rounded-2xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{recipeLabel(m.recipe.name)}</p>
                      <p className="text-xs text-muted">
                        {m.recipe.scaling_model === 'batch'
                          ? `אצווה (${m.recipe.people_per_batch}/אצווה)`
                          : m.recipe.scaling_model === 'per_person' ? 'לאדם' : `מגיש ${m.recipe.base_servings}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <select className="input !min-h-10 !w-auto" value={m.segment_id ?? ''}
                        onChange={e => setMenu(menu.map((x, j) => j === i ? { ...x, segment_id: e.target.value ? Number(e.target.value) : null } : x))}>
                        <option value="">כל האורחים</option>
                        {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <label className="flex items-center gap-2 text-sm text-muted">
                        מנות לאורח
                        <input type="number" min={1} className="input !min-h-10 !w-16 !px-2 text-center"
                          value={m.portions} onChange={e => setMenu(menu.map((x, j) => j === i ? { ...x, portions: Math.max(1, Number(e.target.value)) } : x))} />
                      </label>
                      <Button variant="ghost" className="!px-3 text-danger" aria-label="הסרת מנה"
                        onClick={() => setRemoveTarget(i)}><Icon name="trash" size={16}/></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-3">הוספת מנה</h3>
            {availableRecipes.length === 0 ? (
              <p className="text-faint text-sm">כל המתכונים שלך כבר בתפריט.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pe-1">
                {availableRecipes.map(r => (
                  <button key={r.id} type="button" onClick={() => addMenuItem(r)}
                    className="text-left border border-edge rounded-2xl p-4 hover:border-accent hover:shadow-card transition-all">
                    <p className="font-medium text-ink">{recipeLabel(r.name)}</p>
                    <p className="text-xs text-muted mt-0.5">{r.category || 'מתכון'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-ink">סיכום</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted">שם:</span> <b className="text-ink">{name}</b></div>
            <div><span className="text-muted">תאריך:</span> <b className="text-ink">{date}</b></div>
            <div><span className="text-muted">אורחים:</span> <b className="text-ink">{guests}</b></div>
            <div><span className="text-muted">חיץ:</span> <b className="text-ink">{buffer}%</b></div>
          </div>
          {segments.length > 0 && (
            <div>
              <p className="font-medium text-ink mb-2">קבוצות אורחים</p>
              <div className="flex flex-wrap gap-2">
                {segments.map(s => (
                  <Badge key={s.id} tone="accent">{s.name} · {s.guest_count}</Badge>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="font-medium text-ink mb-2">תפריט ({menu.length})</p>
            <div className="space-y-1.5 text-sm">
              {menu.map((m, i) => (
                <div key={i} className="flex justify-between text-muted">
                  <span>{recipeLabel(m.recipe.name)}</span>
                  <span>{m.segment_id ? (segments.find(s => s.id === m.segment_id)?.name) : 'כל האורחים'} · {m.portions}/אורח</span>
                </div>
              ))}
            </div>
          </div>
          {segError && <div className="text-danger text-sm">{segError}</div>}
        </div>
      )}

      {error && <div className="mt-4 text-danger text-sm bg-danger/10 rounded-xl px-4 py-3" role="alert">{error}</div>}

      <div className="flex justify-between mt-8">
        <Button variant="ghost" onClick={() => step === 0 ? nav(isEdit ? `/events/${id}` : '/') : setStep(step - 1)}>
          {step === 0 ? 'ביטול' : 'חזור'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!canNext} onClick={() => setStep(step + 1)}>המשך</Button>
        ) : (
          <Button onClick={save} disabled={saving}>{saving ? 'שומר…' : (isEdit ? 'שמירת שינויים' : 'יצירת אירוע')}</Button>
        )}
      </div>

      <ConfirmDialog open={removeTarget !== null} onClose={() => setRemoveTarget(null)}
        title="להסיר את המנה?" body="היא תוסר מתפריט האירוע."
        onConfirm={() => { if (removeTarget !== null) setMenu(menu.filter((_, i) => i !== removeTarget)) }} />
    </div>
  )
}
