import { useState } from 'react'
import { loadSettings, saveSettings } from '../lib/theme'
import { Button } from './ui'

export function PersonalWelcome() {
  const [personal, setPersonal] = useState(loadSettings)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(personal.chefName)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 18 ? 'צהריים טובים' : 'ערב טוב'
  return <div className="personal-welcome">
    <p className="eyebrow">{new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}{personal.businessName ? ` · ${personal.businessName}` : ''}</p>
    <h1>{greeting}{personal.chefName ? `, ${personal.chefName}` : ''}</h1>
    <p className="text-muted">תמונת העסק שלך, והצעד הבא להיום.</p>
    {editing ? <form className="flex flex-wrap gap-2 mt-3" onSubmit={e => { e.preventDefault(); const updated = { ...loadSettings(), chefName: name.trim() }; saveSettings(updated); setPersonal(updated); setEditing(false) }}>
      <label className="sr-only" htmlFor="welcome-name">איך לקרוא לך?</label><input id="welcome-name" autoFocus maxLength={80} autoComplete="given-name" className="input !w-48" value={name} onChange={e => setName(e.target.value)} placeholder="השם שלך"/><Button type="submit">שמירה</Button><Button variant="ghost" onClick={() => setEditing(false)}>ביטול</Button>
    </form> : <button className="text-sm text-accent mt-2" onClick={() => { setName(personal.chefName); setEditing(true) }}>{personal.chefName ? 'עריכת השם' : 'איך לקרוא לך?'}</button>}
  </div>
}
