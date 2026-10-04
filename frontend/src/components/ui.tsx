import type { ReactNode } from 'react'
import type { PageMeta } from '../types/api'

export function Page({
  title,
  description,
  children,
  actions,
}: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="page">
      <header className="page-header">
        <div className="page-heading">
          <h1>{title}</h1>
          {description ? <p className="page-description">{description}</p> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  )
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const statusClass = status.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return <span className={`status-badge status-${statusClass}`}><span aria-hidden="true" />{label ?? status}</span>
}

export function Loading({ label = 'Cargando...' }: { label?: string }) {
  return <p role="status">{label}</p>
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return <p className="error-message" role="alert">{children}</p>
}

export function EmptyState({ children = 'No hay registros.' }: { children?: ReactNode }) {
  return <p className="empty-state">{children}</p>
}

export function Pagination({ meta, onChange }: { meta?: PageMeta; onChange: (page: number) => void }) {
  if (!meta || meta.last_page <= 1) return null
  return (
    <nav className="pagination" aria-label="Paginación">
      <button disabled={meta.current_page <= 1} onClick={() => onChange(meta.current_page - 1)}>Anterior</button>
      <span>Página {meta.current_page} de {meta.last_page} ({meta.total})</span>
      <button disabled={meta.current_page >= meta.last_page} onClick={() => onChange(meta.current_page + 1)}>Siguiente</button>
    </nav>
  )
}

export function FieldError({ children }: { children?: string }) {
  return children ? <small className="field-error">{children}</small> : null
}

export function Table({ children }: { children: ReactNode }) {
  return <div className="table-scroll"><table>{children}</table></div>
}
