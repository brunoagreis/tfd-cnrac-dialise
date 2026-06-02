type PermissionLike =
  | string
  | {
      modulo?: string
      module?: string
      codigoModulo?: string
      acao?: string
      action?: string
      codigoAcao?: string
      permitido?: boolean
      allowed?: boolean
      value?: boolean
    }

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function getUserPerfilCodigo(user: any) {
  return normalizeCode(
    user?.perfilCodigo ||
      user?.perfil_codigo ||
      user?.perfil?.codigo ||
      user?.profileCode ||
      user?.role,
  )
}

export function isAdminUser(user: any) {
  const perfilCodigo = getUserPerfilCodigo(user)
  const role = normalizeCode(user?.role)

  return perfilCodigo === "ADMIN" || role === "ADMIN"
}

export function getUserPermissions(user: any): PermissionLike[] {
  const candidates = [
    user?.permissions,
    user?.permissoes,
    user?.permissoesPerfil,
    user?.profilePermissions,
    user?.accessPermissions,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as PermissionLike[]
    }
  }

  return []
}

export function hasUserPermission(
  user: any,
  moduleCode: string,
  actionCode = "visualizar",
) {
  if (!user) return false

  if (isAdminUser(user)) {
    return true
  }

  const target = `${normalizeKey(moduleCode)}.${normalizeKey(actionCode)}`
  const permissions = getUserPermissions(user)

  return permissions.some((permission) => {
    if (typeof permission === "string") {
      return normalizeKey(permission) === target
    }

    const permissionModule = normalizeCode(
      permission.modulo || permission.module || permission.codigoModulo,
    )

    const permissionAction = normalizeKey(
      permission.acao || permission.action || permission.codigoAcao,
    )

    const allowed =
      permission.permitido ??
      permission.allowed ??
      permission.value ??
      true

    return (
      allowed === true &&
      permissionModule === normalizeCode(moduleCode) &&
      permissionAction === normalizeKey(actionCode)
    )
  })
}