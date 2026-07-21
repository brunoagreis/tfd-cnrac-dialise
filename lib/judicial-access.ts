import type { User } from "@/lib/types"
import { hasUserPermission, isAdminUser } from "@/lib/access-control"

type UserLike = (User & Record<string, unknown>) | null | undefined

function hasPermission(
  user: UserLike,
  moduleCode: string,
  actionCode = "visualizar",
) {
  return hasUserPermission(user as any, moduleCode, actionCode)
}

function hasAnyPermission(
  user: UserLike,
  moduleCode: string,
  actionCodes: string[],
) {
  return actionCodes.some((actionCode) =>
    hasPermission(user, moduleCode, actionCode),
  )
}

export function canAccessJudicialModule(user: UserLike) {
  return hasPermission(user, "JUDICIAL", "visualizar")
}

export function canAccessSchedulingModule(user: UserLike) {
  return hasPermission(user, "AGENDAMENTO", "visualizar")
}

export function canManifestSchedulingItem(user: UserLike) {
  return hasAnyPermission(user, "AGENDAMENTO", ["reservar", "editar", "criar"])
}

export function canImportSchedulingAgenda(user: UserLike) {
  return hasAnyPermission(user, "AGENDAMENTO", ["criar", "editar"])
}

export function canAccessJudicialAdmin(user: UserLike) {
  return hasPermission(user, "ADMIN_JUDICIAL", "visualizar")
}

export function canReopenJudicialCase(user: UserLike) {
  return hasAnyPermission(user, "JUDICIAL", ["editar", "encerrar"])
}

export function canForceSchedulingResend(user: UserLike) {
  return (
    isAdminUser(user as any) ||
    hasAnyPermission(user, "AGENDAMENTO", ["editar", "reservar"])
  )
}

export function canMunicipalityManifest(
  casePendingMunicipalityAction: boolean,
  user: UserLike,
) {
  const role = String((user as any)?.role ?? "").trim().toUpperCase()

  return (
    !!user &&
    casePendingMunicipalityAction &&
    (role === "UNIDADE_HOSPITALAR" ||
      hasPermission(user, "PRE_JUDICIAL", "interagir") ||
      hasPermission(user, "JUDICIAL", "interagir"))
  )
}
