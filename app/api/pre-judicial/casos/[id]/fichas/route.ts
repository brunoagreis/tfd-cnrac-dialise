import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeSystem(value: unknown) {
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
  if (status === "finalizada") return "finalizada"
  if (status === "atendido") return "atendido"

  return status || "atendido"
}

function getRequestUser(body: any) {
  return {
    id: text(body?.user?.id || body?.userId || "sistema"),
    nome: text(body?.user?.nome || body?.user?.name || body?.userName || "Sistema"),
    email: text(body?.user?.email || body?.userEmail),
  }
}

async function findPreJudicialCase(decodedId: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT
        id::text AS id,
        protocol_number AS protocolo,
        patient_name AS "pacienteNome"
      FROM public.pre_judicial_casos
      WHERE id::text = $1
         OR protocol_number::text = $1
         OR origin_protocol::text = $1
      LIMIT 1
    `,
    decodedId,
  )

  return rows[0] ?? null
}

async function findFicha(casoId: string, fichaId: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT
        id::text AS id,
        system,
        number,
        notes,
        active,
        status
      FROM public.pre_judicial_fichas
      WHERE caso_id::text = $1
        AND id::text = $2
      LIMIT 1
    `,
    casoId,
    fichaId,
  )

  return rows[0] ?? null
}

async function registrarMovimentacao(params: {
  casoId: string
  type: string
  description: string
  userId: string
  userName: string
  userEmail: string
}) {
  try {
    await prisma.$executeRawUnsafe(
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
          NULL,
          NULL,
          '[]'::jsonb,
          $5,
          $6,
          $7,
          NOW()
        )
      `,
      `pmov_ficha_${randomUUID()}`,
      params.casoId,
      params.type,
      params.description,
      params.userId,
      params.userName,
      params.userEmail || null,
    )
  } catch (error) {
    console.warn("[pre-judicial-fichas] ficha salva, mas movimentação não registrada:", error)
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)
    const body = await req.json().catch(() => ({}))

    const caso = await findPreJudicialCase(decodedId)

    if (!caso) {
      return NextResponse.json(
        { ok: false, error: "Processo pré-judicial não encontrado." },
        { status: 404 },
      )
    }

    const system = normalizeSystem(body?.system)
    const number = text(body?.number || body?.numero || body?.ficha)
    const requestedInclusion = Boolean(body?.requestedInclusion ?? body?.requested_inclusion ?? false)
    const hasJudicialMark = Boolean(body?.hasJudicialMark ?? body?.has_judicial_mark ?? false)
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

    const fichaId = `pf_${randomUUID()}`

    await prisma.$executeRawUnsafe(
      `
        INSERT INTO public.pre_judicial_fichas (
          id,
          caso_id,
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
          updated_by,
          updated_by_name,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          TRUE,
          $11,
          $12,
          NOW(),
          $11,
          $12,
          NOW()
        )
      `,
      fichaId,
      caso.id,
      system,
      number,
      requestedInclusion,
      hasJudicialMark,
      attachmentName || null,
      attachmentUrl || null,
      attachmentRelativePath || null,
      notes,
      user.id,
      user.nome,
    )

    await registrarMovimentacao({
      casoId: caso.id,
      type: "ficha",
      description: [
        `Ficha ${system} cadastrada: ${number}`,
        requestedInclusion ? "Inclusão solicitada: sim" : "Inclusão solicitada: não",
        hasJudicialMark ? "Judicial marcada: sim" : "Judicial marcada: não",
        notes ? `Observações: ${notes}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      userId: user.id,
      userName: user.nome,
      userEmail: user.email,
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: fichaId,
        casoId: caso.id,
        protocolo: caso.protocolo,
        pacienteNome: caso.pacienteNome,
        system,
        number,
        requestedInclusion,
        hasJudicialMark,
        notes,
        active: true,
      },
    })
  } catch (error) {
    console.error("[POST /api/pre-judicial/casos/[id]/fichas] erro:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao cadastrar ficha.",
      },
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

    const caso = await findPreJudicialCase(decodedId)

    if (!caso) {
      return NextResponse.json(
        { ok: false, error: "Processo pré-judicial não encontrado." },
        { status: 404 },
      )
    }

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

    const ficha = await findFicha(caso.id, fichaId)

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

      await prisma.$executeRawUnsafe(
        `
          UPDATE public.pre_judicial_fichas
          SET
            status = $3,
            status_reason = $4,
            status_updated_at = NOW(),
            status_updated_by = $5,
            status_updated_by_name = $6,
            updated_at = NOW(),
            updated_by = $5,
            updated_by_name = $6
          WHERE caso_id::text = $1
            AND id::text = $2
        `,
        caso.id,
        fichaId,
        status,
        reason,
        user.id,
        user.nome,
      )

      await registrarMovimentacao({
        casoId: caso.id,
        type: "ficha",
        description: `Status da ficha ${ficha.system || ""} ${ficha.number || ficha.id} alterado para ${status}. Justificativa: ${reason}`,
        userId: user.id,
        userName: user.nome,
        userEmail: user.email,
      })

      return NextResponse.json({ ok: true })
    }

    if (action === "inativar") {
      await prisma.$executeRawUnsafe(
        `
          UPDATE public.pre_judicial_fichas
          SET
            active = FALSE,
            inactive_reason = $3,
            updated_at = NOW(),
            updated_by = $4,
            updated_by_name = $5
          WHERE caso_id::text = $1
            AND id::text = $2
        `,
        caso.id,
        fichaId,
        reason || "Inativada pelo usuário",
        user.id,
        user.nome,
      )

      await registrarMovimentacao({
        casoId: caso.id,
        type: "ficha",
        description: `Ficha ${ficha.system || ""} ${ficha.number || ficha.id} inativada. Motivo: ${reason || "Não informado"}`,
        userId: user.id,
        userName: user.nome,
        userEmail: user.email,
      })

      return NextResponse.json({ ok: true })
    }

    if (action === "reativar") {
      await prisma.$executeRawUnsafe(
        `
          UPDATE public.pre_judicial_fichas
          SET
            active = TRUE,
            inactive_reason = NULL,
            updated_at = NOW(),
            updated_by = $3,
            updated_by_name = $4
          WHERE caso_id::text = $1
            AND id::text = $2
        `,
        caso.id,
        fichaId,
        user.id,
        user.nome,
      )

      await registrarMovimentacao({
        casoId: caso.id,
        type: "ficha",
        description: `Ficha ${ficha.system || ""} ${ficha.number || ficha.id} reativada.`,
        userId: user.id,
        userName: user.nome,
        userEmail: user.email,
      })

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json(
      { ok: false, error: "Ação inválida para a ficha." },
      { status: 400 },
    )
  } catch (error) {
    console.error("[PATCH /api/pre-judicial/casos/[id]/fichas] erro:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao atualizar ficha.",
      },
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

    const caso = await findPreJudicialCase(decodedId)

    if (!caso) {
      return NextResponse.json(
        { ok: false, error: "Processo pré-judicial não encontrado." },
        { status: 404 },
      )
    }

    const fichaId = text(body?.fichaId || body?.id)
    const reason = text(body?.reason || body?.motivo)
    const user = getRequestUser(body)

    if (!fichaId) {
      return NextResponse.json(
        { ok: false, error: "Informe a ficha." },
        { status: 400 },
      )
    }

    const ficha = await findFicha(caso.id, fichaId)

    if (!ficha) {
      return NextResponse.json(
        { ok: false, error: "Ficha não encontrada." },
        { status: 404 },
      )
    }

    await prisma.$executeRawUnsafe(
      `
        DELETE FROM public.pre_judicial_fichas
        WHERE caso_id::text = $1
          AND id::text = $2
      `,
      caso.id,
      fichaId,
    )

    await registrarMovimentacao({
      casoId: caso.id,
      type: "ficha",
      description: `Ficha ${ficha.system || ""} ${ficha.number || ficha.id} excluída. Motivo: ${reason || "Não informado"}`,
      userId: user.id,
      userName: user.nome,
      userEmail: user.email,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/pre-judicial/casos/[id]/fichas] erro:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao excluir ficha.",
      },
      { status: 500 },
    )
  }
}
