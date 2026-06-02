import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ProcedimentoRow = {
  id: string
  casoId: string
  sigtapCode: string | null
  description: string | null
  specialty: string | null
  subSpecialty: string | null
  situation: string | null
  active: boolean | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

async function findProcedure(caseId: string, procedimentoId: string) {
  const rows = await prisma.$queryRawUnsafe<ProcedimentoRow[]>(
    `
      SELECT
        p.id::text AS id,
        p.caso_id::text AS "casoId",
        p.sigtap_code AS "sigtapCode",
        p.description,
        p.specialty,
        p.sub_specialty AS "subSpecialty",
        p.situation,
        p.active
      FROM public.pre_judicial_procedimentos p
      INNER JOIN public.pre_judicial_casos c
        ON c.id = p.caso_id
      WHERE
        (
          c.id::text = $1
          OR c.protocol_number::text = $1
          OR c.origin_protocol::text = $1
        )
        AND (
          p.id::text = $2
          OR p.sigtap_code = $2
        )
      LIMIT 1
    `,
    caseId,
    procedimentoId,
  )

  return rows[0] ?? null
}

async function updateProcedureActive(params: {
  caseId: string
  procedimentoId: string
  active: boolean
  reason: string
  userId: string
  userName: string
  userEmail: string | null
}) {
  const {
    caseId,
    procedimentoId,
    active,
    reason,
    userId,
    userName,
    userEmail,
  } = params

  const procedimento = await findProcedure(caseId, procedimentoId)

  if (!procedimento) {
    return {
      ok: false as const,
      status: 404,
      error: "Procedimento pré judicial não encontrado.",
    }
  }

  if (procedimento.active === active) {
    return {
      ok: true as const,
      item: {
        id: procedimento.id,
        caseId: procedimento.casoId,
        active,
      },
    }
  }

  const movimentoId = `pre_mov_${randomUUID()}`
  const acao = active
    ? "reativar_procedimento_pre_judicial"
    : "inativar_procedimento_pre_judicial"

  const descricao = [
    active
      ? `Procedimento SIGTAP reativado: ${procedimento.sigtapCode} - ${procedimento.description}`
      : `Procedimento SIGTAP inativado: ${procedimento.sigtapCode} - ${procedimento.description}`,
    reason ? `Motivo: ${reason}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        UPDATE public.pre_judicial_procedimentos
        SET
          active = $2::boolean,
          inactive_reason = CASE
            WHEN $2::boolean = FALSE THEN $3
            ELSE NULL
          END,
          updated_by = $4,
          updated_by_name = $5,
          updated_by_email = $6,
          updated_at = NOW()
        WHERE id::text = $1
      `,
      procedimento.id,
      active,
      reason || null,
      userId,
      userName,
      userEmail,
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
          'interacao',
          $3,
          '[]'::jsonb,
          $4,
          $5,
          $6,
          NOW()
        )
      `,
      movimentoId,
      procedimento.casoId,
      descricao,
      userId,
      userName,
      userEmail,
    )

    await tx.$executeRawUnsafe(
      `
        UPDATE public.pre_judicial_casos
        SET
          updated_by = $2,
          updated_by_name = $3,
          updated_by_email = $4,
          updated_at = NOW()
        WHERE id::text = $1
      `,
      procedimento.casoId,
      userId,
      userName,
      userEmail,
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
          'pre_judicial_procedimentos',
          $1,
          $2,
          $3,
          $4,
          $5,
          'PRE_JUDICIAL',
          NOW(),
          jsonb_build_object(
            'procedimento_id', $6::text,
            'active', $7::boolean,
            'sigtap_code', $8::text,
            'description', $9::text,
            'specialty', $10::text,
            'sub_specialty', $11::text,
            'situation', $12::text
          ),
          jsonb_build_object(
            'procedimento_id', $6::text,
            'active', $13::boolean,
            'inactive_reason', $14::text,
            'movimento_id', $15::text
          ),
          jsonb_build_array(
            'pre_judicial_procedimentos.active',
            'pre_judicial_procedimentos.inactive_reason',
            'pre_judicial_movimentacoes'
          ),
          $16
        )
      `,
      acao,
      procedimento.casoId,
      userId,
      userName,
      userEmail,
      procedimento.id,
      Boolean(procedimento.active),
      procedimento.sigtapCode || null,
      procedimento.description || null,
      procedimento.specialty || null,
      procedimento.subSpecialty || null,
      procedimento.situation || null,
      active,
      reason || null,
      movimentoId,
      descricao,
    )
  })

  return {
    ok: true as const,
    item: {
      id: procedimento.id,
      caseId: procedimento.casoId,
      sigtapCode: procedimento.sigtapCode,
      description: procedimento.description,
      active,
      inactiveReason: active ? null : reason || null,
      movementId: movimentoId,
    },
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; procedimentoId: string }> },
) {
  try {
    const { id, procedimentoId } = await context.params
    const decodedCaseId = decodeURIComponent(id)
    const decodedProcedimentoId = decodeURIComponent(procedimentoId)

    const body = await req.json().catch(() => ({}))

    const active =
      typeof body?.active === "boolean" ? body.active : Boolean(body?.active)

    const reason = text(body?.reason)

    const user = body?.user || {}
    const userId = text(user?.id || body?.userId || "sistema")
    const userName = text(user?.nome || user?.name || body?.userName || "Sistema")
    const userEmail = text(user?.email || body?.userEmail) || null

    const result = await updateProcedureActive({
      caseId: decodedCaseId,
      procedimentoId: decodedProcedimentoId,
      active,
      reason,
      userId,
      userName,
      userEmail,
    })

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      )
    }

    return NextResponse.json({
      ok: true,
      item: result.item,
    })
  } catch (error) {
    console.error(
      "[PATCH /api/pre-judicial/casos/[id]/procedimentos/[procedimentoId]] erro:",
      error,
    )

    return NextResponse.json(
      { ok: false, error: "Erro ao atualizar procedimento pré judicial." },
      { status: 500 },
    )
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; procedimentoId: string }> },
) {
  try {
    const { id, procedimentoId } = await context.params
    const decodedCaseId = decodeURIComponent(id)
    const decodedProcedimentoId = decodeURIComponent(procedimentoId)

    const body = await req.json().catch(() => ({}))

    const reason = text(body?.reason)

    const user = body?.user || {}
    const userId = text(user?.id || body?.userId || "sistema")
    const userName = text(user?.nome || user?.name || body?.userName || "Sistema")
    const userEmail = text(user?.email || body?.userEmail) || null

    const result = await updateProcedureActive({
      caseId: decodedCaseId,
      procedimentoId: decodedProcedimentoId,
      active: false,
      reason,
      userId,
      userName,
      userEmail,
    })

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status },
      )
    }

    return NextResponse.json({
      ok: true,
      item: result.item,
    })
  } catch (error) {
    console.error(
      "[DELETE /api/pre-judicial/casos/[id]/procedimentos/[procedimentoId]] erro:",
      error,
    )

    return NextResponse.json(
      { ok: false, error: "Erro ao inativar procedimento pré judicial." },
      { status: 500 },
    )
  }
}