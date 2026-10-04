import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext } from './AuthContext'
import { api, TOKEN_KEY } from '../services/api'
import type { User } from '../types/api'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => Boolean(sessionStorage.getItem(TOKEN_KEY)))

  useEffect(() => {
    let active = true
    const clearAuth = () => {
      if (active) setUser(null)
    }
    window.addEventListener('gym:unauthorized', clearAuth)
    if (!sessionStorage.getItem(TOKEN_KEY)) {
      return () => {
        active = false
        window.removeEventListener('gym:unauthorized', clearAuth)
      }
    }

    api.get<{ data: User }>('/user')
      .then(({ data }) => active && setUser(data.data))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
      window.removeEventListener('gym:unauthorized', clearAuth)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ data: { user: User; token: string } }>('/login', { email, password })
    sessionStorage.setItem(TOKEN_KEY, data.data.token)
    setUser(data.data.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/logout')
    } finally {
      sessionStorage.removeItem(TOKEN_KEY)
      setUser(null)
    }
  }, [])

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
