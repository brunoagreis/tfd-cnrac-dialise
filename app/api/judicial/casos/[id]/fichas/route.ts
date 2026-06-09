import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type JudicialBaseRow = {
  monitoramentoId: string
  demandaId: string | null
  pacienteNome: string | null
  protocolo: string | null
}

type JudicialFichaRow = {
  id: string
  system: string | null
  number: string | null
  notes: string | null
  active: boolean | null
  status: string | null
}

type RequestUser = {
  id: string
  nome: string
  email: string
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeSystem(value: unknown): "CORE" | "SISREG" | "OUTRO" {
  const system = text(value).toUpperCase()
  if (system === "SISREG") return "SISREG"
  if (system === "OUTRO") return "OUTRO"
  return "CORE"
}

function normalizeFichaStatus(value: unknown) {
  const status = text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (status === "falta") return "falta"
  if (status === "obito") return "obito"
  if (status === "inativa") return "inativa"
  return "atendido"
}

function bool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  const normalized = text(value).toLowerCase()
  if (["1", "true", "sim", "yes", "s"].includes(normalized)) return true
  if (["0", "false", "nao", "não", "no", "n"].includes(normalized)) return false
  return fallback
}

function getRequestUser(body: any): RequestUser {
  return {
    id: text(body?.user?.id || body?.userId || "sistema"),
    nome: text(body?.user?.nome || body?.user?.name || body?.userName || "Sistema"),
    email: text(body?.user?.email || body?.userEmail),
  }
}

async function findJudicialCase(decodedId: string) {
  const rows = await prisma.$queryRawUnsafe<JudicialBaseRow[]>(
    `
      SELECT
        b.id::text AS "monitoramentoId",
        b.demanda_id::text AS "demandaId",
        b.nome_paciente AS "pacienteNome",
        COALESCE(d.protocolo::text, b.demanda_id::text) AS protocolo
      FROM public.judicial_monitoramento_base b
      LEFT JOIN public.demandas d
        ON d.id = b.demanda_id
      WHERE UPPER(COALESCE(b.origem_modulo, '')) = 'JUDICIAL'
        AND (
          b.id::text = $1
          OR b.demanda_id::text = $1
          OR b.origem_registro_id::text = $1
          OR d.id::text = $1
          OR d.protocolo::text = $1
        )
      ORDER BY b.id DESC
      LIMIT 1
    `,
    decodedId,
  )

  return rows[0] ?? null
}

async function findFicha(monitoramentoId: string, fichaId: string) {
  const rows = await prisma.$queryRawUnsafe<JudicialFichaRow[]>(
    `
      SELECT
        id::text AS id,
        system,
        number,
        notes,
        active,
        status
      FROM public.judicial_fichas
      WHERE monitoramento_id = $1::bigint
        AND id::text = $2
      LIMIT 1
    `,
    monitoramentoId,
    fichaId,
  )

  return rows[0] ?? null
}

async function insertMovement(tx: any, params: {
  processo: JudicialBaseRow
  description: string
  user: RequestUser
}) {
  await tx.$executeRawUnsafe(
    `
      INSERT INTO public.judicial_movimentacoes (
        id,
        monitoramento_id,
        demanda_id,
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
        $2::bigint,
        $3,
        'monitoramento',
        $4,
        '[]'::jsonb,
        $5,
        $6,
        $7,
        NOW()
      )
    `,
    `jmov_ficha_${randomUUID()}`,
    params.processo.monitoramentoId,
    params.processo.demandaId || null,
    params.description,
    params.user.id,
    params.user.nome,
    params.user.email || null,
  )
}

async function insertAudit(tx: any, params: {
  processo: JudicialBaseRow
  fichaId: string
  action: string
  description: string
  user: RequestUser
}) {
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
        'judicial_fichas',
        $1,
        $2,
        $3,
        $4,
        $5,
        'JUDICIAL',
        NOW(),
        jsonb_build_object(),
        jsonb_build_object(
          'ficha_id', $6::text,
          'monitoramento_id', $2::text,
          'descricao', $7::text
        ),
        jsonb_build_array('judicial_fichas'),
        $7
      )
    `,
    params.action,
    params.processo.monitoramentoId,
    params.user.id,
    params.user.nome,
    params.user.email || null,
    params.fichaId,
    params.description,
  )
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)
    const body = await req.json().catch(() => ({}))

    const system = normalizeSystem(body?.system)
    const number = text(body?.number ?? body?.numero)
    const requestedInclusion = bool(body?.requestedInclusion ?? body?.requested_inclusion)
    const hasJudicialMark = bool(body?.hasJudicialMark ?? body?.has_judicial_mark, true)
    const attachmentName = text(body?.attachmentName ?? body?.attachment_name)
    const attachmentUrl = text(body?.attachmentUrl ?? body?.attachment_url)
    const attachmentRelativePath = text(body?.attachmentRelativePath ?? body?.attachment_relative_path)
    const notes = text(body?.notes ?? body?.observacoes)
    const user = getRequestUser(body)

    if (!number) {
      return NextResponse.json(
        { ok: false, error: "Informe o número da ficha." },
        { status: 400 },
      )
    }

    const processo = await findJudicialCase(decodedId)

    if (!processo) {
      return NextResponse.json(
        { ok: false, error: "Processo judicial não encontrado." },
        { status: 404 },
      )
    }

    const fichaId = `jf_${randomUUID()}`
    const movementId = `jmov_ficha_${randomUUID()}`
    const attachments = attachmentName
      ? [
          {
            name: attachmentName,
            url: attachmentUrl || undefined,
            relativePath: attachmentRelativePath || undefined,
          },
        ]
      : []

    const movimentoDescricao = [
      `Ficha ${system} cadastrada: ${number}`,
      requestedInclusion ? "Inclusão solicitada: sim" : "Inclusão solicitada: não",
      hasJudicialMark ? "Marca judicial: sim" : "Marca judicial: não",
      notes ? `Observações: ${notes}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.judicial_fichas (
            id,
            monitoramento_id,
            demanda_id,
            system,
            number,
            requested_inclusion,
            has_judicial_mark,
            attachment_name,
            attachment_url,
            attachment_relative_path,
            notes,
            active,
            created_by,
            created_by_name,
            created_at,
            updated_at,
            updated_by,
            updated_by_name
          )
          VALUES (
            $1,
            $2::bigint,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            TRUE,
            $12,
            $13,
            NOW(),
            NOW(),
            $12,
            $13
          )
        `,
        fichaId,
        processo.monitoramentoId,
        processo.demandaId || null,
        system,
        number,
        requestedInclusion,
        hasJudicialMark,
        attachmentName || null,
        attachmentUrl || null,
        attachmentRelativePath || null,
        notes || null,
        user.id,
        user.nome,
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_base
          SET
            ficha_core = CASE WHEN $2 = 'CORE' THEN $3 ELSE ficha_core END,
            status_monitoramento_atual = CASE
              WHEN $2 IN ('CORE', 'SISREG') THEN 'MONITORAMENTO_AUTOMATICO'
              ELSE status_monitoramento_atual
            END,
            data_ultimo_monitoramento = NOW(),
            updated_at = NOW()
          WHERE id::text = $1
        `,
        processo.monitoramentoId,
        system,
        number,
      )

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.judicial_movimentacoes (
            id,
            monitoramento_id,
            demanda_id,
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
            $2::bigint,
            $3,
            'monitoramento',
            $4,
            $5::jsonb,
            $6,
            $7,
            $8,
            NOW()
          )
        `,
        movementId,
        processo.monitoramentoId,
        processo.demandaId || null,
        movimentoDescricao,
        JSON.stringify(attachments),
        user.id,
        user.nome,
        user.email || null,
      )

      await insertAudit(tx, {
        processo,
        fichaId,
        action: "cadastrar_ficha_judicial",
        description: movimentoDescricao,
        user,
      })
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: fichaId,
        monitoramentoId: processo.monitoramentoId,
        demandaId: processo.demandaId,
        protocolo: processo.protocolo,
        pacienteNome: processo.pacienteNome,
        system,
        number,
      },
    })
  } catch (error) {
    console.error("[POST /api/judicial/casos/[id]/fichas] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao cadastrar ficha judicial." },
      { status: 500 },
    )
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)
    const body = await req.json().catch(() => ({}))
    const fichaId = text(body?.fichaId || body?.id)
    const action = text(body?.action || body?.acao).toLowerCase()
    const reason = text(body?.reason || body?.motivo || body?.statusReason)
    const user = getRequestUser(body)

    if (!fichaId) {
      return NextResponse.json(
        { ok: false, error: "Informe a ficha." },
        { status: 400 },
      )
    }

    const processo = await findJudicialCase(decodedId)

    if (!processo) {
      return NextResponse.json(
        { ok: false, error: "Processo judicial não encontrado." },
        { status: 404 },
      )
    }

    const ficha = await findFicha(processo.monitoramentoId, fichaId)

    if (!ficha) {
      return NextResponse.json(
        { ok: false, error: "Ficha não encontrada." },
        { status: 404 },
      )
    }

    if (action === "status") {
      const status = normalizeFichaStatus(body?.status)
      if (!reason) {
        return NextResponse.json(
          { ok: false, error: "Justifique a alteração do status da ficha." },
          { status: 400 },
        )
      }

      const description = `Status da ficha ${ficha.system || ""} ${ficha.number || ficha.id} alterado para ${status}. Justificativa: ${reason}`

      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `
            UPDATE public.judicial_fichas
            SET
              status = $3,
              status_reason = $4,
              status_updated_at = NOW(),
              status_updated_by = $5,
              status_updated_by_name = $6,
              updated_at = NOW(),
              updated_by = $5,
              updated_by_name = $6
            WHERE monitoramento_id = $1::bigint
              AND id::text = $2
          `,
          processo.monitoramentoId,
          fichaId,
          status,
          reason,
          user.id,
          user.nome,
        )

        await insertMovement(tx, { processo, description, user })
        await insertAudit(tx, {
          processo,
          fichaId,
          action: "alterar_status_ficha_judicial",
          description,
          user,
        })
      })

      return NextResponse.json({ ok: true })
    }

    if (action === "inativar") {
      const description = `Ficha ${ficha.system || ""} ${ficha.number || ficha.id} inativada. Motivo: ${reason || "Não informado"}`

      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `
            UPDATE public.judicial_fichas
            SET
              active = FALSE,
              inactive_reason = $3,
              updated_at = NOW(),
              updated_by = $4,
              updated_by_name = $5
            WHERE monitoramento_id = $1::bigint
              AND id::text = $2
          `,
          processo.monitoramentoId,
          fichaId,
          reason || "Inativada pelo usuário",
          user.id,
          user.nome,
        )

        await insertMovement(tx, { processo, description, user })
        await insertAudit(tx, {
          processo,
          fichaId,
          action: "inativar_ficha_judicial",
          description,
          user,
        })
      })

      return NextResponse.json({ ok: true })
    }

    if (action === "reativar") {
      const description = `Ficha ${ficha.system || ""} ${ficha.number || ficha.id} reativada.`

      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `
            UPDATE public.judicial_fichas
            SET
              active = TRUE,
              inactive_reason = NULL,
              updated_at = NOW(),
              updated_by = $3,
              updated_by_name = $4
            WHERE monitoramento_id = $1::bigint
              AND id::text = $2
          `,
          processo.monitoramentoId,
          fichaId,
          user.id,
          user.nome,
        )

        await insertMovement(tx, { processo, description, user })
        await insertAudit(tx, {
          processo,
          fichaId,
          action: "reativar_ficha_judicial",
          description,
          user,
        })
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json(
      { ok: false, error: "Ação inválida para a ficha." },
      { status: 400 },
    )
  } catch (error) {
    console.error("[PATCH /api/judicial/casos/[id]/fichas] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao atualizar ficha judicial." },
      { status: 500 },
    )
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)
    const body = await req.json().catch(() => ({}))
    const fichaId = text(body?.fichaId || body?.id)
    const reason = text(body?.reason || body?.motivo)
    const user = getRequestUser(body)

    if (!fichaId) {
      return NextResponse.json(
        { ok: false, error: "Informe a ficha." },
        { status: 400 },
      )
    }

    const processo = await findJudicialCase(decodedId)

    if (!processo) {
      return NextResponse.json(
        { ok: false, error: "Processo judicial não encontrado." },
        { status: 404 },
      )
    }

    const ficha = await findFicha(processo.monitoramentoId, fichaId)

    if (!ficha) {
      return NextResponse.json(
        { ok: false, error: "Ficha não encontrada." },
        { status: 404 },
      )
    }

    const description = `Ficha ${ficha.system || ""} ${ficha.number || ficha.id} excluída. Motivo: ${reason || "Não informado"}`

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          DELETE FROM public.judicial_fichas
          WHERE monitoramento_id = $1::bigint
            AND id::text = $2
        `,
        processo.monitoramentoId,
        fichaId,
      )

      await insertMovement(tx, { processo, description, user })
      await insertAudit(tx, {
        processo,
        fichaId,
        action: "excluir_ficha_judicial",
        description,
        user,
      })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/judicial/casos/[id]/fichas] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao excluir ficha judicial." },
      { status: 500 },
    )
  }
}
