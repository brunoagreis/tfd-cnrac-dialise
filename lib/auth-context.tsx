"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react"
import type { User } from "@/lib/types"

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isReady: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, senha: string, lembrarMe?: boolean) => Promise<boolean>
  logout: () => void
  updateUser: (data: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isReady: false,
  })

  useEffect(() => {
    try {
      const stored =
        sessionStorage.getItem("auth_user") || localStorage.getItem("auth_user")

      if (stored) {
        const user = JSON.parse(stored) as User
        setState({
          user,
          isAuthenticated: true,
          isReady: true,
        })
        return
      }
    } catch {
      // ignore
    }

    setState({
      user: null,
      isAuthenticated: false,
      isReady: true,
    })
  }, [])

  const login = useCallback(
    async (email: string, senha: string, lembrarMe?: boolean): Promise<boolean> => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      })

      if (!res.ok) return false

      const data = (await res.json()) as { ok: boolean; user?: any }
      if (!data?.ok || !data.user) return false

      const user = data.user as any

      try {
        const r = await fetch("/api/auth/me/permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        })
        const j = await r.json()
        if (r.ok && j?.ok && Array.isArray(j.permissions)) {
          user.permissions = j.permissions
        } else {
          user.permissions = []
        }
      } catch {
        user.permissions = []
      }

      setState({
        user,
        isAuthenticated: true,
        isReady: true,
      })

      const storage = lembrarMe ? localStorage : sessionStorage
      storage.setItem("auth_user", JSON.stringify(user))
      return true
    },
    [],
  )

  const logout = useCallback(() => {
    setState({
      user: null,
      isAuthenticated: false,
      isReady: true,
    })
    sessionStorage.removeItem("auth_user")
    localStorage.removeItem("auth_user")
  }, [])

  const updateUser = useCallback((data: Partial<User>) => {
    setState((prev) => {
      if (!prev.user) return prev
      const updated = { ...prev.user, ...data }
      sessionStorage.setItem("auth_user", JSON.stringify(updated))
      localStorage.setItem("auth_user", JSON.stringify(updated))
      return {
        ...prev,
        user: updated,
      }
    })
  }, [])

  const value = useMemo(
    () => ({ ...state, login, logout, updateUser }),
    [state, login, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}