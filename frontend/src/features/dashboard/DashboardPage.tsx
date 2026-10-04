import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
    <Page title="Inicio">
      <p>Panel de operación del gimnasio.</p>
      {error ? <p role="alert">{error}</p> : null}
      {counts ? <p>{counts.members} miembros · {counts.products} productos registrados</p> : <p>Cargando resumen...</p>}
      <div className="dashboard-links">
        {[
          ['/members', 'Miembros'],
          ['/membership-plans', 'Planes de membresía'],
          ['/payments', 'Pagos'],
          ['/access', 'Registrar acceso'],
          ['/products', 'Productos'],
          ['/inventory', 'Inventario'],
          ['/pos', 'Punto de venta'],
          ['/sales', 'Ventas'],
          ['/reports', 'Reportes'],
        ].map(([to, title]) => <Link className="dashboard-link" key={to} to={to}>{title}</Link>)}
      </div>
    </Page>
  )
}
