import type { User } from "@/lib/types"

export function canAccessJudicialModule(user: User | null | undefined) {
  if (!user) return false
  return user.role !== "VISUALIZADOR"
}

export function canAccessSchedulingModule(user: User | null | undefined) {
  if (!user) return false
  return ["ADMIN", "MEDICO_SES", "REGULADOR", "OPERADOR"].includes(user.role)
}

export function canManifestSchedulingItem(user: User | null | undefined) {
  if (!user) return false
  return ["ADMIN", "MEDICO_SES", "REGULADOR", "OPERADOR"].includes(user.role)
}

export function canImportSchedulingAgenda(user: User | null | undefined) {
  if (!user) return false
  return ["ADMIN", "MEDICO_SES", "REGULADOR"].includes(user.role)
}

export function canAccessJudicialAdmin(user: User | null | undefined) {
  return user?.role === "ADMIN"
}

export function canReopenJudicialCase(user: User | null | undefined) {
  return !!user && ["ADMIN", "MEDICO_SES", "REGULADOR"].includes(user.role)
}

export function canForceSchedulingResend(user: User | null | undefined) {
  return !!user && ["ADMIN", "MEDICO_SES"].includes(user.role)
}

export function canMunicipalityManifest(
  casePendingMunicipalityAction: boolean,
  user: User | null | undefined,
) {
  return !!user && user.role === "UNIDADE_HOSPITALAR" && casePendingMunicipalityAction
}