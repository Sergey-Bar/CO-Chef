import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Allergen, Ingredient, Recipe } from '../lib/types'
import { Button, EmptyState, Loading, Badge, Modal, ConfirmDialog, FieldError, Spinner } from '../components/ui'
import { CATEGORY_LABELS, CUISINE_LABELS, SCALING_LABELS, SOURCE_LABELS, allergenLabel, cuisineLabel, recipeLabel } from '../lib/i18n'
import { FoodImage } from '../components/FoodImage'
import { Icon } from '../components/Icon'
import { useNavigate } from 'react-router-dom'

interface LineDraft {
  ingredient_id: number | null
  ingredient_name: string
  quantity: number
  unit: string
  resolved: boolean
}

interface RecipeDraft {
  name: string
  description: string
  category: string
  cuisine: string
  scaling_model: 'servings' | 'per_person' | 'batch'
  base_servings: number | null
  people_per_batch: number | null
  allergens: string[]
  prep_time_min: number
  ingredients: LineDraft[]
}

const emptyDraft = (): RecipeDraft => ({
  name: '', description: '', category: '', cuisine: '',
  scaling_model: 'servings', base_servings: 4, people_per_batch: null,
  allergens: [], prep_time_min: 0, ingredients: [newLine()],
})

function newLine(): LineDraft {
  return { ingredient_id: null, ingredient_name: '', quantity: 1, unit: 'g', resolved: false }
}

export default function RecipeLibrary() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [allergens, setAllergens] = useState<Allergen[]>([])
  const [query, setQuery] = useState('')
  const [cuisine, setCuisine] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [draft, setDraft] = useState<RecipeDraft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Recipe | null>(null)

  const load = useCallback(async () => {
    const [r, i, a] = await Promise.all([api.recipes(), api.ingredients(), api.allergens()])
    setRecipes(r); setIngredients(i); setAllergens(a)
  }, [])

  useEffect(() => { load() }, [load])

  const cuisines = useMemo(() => {
    if (!recipes) return []
    const set = new Set<string>()
    recipes.forEach(r => { if (r.cuisine) set.add(r.cuisine) })
    return [...set]
  }, [recipes])

  const filtered = useMemo(() => {
    if (!recipes) return []
    const q = query.trim().toLowerCase()
    return recipes.filter(r => {
      if (cuisine !== 'all' && r.cuisine !== cuisine) return false
      if (!q) return true
      return recipeLabel(r.name).toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
        || (r.category || '').toLowerCase().includes(q)
        || (r.cuisine || '').toLowerCase().includes(q)
    })
  }, [recipes, query, cuisine])

  const openNew = () => { setEditing(null); setDraft(emptyDraft()); setError(null); setModalOpen(true) }

  const openEdit = (r: Recipe) => {
    setEditing(r)
    setDraft({
      name: r.name, description: r.description ?? '', category: r.category ?? '',
      cuisine: r.cuisine ?? '', scaling_model: r.scaling_model,
      base_servings: r.base_servings, people_per_batch: r.people_per_batch,
      allergens: [...r.allergens], prep_time_min: r.prep_time_min,
      ingredients: r.ingredients.map(ri => ({
        ingredient_id: ri.ingredient_id, ingredient_name: ri.ingredient_name ?? '',
        quantity: ri.quantity, unit: ri.unit ?? '', resolved: true,
      })),
    })
    setError(null)
    setModalOpen(true)
  }

  const patch = (p: Partial<RecipeDraft>) => setDraft(d => ({ ...d, ...p }))

  const patchLine = (i: number, p: Partial<LineDraft>) => {
    setDraft(d => ({ ...d, ingredients: d.ingredients.map((l, j) => j === i ? { ...l, ...p } : l) }))
  }

  const resolveIngredient = (text: string): Ingredient | undefined => {
    const t = text.trim().toLowerCase()
    return ingredients.find(i => i.name.toLowerCase() === t
      || (i.aliases || []).some(a => a.toLowerCase() === t))
  }

  const save = async () => {
    setError(null)
    if (!draft.name.trim()) { setError('תנו למתכון שם.'); return }
    const lines = draft.ingredients.filter(l => l.ingredient_name.trim() || l.ingredient_id)
    if (lines.length === 0) { setError('הוסיפו לפחות מצרך אחד.'); return }

    setSaving(true)
    try {
      const resolvedLines: { ingredient_id: number; quantity: number; unit: string }[] = []
      for (const l of lines) {
        let ingId = l.ingredient_id
        if (!ingId) {
          const match = resolveIngredient(l.ingredient_name)
          if (match) { ingId = match.id }
          else {
            const created = await api.createIngredient({ name: l.ingredient_name.trim(), category: 'other' })
            ingId = created.id
          }
        }
        resolvedLines.push({ ingredient_id: ingId!, quantity: l.quantity || 0, unit: l.unit })
      }
      const payload: Partial<Recipe> = {
        name: draft.name, description: draft.description || null,
        category: draft.category || null, cuisine: draft.cuisine || null,
        scaling_model: draft.scaling_model,
        base_servings: draft.scaling_model === 'servings' ? draft.base_servings : null,
        people_per_batch: draft.scaling_model === 'batch' ? draft.people_per_batch : null,
        allergens: draft.allergens, prep_time_min: draft.prep_time_min,
        ingredients: resolvedLines as never,
      }
      if (editing) await api.updateRecipe(editing.id, payload)
      else await api.createRecipe(payload)
      setModalOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא ניתן היה לשמור את המתכון')
    } finally {
      setSaving(false)
    }
  }

  if (!recipes) return <Loading label="טוען מתכונים…" />

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">מתכונים</h1>
          <p className="text-muted">אוסף מתכונים מהעולם — כל אחד מותאם אוטומטית לאירוע שלך.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <input className="input !w-56" placeholder="חיפוש מתכונים…" value={query}
            onChange={e => setQuery(e.target.value)} aria-label="חיפוש מתכונים" />
          <Button variant="secondary" onClick={() => navigate('/menu-studio')}><Icon name="plus" size={16}/>בניית תפריט</Button>
          <Button onClick={openNew}>מתכון חדש</Button>
        </div>
      </div>

      {cuisines.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setCuisine('all')}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${
              cuisine === 'all' ? 'bg-ink text-bg border-ink' : 'bg-surface border-edge text-muted hover:text-ink'}`}>
            הכל
          </button>
          {cuisines.map(c => (
            <button key={c} type="button" onClick={() => setCuisine(cuisine === c ? 'all' : c)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${
                cuisine === c ? 'bg-accent text-accent-ink border-accent' : 'bg-surface border-edge text-muted hover:text-ink'}`}>
              {CUISINE_LABELS[c] ?? c}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={<Icon name="book" size={28}/>} title={query || cuisine !== 'all' ? 'אין מתכונים תואמים' : 'אין עדיין מתכונים'}
          hint={query || cuisine !== 'all' ? 'נסו חיפוש או סינון אחר.' : 'צרו מתכון או ייבאו מאחד מטקסט.'}
          action={!query && cuisine === 'all' ? <Button onClick={openNew}>מתכון חדש</Button> : undefined} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <div key={r.id} className="card recipe-card flex flex-col gap-3 hover:shadow-card-dark hover:-translate-y-0.5 transition-all animate-fade-in">
              <FoodImage name={recipeLabel(r.name)} category={r.category ?? r.cuisine} className="recipe-cover" />
              <div className="recipe-card-body">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-semibold text-ink leading-snug">{recipeLabel(r.name)}</h3>
                </div>
                <Badge tone={r.source === 'builtin' ? 'accent' : r.source === 'imported' ? 'warn' : 'neutral'}>
                  {SOURCE_LABELS[r.source] ?? r.source}
                </Badge>
              </div>
              {r.description && r.source !== 'builtin' && <p className="text-sm text-muted line-clamp-2">{r.description}</p>}
              <div className="flex flex-wrap gap-1.5 text-xs text-muted">
                <Badge>{SCALING_LABELS[r.scaling_model] ?? r.scaling_model}</Badge>
                {r.cuisine && <Badge tone="accent">{cuisineLabel(r.cuisine)}</Badge>}
                {r.category && <Badge>{CATEGORY_LABELS[r.category] ?? r.category}</Badge>}
                {r.prep_time_min > 0 && <Badge>{r.prep_time_min} דקות</Badge>}
              </div>
              {r.allergens.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.allergens.map(a => <Badge key={a} tone="warn">{allergenLabel(a)}</Badge>)}
                </div>
              )}
              <div className="flex gap-2 mt-auto border-t border-edge pt-3">
                <Button variant="subtle" className="flex-1 !py-1.5" onClick={() => openEdit(r)}>עריכה</Button>
                <Button variant="ghost" className="!px-3 text-danger" aria-label="מחק מתכון"
                  onClick={() => setDeleting(r)}><Icon name="trash" size={16}/></Button>
              </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} wide
        title={editing ? 'עריכת מתכון' : 'מתכון חדש'}>
        <div className="space-y-4">
          <div>
            <label className="label">שם המתכון</label>
            <input className="input" value={draft.name} placeholder="למשל: טארט עגבניות קיץ"
              onChange={e => patch({ name: e.target.value })} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">מטבח</label>
              <select className="input" value={draft.cuisine}
                onChange={e => patch({ cuisine: e.target.value })}>
                <option value="">–</option>
                {Object.entries(CUISINE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">קטגוריה</label>
              <input className="input" value={draft.category} placeholder="למשל: עיקרית"
                onChange={e => patch({ category: e.target.value })} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">מודל קנה מידה</label>
              <select className="input" value={draft.scaling_model}
                onChange={e => patch({ scaling_model: e.target.value as RecipeDraft['scaling_model'] })}>
                <option value="servings">לפי מנות (הכמות הבסיסית היא למנה)</option>
                <option value="per_person">לאדם (הכמות היא לכל אורח)</option>
                <option value="batch">לפי סבבים קבועים</option>
              </select>
            </div>
            <div>
              <label className="label">זמן הכנה (דקות)</label>
              <input type="number" min={0} className="input" value={draft.prep_time_min}
                onChange={e => patch({ prep_time_min: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {draft.scaling_model === 'servings' && (
              <div>
                <label className="label">כמות מנות בסיסית</label>
                <input type="number" min={1} className="input" value={draft.base_servings ?? ''}
                  onChange={e => patch({ base_servings: Number(e.target.value) || null })} />
                <p className="hint">הכמויות למטה מספיקות למספר זה של מנות.</p>
              </div>
            )}
            {draft.scaling_model === 'batch' && (
              <div>
                <label className="label">אנשים לאצווה</label>
                <input type="number" min={1} className="input" value={draft.people_per_batch ?? ''}
                  onChange={e => patch({ people_per_batch: Number(e.target.value) || null })} />
                <p className="hint">אצווה אחת מספיקה למספר זה של אנשים.</p>
              </div>
            )}
          </div>
          <div>
            <label className="label">תיאור</label>
            <textarea className="input min-h-20 py-2.5" value={draft.description}
              onChange={e => patch({ description: e.target.value })} />
          </div>
          <div>
            <span className="label">אלרגנים <span className="text-faint">(קנוניים)</span></span>
            <div className="flex flex-wrap gap-2">
              {allergens.map(a => {
                const active = draft.allergens.includes(a.key)
                return (
                  <button key={a.key} type="button" onClick={() => patch({
                    allergens: active ? draft.allergens.filter(k => k !== a.key) : [...draft.allergens, a.key],
                  })}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                      active ? 'bg-warn/15 border-warn text-warn' : 'bg-surface border-edge text-muted hover:text-ink'}`}>
                    {a.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="label !mb-0">מצרכים</span>
              <Button variant="ghost" className="!min-h-9 !px-3 text-sm"
                onClick={() => patch({ ingredients: [...draft.ingredients, newLine()] })}>+ הוספת שורה</Button>
            </div>
            <div className="divide-y divide-edge border border-edge rounded-2xl">
              {draft.ingredients.map((l, i) => (
                <div key={i} className="p-3 flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-40 relative">
                    <input className="input" placeholder="מצרך (שם או כינוי)"
                      value={l.ingredient_name}
                      onChange={e => patchLine(i, { ingredient_name: e.target.value, ingredient_id: null, resolved: false })}
                      onBlur={() => {
                        const m = resolveIngredient(l.ingredient_name)
                        if (m) patchLine(i, { ingredient_id: m.id, ingredient_name: m.name, resolved: true })
                      }} />
                    {l.ingredient_id && l.resolved && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-success font-medium">נמצא</span>
                    )}
                  </div>
                  <input type="number" min={0} step="any" className="input !w-24 text-center" value={l.quantity}
                    onChange={e => patchLine(i, { quantity: Number(e.target.value) || 0 })} />
                  <input className="input !w-24" placeholder="יחידה" value={l.unit}
                    onChange={e => patchLine(i, { unit: e.target.value })} />
                  <Button variant="ghost" className="!px-2.5 text-danger" aria-label="הסרת שורה"
                    onClick={() => patch({ ingredients: draft.ingredients.filter((_, j) => j !== i) })}><Icon name="close" size={15}/></Button>
                </div>
              ))}
            </div>
            <p className="hint">הקלידו שם מצרך או כינוי מוכר. מצרך שלא נמצא ייווצר רק לאחר השמירה.</p>
          </div>

          <FieldError message={error ?? undefined} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>ביטול</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : (editing ? 'שמירת שינויים' : 'יצירת מתכון')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)}
        title="למחוק את המתכון?"
        body={`"${deleting?.name}" יוסר. מתכונים בשימוש באירועים לא יימחקו.`}
        onConfirm={async () => {
          if (deleting) { await api.deleteRecipe(deleting.id); await load() }
        }} />
    </div>
  )
}
