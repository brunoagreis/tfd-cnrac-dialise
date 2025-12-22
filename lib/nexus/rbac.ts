import { createAdminClient, createClient } from "@/lib/supabase/server"
import type { Permission, Role, User, UserRole } from "./types"

interface UserPermissions {
  user: User
  roles: UserRole[]
  permissions: string[] // Format: "module:resource:action"
  isSystemAdmin: boolean
  tenantId?: string
}

// Buscar usuário atual com permissões
export async function getCurrentUserWithPermissions(): Promise<UserPermissions | null> {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return null
  }

  const adminClient = await createAdminClient()

  // Buscar usuário do sistema
  const { data: nexusUser, error: userError } = await adminClient
    .from("core_users")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .single()

  if (userError || !nexusUser) {
    return null
  }

  // Buscar roles do usuário
  const { data: userRoles, error: rolesError } = await adminClient
    .from("rbac_user_roles")
    .select(`
      *,
      role:rbac_roles(*),
      unit:core_units(*),
      sector:core_sectors(*)
    `)
    .eq("user_id", nexusUser.id)
    .eq("is_active", true)

  if (rolesError) {
    console.error("[NEXUS] Failed to fetch user roles:", rolesError)
    return null
  }

  // Buscar permissões de todas as roles
  const roleIds = userRoles?.map((ur: UserRole) => ur.role_id) || []

  const { data: rolePermissions, error: permsError } = await adminClient
    .from("rbac_role_permissions")
    .select(`
      permission:rbac_permissions(*)
    `)
    .in("role_id", roleIds)

  if (permsError) {
    console.error("[NEXUS] Failed to fetch permissions:", permsError)
    return null
  }

  // Formatar permissões como strings
  const permissions =
    rolePermissions?.map(
      (rp: { permission: Permission }) =>
        `${rp.permission.module_code}:${rp.permission.resource}:${rp.permission.action}`,
    ) || []

  return {
    user: nexusUser as User,
    roles: userRoles as UserRole[],
    permissions: [...new Set(permissions)], // Remove duplicatas
    isSystemAdmin: nexusUser.is_system_admin,
    tenantId: nexusUser.tenant_id,
  }
}

// Verificar se usuário tem permissão específica
export async function hasPermission(moduleCode: string, resource: string, action: string): Promise<boolean> {
  const userPerms = await getCurrentUserWithPermissions()

  if (!userPerms) {
    return false
  }

  // System admin tem todas as permissões
  if (userPerms.isSystemAdmin) {
    return true
  }

  const permissionKey = `${moduleCode}:${resource}:${action}`
  return userPerms.permissions.includes(permissionKey)
}

// Verificar múltiplas permissões (OR)
export async function hasAnyPermission(
  permissions: Array<{ module: string; resource: string; action: string }>,
): Promise<boolean> {
  const userPerms = await getCurrentUserWithPermissions()

  if (!userPerms) {
    return false
  }

  if (userPerms.isSystemAdmin) {
    return true
  }

  return permissions.some((p) => userPerms.permissions.includes(`${p.module}:${p.resource}:${p.action}`))
}

// Verificar múltiplas permissões (AND)
export async function hasAllPermissions(
  permissions: Array<{ module: string; resource: string; action: string }>,
): Promise<boolean> {
  const userPerms = await getCurrentUserWithPermissions()

  if (!userPerms) {
    return false
  }

  if (userPerms.isSystemAdmin) {
    return true
  }

  return permissions.every((p) => userPerms.permissions.includes(`${p.module}:${p.resource}:${p.action}`))
}

// Buscar roles disponíveis para um tenant
export async function getRolesForTenant(tenantId: string): Promise<Role[]> {
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from("rbac_roles")
    .select("*")
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .eq("is_active", true)
    .order("display_name")

  if (error) {
    console.error("[NEXUS] Failed to fetch roles:", error)
    return []
  }

  return data as Role[]
}

// Buscar todas as permissões
export async function getAllPermissions(): Promise<Permission[]> {
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from("rbac_permissions")
    .select("*")
    .order("module_code")
    .order("resource")
    .order("action")

  if (error) {
    console.error("[NEXUS] Failed to fetch permissions:", error)
    return []
  }

  return data as Permission[]
}

// Atribuir role a usuário
export async function assignRoleToUser(
  userId: string,
  roleId: string,
  unitId?: string,
  sectorId?: string,
  isPrimary = false,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createAdminClient()

  const { error } = await supabase.from("rbac_user_roles").insert({
    user_id: userId,
    role_id: roleId,
    unit_id: unitId,
    sector_id: sectorId,
    is_primary: isPrimary,
    is_active: true,
  })

  if (error) {
    console.error("[NEXUS] Failed to assign role:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

// Remover role de usuário
export async function removeRoleFromUser(userRoleId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createAdminClient()

  const { error } = await supabase.from("rbac_user_roles").update({ is_active: false }).eq("id", userRoleId)

  if (error) {
    console.error("[NEXUS] Failed to remove role:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
