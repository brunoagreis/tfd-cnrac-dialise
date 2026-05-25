"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  ROLES,
  MODULES,
  ACTIONS,
  type Role,
  type Module,
  type Action,
  type PermissionMatrix,
} from "@/lib/types"

function buildDefaultMatrix(): PermissionMatrix {
  const matrix = {} as PermissionMatrix

  for (const role of ROLES) {
    matrix[role] = {} as Record<Module, Record<Action, boolean>>

    for (const mod of MODULES) {
      matrix[role][mod] = {} as Record<Action, boolean>

      for (const action of ACTIONS) {
        if (role === "ADMIN") {
          matrix[role][mod][action] = true
        } else if (role === "MEDICO_SES") {
          matrix[role][mod][action] = [
            "visualizar",
            "criar",
            "editar",
            "imprimir",
            "interagir",
          ].includes(action)
        } else if (role === "REGULADOR") {
          matrix[role][mod][action] = [
            "visualizar",
            "criar",
            "editar",
            "imprimir",
          ].includes(action)
        } else if (role === "OPERADOR") {
          matrix[role][mod][action] = [
            "visualizar",
            "criar",
            "editar",
          ].includes(action)
        } else if (role === "UNIDADE_HOSPITALAR") {
          matrix[role][mod][action] = [
            "visualizar",
            "interagir",
          ].includes(action)
        } else {
          matrix[role][mod][action] = action === "visualizar"
        }
      }
    }
  }

  return matrix
}

interface PermissionsContextType {
  matrix: PermissionMatrix
  hasPermission: (role: Role, mod: Module, action: Action) => boolean
  setPermission: (
    role: Role,
    mod: Module,
    action: Action,
    value: boolean
  ) => void
  canAccessModule: (role: Role, mod: Module) => boolean
  canAccessArea: (role: Role, mod: Module) => boolean
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(
  undefined
)

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [matrix, setMatrix] = useState<PermissionMatrix>(() => {
    if (typeof window === "undefined") return buildDefaultMatrix()

    try {
      const stored = localStorage.getItem("permissions_matrix")
      if (stored) {
        return JSON.parse(stored) as PermissionMatrix
      }
    } catch {
      return buildDefaultMatrix()
    }

    return buildDefaultMatrix()
  })

  const hasPermission = useCallback(
    (role: Role, mod: Module, action: Action) => {
      return Boolean(matrix?.[role]?.[mod]?.[action])
    },
    [matrix]
  )

  const canAccessModule = useCallback(
    (role: Role, mod: Module) => {
      return Boolean(matrix?.[role]?.[mod]?.visualizar)
    },
    [matrix]
  )

  const canAccessArea = useCallback(
    (role: Role, mod: Module) => {
      return Boolean(matrix?.[role]?.[mod]?.visualizar)
    },
    [matrix]
  )

  const setPermission = useCallback(
    (role: Role, mod: Module, action: Action, value: boolean) => {
      setMatrix((prev) => {
        const next =
          typeof structuredClone === "function"
            ? structuredClone(prev)
            : JSON.parse(JSON.stringify(prev))

        next[role][mod][action] = value

        if (typeof window !== "undefined") {
          localStorage.setItem("permissions_matrix", JSON.stringify(next))
        }

        return next
      })
    },
    []
  )

  const value = useMemo<PermissionsContextType>(
    () => ({
      matrix,
      hasPermission,
      setPermission,
      canAccessModule,
      canAccessArea,
    }),
    [matrix, hasPermission, setPermission, canAccessModule, canAccessArea]
  )

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext)

  if (!ctx) {
    throw new Error("usePermissions must be used inside PermissionsProvider")
  }

  const safeHasPermission =
    typeof ctx.hasPermission === "function"
      ? ctx.hasPermission
      : () => false

  const safeCanAccessModule =
    typeof ctx.canAccessModule === "function"
      ? ctx.canAccessModule
      : (role: Role, mod: Module) => safeHasPermission(role, mod, "visualizar")

  const safeCanAccessArea =
    typeof ctx.canAccessArea === "function"
      ? ctx.canAccessArea
      : (role: Role, mod: Module) => safeHasPermission(role, mod, "visualizar")

  const safeSetPermission =
    typeof ctx.setPermission === "function"
      ? ctx.setPermission
      : () => {}

  return {
    matrix: ctx.matrix,
    hasPermission: safeHasPermission,
    setPermission: safeSetPermission,
    canAccessModule: safeCanAccessModule,
    canAccessArea: safeCanAccessArea,
  }
}