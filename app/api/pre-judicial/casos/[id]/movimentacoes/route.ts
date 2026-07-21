import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { sendMunicipalitySchedulingNotification } from "@/lib/municipality-notifications"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PreJudicialCaseRow = {
  id: string
  protocolNumber: string | null
  patientName: string | null
  municipalityName: string | null
  numeroProcesso: string | null
  statusAnterior: string | null
  activeAnterior: boolean | null
  schedulingStatusAnterior: string | null
}

type PreSchedulingFichaRow = {
  id: string
  fichaNumero: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeText(value: unknown) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
}

function parseDateTime(value: unknown) {
  const raw = text(value)

  if (!raw) return null

  const date = new Date(raw)

  if (Number.isNaN(date.getTime())) return null

  return date.toISOString()
}

function normalizeAppointmentFichas(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item: any) => {
      const id = text(item?.id || item?.fichaId || item?.ficha_id)
      const appointmentDate = parseDateTime(
        item?.appointmentDate || item?.appointment_date || item?.dataAgendamento,
      )
      const notes = text(
        item?.notes || item?.appointmentNotes || item?.appointment_notes,
      )

      if (!id || !appointmentDate) return null

      return {
        id,
        appointmentDate,
        notes,
      }
    })
    .filter(Boolean) as Array<{
    id: string
    appointmentDate: string
    notes: string
  }>
}


function normalizeAttachments(value: unknown) {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") {
        return {
          name: item,
        }
      }

      if (item && typeof item === "object") {
        return item
      }

      return {
        name: String(item ?? ""),
      }
    })
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((name) => ({ name }))
  }

  return []
}

function normalizeMovementType(value: unknown) {
  const type = normalizeText(value)

  if (!type) return "interacao"

  if (type === "interacao") return "interacao"
  if (type === "cadastro") return "cadastro"
  if (type === "anexo") return "anexo"
  if (type === "notificacao_municipio") return "notificacao_municipio"
  if (type === "envio_agendamento_demanda") return "envio_agendamento_demanda"
  if (type === "encaminhar_direto_agendamento") return "encaminhar_direto_agendamento"
  if (type === "analise_viabilidade_apta_agendamento") return "analise_viabilidade_apta_agendamento"
  if (type === "analise_viabilidade_nao_rede") return "analise_viabilidade_nao_rede"
  if (type === "analise_viabilidade_complementacao") return "analise_viabilidade_complementacao"
  if (type === "reserva_agendamento") return "reserva_agendamento"
  if (type === "agendado") return "agendado"
  if (type === "nao_agendado") return "nao_agendado"
  if (type === "manifestacao_automatica_prazo") return "manifestacao_automatica_prazo"
  if (type === "retorno_fila") return "retorno_fila"
  if (type === "encerramento") return "encerramento"
  if (type === "reabertura") return "reabertura"

  if (type === "resolvido" || type === "resolvida") return "resolvido"
  if (type === "cumprido" || type === "cumprida") return "cumprido"
  if (type === "arquivado" || type === "arquivada") return "arquivado"
  if (type === "obito") return "obito"

  return type
}

function movementTypeLabel(type: string) {
  const labels: Record<string, string> = {
    cadastro: "Cadastro",
    interacao: "Interação",
    anexo: "Anexo",
    notificacao_municipio: "Notificação ao município",
    envio_agendamento_demanda: "Envio ao Agendamento da Demanda",
    encaminhar_direto_agendamento: "Encaminhar direto para agendamento",
    analise_viabilidade_apta_agendamento: "Análise de viabilidade apta para agendamento",
    analise_viabilidade_apta_agendamento: "Análise de viabilidade - apto para agendamento",
    analise_viabilidade_nao_rede: "Análise de viabilidade - não realizado na rede",
    analise_viabilidade_complementacao: "Análise de viabilidade - complementação necessária",
    reserva_agendamento: "Reserva de agenda",
    agendado: "Agendado",
    nao_agendado: "Não agendado",
    manifestacao_automatica_prazo: "Manifestação automática por prazo",
    retorno_fila: "Retorno à fila",
    encerramento: "Encerramento",
    reabertura: "Reabertura",
    resolvido: "Resolvido",
    cumprido: "Cumprido",
    arquivado: "Arquivado",
    obito: "Ã“bito",
  }

  return labels[type] || type
}

function normalizeOriginModule(value: unknown) {
  const key = text(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")

  if (key === "HEMODIALISE" || key === "HEMODIALISE") return "HEMODIALISE"
  if (key === "PRE_JUDICIAL") return "PRE_JUDICIAL"
  if (["JUDICIAL", "TFD", "CNRAC"].includes(key)) return key

  return key
}

function statusFromMovement(type: string) {
  if (type === "encaminhar_direto_agendamento") return "enviado_agendamento"
  if (type === "envio_agendamento_demanda") return "enviado_agendamento"
  if (type === "analise_viabilidade_apta_agendamento") return "enviado_agendamento"
  if (type === "analise_viabilidade_nao_rede") return "ativo"
  if (type === "analise_viabilidade_complementacao") return "ativo"
  if (type === "reserva_agendamento") return "reservado"
  if (type === "agendado") return "ativo"
  if (type === "nao_agendado") return "ativo"
  if (type === "retorno_fila") return "ativo"
  if (type === "reabertura") return "ativo"
  if (type === "encerramento") return "encerrado"
  if (type === "resolvido") return "resolvido"
  if (type === "cumprido") return "cumprido"
  if (type === "arquivado") return "arquivado"
  if (type === "obito") return "obito"

  return null
}

function schedulingStatusFromMovement(type: string) {
  if (type === "encaminhar_direto_agendamento") return "para_agendar"
  if (type === "envio_agendamento_demanda") return "para_avaliar"
  if (type === "analise_viabilidade_apta_agendamento") return "apto_agendamento"
  if (type === "analise_viabilidade_nao_rede") return "fora_fila"
  if (type === "analise_viabilidade_complementacao") return "fora_fila"
  if (type === "reserva_agendamento") return "reservado"
  if (type === "agendado") return "fora_fila"
  if (type === "nao_agendado") return "fora_fila"
  if (type === "retorno_fila") return "fora_fila"
  if (type === "reabertura") return "fora_fila"

  return null
}

function shouldCloseCase(type: string) {
  return ["encerramento", "resolvido", "cumprido", "arquivado", "obito"].includes(
    type,
  )
}

function shouldReopenCase(type: string) {
  return ["reabertura", "retorno_fila", "nao_agendado", "agendado"].includes(type)
}

async function findPreJudicialCase(decodedId: string) {
  const rows = await prisma.$queryRawUnsafe<PreJudicialCaseRow[]>(
    `
      SELECT
        c.id::text AS id,
        c.protocol_number AS "protocolNumber",
        c.patient_name AS "patientName",
        c.municipality_name AS "municipalityName",
        COALESCE(
          NULLIF(to_jsonb(c)->>'action_records', ''),
          NULLIF(to_jsonb(c)->>'numero_processo', ''),
          NULLIF(to_jsonb(c)->>'process_number', ''),
          NULLIF(to_jsonb(c)->>'processo', ''),
          NULLIF(c.origin_protocol::text, ''),
          c.protocol_number::text
        ) AS "numeroProcesso",
        c.status AS "statusAnterior",
        c.active AS "activeAnterior",
        c.scheduling_status AS "schedulingStatusAnterior"
      FROM public.pre_judicial_casos c
      WHERE
        c.id::text = $1
        OR c.protocol_number::text = $1
        OR c.origin_protocol::text = $1
      LIMIT 1
    `,
    decodedId,
  )

  return rows[0] ?? null
}


// PRE_JUDICIAL_SCHEDULING_EMAIL_NOTIFICATION
async function loadPreJudicialSchedulingFichas(
  casoId: string,
  fichaIds: string[],
) {
  const ids = Array.from(
    new Set(
      fichaIds
        .map((item) => text(item))
        .filter(Boolean),
    ),
  )

  if (ids.length === 0) {
    return prisma.$queryRawUnsafe<
      PreSchedulingFichaRow[]
    >(
      `
        SELECT
          f.id::text AS id,
          COALESCE(
            NULLIF(to_jsonb(f)->>'number', ''),
            NULLIF(to_jsonb(f)->>'numero', ''),
            NULLIF(to_jsonb(f)->>'ficha_core', ''),
            NULLIF(to_jsonb(f)->>'ficha', ''),
            f.id::text
          ) AS "fichaNumero"
        FROM public.pre_judicial_fichas f
        WHERE f.caso_id::text = $1
          AND COALESCE(f.active, TRUE) = TRUE
        ORDER BY
          f.updated_at DESC NULLS LAST,
          f.created_at DESC NULLS LAST
        LIMIT 1
      `,
      casoId,
    )
  }

  return prisma.$queryRawUnsafe<
    PreSchedulingFichaRow[]
  >(
    `
      SELECT
        f.id::text AS id,
        COALESCE(
          NULLIF(to_jsonb(f)->>'number', ''),
          NULLIF(to_jsonb(f)->>'numero', ''),
          NULLIF(to_jsonb(f)->>'ficha_core', ''),
          NULLIF(to_jsonb(f)->>'ficha', ''),
          f.id::text
        ) AS "fichaNumero"
      FROM public.pre_judicial_fichas f
      WHERE f.caso_id::text = $1
        AND f.id::text IN (
          SELECT value
          FROM jsonb_array_elements_text($2::jsonb)
        )
    `,
    casoId,
    JSON.stringify(ids),
  )
}

function formatPreSchedulingEmailDate(
  value: string,
) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Campo_Grande",
  }).format(date)
}

function preSchedulingEmailKeyPart(
  value: unknown,
) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)

    const body = await req.json().catch(() => ({}))

    const type = normalizeMovementType(body?.type || body?.movementType)
    const description = text(body?.description || body?.descricao)

    const dueAt = parseDateTime(
      body?.dueAt ||
        body?.responseDeadlineAt ||
        body?.response_deadline_at ||
        body?.prazoResposta,
    )

    let appointmentDate = parseDateTime(
      body?.appointmentDate || body?.appointment_date || body?.dataAgendamento,
    )

    const attachments = normalizeAttachments(body?.attachments)

    const appointmentFichas = normalizeAppointmentFichas(
      body?.appointmentFichas || body?.fichasAgendamento || body?.fichas || [],
    )

    if (!appointmentDate && appointmentFichas.length > 0) {
      appointmentDate = appointmentFichas[0].appointmentDate
    }

    const user = body?.user || {}
    const userId = text(user?.id || body?.userId || "sistema")
    const userName = text(user?.nome || user?.name || body?.userName || "Sistema")
    const userEmail = text(user?.email || body?.userEmail)

    if (!description) {
      return NextResponse.json(
        { ok: false, error: "Descreva a movimentação." },
        { status: 400 },
      )
    }

    if (type === "envio_agendamento_demanda" && !dueAt) {
      return NextResponse.json(
        { ok: false, error: "Informe o prazo de resposta do Agendamento." },
        { status: 400 },
      )
    }

    if (type === "agendado" && !appointmentDate) {
      return NextResponse.json(
        { ok: false, error: "Informe a data do agendamento." },
        { status: 400 },
      )
    }

    const caso = await findPreJudicialCase(decodedId)

    if (!caso) {
      return NextResponse.json(
        { ok: false, error: "Processo pré judicial não encontrado." },
        { status: 404 },
      )
    }

    const movementId = `pre_mov_${randomUUID()}`
    const nextStatus = statusFromMovement(type)
    const nextSchedulingStatus = schedulingStatusFromMovement(type)

    const descricaoAuditoria = [
      `MOVIMENTAÃ‡ÃƒO PRÉ JUDICIAL: ${movementTypeLabel(type)}`,
      description,
      dueAt ? `Prazo: ${dueAt}` : "",
      appointmentDate ? `Agendamento: ${appointmentDate}` : "",
      attachments.length > 0
        ? `Anexos: ${attachments
            .map((item: any) => item?.name)
            .filter(Boolean)
            .join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n")

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.pre_judicial_movimentacoes (
            id,
            caso_id,
            type,
            description,
            due_at,
            appointment_date,
            attachments,
            created_by,
            created_by_name,
            created_by_email,
            created_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5::timestamptz,
            $6::timestamptz,
            $7::jsonb,
            $8,
            $9,
            $10,
            NOW()
          )
        `,
        movementId,
        caso.id,
        type,
        description,
        dueAt,
        appointmentDate,
        JSON.stringify(attachments),
        userId,
        userName,
        userEmail || null,
      )


      for (const ficha of appointmentFichas) {
        await tx.$executeRawUnsafe(
          `
            UPDATE public.pre_judicial_fichas
            SET
              appointment_date = $2::timestamptz,
              appointment_notes = NULLIF($3, ''),
              appointment_status = 'agendado',
              appointment_updated_at = NOW(),
              appointment_updated_by = $4,
              appointment_updated_by_name = $5,
              updated_by = $4,
              updated_by_name = $5,
              updated_at = NOW()
            WHERE id::text = $1
              AND caso_id::text = $6
          `,
          ficha.id,
          ficha.appointmentDate,
          ficha.notes || description,
          userId,
          userName,
          caso.id,
        )
      }


      await tx.$executeRawUnsafe(
        `
          UPDATE public.pre_judicial_casos
          SET
            status = COALESCE($2, status),
            active = CASE
              WHEN $3 = TRUE THEN FALSE
              WHEN $4 = TRUE THEN TRUE
              ELSE active
            END,
            scheduling_status = COALESCE($5, scheduling_status),
            scheduling_requested_at = CASE
              WHEN $6 IN ('envio_agendamento_demanda', 'encaminhar_direto_agendamento') THEN NOW()
              ELSE scheduling_requested_at
            END,
            scheduling_reserved_at = CASE
              WHEN $6 = 'reserva_agendamento' THEN NOW()
              ELSE scheduling_reserved_at
            END,
            scheduling_response_deadline_at = CASE
              WHEN $6 = 'encaminhar_direto_agendamento' THEN NULL
              WHEN $6 = 'envio_agendamento_demanda' THEN $7::timestamptz
              ELSE scheduling_response_deadline_at
            END,
            updated_by = $8,
            updated_by_name = $9,
            updated_by_email = $10,
            updated_at = NOW()
          WHERE id::text = $1
        `,
        caso.id,
        nextStatus,
        shouldCloseCase(type),
        shouldReopenCase(type),
        nextSchedulingStatus,
        type,
        dueAt,
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.sistema_auditoria (
            tabela_nome,
            acao,
            registro_id,
            usuario_id,
            usuario_nome,
            usuario_email,
            modulo_codigo,
            data_hora,
            dados_anteriores,
            dados_novos,
            campos_alterados,
            observacao
          )
          VALUES (
            'pre_judicial_movimentacoes',
            'registrar_movimentacao_pre_judicial',
            $1,
            $2,
            $3,
            $4,
            'PRE_JUDICIAL',
            NOW(),
            jsonb_build_object(
              'status_anterior', $5::text,
              'active_anterior', $6::boolean,
              'scheduling_status_anterior', $7::text
            ),
            jsonb_build_object(
              'movimentacao_id', $8::text,
              'type', $9::text,
              'description', $10::text,
              'due_at', $11::text,
              'appointment_date', $12::text,
              'attachments', $13::jsonb,
              'status_novo', $14::text,
              'scheduling_status_novo', $15::text
            ),
            jsonb_build_array(
              'pre_judicial_movimentacoes',
              'pre_judicial_casos.status',
              'pre_judicial_casos.active',
              'pre_judicial_casos.scheduling_status'
            ),
            $16
          )
        `,
        caso.id,
        userId,
        userName,
        userEmail || null,
        caso.statusAnterior || null,
        caso.activeAnterior ?? true,
        caso.schedulingStatusAnterior || null,
        movementId,
        type,
        description,
        dueAt,
        appointmentDate,
        JSON.stringify(attachments),
        nextStatus,
        nextSchedulingStatus,
        descricaoAuditoria,
      )
    })


    const emailMunicipioAgendamento:
      Array<Record<string, unknown>> = []

    if (
      type === "agendado" &&
      appointmentDate
    ) {
      try {
        const sourceFichas =
          appointmentFichas.length > 0
            ? appointmentFichas
            : [
                {
                  id: "",
                  appointmentDate,
                  notes: "",
                },
              ]

        const fichaRows =
          await loadPreJudicialSchedulingFichas(
            caso.id,
            sourceFichas
              .map((item) => item.id)
              .filter(Boolean),
          )

        const fichaMap = new Map(
          fichaRows.map((item) => [
            item.id,
            text(item.fichaNumero),
          ]),
        )

        const fallbackFicha =
          text(fichaRows[0]?.fichaNumero) ||
          "Não informada"

        const groupedByDate =
          new Map<string, string[]>()

        for (const item of sourceFichas) {
          const schedulingDate =
            item.appointmentDate ||
            appointmentDate

          if (!schedulingDate) continue

          const fichaNumero =
            text(fichaMap.get(item.id)) ||
            text(item.id) ||
            fallbackFicha

          const current =
            groupedByDate.get(
              schedulingDate,
            ) || []

          current.push(fichaNumero)

          groupedByDate.set(
            schedulingDate,
            current,
          )
        }

        for (
          const [
            schedulingDate,
            fichaNumbers,
          ] of groupedByDate.entries()
        ) {
          const fichas = Array.from(
            new Set(
              fichaNumbers
                .map((item) => text(item))
                .filter(Boolean),
            ),
          )
            .sort()
            .join(", ") || fallbackFicha

          const protocolo =
            text(caso.protocolNumber) ||
            text(caso.id)

          const numeroProcesso =
            text(caso.numeroProcesso) ||
            protocolo

          const duplicateKey = [
            "pre_judicial",
            numeroProcesso,
            fichas,
            schedulingDate,
          ]
            .map(preSchedulingEmailKeyPart)
            .join("|")

          const emailResult =
            await sendMunicipalitySchedulingNotification(
              {
                module: "pre_judicial",
                protocolo,
                pacienteNome:
                  text(caso.patientName) ||
                  "Paciente não informado",
                municipio:
                  text(caso.municipalityName),
                numeroProcesso,
                fichaNumero: fichas,
                dataAgendamento:
                  formatPreSchedulingEmailDate(
                    schedulingDate,
                  ),
                userSistema:
                  userName || "SIGAJUS",
                duplicateKey,
              },
            )

          emailMunicipioAgendamento.push({
            dataAgendamento:
              schedulingDate,
            fichas,
            ...emailResult,
          })
        }
      } catch (emailError) {
        console.error(
          "PRE_JUDICIAL_SCHEDULING_EMAIL_WARNING",
          emailError,
        )

        emailMunicipioAgendamento.push({
          ok: false,
          skipped: true,
          reason:
            emailError instanceof Error
              ? emailError.message
              : "Erro ao enviar e-mail de agendamento.",
        })
      }
    }
    return NextResponse.json({
      ok: true,
      item: {
        id: movementId,
        caseId: caso.id,
        protocolNumber: caso.protocolNumber,
        patientName: caso.patientName,
        type,
        typeLabel: movementTypeLabel(type),
        description,
        dueAt,
        appointmentDate,
        attachments,
        status: nextStatus,
        schedulingStatus: nextSchedulingStatus,
        active: false,
        createdAt: new Date().toISOString(),
        createdById: userId,
        createdByName: userName,
        emailMunicipioAgendamento,
      },
    })
  } catch (error) {
    console.error("[POST /api/pre-judicial/casos/[id]/movimentacoes] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao registrar movimentação pré judicial." },
      { status: 500 },
    )
  }
}
