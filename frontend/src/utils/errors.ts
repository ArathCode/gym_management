import axios from 'axios'
import type { ApiError } from '../types/api'

export function getErrorMessage(error: unknown, fallback = 'Ocurrió un error.'): string {
  if (axios.isAxiosError<ApiError>(error)) {
    const response = error.response?.data
    const message = response?.message
    if (message && message !== 'The given data was invalid.' && message !== 'The given data failed validation.') return message
    const firstFieldError = response?.errors ? Object.values(response.errors)[0]?.[0] : undefined
    return firstFieldError ?? message ?? fallback
  }
  return error instanceof Error ? error.message : fallback
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError<ApiError>(error) || !error.response?.data.errors) return {}
  return Object.fromEntries(
    Object.entries(error.response.data.errors).map(([field, messages]) => [field, messages[0] ?? 'Valor inválido.']),
  )
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

export function formatMoney(value: string | number | null | undefined): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value ?? 0))
}
