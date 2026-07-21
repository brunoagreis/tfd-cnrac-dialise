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

type AuthUser = User & {
  permissions?: string[]
  permissoes?: string[]
  perfilCodigo?: string
  perfilNome?: string
  [key: string]: unknown
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isReady: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, senha: string, lembrarMe?: boolean) => Promise<boolean>
  logout: () => void
  updateUser: (data: Partial<User>) => void
  refreshPermissions: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function readStoredUser() {
  const sessionStored = sessionStorage.getItem("auth_user")
  const localStored = localStorage.getItem("auth_user")
  const stored = sessionStored || localStored

  if (!stored) return null

  return JSON.parse(stored) as AuthUser
}

function persistUser(user: AuthUser, lembrarMe?: boolean) {
  const hasLocal = localStorage.getItem("auth_user")
  const hasSession = sessionStorage.getItem("auth_user")
  const payload = JSON.stringify(user)

  if (lembrarMe === true) {
    localStorage.setItem("auth_user", payload)
    sessionStorage.removeItem("auth_user")
    return
  }

  if (lembrarMe === false) {
    sessionStorage.setItem("auth_user", payload)
    localStorage.removeItem("auth_user")
    return
  }

  if (hasLocal) {
    localStorage.setItem("auth_user", payload)
  }

  if (hasSession || !hasLocal) {
    sessionStorage.setItem("auth_user", payload)
  }
}

function mergePermissions(user: AuthUser, data: any): AuthUser {
  const permissions = Array.isArray(data?.permissions) ? data.permissions : []
  const permissoes = Array.isArray(data?.permissoes) ? data.permissoes : permissions

  return {
    ...user,
    permissions,
    permissoes,
    perfilCodigo: data?.perfilCodigo ?? user.perfilCodigo,
    perfilNome: data?.perfilNome ?? user.perfilNome,
  }
}

async function loadUserPermissions(user: AuthUser): Promise<AuthUser> {
  if (!user?.id) return user

  try {
    const response = await fetch("/api/auth/me/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
      cache: "no-store",
    })

    const data = await response.json().catch(() => null)

    if (response.ok && data?.ok) {
      return mergePermissions(user, data)
    }
  } catch {
    // Mantém o usuário atual se a atualização falhar momentaneamente.
  }

  return {
    ...user,
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
    permissoes: Array.isArray(user.permissoes) ? user.permissoes : [],
  }
}

function shouldReplaceUser(currentUser: AuthUser, nextUser: AuthUser) {
  return (
    JSON.stringify(currentUser.permissions ?? []) !==
      JSON.stringify(nextUser.permissions ?? []) ||
    JSON.stringify(currentUser.permissoes ?? []) !==
      JSON.stringify(nextUser.permissoes ?? []) ||
    currentUser.perfilCodigo !== nextUser.perfilCodigo ||
    currentUser.perfilNome !== nextUser.perfilNome
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isReady: false,
  })

  const refreshPermissions = useCallback(async () => {
    let currentUser: AuthUser | null = null

    setState((prev) => {
      currentUser = prev.user as AuthUser | null
      return prev
    })

    if (!currentUser?.id) return

    const nextUser = await loadUserPermissions(currentUser)

    setState((prev) => {
      if (!prev.user) return prev

      const previousUser = prev.user as AuthUser

      if (!shouldReplaceUser(previousUser, nextUser)) {
        return prev
      }

      persistUser(nextUser)

      return {
        ...prev,
        user: nextUser,
      }
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function restoreUser() {
      try {
        const storedUser = readStoredUser()

        if (storedUser) {
          setState({
            user: storedUser,
            isAuthenticated: true,
            isReady: true,
          })

          const refreshedUser = await loadUserPermissions(storedUser)

          if (!cancelled) {
            persistUser(refreshedUser)

            setState({
              user: refreshedUser,
              isAuthenticated: true,
              isReady: true,
            })
          }

          return
        }
      } catch {
        // ignore
      }

      if (!cancelled) {
        setState({
          user: null,
          isAuthenticated: false,
          isReady: true,
        })
      }
    }

    restoreUser()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!state.isAuthenticated || !state.user?.id) return

    const interval = window.setInterval(() => {
      refreshPermissions()
    }, 60000)

    function handleFocus() {
      refreshPermissions()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshPermissions()
      }
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [refreshPermissions, state.isAuthenticated, state.user?.id])

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

      const user = await loadUserPermissions(data.user as AuthUser)

      setState({
        user,
        isAuthenticated: true,
        isReady: true,
      })

      persistUser(user, lembrarMe)
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

      const updated = { ...(prev.user as AuthUser), ...data }

      persistUser(updated)

      return {
        ...prev,
        user: updated,
      }
    })
  }, [])

  const value = useMemo(
    () => ({ ...state, login, logout, updateUser, refreshPermissions }),
    [state, login, logout, updateUser, refreshPermissions],
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
