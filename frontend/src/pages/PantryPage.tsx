import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Ingredient, PantryHolding } from '../lib/types'
import { Loading, Button, EmptyState, Badge } from '../components/ui'
import { KpiCard, SectionCard } from '../components/dash'
import { CATEGORY_LABELS, ingredientLabel } from '../lib/i18n'
import { Icon } from '../components/Icon'

export default function PantryPage() {
  const [holdings, setHoldings] = useState<PantryHolding[] | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [q, setQ] = useState('')
  const [pickId, setPickId] = useState<number | null>(null)
  const [addQty, setAddQty] = useState('')
  const [edits, setEdits] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
    const [p, i] = await Promise.all([api.pantry(), api.ingredients()])
    setHoldings(p); setIngredients(i)
  }, [])
  useEffect(() => { load() }, [load])

  const held = useMemo(() => new Set((holdings ?? []).map(h => h.ingredient_id)), [holdings])
  const available = useMemo(() => ingredients.filter(i => !held.has(i.id)), [ingredients, held])

  if (!holdings) return <Loading label="טוען מלאי…" />

  const filtered = holdings.filter(h => !q || (`${ingredientLabel(h.name ?? '')} ${h.name ?? ''}`.toLowerCase().includes(q.toLowerCase())))

  const add = async () => {
    if (!pickId) return
    const qty = Number(addQty) || 0
    await api.setPantry(pickId, { quantity: qty })
    setPickId(null); setAddQty('')
    await load()
  }

  const saveEdit = async (id: number, ingredientId: number) => {
    const qty = Number(edits[id]) || 0
    await api.setPantry(ingredientId, { quantity: qty })
    await load()
  }

  const inventoryValue = holdings.reduce((a, h) => a + (h.quantity > 0 ? 1 : 0), 0)
  const totalQty = holdings.reduce((a, h) => a + h.quantity, 0)
  const lowStock = holdings.filter(h => h.quantity > 0 && h.quantity < 5).length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">ניהול מלאי</h1>
          <p className="text-muted">מעקב אחר מה שיש בבית ומה צריך לחדש.</p>
        </div>
      </div>

      {holdings.length > 0 && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="פריטים במעקב" value={holdings.length} />
        <KpiCard label="פריטים זמינים" value={inventoryValue} />
        <KpiCard label="כמות כוללת" value={Math.round(totalQty)} />
        <KpiCard label="מלאי דל" value={lowStock} />
      </div>}

      <SectionCard title="הוספת פריט למלאי">
        {available.length === 0 ? (
          <p className="text-faint text-sm">כל המצרכים כבר במעקב.</p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-1">
              <label className="label" htmlFor="pk-ing">מצרך</label>
              <select id="pk-ing" className="input" value={pickId ?? ''}
                onChange={e => setPickId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">בחירה…</option>
                {available.map(i => <option key={i.id} value={i.id}>{ingredientLabel(i.name)}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pk-qty">כמות</label>
              <input id="pk-qty" type="number" min={0} className="input" value={addQty}
                placeholder="0" onChange={e => setAddQty(e.target.value)} />
            </div>
            <div>
              <Button onClick={add} disabled={!pickId} className="w-full">הוספה למלאי</Button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="מצאי נוכחי">
        <div className="mb-4 max-w-sm">
          <input className="input" placeholder="חיפוש במלאי…" value={q}
            onChange={e => setQ(e.target.value)} />
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<Icon name="box" size={28}/>} title="אין פריטים במלאי"
            hint="הוסיפו מצרכים כדי לעקוב אחר המלאי." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint uppercase tracking-wide">
                  <th className="font-semibold py-2 pe-3">מצרך</th>
                  <th className="font-semibold py-2 pe-3">קטגוריה</th>
                  <th className="font-semibold py-2 pe-3 text-right">כמות</th>
                  <th className="font-semibold py-2 text-right">פעולה</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(h => (
                  <tr key={h.id} className="border-t border-edge">
                    <td className="py-2.5 pe-3 font-medium text-ink">{ingredientLabel(h.name ?? '')}</td>
                    <td className="py-2.5 pe-3">
                      <Badge tone="neutral">{CATEGORY_LABELS[h.category ?? ''] ?? h.category ?? 'אחר'}</Badge>
                    </td>
                    <td className="py-2.5 pe-3">
                      <div className="flex items-center justify-end gap-2">
                        <input type="number" min={0} className="input !w-24 !min-h-10 text-right tabular-nums"
                          value={edits[h.id] ?? String(h.quantity)}
                          onChange={e => setEdits({ ...edits, [h.id]: e.target.value })} />
                        <span className="text-muted text-xs">{h.unit ?? ''}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="subtle" className="!py-1.5 text-xs"
                          onClick={() => saveEdit(h.id, h.ingredient_id)}>שמירה</Button>
                        <Button variant="ghost" className="!px-2 text-danger" aria-label="הסר מהמלאי"
                          onClick={async () => { await api.clearPantry(h.ingredient_id); await load() }}><Icon name="trash" size={16}/></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
