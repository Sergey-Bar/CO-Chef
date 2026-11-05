import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Employee } from '../lib/types'
import { Badge, Button, ConfirmDialog, EmptyState, Loading, Modal, Spinner } from '../components/ui'
import { useToast } from '../components/toast'
import { formatMoney } from '../lib/i18n'
import { Icon } from '../components/Icon'

const EMPTY_FORM = { name: '', role: '', phone: '', email: '', hourly_rate: '', notes: '' }

type FormState = typeof EMPTY_FORM

export default function TeamPage() {
  const [employees, setEmployees] = useState<Employee[] | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [deleting, setDeleting] = useState<Employee | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => { setEmployees(await api.employees()) }, [])
  useEffect(() => { load() }, [load])

  if (!employees) return <Loading label="טוען את הצוות…" />

  const closeModal = () => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(false) }
  const openAdd = () => { setForm(EMPTY_FORM); setEditing(null); setModalOpen(true) }
  const openEdit = (e: Employee) => {
    setEditing(e)
    setModalOpen(true)
    setForm({
      name: e.name, role: e.role ?? '', phone: e.phone ?? '', email: e.email ?? '',
      hourly_rate: e.hourly_rate ? String(e.hourly_rate) : '', notes: e.notes ?? '',
    })
  }

  const save = async () => {
    if (!form.name.trim() || saving) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      role: form.role.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      hourly_rate: Number(form.hourly_rate) || 0,
      notes: form.notes.trim() || null,
    }
    try {
      if (editing) {
        await api.updateEmployee(editing.id, payload)
        toast('פרטי העובד עודכנו', 'success')
      } else {
        await api.createEmployee(payload)
        toast('העובד נוסף לצוות', 'success')
      }
      closeModal()
      await load()
    } finally { setSaving(false) }
  }

  const toggleActive = async (e: Employee) => {
    await api.updateEmployee(e.id, { active: !e.active })
    await load()
  }

  const activeCount = employees.filter(e => e.active).length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">צוות</h1>
          <p className="text-muted">ניהול העובדים, התפקידים ועלויות העבודה.</p>
        </div>
        <Button onClick={openAdd}>+ עובד חדש</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs text-muted font-medium">סה"כ בצוות</p>
          <p className="text-3xl font-semibold text-ink tabular-nums mt-1">{employees.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-muted font-medium">עובדים פעילים</p>
          <p className="text-3xl font-semibold text-ink tabular-nums mt-1">{activeCount}</p>
        </div>
        <div className="card p-5 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted font-medium">עלות שעה ממוצעת</p>
          <p className="text-3xl font-semibold text-ink tabular-nums mt-1">
            {employees.length ? formatMoney(employees.reduce((a, e) => a + e.hourly_rate, 0) / employees.length) : '—'}
          </p>
        </div>
      </div>

      <div className="card p-4 sm:p-6">
        {employees.length === 0 ? (
          <EmptyState icon={<Icon name="people" size={28}/>} title="אין עובדים עדיין"
            hint="הוסיפו את העובדים הראשונים כדי להתחיל לנהל צוות."
            action={<Button onClick={openAdd}>+ עובד חדש</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint uppercase tracking-wide">
                  <th className="font-semibold py-2 pe-3">שם</th>
                  <th className="font-semibold py-2 pe-3">תפקיד</th>
                  <th className="font-semibold py-2 pe-3">יצירת קשר</th>
                  <th className="font-semibold py-2 pe-3 text-right">תעריף שעתי</th>
                  <th className="font-semibold py-2 pe-3">סטטוס</th>
                  <th className="font-semibold py-2 text-right">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(e => (
                  <tr key={e.id} className="border-t border-edge">
                    <td className="py-2.5 pe-3 font-medium text-ink">{e.name}</td>
                    <td className="py-2.5 pe-3 text-muted">{e.role || '—'}</td>
                    <td className="py-2.5 pe-3 text-muted">{e.phone ?? e.email ?? '—'}</td>
                    <td className="py-2.5 pe-3 text-right tabular-nums">{formatMoney(e.hourly_rate)}</td>
                    <td className="py-2.5 pe-3">
                      <button type="button" onClick={() => void toggleActive(e)} aria-pressed={e.active}>
                        <Badge tone={e.active ? 'success' : 'neutral'}>{e.active ? 'פעיל' : 'לא פעיל'}</Badge>
                      </button>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="subtle" className="!py-1.5" onClick={() => openEdit(e)}>עריכה</Button>
                        <Button variant="ghost" className="!px-3 text-danger" aria-label="מחק עובד"
                          onClick={() => setDeleting(e)}><Icon name="trash" size={16}/></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} title={editing ? 'עריכת עובד' : 'עובד חדש'} onClose={closeModal}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="emp-name">שם *</label>
            <input id="emp-name" className="input" value={form.name} autoFocus onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="emp-role">תפקיד</label>
            <input id="emp-role" className="input" value={form.role} placeholder="למשל: טבח, שירות" onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="emp-rate">תעריף שעתי (₪)</label>
            <input id="emp-rate" className="input" type="number" min="0" step="any" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="emp-phone">טלפון</label>
            <input id="emp-phone" className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="emp-email">אימייל</label>
            <input id="emp-email" className="input" dir="ltr" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="emp-notes">הערות</label>
            <textarea id="emp-notes" className="input" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={closeModal}>ביטול</Button>
          <Button onClick={() => void save()} disabled={!form.name.trim() || saving}>
            {saving ? <Spinner className="w-4 h-4" /> : (editing ? 'שמירה' : 'הוספה')}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)}
        title="למחוק את העובד?"
        body={`"${deleting?.name}" יוסר מהצוות.`}
        onConfirm={async () => {
          if (deleting) { await api.deleteEmployee(deleting.id); toast('העובד הוסר', 'success'); await load() }
        }} />
    </div>
  )
}
