import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { api } from '../lib/api'
import type { Recipe } from '../lib/types'
import { Badge, Button, EmptyState, Loading } from '../components/ui'
import { FoodImage } from '../components/FoodImage'
import { Icon } from '../components/Icon'
import { recipeLabel } from '../lib/i18n'

const courses = [
  { key: 'פתיחה', label: 'פתיחה', hint: 'מנה קלה שמכניסה לאווירה' },
  { key: 'עיקרית', label: 'עיקריות', hint: 'הלב של הארוחה' },
  { key: 'קינוח', label: 'סיום מתוק', hint: 'זיכרון אחרון מהאירוע' },
]

type Board = Record<string, number[]>
const emptyBoard = (): Board => ({ פתיחה: [], עיקרית: [], קינוח: [] })

export default function MenuStudio() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [board, setBoard] = useState<Board>(() => {
    try { return JSON.parse(localStorage.getItem('cochef-menu-draft') ?? '') as Board }
    catch { return emptyBoard() }
  })
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => { let alive = true; setLoadError(''); api.recipes().then(rows => { if (alive) setRecipes(rows) }).catch(() => { if (alive) setLoadError('לא הצלחנו לטעון את המתכונים. הטיוטה שלך נשמרה ללא שינוי.') }); return () => { alive = false } }, [attempt])
  const selected = useMemo(() => new Set(Object.values(board).flat()), [board])
  const available = useMemo(() => (recipes ?? []).filter(recipe => !selected.has(recipe.id) && `${recipeLabel(recipe.name)} ${recipe.name}`.toLowerCase().includes(query.trim().toLowerCase())), [recipes, query, selected])
  const recipeById = useMemo(() => new Map((recipes ?? []).map(recipe => [recipe.id, recipe])), [recipes])
  const total = selected.size
  const completedCourses = Object.values(board).filter(items => items.length > 0).length
  const completion = Math.round((completedCourses / courses.length) * 100)

  const add = (recipeId: number, course: string) => {
    setBoard(current => {
      const next = Object.fromEntries(Object.entries(current).map(([key, ids]) => [key, ids.filter(id => id !== recipeId)])) as Board
      next[course] = [...(next[course] ?? []), recipeId]
      return next
    })
  }
  const drop = (event: DragEvent, course: string) => {
    event.preventDefault()
    const recipeId = Number(event.dataTransfer.getData('text/recipe-id'))
    if (recipeId) add(recipeId, course)
    setDragging(null)
  }
  const save = () => {
    localStorage.setItem('cochef-menu-draft', JSON.stringify(board))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2200)
  }

  if (loadError) return <div role="alert" className="card p-6 space-y-4"><h1>המתכונים לא נטענו</h1><p>{loadError}</p><Button onClick={() => setAttempt(value => value + 1)}>ניסיון נוסף</Button></div>
  if (!recipes) return <Loading label="פותח את סטודיו התפריט…" />

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="studio-heading">
        <div><p className="eyebrow">בניית תפריט</p><h1>מסלול הארוחה</h1><p>גררו מנות לשלבי הארוחה, או הוסיפו אותן בלחיצה.</p></div>
        <div className="menu-score" aria-label={`${completedCourses} מתוך ${courses.length} שלבים כוללים מנות`}><span>שלבים מוכנים</span><strong>{completedCourses}/{courses.length}</strong><small>{total} מנות</small></div>
      </div>

      <div className="studio-progress" aria-hidden="true"><span style={{ width: `${completion}%` }} /></div>
      <div className="studio-layout">
        <aside className="recipe-tray">
          <div className="section-heading"><div><h2>המנות שלכם</h2><p>בחרו רק מה שמתאים לאירוע הזה</p></div><Badge>{available.length}</Badge></div>
          <div className="search-field mb-4"><Icon name="search" size={17}/><input className="input" value={query} onChange={event => setQuery(event.target.value)} placeholder="חיפוש מנה…" aria-label="חיפוש מנה" /></div>
          <div className="recipe-tray-list">
            {available.map(recipe => <article key={recipe.id} className={`tray-recipe ${dragging === recipe.id ? 'is-dragging' : ''}`} draggable
              onDragStart={event => { event.dataTransfer.setData('text/recipe-id', String(recipe.id)); setDragging(recipe.id) }} onDragEnd={() => setDragging(null)}>
              <FoodImage name={recipeLabel(recipe.name)} category={recipe.category ?? recipe.cuisine} />
              <div className="min-w-0"><strong>{recipeLabel(recipe.name)}</strong><span>{recipe.prep_time_min ? `${recipe.prep_time_min} דקות` : 'זמן הכנה לא הוגדר'}</span></div>
              <details className="quick-place"><summary aria-label={`הוספת ${recipeLabel(recipe.name)} לתפריט`}><Icon name="plus" size={16}/></summary><div>{courses.map(course => <button key={course.key} onClick={() => add(recipe.id, course.key)}>{course.label}</button>)}</div></details>
            </article>)}
            {available.length === 0 && <p className="text-sm text-muted text-center py-8">כל המנות המתאימות כבר בתפריט.</p>}
          </div>
        </aside>

        <section className="menu-board" aria-label="מסלול הארוחה">
          {courses.map((course, index) => <div key={course.key} className="course-lane" onDragOver={event => event.preventDefault()} onDrop={event => drop(event, course.key)}>
            <header><span className="course-number">0{index + 1}</span><div><h2>{course.label}</h2><p>{course.hint}</p></div><Badge>{board[course.key]?.length ?? 0}</Badge></header>
            <div className={`course-dropzone ${dragging ? 'is-ready' : ''}`}>
              {(board[course.key] ?? []).map(id => { const recipe = recipeById.get(id); return recipe ? <article className="selected-dish" key={id} draggable
                onDragStart={event => { event.dataTransfer.setData('text/recipe-id', String(id)); setDragging(id) }} onDragEnd={() => setDragging(null)}>
                <FoodImage name={recipeLabel(recipe.name)} category={recipe.category ?? recipe.cuisine}/><div><strong>{recipeLabel(recipe.name)}</strong><span>{recipe.allergens.length ? `${recipe.allergens.length} אלרגנים מסומנים` : 'ללא אלרגנים מסומנים'}</span></div><button onClick={() => setBoard(current => ({ ...current, [course.key]: current[course.key].filter(item => item !== id) }))} aria-label={`הסרת ${recipeLabel(recipe.name)}`}><Icon name="close" size={15}/></button>
              </article> : null })}
              {(board[course.key]?.length ?? 0) === 0 && <div className="drop-hint"><Icon name="plus"/><span>גררו לכאן מנה</span></div>}
            </div>
          </div>)}
        </section>
      </div>
      <div className="studio-actions"><div><strong>{completedCourses === courses.length ? 'כל שלבי הארוחה מוכנים' : `${courses.length - completedCourses} שלבים עדיין ריקים`}</strong><span>הטיוטה נשמרת במחשב הזה בלבד.</span></div><Button variant="secondary" onClick={() => setBoard(emptyBoard())}>ניקוי</Button><Button onClick={save}>{saved ? 'הטיוטה נשמרה' : 'שמירת טיוטה'}</Button></div>
      {recipes.length === 0 && <EmptyState title="עדיין אין מנות בסטודיו" hint="הוסיפו או ייבאו מתכון, ואז חזרו לבנות תפריט." />}
    </div>
  )
}
