import type {
  DashboardSummary,
  InventoryMovement,
  Membership,
  MembershipPlan,
  PageResponse,
  Payment,
  Product,
  Report,
  Sale,
} from '../types/api'
import { api } from './api'

export const commerceApi = {
  dashboard: () => api.get<{ data: DashboardSummary }>('/dashboard').then((response) => response.data.data),
  plans: () => api.get<{ data: MembershipPlan[] }>('/membership-plans').then((response) => response.data.data),
  plan: (id: number) => api.get<{ data: MembershipPlan }>(`/membership-plans/${id}`).then((response) => response.data.data),
  createPlan: (values: Record<string, unknown>) =>
    api.post<{ data: MembershipPlan }>('/membership-plans', values).then((response) => response.data.data),
  updatePlan: (id: number, values: Record<string, unknown>) =>
    api.put<{ data: MembershipPlan }>(`/membership-plans/${id}`, values).then((response) => response.data.data),
  payments: (params: Record<string, string | number | undefined>) =>
    api.get<PageResponse<Payment>>('/payments', { params }).then((response) => response.data),
  membershipPayments: (id: number) =>
    api.get<PageResponse<Payment>>(`/memberships/${id}/payments`).then((response) => response.data),
  createPayment: (id: number, values: Record<string, unknown>) =>
    api.post<{ data: { payment: Payment; membership: Membership } }>(`/memberships/${id}/payments`, values)
      .then((response) => response.data.data),
  products: (params: { search?: string; page?: number } = {}) =>
    api.get<PageResponse<Product>>('/products', { params }).then((response) => response.data),
  product: (id: number) => api.get<{ data: Product }>(`/products/${id}`).then((response) => response.data.data),
  createProduct: (values: Record<string, unknown>) =>
    api.post<{ data: Product }>('/products', values).then((response) => response.data.data),
  updateProduct: (id: number, values: Record<string, unknown>) =>
    api.put<{ data: Product }>(`/products/${id}`, values).then((response) => response.data.data),
  movements: (params: Record<string, string | number | undefined>) =>
    api.get<PageResponse<InventoryMovement>>('/inventory/movements', { params }).then((response) => response.data),
  createMovement: (id: number, values: Record<string, unknown>) =>
    api.post(`/products/${id}/inventory-movements`, values).then((response) => response.data),
  sales: (params: Record<string, string | number | undefined>) =>
    api.get<PageResponse<Sale>>('/sales', { params }).then((response) => response.data),
  sale: (id: number) => api.get<{ data: Sale }>(`/sales/${id}`).then((response) => response.data.data),
  createSale: (values: Record<string, unknown>) =>
    api.post<{ data: Sale }>('/sales', values).then((response) => response.data.data),
  cancelSale: (id: number) =>
    api.post<{ data: Sale }>(`/sales/${id}/cancel`).then((response) => response.data.data),
  report: (type: 'sales' | 'payments' | 'attendance' | 'inventory', params: Record<string, string>) =>
    api.get<{ data: Report }>(`/reports/${type}`, { params }).then((response) => response.data.data),
}
