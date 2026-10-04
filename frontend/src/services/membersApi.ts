import type { Member, Membership, PageResponse } from '../types/api'
import { api } from './api'

export const membersApi = {
  list: (params: { search?: string; status?: string; page?: number }) =>
    api.get<PageResponse<Member>>('/members', { params }).then((response) => response.data),
  get: (id: number) => api.get<{ data: Member }>(`/members/${id}`).then((response) => response.data.data),
  create: (values: Record<string, unknown>) =>
    api.post<{ data: Member }>('/members', values).then((response) => response.data.data),
  update: (id: number, values: Record<string, unknown>) =>
    api.put<{ data: Member }>(`/members/${id}`, values).then((response) => response.data.data),
  regenerateBarcode: (id: number) =>
    api.post<{ data: Member }>(`/members/${id}/regenerate-barcode`).then((response) => response.data.data),
  memberships: (id: number) =>
    api.get<{ data: Membership[] }>(`/members/${id}/memberships`).then((response) => response.data.data),
  createMembership: (id: number, values: Record<string, unknown>) =>
    api.post<{ data: Membership }>(`/members/${id}/memberships`, values).then((response) => response.data.data),
}
