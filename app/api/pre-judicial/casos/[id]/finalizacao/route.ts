import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PreJudicialCaseRow = {
  id: string
  protocolNumber: string | null
  patientName: string | null
  statusAnterior: string | null
  activeAnterior: boolean | null
}

const STATUS_PERMITIDOS = [
  "pendente",
  "resolvido",
  "cumprido",
  "bloqueio",
  "sequestro",
  "obito",
  "arquivado",
  "devolvida",
] as const

type StatusFinalizacao = (typeof STATUS_PERMITIDOS)[number]

function text(value: unknown) {
  return String(value ?? "").trim()
}

function parseMoney(value: unknown) {
  const raw = text(value)

  if (!raw) return null

  const normalized = raw
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")

  const number = Number(normalized)

  if (!Number.isFinite(number)) return null

  return number
}

function normalizeText(value: unknown) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
}

function normalizarStatus(value: unknown): StatusFinalizacao | null {
  const status = normalizeText(value)

  if (status === "pendente") return "pendente"
  if (status === "resolvido" || status === "resolver") return "resolvido"
  if (status === "cumprido" || status === "cumprida") return "cumprido"
  if (status === "bloqueio") return "bloqueio"
  if (status === "sequestro") return "sequestro"
  if (status === "obito") return "obito"
  if (status === "arquivado" || status === "arquivada") return "arquivado"
  if (status === "devolvida" || status === "devolvido") return "devolvida"

  return null
}

function normalizarPendingLocation(value: unknown) {
  const local = normalizeText(value)

  if (local === "ses") return "ses"
  if (local === "core") return "core"
  if (local === "municipio") return "municipio"

  return ""
}

function statusLabel(status: StatusFinalizacao) {
  const labels: Record<StatusFinalizacao, string> = {
    pendente: "Pendente",
    resolvido: "Resolvido",
    cumprido: "Cumprido",
    bloqueio: "Bloqueio",
    sequestro: "Sequestro",
    obito: "Óbito",
    arquivado: "Arquivado",
    devolvida: "Devolvida",
  }

  return labels[status]
}

function pendingLocationLabel(value: string) {
  if (value === "ses") return "Pendente SES"
  if (value === "core") return "Pendente CORE"
  if (value === "municipio") return "Pendente Município"

  return ""
}

function isClosingStatus(status: StatusFinalizacao) {
  return ["resolvido", "cumprido", "obito", "arquivado", "devolvida"].includes(
    status,
  )
}

function movementTypeForStatus(status: StatusFinalizacao) {
  if (isClosingStatus(status)) return "encerramento"

  return "interacao"
}

async function findPreJudicialCase(decodedId: string) {
  const rows = await prisma.$queryRawUnsafe<PreJudicialCaseRow[]>(
    `
      SELECT
        c.id::text AS id,
        c.protocol_number AS "protocolNumber",
        c.patient_name AS "patientName",
        c.status AS "statusAnterior",
        c.active AS "activeAnterior"
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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)

    const body = await req.json().catch(() => ({}))

    const status = normalizarStatus(body?.status)
    const pendingLocation = normalizarPendingLocation(body?.pendingLocation)
    const reason = text(body?.reason)

    const valorEstado = parseMoney(
      body?.valorEstado ??
        body?.stateAmount ??
        body?.estadoAmount ??
        body?.stateValue,
    )

    const valorMunicipio = parseMoney(
      body?.valorMunicipio ??
        body?.municipalityAmount ??
        body?.municipioAmount ??
        body?.municipalityValue,
    )

    const user = body?.user || {}
    const userId = text(user?.id || body?.userId || "sistema")
    const userName = text(user?.nome || user?.name || body?.userName || "Sistema")
    const userEmail = text(user?.email || body?.userEmail)

    if (!status) {
      return NextResponse.json(
        { ok: false, error: "Status de finalização inválido." },
        { status: 400 },
      )
    }

    if (status === "pendente") {
      if (!pendingLocation) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Informe onde está pendente: Pendente SES, Pendente CORE ou Pendente Município.",
          },
          { status: 400 },
        )
      }

      if (!reason) {
        return NextResponse.json(
          { ok: false, error: "Justifique a pendência antes de salvar." },
          { status: 400 },
        )
      }
    }

    if ((status === "resolvido" || status === "cumprido") && !reason) {
      return NextResponse.json(
        {
          ok: false,
          error:
            status === "cumprido"
              ? "Justifique o cumprimento antes de salvar."
              : "Justifique a resolução antes de salvar.",
        },
        { status: 400 },
      )
    }

    if ((status === "obito" || status === "arquivado" || status === "devolvida") && !reason) {
      return NextResponse.json(
        {
          ok: false,
          error:
            status === "obito"
              ? "Justifique o óbito antes de salvar."
              : status === "arquivado"
                ? "Justifique o arquivamento antes de salvar."
                : "Justifique a devolução antes de salvar.",
        },
        { status: 400 },
      )
    }

    if (status === "bloqueio" || status === "sequestro") {
      if (valorEstado === null || valorEstado <= 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              status === "bloqueio"
                ? "Informe o valor do bloqueio para o Estado."
                : "Informe o valor do sequestro para o Estado.",
          },
          { status: 400 },
        )
      }

      if (valorMunicipio === null || valorMunicipio <= 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              status === "bloqueio"
                ? "Informe o valor do bloqueio para o Município."
                : "Informe o valor do sequestro para o Município.",
          },
          { status: 400 },
        )
      }
    }

    const caso = await findPreJudicialCase(decodedId)

    if (!caso) {
      return NextResponse.json(
        { ok: false, error: "Processo pré judicial não encontrado." },
        { status: 404 },
      )
    }

    const finalizacaoId = `pre_fin_${randomUUID()}`
    const movimentoId = `pre_mov_${randomUUID()}`
    const label = statusLabel(status)
    const localLabel = pendingLocationLabel(pendingLocation)

    const descricao = [
      `FINALIZAÇÃO DA DEMANDA PRÉ JUDICIAL: ${label}`,
      localLabel ? `Pendente em: ${localLabel}` : "",
      reason ? `Justificativa: ${reason}` : "",
      status === "bloqueio" && valorEstado !== null
        ? `Valor do bloqueio para o Estado: R$ ${valorEstado.toFixed(2)}`
        : "",
      status === "bloqueio" && valorMunicipio !== null
        ? `Valor do bloqueio para o Município: R$ ${valorMunicipio.toFixed(2)}`
        : "",
      status === "sequestro" && valorEstado !== null
        ? `Valor do sequestro para o Estado: R$ ${valorEstado.toFixed(2)}`
        : "",
      status === "sequestro" && valorMunicipio !== null
        ? `Valor do sequestro para o Município: R$ ${valorMunicipio.toFixed(2)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n")

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.pre_judicial_finalizacoes (
            id,
            caso_id,
            status,
            pending_location,
            reason,
            valor_estado,
            valor_municipio,
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
            $5,
            $6::numeric,
            $7::numeric,
            $8,
            $9,
            $10,
            NOW()
          )
        `,
        finalizacaoId,
        caso.id,
        status,
        pendingLocation || null,
        reason || null,
        valorEstado,
        valorMunicipio,
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.pre_judicial_movimentacoes (
            id,
            caso_id,
            type,
            description,
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
            '[]'::jsonb,
            $5,
            $6,
            $7,
            NOW()
          )
        `,
        movimentoId,
        caso.id,
        movementTypeForStatus(status),
        descricao,
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.pre_judicial_casos
          SET
            status = $2,
            active = CASE
              WHEN $3 = TRUE THEN FALSE
              ELSE active
            END,
            updated_by = $4,
            updated_by_name = $5,
            updated_by_email = $6,
            updated_at = NOW()
          WHERE id::text = $1
        `,
        caso.id,
        status,
        isClosingStatus(status),
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
            'pre_judicial_finalizacoes',
            'finalizar_demanda_pre_judicial',
            $1,
            $2,
            $3,
            $4,
            'PRE_JUDICIAL',
            NOW(),
            jsonb_build_object(
              'status_anterior', $5::text,
              'active_anterior', $6::boolean
            ),
            jsonb_build_object(
              'finalizacao_id', $7::text,
              'status', $8::text,
              'pending_location', $9::text,
              'reason', $10::text,
              'valor_estado', $11::numeric,
              'valor_municipio', $12::numeric,
              'movimento_id', $13::text
            ),
            jsonb_build_array(
              'pre_judicial_finalizacoes',
              'pre_judicial_movimentacoes',
              'pre_judicial_casos.status',
              'pre_judicial_casos.active'
            ),
            $14
          )
        `,
        caso.id,
        userId,
        userName,
        userEmail || null,
        caso.statusAnterior || null,
        caso.activeAnterior ?? true,
        finalizacaoId,
        status,
        pendingLocation || null,
        reason || null,
        valorEstado,
        valorMunicipio,
        movimentoId,
        descricao,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: finalizacaoId,
        caseId: caso.id,
        protocolNumber: caso.protocolNumber,
        patientName: caso.patientName,
        status,
        statusLabel: label,
        pendingLocation: pendingLocation || null,
        reason: reason || null,
        valorEstado,
        valorMunicipio,
        movementId: movimentoId,
        active: !isClosingStatus(status),
        createdAt: new Date().toISOString(),
        createdById: userId,
        createdByName: userName,
      },
    })
  } catch (error) {
    console.error("[POST /api/pre-judicial/casos/[id]/finalizacao] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao finalizar demanda pré judicial." },
      { status: 500 },
    )
  }
}