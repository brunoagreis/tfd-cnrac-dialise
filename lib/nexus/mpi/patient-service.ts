// ============================================================
// NEXUS - MPI Patient Service
// ============================================================

import { createClient } from "@/lib/supabase/server"
import { logAuditEvent } from "@/lib/nexus/audit"
import type {
  MPIPatient,
  PatientSearchParams,
  PatientSearchResult,
  PatientSummary,
  MPIAllergy,
  MPICondition,
  MPIImmunization,
  MPIConsent,
  MergeRequest,
} from "./types"

export class PatientService {
  private tenantId: string
  private userId: string

  constructor(tenantId: string, userId: string) {
    this.tenantId = tenantId
    this.userId = userId
  }

  /**
   * Busca pacientes com filtros avançados e detecção de duplicatas
   */
  async searchPatients(params: PatientSearchParams): Promise<PatientSearchResult> {
    const supabase = await createClient()
    const {
      query,
      cpf,
      cns,
      name,
      birth_date,
      mother_name,
      medical_record_number,
      include_inactive = false,
      include_deceased = false,
      page = 1,
      limit = 20,
    } = params

    let queryBuilder = supabase
      .from("mpi_patients")
      .select(
        `
        *,
        person:core_persons(*)
      `,
        { count: "exact" },
      )
      .eq("tenant_id", this.tenantId)

    // Filtros
    if (!include_inactive) {
      queryBuilder = queryBuilder.eq("is_active", true)
    }
    if (!include_deceased) {
      queryBuilder = queryBuilder.eq("is_deceased", false)
    }
    if (medical_record_number) {
      queryBuilder = queryBuilder.eq("medical_record_number", medical_record_number)
    }

    // Busca em person
    if (cpf) {
      queryBuilder = queryBuilder.eq("person.cpf", cpf.replace(/\D/g, ""))
    }
    if (cns) {
      queryBuilder = queryBuilder.eq("person.cns", cns.replace(/\D/g, ""))
    }
    if (name) {
      queryBuilder = queryBuilder.ilike("person.full_name", `%${name}%`)
    }
    if (birth_date) {
      queryBuilder = queryBuilder.eq("person.birth_date", birth_date)
    }
    if (mother_name) {
      queryBuilder = queryBuilder.ilike("person.mother_name", `%${mother_name}%`)
    }

    // Paginação
    const offset = (page - 1) * limit
    queryBuilder = queryBuilder.range(offset, offset + limit - 1).order("created_at", { ascending: false })

    const { data, error, count } = await queryBuilder

    if (error) {
      throw new Error(`Erro ao buscar pacientes: ${error.message}`)
    }

    // Log de acesso
    await logAuditEvent({
      tenant_id: this.tenantId,
      user_id: this.userId,
      action: "SEARCH",
      module: "MPI",
      resource_type: "patients",
      details: { filters: params, results_count: count },
    })

    return {
      patients: data as MPIPatient[],
      total: count || 0,
      page,
      limit,
    }
  }

  /**
   * Obtém paciente por ID com todos os dados relacionados
   */
  async getPatientById(patientId: string): Promise<MPIPatient | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("mpi_patients")
      .select(`
        *,
        person:core_persons(*)
      `)
      .eq("id", patientId)
      .eq("tenant_id", this.tenantId)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw new Error(`Erro ao buscar paciente: ${error.message}`)
    }

    // Log de acesso a dados sensíveis
    await logAuditEvent({
      tenant_id: this.tenantId,
      user_id: this.userId,
      action: "READ",
      module: "MPI",
      resource_type: "patients",
      resource_id: patientId,
      is_sensitive: true,
    })

    return data as MPIPatient
  }

  /**
   * Obtém resumo completo do paciente (alergias, condições, vacinas, consentimentos)
   */
  async getPatientSummary(patientId: string): Promise<PatientSummary | null> {
    const supabase = await createClient()

    // Buscar paciente
    const patient = await this.getPatientById(patientId)
    if (!patient) return null

    // Buscar dados relacionados em paralelo
    const [allergiesResult, conditionsResult, immunizationsResult, consentsResult] = await Promise.all([
      supabase
        .from("mpi_allergies")
        .select("*")
        .eq("patient_id", patientId)
        .eq("status", "ACTIVE")
        .order("severity", { ascending: false }),

      supabase
        .from("mpi_conditions")
        .select("*")
        .eq("patient_id", patientId)
        .eq("clinical_status", "ACTIVE")
        .order("condition_type"),

      supabase
        .from("mpi_immunizations")
        .select("*")
        .eq("patient_id", patientId)
        .order("administration_date", { ascending: false })
        .limit(10),

      supabase.from("mpi_consents").select("*").eq("patient_id", patientId).eq("status", "ACTIVE"),
    ])

    return {
      patient,
      allergies: (allergiesResult.data || []) as MPIAllergy[],
      active_conditions: (conditionsResult.data || []) as MPICondition[],
      recent_immunizations: (immunizationsResult.data || []) as MPIImmunization[],
      active_consents: (consentsResult.data || []) as MPIConsent[],
    }
  }

  /**
   * Cria novo paciente
   */
  async createPatient(personId: string, patientData: Partial<MPIPatient>): Promise<MPIPatient> {
    const supabase = await createClient()

    // Gerar número de prontuário
    const { data: lastPatient } = await supabase
      .from("mpi_patients")
      .select("medical_record_number")
      .eq("tenant_id", this.tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    let nextNumber = 1
    if (lastPatient?.medical_record_number) {
      const match = lastPatient.medical_record_number.match(/\d+/)
      if (match) nextNumber = Number.parseInt(match[0]) + 1
    }

    const medical_record_number = `PRONT-${nextNumber.toString().padStart(6, "0")}`

    const { data, error } = await supabase
      .from("mpi_patients")
      .insert({
        tenant_id: this.tenantId,
        person_id: personId,
        medical_record_number,
        ...patientData,
        created_by: this.userId,
        updated_by: this.userId,
      })
      .select(`*, person:core_persons(*)`)
      .single()

    if (error) {
      throw new Error(`Erro ao criar paciente: ${error.message}`)
    }

    // Log de criação
    await logAuditEvent({
      tenant_id: this.tenantId,
      user_id: this.userId,
      action: "CREATE",
      module: "MPI",
      resource_type: "patients",
      resource_id: data.id,
      new_values: data,
    })

    return data as MPIPatient
  }

  /**
   * Atualiza dados do paciente
   */
  async updatePatient(patientId: string, updates: Partial<MPIPatient>): Promise<MPIPatient> {
    const supabase = await createClient()

    // Buscar dados atuais para auditoria
    const currentPatient = await this.getPatientById(patientId)
    if (!currentPatient) {
      throw new Error("Paciente não encontrado")
    }

    const { data, error } = await supabase
      .from("mpi_patients")
      .update({
        ...updates,
        updated_by: this.userId,
        updated_at: new Date().toISOString(),
        version: currentPatient.version + 1,
      })
      .eq("id", patientId)
      .eq("tenant_id", this.tenantId)
      .select(`*, person:core_persons(*)`)
      .single()

    if (error) {
      throw new Error(`Erro ao atualizar paciente: ${error.message}`)
    }

    // Log de atualização
    await logAuditEvent({
      tenant_id: this.tenantId,
      user_id: this.userId,
      action: "UPDATE",
      module: "MPI",
      resource_type: "patients",
      resource_id: patientId,
      old_values: currentPatient,
      new_values: data,
    })

    return data as MPIPatient
  }

  /**
   * Lista candidatos a duplicata pendentes de revisão
   */
  async getPendingDuplicates(page = 1, limit = 20) {
    const supabase = await createClient()

    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from("mpi_duplicate_candidates")
      .select(
        `
        *,
        patient_a:mpi_patients!patient_id_a(*, person:core_persons(*)),
        patient_b:mpi_patients!patient_id_b(*, person:core_persons(*))
      `,
        { count: "exact" },
      )
      .eq("tenant_id", this.tenantId)
      .eq("status", "PENDING")
      .order("similarity_score", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw new Error(`Erro ao buscar duplicatas: ${error.message}`)
    }

    return {
      duplicates: data,
      total: count || 0,
      page,
      limit,
    }
  }

  /**
   * Revisa candidato a duplicata
   */
  async reviewDuplicate(duplicateId: string, isConfirmedDuplicate: boolean, notes?: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("mpi_duplicate_candidates")
      .update({
        status: isConfirmedDuplicate ? "CONFIRMED_DUPLICATE" : "NOT_DUPLICATE",
        reviewed_at: new Date().toISOString(),
        reviewed_by: this.userId,
        review_notes: notes,
      })
      .eq("id", duplicateId)
      .eq("tenant_id", this.tenantId)
      .select()
      .single()

    if (error) {
      throw new Error(`Erro ao revisar duplicata: ${error.message}`)
    }

    await logAuditEvent({
      tenant_id: this.tenantId,
      user_id: this.userId,
      action: "UPDATE",
      module: "MPI",
      resource_type: "duplicate_candidates",
      resource_id: duplicateId,
      details: { decision: isConfirmedDuplicate ? "CONFIRMED" : "NOT_DUPLICATE", notes },
    })

    return data
  }

  /**
   * Unifica dois pacientes (merge)
   */
  async mergePatients(request: MergeRequest): Promise<void> {
    const supabase = await createClient()

    const { surviving_patient_id, merged_patient_id, merge_reason, incorporate_data } = request

    // Buscar dados do paciente que será merged
    const mergedPatient = await this.getPatientById(merged_patient_id)
    if (!mergedPatient) {
      throw new Error("Paciente a ser unificado não encontrado")
    }

    // Criar snapshot antes do merge
    const mergedSnapshot = { ...mergedPatient }

    // Iniciar transação (via múltiplas operações)

    // 1. Registrar histórico de merge
    const { error: historyError } = await supabase.from("mpi_merge_history").insert({
      tenant_id: this.tenantId,
      surviving_patient_id,
      merged_patient_id,
      merged_patient_snapshot: mergedSnapshot,
      incorporated_data: incorporate_data,
      merge_reason,
      approved_by: this.userId,
      undo_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 dias
    })

    if (historyError) {
      throw new Error(`Erro ao registrar histórico de merge: ${historyError.message}`)
    }

    // 2. Transferir dados se solicitado
    if (incorporate_data?.allergies) {
      await supabase
        .from("mpi_allergies")
        .update({ patient_id: surviving_patient_id })
        .eq("patient_id", merged_patient_id)
    }

    if (incorporate_data?.conditions) {
      await supabase
        .from("mpi_conditions")
        .update({ patient_id: surviving_patient_id })
        .eq("patient_id", merged_patient_id)
    }

    if (incorporate_data?.immunizations) {
      await supabase
        .from("mpi_immunizations")
        .update({ patient_id: surviving_patient_id })
        .eq("patient_id", merged_patient_id)
    }

    // 3. Marcar paciente como merged
    const { error: updateError } = await supabase
      .from("mpi_patients")
      .update({
        is_active: false,
        merged_into_id: surviving_patient_id,
        updated_by: this.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", merged_patient_id)
      .eq("tenant_id", this.tenantId)

    if (updateError) {
      throw new Error(`Erro ao marcar paciente como merged: ${updateError.message}`)
    }

    // 4. Atualizar status da duplicata se existir
    await supabase
      .from("mpi_duplicate_candidates")
      .update({
        status: "MERGED",
        surviving_patient_id,
        reviewed_by: this.userId,
        reviewed_at: new Date().toISOString(),
      })
      .or(`patient_id_a.eq.${merged_patient_id},patient_id_b.eq.${merged_patient_id}`)
      .eq("tenant_id", this.tenantId)

    // Log de merge
    await logAuditEvent({
      tenant_id: this.tenantId,
      user_id: this.userId,
      action: "MERGE",
      module: "MPI",
      resource_type: "patients",
      resource_id: merged_patient_id,
      details: {
        surviving_patient_id,
        merge_reason,
        incorporated_data,
      },
    })
  }
}
