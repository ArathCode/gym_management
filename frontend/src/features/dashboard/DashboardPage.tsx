import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, Package, QrCode, ShoppingCart, UsersRound, WalletCards } from 'lucide-react'
import { Page } from '../../components/ui'
import { commerceApi } from '../../services/commerceApi'
import type { DashboardSummary } from '../../types/api'
import { formatMoney } from '../../utils/errors'

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toLocaleString('es-MX')}`
const units = { unit: 'unidades', gram: 'g', ml: 'ml' }

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const data = await commerceApi.dashboard()
        if (active) { setSummary(data); setError('') }
      } catch {
        if (active) setError('No fue posible actualizar el resumen del backend.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    const refreshOnFocus = () => { void load() }
    window.addEventListener('focus', refreshOnFocus)
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 30000)
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', refreshOnFocus) }
  }, [])

  const indicators = [
    { label: 'Miembros activos', value: summary?.active_members.toLocaleString(), note: summary ? `${signed(summary.new_active_members_this_week)} nuevos esta semana` : '', to: '/members', Icon: UsersRound },
    { label: 'Planes activos', value: summary?.active_plans.toLocaleString(), note: summary ? `${signed(summary.new_active_plans_this_week)} nuevos esta semana` : '', to: '/membership-plans', Icon: WalletCards },
    { label: 'Ingresos de hoy', value: summary ? formatMoney(summary.income_today.total) : undefined, note: summary ? summary.income_change_percent === null ? 'Sin base de comparación ayer' : `${signed(Number(summary.income_change_percent))}% vs. ayer` : '', to: '/reports?type=payments', Icon: CreditCard },
    { label: 'Visitas de hoy', value: summary?.visits_today.toLocaleString(), note: summary ? `${signed(summary.visits_change)} vs. ayer` : '', to: '/reports?type=attendance', Icon: QrCode },
  ]

  return (
    <Page title="Inicio" description="Panel de operación del gimnasio.">
      {error ? <p className="dashboard-error" role="alert">{error}{summary ? ' Se muestra el último resumen disponible.' : ''}</p> : null}
      <section className="dashboard-kpis" aria-label="Resumen">
        {indicators.map(({ label, value, note, to, Icon }) => <article className="dashboard-kpi" key={label}>
          <span className="dashboard-kpi-icon"><Icon size={20} aria-hidden="true" /></span>
          <div><span>{label}</span><strong>{value ?? '—'}</strong><small className="dashboard-trend">{note}</small></div>
          <Link to={to} aria-label={`Ver ${label.toLowerCase()}`}><Icon size={17} /></Link>
        </article>)}
      </section>
      {loading ? <p className="dashboard-loading" role="status">Cargando resumen...</p> : null}
      {summary ? <p className="dashboard-income-breakdown">Membresías: {formatMoney(summary.income_today.memberships)} · Punto de venta: {formatMoney(summary.income_today.pos)}</p> : null}
      <div className="dashboard-overview">
        <section className="panel-card dashboard-panel" aria-labelledby="recent-access-title">
          <header className="dashboard-panel-heading"><h2 id="recent-access-title">Accesos recientes</h2><Link to="/reports?type=attendance">Ver todos →</Link></header>
          {summary ? summary.recent_visits.length ? <ul className="dashboard-activity-list">
            {summary.recent_visits.map((visit) => <li key={visit.id}>
              <span className="dashboard-member-initials" aria-hidden="true">{visit.member.first_name.charAt(0)}{visit.member.last_name.charAt(0)}</span>
              <Link to={`/members/${visit.member.id}`}>{visit.member.first_name} {visit.member.last_name}</Link>
              <time dateTime={visit.checked_in_at}>{new Intl.DateTimeFormat('es-MX', { timeZone: summary.timezone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(visit.checked_in_at))}</time>
              <span className="status-badge is-active">Entrada</span>
            </li>)}
          </ul> : <p className="empty-state">Todavía no hay accesos registrados.</p> : <p className="empty-state">{loading ? 'Cargando accesos...' : 'Accesos no disponibles.'}</p>}
        </section>
        <section className="panel-card dashboard-panel" aria-labelledby="low-stock-title">
          <header className="dashboard-panel-heading"><h2 id="low-stock-title">Inventario bajo</h2><Link to="/inventory">Ver inventario →</Link></header>
          {summary ? summary.low_stock_products.length ? <><p className="dashboard-stock-count">{summary.low_stock_count} productos con stock bajo</p><ul className="dashboard-stock-list">
            {summary.low_stock_products.map((product) => <li key={product.id}>
              <div><Link to={`/products/${product.id}`}>{product.name}</Link><small>{product.sku} · Mínimo: {product.minimum_stock} {units[product.inventory_unit]}</small></div>
              <strong>{product.stock} <small>{units[product.inventory_unit]}</small></strong>
            </li>)}
          </ul></> : <p className="empty-state">No hay productos con inventario bajo.</p> : <p className="empty-state">{loading ? 'Cargando inventario...' : 'Inventario no disponible.'}</p>}
        </section>
        <section className="panel-card dashboard-panel" aria-labelledby="quick-actions-title">
          <header className="dashboard-panel-heading"><h2 id="quick-actions-title">Acciones rápidas</h2></header>
          <div className="dashboard-quick-actions">
            {[
              { to: '/access', title: 'Registrar acceso', description: 'Escanear la credencial de un miembro', Icon: QrCode },
              { to: '/members', title: 'Nuevo pago', description: 'Seleccionar un miembro y su membresía', Icon: CreditCard },
              { to: '/members/new', title: 'Nuevo miembro', description: 'Dar de alta un nuevo miembro', Icon: UsersRound },
              { to: '/pos', title: 'Punto de venta', description: 'Vender productos del gimnasio', Icon: ShoppingCart },
            ].map(({ to, title, description, Icon }) => <Link className="dashboard-link" key={title} to={to}>
              <span className="dashboard-link-icon"><Icon size={19} aria-hidden="true" /></span>
              <span><strong>{title}</strong><small>{description}</small></span>
              <span className="dashboard-link-arrow" aria-hidden="true">›</span>
            </Link>)}
          </div>
          <Link className="dashboard-inventory-link" to="/products"><Package size={16} aria-hidden="true" /> Catálogo de productos</Link>
        </section>
      </div>
    </Page>
  )
}
