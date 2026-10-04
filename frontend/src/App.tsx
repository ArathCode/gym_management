import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './app/AuthProvider'
import { useAuth } from './app/useAuth'
import { AccessPage } from './features/access/AccessPage'
import { LoginPage } from './features/auth/LoginPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { MemberCredentialPage, MemberDetailPage, MemberFormPage, MembersPage } from './features/members/MembersPages'
import {
  MemberMembershipsPage,
  MembershipPlanFormPage,
  MembershipPlansPage,
  PaymentsPage,
} from './features/memberships/MembershipPages'
import { InventoryPage, ProductDetailPage, ProductFormPage, ProductsPage, SaleDetailPage, SalesPage } from './features/products/CommercePages'
import { ReportsPage } from './features/reports/ReportsPage'
import { PosPage } from './features/sales/PosPage'
import { AppLayout } from './layouts/AppLayout'
import { Loading } from './components/ui'
import './App.css'

function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading label="Verificando sesión..." />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

function ApplicationRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/access" element={<AppLayout><AccessPage /></AppLayout>} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="members/new" element={<MemberFormPage />} />
          <Route path="members/:id/credential" element={<MemberCredentialPage />} />
          <Route path="members/:id" element={<MemberDetailPage />} />
          <Route path="members/:id/edit" element={<MemberFormPage />} />
          <Route path="members/:id/memberships" element={<MemberMembershipsPage />} />
          <Route path="membership-plans" element={<MembershipPlansPage />} />
          <Route path="membership-plans/new" element={<MembershipPlanFormPage />} />
          <Route path="membership-plans/:id/edit" element={<MembershipPlanFormPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="products/:id/edit" element={<ProductFormPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="pos" element={<PosPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="sales/:id" element={<SaleDetailPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return <BrowserRouter><AuthProvider><ApplicationRoutes /></AuthProvider></BrowserRouter>
}

export default App
