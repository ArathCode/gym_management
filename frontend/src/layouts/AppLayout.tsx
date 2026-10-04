import {
  BarChart3,
  ChevronDown,
  CreditCard,
  Dumbbell,
  Ellipsis,
  House,
  LogIn,
  LogOut,
  Package,
  QrCode,
  ShoppingCart,
  UsersRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/useAuth'
import { getErrorMessage } from '../utils/errors'

const primaryLinks = [
  { to: '/', label: 'Inicio', Icon: House, end: true },
  { to: '/members', label: 'Miembros', Icon: UsersRound },
  { to: '/payments', label: 'Pagos', Icon: CreditCard },
  { to: '/access', label: 'Accesos', Icon: QrCode },
  { to: '/pos', label: 'Punto de venta', Icon: ShoppingCart },
  { to: '/reports', label: 'Reportes', Icon: BarChart3 },
]

const moreLinks = [
  { to: '/membership-plans', label: 'Planes', Icon: Dumbbell },
  { to: '/products', label: 'Productos', Icon: Package },
  { to: '/inventory', label: 'Inventario', Icon: Package },
  { to: '/sales', label: 'Ventas', Icon: ShoppingCart },
]

export function AppLayout({ children }: { children?: ReactNode } = {}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const moreIsActive = moreLinks.some(({ to }) => pathname === to || pathname.startsWith(`${to}/`))

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
        <NavLink className="brand" to="/" aria-label="Moicano Boxing Club, inicio">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-wordmark"><strong>MOICANO</strong><small>BOXING CLUB</small></span>
        </NavLink>
        <nav className="main-nav" aria-label="Navegación principal">
          <div className="nav-pill">
            {primaryLinks.map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'active' : undefined}>
                <Icon size={19} strokeWidth={2.4} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
            <details className={`nav-more${moreIsActive ? ' active' : ''}`}>
              <summary aria-label="Más secciones">
                <Ellipsis size={20} strokeWidth={2.4} aria-hidden="true" />
                <span>Más</span>
                <ChevronDown className="more-chevron" size={13} aria-hidden="true" />
              </summary>
              <div className="more-menu">
                {moreLinks.map(({ to, label, Icon }) => (
                  <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : undefined}>
                    <Icon size={17} aria-hidden="true" />{label}
                  </NavLink>
                ))}
              </div>
            </details>
          </div>
        </nav>
        <div className="user-actions">
          {user ? <>
            <span className="user-chip"><span className="user-avatar" aria-hidden="true">{user.name.charAt(0)}</span><span>{user.name}</span></span>
            <button className="button-secondary logout-button" onClick={handleLogout}><LogOut size={16} aria-hidden="true" /><span>Cerrar sesión</span></button>
          </> : <NavLink className="button-link access-login-link" to="/login"><LogIn size={16} aria-hidden="true" /><span>Iniciar sesión</span></NavLink>}
        </div>
      </header>
      <main className="content">
        <Outlet />{children}
      </main>
    </div>
  )
}
