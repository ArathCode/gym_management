import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/useAuth'
import { getErrorMessage } from '../utils/errors'

const links = [
  ['/', 'Inicio'],
  ['/members', 'Miembros'],
  ['/membership-plans', 'Planes'],
  ['/payments', 'Pagos'],
  ['/access', 'Accesos'],
  ['/products', 'Productos'],
  ['/inventory', 'Inventario'],
  ['/pos', 'Punto de venta'],
  ['/sales', 'Ventas'],
  ['/reports', 'Reportes'],
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (logoutError) {
      navigate('/login', {
        replace: true,
        state: { message: getErrorMessage(logoutError, 'No se pudo invalidar el token en el servidor.') },
      })
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/">Gym Management</NavLink>
        <nav className="main-nav" aria-label="Navegación principal">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>
          ))}
        </nav>
        <div className="user-actions">
          <span>{user?.name}</span>
          <button className="button-secondary" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
