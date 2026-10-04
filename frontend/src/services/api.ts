import axios from 'axios'

export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '')
export const TOKEN_KEY = 'gym-api-token'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new Event('gym:unauthorized'))
    }
    return Promise.reject(error)
  },
)
