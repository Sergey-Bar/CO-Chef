import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Ingredient, IntakeClassification, ParsedImport, ParsedImportLine } from '../lib/types'
import { Button, FieldError, Spinner, Badge } from '../components/ui'
import { ingredientLabel } from '../lib/i18n'

export default function ImportPage() {
  const nav = useNavigate()
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [classification, setClassification] = useState<IntakeClassification | null>(null)

  useEffect(() => { api.ingredients().then(setIngredients) }, [])

  const uploadFile = async (file: File) => {
    setError(null); setUploading(true)
    try {
      const res = await api.uploadImport(file)
      setText(res.text)
      setClassification(res.classification)
      setParsed(res.parsed)
      if (res.parsed) setName(res.parsed.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא ניתן היה לקרוא את הקובץ')
    } finally {
      setUploading(false)
    }
  }

  const doParse = async () => {
    setError(null); setBusy(true)
    try {
      const detected = await api.classifyImport(text)
      setClassification(detected)
      if (detected.kind === 'recipe') {
        const p = await api.parseImport(text)
        setParsed(p)
        setName(p.name)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא ניתן היה לנתח את הטקסט')
    } finally {
      setBusy(false)
    }
  }

  const saveClassified = async () => {
    if (!classification) return
    setSaving(true); setError(null)
    try {
      if (classification.kind === 'event') {
        await api.createLead({ kind: 'lead', title: classification.title, preferred_date: classification.fields.date, guest_estimate: classification.fields.guests, amount: classification.fields.amount ?? 0, status: 'new', notes: text })
        nav('/work')
      } else if (classification.kind === 'client') {
        await api.createClient({ name: classification.title.replace(/^לקוח(?:ה)?(?: חדש(?:ה)?)?[:\s-]*/i, '') || 'לקוח חדש', phone: classification.fields.phone, email: classification.fields.email, notes: text })
        nav('/clients')
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'לא ניתן היה לשמור את המידע') }
    finally { setSaving(false) }
  }

  const match = (line: ParsedImportLine): Ingredient | undefined => {
    const t = (line.ingredient || '').trim().toLowerCase()
    return ingredients.find(i => i.name.toLowerCase() === t
      || (i.aliases || []).some(a => a.toLowerCase() === t))
  }

  const patchLine = (i: number, patch: Partial<ParsedImportLine>) => {
    if (!parsed) return
    setParsed({ ...parsed, ingredients: parsed.ingredients.map((l, j) => j === i ? { ...l, ...patch } : l) })
  }

  const confirm = async () => {
    if (!parsed) return
    setSaving(true); setError(null)
    try {
      const items = parsed.ingredients
        .filter(l => l.ok && l.ingredient)
        .map(l => ({
          ingredient: (l.ingredient || '').trim(),
          quantity: l.quantity ?? 1,
          unit: l.unit ?? null,
        }))
      if (items.length === 0) { setError('אין מצרכים שנותחו לשמירה.'); return }
      await api.confirmImport({ name: name.trim() || 'מתכון מיובא', ingredients: items })
      nav('/recipes')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא ניתן היה לשמור את המתכון המיובא')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink">ייבוא חכם</h1>
        <p className="text-muted mt-1">זרקו לכאן קובץ או הדביקו טקסט. המערכת המקומית תחלץ ותסדר את המידע לפני השמירה.</p>
      </div>

      {!parsed && !classification ? (
        <>
        <div className={`card import-dropzone ${dragging ? 'is-dragging' : ''}`}
          onDragOver={event => { event.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void uploadFile(file) }}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <h3 className="font-semibold text-ink">גררו קובץ לכאן</h3>
              <p className="text-muted text-sm">פי־די־אף, וורד, טקסט או קובץ מגוגל דוקס.</p>
            </div>
            <label className="btn btn-secondary">
              {uploading ? <Spinner className="h-4 w-4" /> : 'בחירת קובץ מהמחשב'}
              <input type="file" accept=".txt,.md,.docx,.pdf,.rtf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.target.value = '' }} />
            </label>
          </div>
        </div>

        <div className="card p-6">
          <label className="label" htmlFor="paste">טקסט המתכון</label>
          <textarea id="paste" className="input min-h-56 py-3 text-sm"
            placeholder={'פסטה לימונית\n500 גרם פסטה\n2 לימונים\n250 מ״ל שמנת\nמלח ופלפל'}
            value={text} onChange={e => setText(e.target.value)} />
          <div className="import-assurances"><span>עובד גם בלי חיבור לאינטרנט</span><span>שום דבר לא נשמר לפני אישור</span><span>אפשר לתקן כל שדה</span></div>
          <div className="flex justify-end mt-4">
            <Button onClick={doParse} disabled={busy || !text.trim()}>
              {busy ? <Spinner className="h-4 w-4" /> : 'סידור הטקסט'}
            </Button>
          </div>
        </div>
        </>
      ) : classification && classification.kind !== 'recipe' ? (
        <div className="card p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div><p className="eyebrow">המערכת זיהתה</p><h2 className="text-xl font-semibold">{classification.label}</h2><p className="text-sm text-muted mt-2">{classification.title}</p></div>
            <Badge tone="success">{Math.round(classification.confidence * 100)}% התאמה</Badge>
          </div>
          <div className="classification-grid">
            {classification.fields.date && <div><span>תאריך</span><strong>{classification.fields.date}</strong></div>}
            {classification.fields.guests && <div><span>אורחים</span><strong>{classification.fields.guests}</strong></div>}
            {classification.fields.amount && <div><span>סכום</span><strong>₪{classification.fields.amount.toLocaleString('he-IL')}</strong></div>}
            {classification.fields.phone && <div><span>טלפון</span><strong><bdi>{classification.fields.phone}</bdi></strong></div>}
            {classification.fields.email && <div><span>דוא״ל</span><strong><bdi>{classification.fields.email}</bdi></strong></div>}
          </div>
          {classification.kind === 'inventory' && <p className="text-sm text-muted">זיהינו רשימת מלאי או רכישה. בשלב הבא נחבר את השורות ישירות לעדכון הכמויות; כרגע אפשר לעבור למלאי ולבדוק אותן.</p>}
          {classification.kind === 'note' && <p className="text-sm text-muted">הטקסט לא נראה כמו מתכון, פנייה, לקוח או רשימת מלאי. הוא לא יישמר אוטומטית כדי שלא ייכנס למקום הלא נכון.</p>}
          <FieldError message={error ?? undefined}/>
          <div className="flex justify-end gap-3 flex-wrap">
            <Button variant="ghost" onClick={() => setClassification(null)}>תיקון הטקסט</Button>
            {(classification.kind === 'event' || classification.kind === 'client') && <Button onClick={saveClassified} disabled={saving}>{saving ? <Spinner className="h-4 w-4"/> : classification.kind === 'event' ? 'שמירה כפנייה חדשה' : 'שמירה כלקוח חדש'}</Button>}
            {classification.kind === 'inventory' && <Button onClick={() => nav('/pantry')}>מעבר למלאי</Button>}
          </div>
        </div>
      ) : parsed ? (
        <div className="space-y-4">
          <div className="card p-6">
            <label className="label">שם המתכון</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="font-semibold text-ink">בדיקה קצרה לפני שמירה</h3><p className="text-xs text-muted mt-1">עברו רק על השורות הצהובות. השאר כבר מסודר.</p></div>
              <Button variant="ghost" className="!min-h-9 !px-3 text-sm" onClick={() => { setParsed(null); setText('') }}>
                התחלה מחדש
              </Button>
            </div>
            <div className="divide-y divide-edge border border-edge rounded-2xl">
              {parsed.ingredients.map((l, i) => {
                const m = match(l)
                return (
                  <div key={i} className="p-3.5 flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="number" step="any" min={0} className="input !w-24 text-center"
                        value={l.quantity ?? ''} onChange={e => patchLine(i, { quantity: Number(e.target.value) || 0 })} />
                      <input className="input !w-24" placeholder="יחידה" value={l.unit ?? ''}
                        onChange={e => patchLine(i, { unit: e.target.value })} />
                      <div className="flex-1 min-w-44 relative">
                        <input className="input" list="ingredient-options" placeholder="שם מצרך או כינוי"
                          value={l.ingredient ?? ''} onChange={e => patchLine(i, { ingredient: e.target.value })} />
                        <datalist id="ingredient-options">
                          {ingredients.map(ig => (
                            <option key={ig.id} value={ig.name}>{ingredientLabel(ig.name)}</option>
                          ))}
                          {ingredients.flatMap(ig => (ig.aliases || []).map(a => <option key={ig.id + a} value={a} />))}
                        </datalist>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {m ? (
                        <Badge tone="success">יותאם ל: {ingredientLabel(m.name)}</Badge>
                      ) : l.ok ? (
                        <Badge tone="warn">ייווצר כמצרך חדש</Badge>
                      ) : (
                        <Badge tone="danger">{l.error || 'נדרשת בדיקה'}</Badge>
                      )}
                      {!l.ok && (
                        <span className="text-xs text-muted">השורה לא נותחה אוטומטית — ערכו את השדות למעלה.</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <FieldError message={error ?? undefined} />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setParsed(null)}>חזור</Button>
            <Button onClick={confirm} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : 'שמירת מתכון מיובא'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
