import { createContext } from 'react'
import type { User } from '../types/api'

export type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
