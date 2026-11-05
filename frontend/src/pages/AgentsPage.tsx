import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Agent, AgentUpdate } from '../lib/types'
import { Badge, Button, EmptyState, Loading, Modal } from '../components/ui'
import { PageHeader, SectionCard } from '../components/dash'
import { Icon } from '../components/Icon'
import { useToast } from '../components/toast'

const severityTone = { urgent: 'danger', warning: 'warn', opportunity: 'accent', info: 'neutral' } as const
const severityLabel = { urgent: 'דחוף', warning: 'לבדיקה', opportunity: 'הזדמנות', info: 'מידע' }

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null)
  const [updates, setUpdates] = useState<AgentUpdate[] | null>(null)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [provider, setProvider] = useState('')
  const [parentAgentId, setParentAgentId] = useState('')
  const [capabilities, setCapabilities] = useState('')
  const [created, setCreated] = useState<Agent | null>(null)
  const [saving, setSaving] = useState(false)
  const nav = useNavigate()
  const { toast } = useToast()

  const load = useCallback(async () => {
    setError('')
    try {
      const [agentRows, updateRows] = await Promise.all([api.agents(), api.agentUpdates()])
      setAgents(agentRows); setUpdates(updateRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'טעינת הסוכנים נכשלה')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const external = useMemo(() => agents?.filter(a => !a.is_builtin) ?? [], [agents])
  const agentNameById = useMemo(() => new Map(external.map(agent => [agent.id, agent.name])), [external])
  const openCount = updates?.filter(u => u.status === 'new').length ?? 0

  const create = async () => {
    if (!name.trim() || !slug) { toast('יש להזין שם ומזהה לסוכן', 'warn'); return }
    setSaving(true)
    try {
      const agent = await api.createAgent({
        name: name.trim(), slug, provider: provider.trim() || null, parent_agent_id: parentAgentId ? Number(parentAgentId) : null,
        capabilities: capabilities.split(',').map(x => x.trim()).filter(Boolean),
      })
      setCreated(agent); setShowCreate(false); setName(''); setSlug(''); setProvider(''); setParentAgentId(''); setCapabilities('')
      toast('הסוכן נוסף. העתיקו את מפתח הגישה פעם אחת בלבד.', 'success')
      await load()
    } catch (err) { toast(err instanceof Error ? err.message : 'לא ניתן היה להוסיף את הסוכן', 'error') }
    finally { setSaving(false) }
  }

  const setAgentActive = async (agent: Agent) => {
    try {
      await api.updateAgent(agent.id, { active: !agent.active })
      await load()
    } catch (err) { toast(err instanceof Error ? err.message : 'לא ניתן היה לעדכן את הסוכן', 'error') }
  }

  const setUpdateStatus = async (update: AgentUpdate, status: AgentUpdate['status']) => {
    try {
      await api.updateAgentUpdate(update.id, status)
      await load()
    } catch (err) { toast(err instanceof Error ? err.message : 'לא ניתן היה לעדכן', 'error') }
  }

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast('הועתק ללוח', 'success') }
    catch { toast('לא ניתן היה להעתיק. אפשר לסמן ולהעתיק ידנית.', 'warn') }
  }

  if (error) return <EmptyState icon={<Icon name="bot" size={30}/>} title="לא הצלחנו לטעון את מרכז הסוכנים" hint={error} action={<Button onClick={() => void load()}>ניסיון נוסף</Button>} />
  if (!agents || !updates) return <Loading label="טוען את מרכז הסוכנים…" />

  return <div className="space-y-7 animate-fade-in">
    <PageHeader title="סוכני Co‑Chef" subtitle="חיבור פתוח לסוכנים מכל ספק — עם גבולות, שקיפות ואישור אנושי." action={<Button onClick={() => setShowCreate(true)}><Icon name="plus" size={16}/>חיבור סוכן</Button>} />

    <section className="agent-hero">
      <div><p className="eyebrow">מרכז הסוכנים</p><h2>כל סוכן יכול לעבוד לצדך.</h2><p>הסוכן שולח תובנות בלבד. כל שינוי בעסק נשאר אצלך לאישור — עם תובנות שתוכל לפתוח ולטפל בהן.</p></div>
      <div className="agent-hero-count"><strong>{external.length}</strong><span>סוכנים מחוברים</span><small>{openCount ? `${openCount} עדכונים חדשים` : 'הכול שקט'}</small></div>
    </section>

    <SectionCard title="הסוכנים שלך" action={<span className="text-xs text-muted">המפתח נשמר אצלך בלבד</span>}>
      <div className="agent-grid">
        {agents.map(agent => <article key={agent.id} className={`agent-card ${agent.active ? '' : 'is-paused'}`}>
          <div className="flex items-start justify-between gap-3"><span className="agent-avatar"><Icon name={agent.is_builtin ? 'spark' : 'bot'} size={19}/></span><Badge tone={agent.active ? 'success' : 'neutral'}>{agent.active ? 'פעיל' : 'מושהה'}</Badge></div>
          <h3>{agent.name}</h3><p>{agent.provider || 'סוכן חיצוני'}{agent.parent_agent_id ? ` · מדווח אל ${agentNameById.get(agent.parent_agent_id) ?? 'סוכן־מנהל'}` : ''}</p>
          <div className="agent-capabilities">{agent.capabilities.map(cap => <span key={cap}>{cap}</span>)}</div>
          <div className="agent-card-foot"><small>{agent.is_builtin ? 'מחשב תדריך מהנתונים המקומיים' : agent.last_seen_at ? 'דיווח אחרון התקבל' : 'ממתין לחיבור הראשון'}</small>
          {!agent.is_builtin && <Button variant="ghost" className="!min-h-8 !px-2 text-xs" onClick={() => void setAgentActive(agent)}>{agent.active ? 'השהיה' : 'הפעלה'}</Button>}</div>
        </article>)}
      </div>
    </SectionCard>

    <SectionCard title="תיבת העדכונים" action={openCount ? <Badge tone="accent">{openCount} חדשים</Badge> : undefined}>
      {updates.length === 0 ? <EmptyState icon={<Icon name="spark" size={28}/>} title="הסוכנים עדיין לא שלחו עדכונים" hint="חברו סוכן או השתמשו במפתח הגישה כדי לפרסם תובנה ראשונה." /> :
      <div className="agent-feed">{updates.map(update => <article className={`agent-update ${update.status}`} key={update.id}>
        <span className={`agent-update-mark ${update.severity}`} aria-hidden="true" />
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><strong>{update.title}</strong><Badge tone={severityTone[update.severity]}>{severityLabel[update.severity]}</Badge><span className="text-xs text-faint">{update.agent_name}</span></div><p>{update.summary}</p></div>
        <div className="agent-update-actions">{update.href && <Button variant="secondary" className="!min-h-8 !px-2.5 text-xs" onClick={() => nav(update.href!)}>פתיחה</Button>}{update.status === 'new' && <Button variant="ghost" className="!min-h-8 !px-2.5 text-xs" onClick={() => void setUpdateStatus(update, 'acknowledged')}>סימון נקרא</Button>}{update.status !== 'resolved' && <Button variant="ghost" className="!min-h-8 !px-2.5 text-xs" onClick={() => void setUpdateStatus(update, 'resolved')}>סגירה</Button>}</div>
      </article>)}</div>}
    </SectionCard>

    <SectionCard title="חיבור מהיר לכל סוכן">
      <div className="agent-connect"><div><h3>פרוטוקול פתוח ופשוט</h3><p>אחרי יצירת סוכן מתקבל מפתח גישה חד־פעמי. כל מערכת סוכנים יכול לפרסם עדכון באמצעות בקשת HTTP מקומית ומאומתת.</p></div><div className="agent-connect-steps"><span>1. יצירת סוכן</span><span>2. שמירת מפתח</span><span>3. פרסום תובנות</span></div></div>
    </SectionCard>

    <SectionCard title="כך בונים צוות סוכנים שעובד בשבילך">
      <div className="agent-guide-grid"><article><span className="agent-guide-number">01</span><h3>סוכן־מנהל</h3><p>אפשר לשייך אליו סוכנים מומחים. ריכוז העדכונים ותיאום העבודה דורשים הגדרה במערכת הסוכנים החיצונית.</p></article><article><span className="agent-guide-number">02</span><h3>סוכנים מומחים</h3><p>למשל רווחיות, תפריט, מלאי, לקוחות וגבייה. כל אחד מפרסם רק בתחום שלו.</p></article><article><span className="agent-guide-number">03</span><h3>אישור שלך</h3><p>התובנות נכנסות לדשבורד; אתה מחליט אם לפתוח, לסמן, או לבצע שינוי בעסק.</p></article></div>
      <div className="agent-guide-callout"><Icon name="spark" size={17}/><p><strong>המלצה להתחלה:</strong> חבר סוכן־מנהל אחד, ואז צרף אליו 2–3 מומחים. בעת הוספת סוכן בחר “סוכן־מנהל” כדי ליצור היררכיית דיווח.</p></div>
    </SectionCard>

    <SectionCard title="מה אפשר לתת לסוכנים לעשות">
      <div className="agent-use-grid"><article><Icon name="chart" size={18}/><h3>רווחיות</h3><p>לזהות אירוע עם מרווח נמוך, חומר גלם שהתייקר או הצעת מחיר שדורשת בדיקה.</p></article><article><Icon name="calendar" size={18}/><h3>תכנון אירוע</h3><p>לרכז הכנות, אלרגנים וחוסרים לפני האירוע — לעדכון קצר וברור בדשבורד.</p></article><article><Icon name="box" size={18}/><h3>תפעול</h3><p>לסווג ייבוא, להתריע על מלאי, ולעזור להפוך טקסט גולמי לרשימה מסודרת.</p></article><article><Icon name="wallet" size={18}/><h3>אדמיניסטרציה</h3><p>לסמן גבייה שדורשת תשומת לב ותזכורות ניהוליות, בלי לבצע פעולה כספית בעצמו.</p></article></div>
      <p className="agent-safety-note">גבול העבודה: סוכן מפרסם תובנה עם קישור פנימי בלבד. הוא אינו משנה אירועים, מחירים, לקוחות או נתונים כספיים ללא פעולה מפורשת שלך.</p>
    </SectionCard>

    <Modal open={showCreate} onClose={() => !saving && setShowCreate(false)} title="חיבור סוכן חדש">
      <div className="space-y-4"><p className="text-sm text-muted">הסוכן יכול להיות מקומי, n8n, Claude, OpenAI, או מערכת פנימית אחרת. הוא יקבל הרשאה לפרסם עדכונים בלבד.</p>
        <div><label className="label" htmlFor="agent-name">שם הסוכן</label><input id="agent-name" className="input" value={name} placeholder="למשל: שומר הרווחיות" onChange={e => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)) }} /></div>
        <div><label className="label" htmlFor="agent-slug">מזהה טכני</label><input id="agent-slug" className="input" dir="ltr" value={slug} placeholder="profit-guard" onChange={e => setSlug(slugify(e.target.value))} /><p className="text-xs text-faint mt-1">אנגלית קטנה, מספרים ומקפים בלבד.</p></div>
        <div><label className="label" htmlFor="agent-provider">ספק או runtime <span className="text-faint">(אופציונלי)</span></label><input id="agent-provider" className="input" value={provider} placeholder="n8n / OpenAI / Claude / Local" onChange={e => setProvider(e.target.value)} /></div>
        <div><label className="label" htmlFor="agent-parent">סוכן־מנהל <span className="text-faint">(אופציונלי)</span></label><select id="agent-parent" className="input" value={parentAgentId} onChange={e => setParentAgentId(e.target.value)}><option value="">הסוכן עצמאי</option>{external.map(agent => <option value={agent.id} key={agent.id}>{agent.name}</option>)}</select><p className="hint">בחרו סוכן מרכזי אם הסוכן החדש אמור לדווח אליו.</p></div>
        <div><label className="label" htmlFor="agent-capabilities">מה הסוכן עושה <span className="text-faint">(מופרד בפסיקים)</span></label><input id="agent-capabilities" className="input" value={capabilities} placeholder="רווחיות, תמחור, התראות" onChange={e => setCapabilities(e.target.value)} /></div>
        <div className="flex justify-end gap-3 pt-2"><Button variant="ghost" disabled={saving} onClick={() => setShowCreate(false)}>ביטול</Button><Button disabled={saving} onClick={() => void create()}>{saving ? 'יוצר…' : 'יצירת סוכן'}</Button></div>
      </div>
    </Modal>

    <Modal open={!!created} onClose={() => setCreated(null)} title="הסוכן מוכן להתחבר" wide>
      {created && <div className="space-y-4"><p className="text-muted text-sm">שמרו את המפתח עכשיו. מטעמי אבטחה הוא לא יוצג שוב.</p><div className="agent-secret"><code>{created.access_key}</code><Button variant="secondary" onClick={() => void copy(created.access_key ?? '')}>העתקה</Button></div><pre className="agent-code" dir="ltr">{`POST /api/agents/${created.id}/updates\nX-CoChef-Agent-Key: ${created.access_key}\n\n{\n  "severity": "warning",\n  "title": "כותרת תובנה",\n  "summary": "מה נמצא ולמה זה חשוב",\n  "href": "/finance"\n}`}</pre><Button onClick={() => setCreated(null)}>סיימתי</Button></div>}
    </Modal>
  </div>
}
