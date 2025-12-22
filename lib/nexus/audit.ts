import { createAdminClient } from "@/lib/supabase/server"
import type { AuditEventLog, LogAccess } from "./types"

interface AuditEventInput {
  tenantId?: string
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  moduleCode: string
  entityType: string
  entityId?: string
  action: string
  actionDescription?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

interface AccessLogInput {
  tenantId?: string
  userId: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  moduleCode: string
  entityType: string
  entityId: string
  accessType: "VIEW" | "PRINT" | "EXPORT" | "DOWNLOAD"
  reason: string
  metadata?: Record<string, unknown>
}

// Log de eventos de auditoria (CREATE, UPDATE, DELETE, etc.)
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const supabase = await createAdminClient()

    const { error } = await supabase.from("audit_event_log").insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      session_id: input.sessionId,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      module_code: input.moduleCode,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      action_description: input.actionDescription,
      old_values: input.oldValues,
      new_values: input.newValues,
      metadata: input.metadata || {},
    })

    if (error) {
      console.error("[NEXUS] Failed to log audit event:", error)
    }
  } catch (err) {
    console.error("[NEXUS] Error in logAuditEvent:", err)
  }
}

// Log de acesso a dados sensíveis (LGPD)
export async function logAccessEvent(input: AccessLogInput): Promise<void> {
  try {
    const supabase = await createAdminClient()

    const { error } = await supabase.from("log_access").insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      session_id: input.sessionId,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      module_code: input.moduleCode,
      entity_type: input.entityType,
      entity_id: input.entityId,
      access_type: input.accessType,
      reason: input.reason,
      metadata: input.metadata || {},
    })

    if (error) {
      console.error("[NEXUS] Failed to log access event:", error)
    }
  } catch (err) {
    console.error("[NEXUS] Error in logAccessEvent:", err)
  }
}

// Log de erros do sistema
export async function logError(input: {
  tenantId?: string
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  moduleCode?: string
  errorCode?: string
  errorMessage: string
  errorStack?: string
  requestUrl?: string
  requestMethod?: string
  requestBody?: Record<string, unknown>
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = await createAdminClient()

    const { error } = await supabase.from("error_log").insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      session_id: input.sessionId,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      module_code: input.moduleCode,
      error_code: input.errorCode,
      error_message: input.errorMessage,
      error_stack: input.errorStack,
      request_url: input.requestUrl,
      request_method: input.requestMethod,
      request_body: input.requestBody,
      metadata: input.metadata || {},
    })

    if (error) {
      console.error("[NEXUS] Failed to log error:", error)
    }
  } catch (err) {
    console.error("[NEXUS] Error in logError:", err)
  }
}

// Buscar logs de auditoria
export async function getAuditLogs(params: {
  tenantId?: string
  userId?: string
  entityType?: string
  entityId?: string
  action?: string
  moduleCode?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}): Promise<AuditEventLog[]> {
  const supabase = await createAdminClient()

  let query = supabase
    .from("audit_event_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(params.limit || 50)

  if (params.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 50) - 1)
  }

  if (params.tenantId) {
    query = query.eq("tenant_id", params.tenantId)
  }

  if (params.userId) {
    query = query.eq("user_id", params.userId)
  }

  if (params.entityType) {
    query = query.eq("entity_type", params.entityType)
  }

  if (params.entityId) {
    query = query.eq("entity_id", params.entityId)
  }

  if (params.action) {
    query = query.eq("action", params.action)
  }

  if (params.moduleCode) {
    query = query.eq("module_code", params.moduleCode)
  }

  if (params.startDate) {
    query = query.gte("created_at", params.startDate)
  }

  if (params.endDate) {
    query = query.lte("created_at", params.endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error("[NEXUS] Failed to fetch audit logs:", error)
    return []
  }

  return data as AuditEventLog[]
}

// Buscar logs de acesso
export async function getAccessLogs(params: {
  tenantId?: string
  userId?: string
  entityType?: string
  entityId?: string
  accessType?: string
  moduleCode?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}): Promise<LogAccess[]> {
  const supabase = await createAdminClient()

  let query = supabase
    .from("log_access")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(params.limit || 50)

  if (params.offset) {
    query = query.range(params.offset, params.offset + (params.limit || 50) - 1)
  }

  if (params.tenantId) {
    query = query.eq("tenant_id", params.tenantId)
  }

  if (params.userId) {
    query = query.eq("user_id", params.userId)
  }

  if (params.entityType) {
    query = query.eq("entity_type", params.entityType)
  }

  if (params.entityId) {
    query = query.eq("entity_id", params.entityId)
  }

  if (params.accessType) {
    query = query.eq("access_type", params.accessType)
  }

  if (params.moduleCode) {
    query = query.eq("module_code", params.moduleCode)
  }

  if (params.startDate) {
    query = query.gte("created_at", params.startDate)
  }

  if (params.endDate) {
    query = query.lte("created_at", params.endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error("[NEXUS] Failed to fetch access logs:", error)
    return []
  }

  return data as LogAccess[]
}
