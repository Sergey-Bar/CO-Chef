import type { ReactNode } from 'react'
import { Badge } from './ui'
import { STATUS_LABELS_SINGULAR, statusTone } from '../lib/i18n'

export function KpiCard({ label, value, sub }: {
  label: string
  value: ReactNode
  sub?: ReactNode
}) {
  return (
    <div className="card p-6 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted font-medium">{label}</span>
        <span className="kpi-accent" aria-hidden="true" />
      </div>
      <div className="text-3xl font-semibold text-ink tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SectionCard({ title, action, children, className = '' }: {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`card p-5 sm:p-6 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="font-semibold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export function StatusPill({ status }: { status: string }) {
  if (status === 'archived') return <Badge tone="neutral">{STATUS_LABELS_SINGULAR[status]}</Badge>
  return <Badge tone={statusTone(status)}>{STATUS_LABELS_SINGULAR[status] ?? status}</Badge>
}

export function EmptyRow({ message = 'אין נתונים להצגה' }: { message?: string }) {
  return (
    <div className="text-center text-faint text-sm py-8">{message}</div>
  )
}
