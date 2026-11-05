import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon } from './Icon'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

export function Button({ variant = 'primary', className = '', children, type = 'button', ...rest }: ButtonProps) {
  const cls =
    variant === 'primary' ? 'btn-primary'
    : variant === 'secondary' ? 'btn-secondary'
    : variant === 'ghost' ? 'btn-ghost'
    : variant === 'danger' ? 'btn-danger'
    : 'bg-surface border border-edge text-ink hover:bg-surface-2'
  return (
    <button type={type} className={`btn ${cls} ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-accent ${className}`} viewBox="0 0 24 24" fill="none"
      role="status" aria-label="טוען">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export function Loading({ label = 'טוען…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted" role="status">
      <Spinner />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function EmptyState({ icon = <Icon name="list" size={28} />, title, hint, action }: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="card flex flex-col items-center text-center p-10 gap-3 animate-fade-in">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {hint && <p className="text-muted max-w-sm">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function TabBar({ tabs, active, onChange }: {
  tabs: { key: string; label: string; count?: number }[]
  active: string
  onChange: (k: string) => void
}) {
  return (
    <div className="flex w-fit max-w-full overflow-x-auto bg-surface-2 rounded-xl p-1 gap-1" role="tablist"
      aria-label="פילטור" onKeyDown={e => {
        const index = tabs.findIndex(t => t.key === active)
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : e.key === 'ArrowLeft' ? (index + 1) % tabs.length : e.key === 'ArrowRight' ? (index - 1 + tabs.length) % tabs.length : -1
        if (next < 0) return
        e.preventDefault(); onChange(tabs[next].key)
        e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
      }}>
      {tabs.map(t => (
        <button key={t.key} type="button" role="tab" tabIndex={active === t.key ? 0 : -1} aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`tab-btn shrink-0 ${active === t.key
            ? 'bg-surface text-ink shadow-sm'
            : 'text-muted hover:text-ink'}`}>
          {t.label}{t.count !== undefined ? <span className="ml-1.5 text-faint">{t.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Badge({ children, tone = 'neutral' }: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'danger' | 'success' | 'warn'
}) {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    accent: 'bg-accent/10 text-accent',
    danger: 'bg-danger/10 text-danger',
    success: 'bg-success/10 text-success',
    warn: 'bg-warn/10 text-warn',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  wide?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current?.close()
  }, [open])
  return (
    <dialog ref={dialog} className={`app-dialog ${wide ? 'dialog-wide' : ''}`} aria-label={title}
      onCancel={e => { e.preventDefault(); onClose() }}
      onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose() } }}>
      {open && <>
        <div className="px-7 pt-6 pb-5 flex items-center justify-between gap-4 border-b border-edge mb-6">
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="סגירה" className="btn btn-ghost !px-3 text-muted"><Icon name="close" size={18}/></button>
        </div>
        <div className="px-7 pb-7">{children}</div>
      </>}
    </dialog>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = 'מחיקה' }: {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  body?: string
  confirmLabel?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const close = () => { if (!busy) { setError(''); onClose() } }
  const confirm = async () => {
    setBusy(true); setError('')
    try { await onConfirm(); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : 'הפעולה נכשלה. נסו שוב.') }
    finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={close} title={title}>
      {body && <p className="text-muted mb-5 leading-relaxed">{body}</p>}
      {error && <p role="alert" className="text-danger text-sm mb-4">{error}</p>}
      <div className="flex justify-end gap-3">
        <Button variant="ghost" disabled={busy} onClick={close}>ביטול</Button>
        <Button variant="danger" disabled={busy} onClick={() => void confirm()}>{busy ? <Spinner className="w-4 h-4"/> : confirmLabel}</Button>
      </div>
    </Modal>
  )
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="field-error" role="alert">{message}</p>
}


