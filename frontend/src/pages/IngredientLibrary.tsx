import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Ingredient, PriceBookEntry, IngredientSubstitutions } from '../lib/types'
import { Button, EmptyState, Loading, Modal, ConfirmDialog, Spinner, FieldError, Badge } from '../components/ui'
import { Icon } from '../components/Icon'
import { CATEGORY_LABELS, formatMoney, ingredientLabel } from '../lib/i18n'
import { FoodImage } from '../components/FoodImage'

interface Draft {
  name: string
  category: string
  aliases: string
  default_unit: string
  cost_per_unit: string
  density: string
}

const toDraft = (i?: Ingredient): Draft => ({
  name: i?.name ?? '',
  category: i?.category ?? '',
  aliases: (i?.aliases ?? []).join(', '),
  default_unit: i?.default_unit ?? '',
  cost_per_unit: i?.cost_per_unit != null ? String(i.cost_per_unit) : '',
  density: i?.density != null ? String(i.density) : '',
})

export default function IngredientLibrary() {
  const [items, setItems] = useState<Ingredient[] | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [notice, setNotice] = useState('')
  const [loadError, setLoadError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [draft, setDraft] = useState<Draft>(toDraft())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Ingredient | null>(null)
  const [priceBook, setPriceBook] = useState<PriceBookEntry[]>([])
  const [subs, setSubs] = useState<IngredientSubstitutions | null>(null)
  const [pbUnit, setPbUnit] = useState('')
  const [pbPrice, setPbPrice] = useState('')
  const [pbDate, setPbDate] = useState('')
  const [pbSupplier, setPbSupplier] = useState('')
  const [pbError, setPbError] = useState('')
  const [pbSaving, setPbSaving] = useState(false)
  const [extrasLoading, setExtrasLoading] = useState(false)

  const load = useCallback(async () => {
    setLoadError('')
    try { setItems(await api.ingredients()) }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'טעינת המצרכים נכשלה') }
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? []).filter(i => (!category || i.category === category)
      && (!missingOnly || i.cost_per_unit == null || !i.default_unit)
      && (!q || [ingredientLabel(i.name), i.name, i.category ?? '', CATEGORY_LABELS[i.category ?? ''] ?? '', ...i.aliases].some(v => v.toLowerCase().includes(q))))
      .sort((a,b) => a.name.localeCompare(b.name, 'he'))
  }, [items, query, category, missingOnly])
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(currentPage * 20, (currentPage + 1) * 20)
  const resetFilters = () => { setQuery(''); setCategory(''); setMissingOnly(false); setPage(0) }
  const priceLabel = (item: Ingredient) => new Intl.NumberFormat('he-IL', {
    style: 'currency', currency: item.currency || 'ILS', minimumFractionDigits: 2, maximumFractionDigits: 4,
  }).format(item.cost_per_unit ?? 0)
  const openNew = () => {
    setEditing(null); setDraft(toDraft()); setError(null); setOpen(true)
    setPriceBook([]); setSubs(null); setPbError('')
  }
  const openEdit = (i: Ingredient) => {
    setEditing(i); setDraft(toDraft(i)); setError(null); setOpen(true)
    setPbError('')
    setExtrasLoading(true)
    Promise.all([api.priceBook(i.id), api.substitutions(i.id)])
      .then(([pb, su]) => { setPriceBook(pb); setSubs(su) })
      .catch(() => { setSubs(null); setPriceBook([]) })
      .finally(() => setExtrasLoading(false))
  }

  const loadPriceBook = async () => {
    if (!editing) return
    setPriceBook(await api.priceBook(editing.id))
  }

  const addPb = async () => {
    if (!editing || pbSaving) return
    const price = Number(pbPrice)
    if (!Number.isFinite(price) || price < 0) { setPbError('הזינו מחיר תקין (מספר חיובי).'); return }
    setPbSaving(true); setPbError('')
    try {
      await api.addPriceBook(editing.id, {
        unit: pbUnit.trim() || null,
        price_per_unit: price,
        effective_date: pbDate || new Date().toISOString().slice(0, 10),
        supplier: pbSupplier.trim() || null,
      })
      setPbUnit(''); setPbPrice(''); setPbSupplier('')
      await loadPriceBook()
    } catch (err) {
      setPbError(err instanceof Error ? err.message : 'לא ניתן היה להוסיף את המחיר')
    } finally {
      setPbSaving(false)
    }
  }
  const save = async () => {
    setError(null)
    if (!draft.name.trim()) { setError('הזינו שם מצרך.'); return }
    const density = draft.density.trim()
    const cost = draft.cost_per_unit.trim()
    if (density && (!Number.isFinite(Number(density)) || Number(density) <= 0)) { setError('הצפיפות חייבת להיות מספר גדול מאפס.'); return }
    if (cost && (!Number.isFinite(Number(cost)) || Number(cost) < 0)) { setError('העלות חייבת להיות מספר חיובי או אפס.'); return }
    const payload: Partial<Ingredient> = {
      name: draft.name.trim(), category: draft.category.trim() || null,
      aliases: draft.aliases.split(',').map(a => a.trim()).filter(Boolean),
      default_unit: draft.default_unit.trim() || null,
      cost_per_unit: cost ? Number(cost) : null, density: density ? Number(density) : null,
    }
    setSaving(true)
    try {
      if (editing) await api.updateIngredient(editing.id, payload)
      else await api.createIngredient(payload)
      setOpen(false)
      setNotice(editing ? 'השינויים נשמרו בהצלחה' : 'המצרך נוסף לספרייה')
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'לא ניתן היה לשמור את המצרך') }
    finally { setSaving(false) }
  }

  if (!items && loadError) return <EmptyState icon={<Icon name="leaf" size={30} />} title="לא הצלחנו לטעון את הספרייה" hint={loadError} action={<Button onClick={() => void load()}>ניסיון נוסף</Button>} />
  if (!items) return <Loading label="טוען את ספריית המצרכים…" />
  const missingCount = items.filter(i => i.cost_per_unit == null || !i.default_unit).length
  const categoryCount = new Set(items.map(i => i.category).filter(Boolean)).size

  return (
    <div className="animate-fade-in">
      <div className="library-heading">
        <div><div className="eyebrow">הבסיס לכל מנה טובה</div><h1>ספריית המצרכים</h1><p className="text-muted">כל חומרי הגלם, המחירים והיחידות. במקום אחד.</p></div>
        <Button onClick={openNew}><Icon name="plus" size={18} />מצרך חדש</Button>
      </div>
      <div className="library-summary" aria-label="סיכום הספרייה">
        <div className="library-metric"><span>מצרכים בספרייה</span><strong>{items.length}</strong></div>
        <div className="library-metric"><span>קטגוריות</span><strong>{categoryCount}</strong></div>
        <div className="library-metric"><span>ממתינים לתמחור</span><strong className={missingCount ? 'text-warn' : ''}>{missingCount}</strong></div>
      </div>
      {notice && <div role="status" className="library-notice"><Icon name="check" size={17}/><span className="flex-1">{notice}</span><button aria-label="סגירת הודעה" onClick={() => setNotice('')}><Icon name="close" size={17}/></button></div>}
      {loadError && <p role="alert" className="text-danger mb-4">{loadError} <button className="underline" onClick={() => void load()}>ניסיון נוסף</button></p>}
      <section className="library-panel" aria-label="רשימת מצרכים">
        <div className="library-tools">
          <div className="search-field"><Icon name="search" size={18}/><input type="search" className="input" placeholder="חיפוש לפי שם או כינוי…" aria-label="חיפוש מצרכים" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} />
          {query && <button className="search-clear" aria-label="ניקוי חיפוש" onClick={() => { setQuery(''); setPage(0) }}><Icon name="close" size={16}/></button>}</div>
          <select className="input filter-select" aria-label="סינון לפי קטגוריה" value={category} onChange={e => { setCategory(e.target.value); setPage(0) }}><option value="">כל הקטגוריות</option>{Object.entries(CATEGORY_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select>
          <button className={`filter-chip ${missingOnly ? 'selected' : ''}`} aria-pressed={missingOnly} onClick={() => { setMissingOnly(v => !v); setPage(0) }}>חסר תמחור <span className="opacity-70">· {missingCount}</span></button>
        </div>
        {filtered.length === 0 ? <EmptyState icon={<Icon name="search" size={32}/>} title={items.length ? 'לא נמצאו מצרכים' : 'הספרייה שלכם מתחילה כאן'} hint={items.length ? 'נסו שם אחר או הסירו את הסינון.' : 'הוסיפו חומר גלם ראשון כדי להתחיל לתמחר את המנות שלכם.'} action={<Button variant="secondary" onClick={items.length ? resetFilters : openNew}>{items.length ? 'ניקוי סינון' : 'הוספת מצרך'}</Button>} /> : <>
        <table className="library-table">
          <caption className="sr-only">מצרכים, קטגוריות ועלות ליחידת רכישה</caption>
          <thead><tr><th scope="col">חומר גלם</th><th scope="col" className="category-column">קטגוריה</th><th scope="col">עלות ליחידה</th><th scope="col"><span className="sr-only">פעולות</span></th></tr></thead>
          <tbody>{visible.map(i => <tr key={i.id}>
            <td><div className="ingredient-name"><FoodImage name={ingredientLabel(i.name)} category={i.category} className="ingredient-photo"/><div><button className="ingredient-title" onClick={() => openEdit(i)}><bdi>{ingredientLabel(i.name)}</bdi></button>{i.aliases.length > 0 && <span className="ingredient-alias">כולל {i.aliases.length} כינויים לחיפוש</span>}</div></div></td>
            <td className="category-column text-muted">{CATEGORY_LABELS[i.category ?? ''] ?? i.category ?? 'ללא קטגוריה'}</td>
            <td>{i.cost_per_unit != null && i.default_unit ? <><span className="font-medium tabular-nums"><bdi>{priceLabel(i)}</bdi></span><div className="unit-label">ל־<bdi>{i.default_unit}</bdi></div></> : <button className="text-warn text-xs underline underline-offset-4" onClick={() => openEdit(i)}>השלמת תמחור</button>}</td>
            <td><div className="row-actions"><Button variant="ghost" aria-label={`עריכת ${i.name}`} onClick={() => openEdit(i)}><Icon name="edit" size={16}/><span className="hidden xl:inline">עריכה</span></Button><Button variant="ghost" className="delete-action text-muted hover:!text-danger" aria-label={`מחיקת ${i.name}`} onClick={() => setDeleting(i)}><Icon name="trash" size={16}/></Button></div></td>
          </tr>)}</tbody>
        </table>
        <div className="library-footer"><span role="status">מציגים {currentPage * 20 + 1}–{Math.min((currentPage + 1) * 20, filtered.length)} מתוך {filtered.length} מצרכים</span><div className="flex items-center gap-2"><Button variant="ghost" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>הקודם</Button><span>{currentPage + 1} / {pageCount}</span><Button variant="ghost" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>הבא</Button></div></div>
        </>}
      </section>
      <p className="library-footnote"><Icon name="chart" size={15}/>מחירים מעודכנים הם הבסיס לתכנון רווחי. אפשר לערוך כל מצרך בלחיצה על שמו.</p>

      <Modal open={open} onClose={() => { if (!saving) setOpen(false) }} title={editing ? 'עריכת מצרך' : 'מצרך חדש'}>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="ingredient-name">שם</label>
            <input id="ingredient-name" className="input" value={draft.name} placeholder="למשל: קמח לבן"
              onChange={e => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="ingredient-category">קטגוריה</label>
              <select id="ingredient-category" className="input" value={draft.category}
                onChange={e => setDraft({ ...draft, category: e.target.value })}>
                <option value="">–</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ingredient-unit">יחידת ברירת מחדל / רכישה</label>
              <input id="ingredient-unit" className="input" value={draft.default_unit} placeholder="גרם, מ״ל, כוס, יחידה"
                onChange={e => setDraft({ ...draft, default_unit: e.target.value })} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="ingredient-cost">עלות ליחידה</label>
              <input id="ingredient-cost" type="number" step="any" min={0} className="input" value={draft.cost_per_unit}
                placeholder="למשל: 0.003" onChange={e => setDraft({ ...draft, cost_per_unit: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="ingredient-density">צפיפות (גרם למ"ל)</label>
              <input id="ingredient-density" type="number" step="any" min={0} className="input" value={draft.density}
                placeholder="למשל: 0.529" onChange={e => setDraft({ ...draft, density: e.target.value })} />
              <p className="hint">מאפשר המרת נפח↔משקל (למשל כוסות → גרם).</p>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="ingredient-aliases">כינויים <span className="text-faint">(מופרדים בפסיקים)</span></label>
            <input id="ingredient-aliases" className="input" value={draft.aliases} placeholder="קמח, קמח חיטה"
              onChange={e => setDraft({ ...draft, aliases: e.target.value })} />
            <p className="hint">שמות חלופיים המשמשים בייבוא ובהקלדת מצרכים.</p>
          </div>
          {editing && (
            <>
              <div className="border-t border-edge pt-4 space-y-3">
                <h4 className="font-semibold text-sm text-ink">החלפות מוצעות</h4>
                {extrasLoading ? (
                  <p className="text-faint text-sm">טוען…</p>
                ) : !subs || subs.substitutions.length === 0 ? (
                  <p className="text-faint text-sm">אין החלפות מוצעות עבור מצרך זה.</p>
                ) : (
                  <div className="space-y-2">
                    {subs.substitutions.map(su => (
                      <div key={su.ingredient_id} className="flex items-center justify-between gap-2 border border-edge rounded-xl px-3 py-2 text-sm">
                        <span className="font-medium text-ink">{su.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {su.group && <Badge tone="accent">קבוצה</Badge>}
                          <span className="text-xs text-muted">{su.reason}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-edge pt-4 space-y-3">
                <h4 className="font-semibold text-sm text-ink">ספר מחירים</h4>
                {priceBook.length === 0 ? (
                  <p className="text-faint text-sm">אין רישומי מחיר עדיין.</p>
                ) : (
                  <div className="divide-y divide-edge border border-edge rounded-2xl">
                    {priceBook.map(p => (
                      <div key={p.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                        <div>
                          <span className="font-medium text-ink tabular-nums">{formatMoney(p.price_per_unit)}</span>
                          {p.unit && <span className="text-muted ms-1">ל־{p.unit}</span>}
                          <div className="text-xs text-muted">{p.effective_date}{p.supplier ? ` · ${p.supplier}` : ''}</div>
                        </div>
                        <Button variant="ghost" className="!px-2 text-danger" aria-label="מחק מחיר"
                          onClick={async () => { await api.deletePriceBook(p.id); await loadPriceBook() }}><Icon name="trash" size={16}/></Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid sm:grid-cols-4 gap-2">
                  <input className="input" placeholder="יחידה" value={pbUnit} onChange={e => setPbUnit(e.target.value)} />
                  <input className="input" type="number" min={0} step="any" placeholder="מחיר ליחידה *"
                    value={pbPrice} onChange={e => setPbPrice(e.target.value)} />
                  <input className="input" type="date" value={pbDate} onChange={e => setPbDate(e.target.value)} />
                  <input className="input" placeholder="ספק" value={pbSupplier} onChange={e => setPbSupplier(e.target.value)} />
                </div>
                {pbError && <p role="alert" className="text-danger text-sm">{pbError}</p>}
                <Button variant="secondary" onClick={addPb} disabled={pbSaving || !pbPrice.trim()}>
                  {pbSaving ? 'מוסיף…' : 'הוספת מחיר'}
                </Button>
              </div>
            </>
          )}
          <FieldError message={error ?? undefined} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" disabled={saving} onClick={() => setOpen(false)}>ביטול</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : (editing ? 'שמירת שינויים' : 'יצירת מצרך')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)}
        title="למחוק את המצרך?" body={`"${deleting?.name}" יוסר מספריית המצרכים. לא ניתן לבטל פעולה זו.`}
        onConfirm={async () => { if (deleting) { await api.deleteIngredient(deleting.id); setNotice('המצרך הוסר מהספרייה'); await load() } }} />
    </div>
  )
}
