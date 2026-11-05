import { useEffect, useState } from 'react'
import { Button, Spinner } from '../components/ui'
import { loadSettings, saveSettings, useTheme, type ThemePreference } from '../lib/theme'
import { Icon } from '../components/Icon'
import { api } from '../lib/api'
import { useToast } from '../components/toast'

export default function SettingsPage() {
  const { preference, setPreference } = useTheme()
  const initial = loadSettings()
  const [buffer, setBuffer] = useState(String(initial.defaultBuffer))
  const [tax, setTax] = useState(String(initial.defaultTax))
  const [vatCycle, setVatCycle] = useState(initial.vatReportCycle)
  const [annualReviewMonth, setAnnualReviewMonth] = useState(String(initial.annualReviewMonth))
  const [chefName, setChefName] = useState(initial.chefName)
  const [businessName, setBusinessName] = useState(initial.businessName)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [telegramEnabled, setTelegramEnabled] = useState(false)
  const [telegramConfigured, setTelegramConfigured] = useState(false)
  const [telegramSaving, setTelegramSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => { api.telegramSettings().then(settings => {
    setTelegramChatId(settings.chat_id); setTelegramEnabled(settings.enabled); setTelegramConfigured(settings.configured)
  }).catch(() => setError('לא הצלחנו לבדוק את חיבור Telegram. רעננו את העמוד לפני שינוי פרטי החיבור.')) }, [])

  const applyDefaults = () => {
    if (!Number.isFinite(Number(tax)) || Number(tax) < 0 || Number(tax) > 100 || Number(buffer) < 0 || Number(buffer) > 100) { setError('מע״מ וחיץ חייבים להיות בין 0 ל־100'); return }
    setError('')
    saveSettings({ defaultBuffer: Number(buffer) || 0, defaultTax: tax.trim() === '' ? 18 : Number(tax), vatReportCycle: vatCycle, annualReviewMonth: Number(annualReviewMonth) || 12, chefName: chefName.trim(), businessName: businessName.trim() })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2200)
  }

  const exportBackup = async () => {
    setExporting(true)
    setError('')
    try {
      const response = await fetch('/api/backup')
      if (!response.ok) throw new Error('הורדת הגיבוי נכשלה')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `private-chef-backup-${new Date().toISOString().slice(0, 10)}.db`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'הורדת הגיבוי נכשלה')
    } finally {
      setExporting(false)
    }
  }

  const saveTelegram = async () => {
    setTelegramSaving(true)
    try {
      const savedTelegram = await api.saveTelegramSettings({ bot_token: telegramToken || undefined, chat_id: telegramChatId, enabled: telegramEnabled })
      setTelegramConfigured(savedTelegram.configured); setTelegramToken('')
      toast('חיבור Telegram נשמר במחשב הזה.', 'success')
    } catch (err) { toast(err instanceof Error ? err.message : 'לא ניתן לשמור את החיבור', 'error') }
    finally { setTelegramSaving(false) }
  }

  const testTelegram = async () => {
    setTelegramSaving(true)
    try { await api.testTelegram(); toast('נשלחה הודעת בדיקה ל־Telegram.', 'success') }
    catch (err) { toast(err instanceof Error ? err.message : 'לא ניתן היה לשלוח הודעת בדיקה', 'error') }
    finally { setTelegramSaving(false) }
  }

  const themeOptions: { key: ThemePreference; label: string }[] = [
    { key: 'auto', label: 'אוטומטי' },
    { key: 'light', label: 'בהיר' },
    { key: 'dark', label: 'כהה' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {error && <p role="alert" className="text-danger">{error}</p>}
      <div>
        <h1 className="text-2xl font-bold text-ink">הגדרות</h1>
        <p className="text-muted mt-1">העדפות אישיות, ברירות מחדל וגיבוי מקומי.</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5"><span className="settings-icon"><Icon name="user" size={19}/></span><div><h3 className="font-semibold text-ink">המרחב שלי</h3><p className="text-xs text-muted mt-1">השם ישמש לברכה האישית בלבד.</p></div></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label" htmlFor="chef-name">השם שלך</label><input id="chef-name" className="input" value={chefName} onChange={e => setChefName(e.target.value)} placeholder="למשל: נועה" autoComplete="name" /></div>
          <div><label className="label" htmlFor="business-name">שם העסק</label><input id="business-name" className="input" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="למשל: המטבח של נועה" /></div>
        </div>
        <div className="flex justify-end mt-4"><Button variant="secondary" onClick={applyDefaults}>{saved ? 'הפרטים נשמרו' : 'שמירת פרטים'}</Button></div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-3"><span className="settings-icon"><Icon name="mail" size={19}/></span><div><h3 className="font-semibold text-ink">Telegram — התראות שקטות</h3><p className="text-xs text-muted mt-1">שלחו לעצמכם תזכורות רווחיות ומוכנות אירוע בלי להעמיס על הדשבורד.</p></div></div>
        <ol className="telegram-steps"><li>צרו בוט ב־BotFather וקבלו מפתח בוט.</li><li>פתחו שיחה עם הבוט, ושלחו לו הודעה אחת.</li><li>הזינו כאן את מזהה הצ׳אט והפעילו את החיבור.</li></ol>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div><label className="label" htmlFor="telegram-token">מפתח בוט {telegramConfigured && <span className="text-success">· נשמר</span>}</label><input id="telegram-token" type="password" autoComplete="off" className="input" value={telegramToken} placeholder={telegramConfigured ? 'השאירו ריק כדי לשמור את הקיים' : '123456:ABC…'} onChange={e => setTelegramToken(e.target.value)} /><p className="hint">נשמר מקומית בלבד ולא מוצג שוב.</p></div>
          <div><label className="label" htmlFor="telegram-chat">מזהה צ׳אט</label><input id="telegram-chat" dir="ltr" className="input" value={telegramChatId} placeholder="למשל: 123456789" onChange={e => setTelegramChatId(e.target.value)} /></div>
        </div>
        <label className="telegram-toggle"><input type="checkbox" checked={telegramEnabled} onChange={e => setTelegramEnabled(e.target.checked)} /> <span><strong>הפעלת התראות Telegram</strong><small>כרגע החיבור שולח רק בדיקת חיבור ידנית — ללא הודעות אוטומטיות.</small></span></label>
        <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" disabled={telegramSaving} onClick={() => void saveTelegram()}>{telegramSaving ? <Spinner className="h-4 w-4"/> : 'שמירת חיבור'}</Button><Button disabled={telegramSaving || !telegramConfigured} onClick={() => void testTelegram()}>שליחת בדיקה</Button></div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-ink mb-4">מראה</h3>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="font-medium text-ink">ערכת נושא</p>
            <p className="text-muted text-sm">עקבו אחרי המכשיר או בחרו מראה קבוע.</p>
          </div>
          <div className="inline-flex bg-surface-2 rounded-full p-1 gap-1">
            {themeOptions.map(o => (
              <button key={o.key} type="button" onClick={() => setPreference(o.key)}
                className={`tab-btn ${preference === o.key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5"><span className="settings-icon"><Icon name="wallet" size={19}/></span><div><h3 className="font-semibold text-ink">ברירות מחדל לאירועים חדשים</h3><p className="text-xs text-muted mt-1">שומרות על תמחור עקבי, בלי להקליד שוב את אותם פרטים.</p></div></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">אחוז חיץ כברירת מחדל</label>
            <input type="number" min={0} className="input" value={buffer}
              onChange={e => setBuffer(e.target.value)} />
            <p className="hint">מתווסף לכמויות כמרחב ביטחון.</p>
          </div>
          <div>
            <label className="label">מע״מ כברירת מחדל</label>
            <input type="number" min={0} step="0.1" className="input" value={tax}
              onChange={e => setTax(e.target.value)} />
            <p className="hint">18% היא ברירת המחדל בישראל מאז 1.1.2025; אפשר לשנות לפי רו״ח או סוג העסקה.</p>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={applyDefaults}>{saved ? 'ברירות המחדל נשמרו' : 'שמירת ברירות מחדל'}</Button>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5"><span className="settings-icon"><Icon name="clock" size={19}/></span><div><h3 className="font-semibold text-ink">שגרת מס ותזכורות</h3><p className="text-xs text-muted mt-1">תכנון ניהולי אישי — לא תחליף לייעוץ חשבונאי או למועדי רשות המסים.</p></div></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label" htmlFor="vat-cycle">מחזור דיווח מע״מ</label><select id="vat-cycle" className="input" value={vatCycle} onChange={e => setVatCycle(e.target.value as 'monthly' | 'bimonthly')}><option value="monthly">חודשי</option><option value="bimonthly">דו־חודשי</option></select><p className="hint">בחרו לפי הסיווג שנקבע לעסק שלכם.</p></div>
          <div><label className="label" htmlFor="annual-review">חודש בדיקה שנתית</label><select id="annual-review" className="input" value={annualReviewMonth} onChange={e => setAnnualReviewMonth(e.target.value)}>{['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'].map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select><p className="hint">לריכוז מסמכים, הוצאות מוכרות ובדיקת החזר מס.</p></div>
        </div>
        <div className="flex justify-end mt-4"><Button onClick={applyDefaults}>{saved ? 'שגרת המס נשמרה' : 'שמירת שגרת מס'}</Button></div>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-ink mb-4">נתונים וגיבוי</h3>
        <p className="text-muted text-sm mb-4">
          הנתונים שלכם נשמרים בקובץ מקומי במחשב. הורידו קובץ גיבוי כדי לשמור עותק בטוח.
        </p>
        <Button variant="secondary" onClick={exportBackup} disabled={exporting}>
          {exporting ? <Spinner className="h-4 w-4" /> : 'הורדת גיבוי'}
        </Button>
      </div>
    </div>
  )
}
