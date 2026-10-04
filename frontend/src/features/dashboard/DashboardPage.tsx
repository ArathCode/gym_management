import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, CreditCard, Package, QrCode, ShoppingCart, UsersRound, WalletCards } from 'lucide-react'
import { Page } from '../../components/ui'
import { membersApi } from '../../services/membersApi'
import { commerceApi } from '../../services/commerceApi'

export function DashboardPage() {
  const [counts, setCounts] = useState<{ members: number; products: number } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([membersApi.list({ page: 1 }), commerceApi.products({ page: 1 })])
      .then(([members, products]) => setCounts({ members: members.meta.total, products: products.meta.total }))
      .catch(() => setError('No fue posible cargar los contadores del backend.'))
  }, [])

  return (
    <Page title="Inicio" description="Panel de operación del gimnasio.">
      {error ? <p className="dashboard-error" role="alert">{error}</p> : null}
      <section className="dashboard-kpis" aria-label="Resumen">
        <article className="dashboard-kpi"><span className="dashboard-kpi-icon"><UsersRound size={20} aria-hidden="true" /></span><div><span>Miembros registrados</span><strong>{counts ? counts.members.toLocaleString() : '—'}</strong></div><Link to="/members" aria-label="Ver miembros"><UsersRound size={17} /></Link></article>
        <article className="dashboard-kpi"><span className="dashboard-kpi-icon"><Package size={20} aria-hidden="true" /></span><div><span>Productos registrados</span><strong>{counts ? counts.products.toLocaleString() : '—'}</strong></div><Link to="/products" aria-label="Ver productos"><Package size={17} /></Link></article>
      </section>
      {!counts && !error ? <p className="dashboard-loading" role="status">Cargando resumen...</p> : null}
      <section className="dashboard-modules">
        <div className="module-section-heading"><div><h2>Operación</h2><p>Accesos rápidos a los módulos del gimnasio.</p></div></div>
        <div className="dashboard-links">
          {[
            ['/members', 'Miembros', 'Socios y credenciales', UsersRound],
            ['/membership-plans', 'Planes de membresía', 'Planes y vigencias', WalletCards],
            ['/payments', 'Pagos', 'Historial financiero', CreditCard],
            ['/access', 'Registrar acceso', 'Control de recepción', QrCode],
            ['/products', 'Productos', 'Catálogo y precios', Package],
            ['/inventory', 'Inventario', 'Existencias y movimientos', Package],
            ['/pos', 'Punto de venta', 'Registrar una venta', ShoppingCart],
            ['/sales', 'Ventas', 'Historial de operaciones', ShoppingCart],
            ['/reports', 'Reportes', 'Resumen del gimnasio', BarChart3],
          ].map(([to, title, description, Icon]) => {
            const ModuleIcon = Icon as typeof UsersRound
            return <Link className="dashboard-link" key={to as string} to={to as string}>
              <span className="dashboard-link-icon"><ModuleIcon size={19} aria-hidden="true" /></span>
              <span><strong>{title as string}</strong><small>{description as string}</small></span>
              <span className="dashboard-link-arrow" aria-hidden="true">›</span>
            </Link>
          })}
        </div>
      </section>
    </Page>
  )
}
