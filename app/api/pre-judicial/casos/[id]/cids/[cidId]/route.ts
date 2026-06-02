import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CidRow = {
  id: string
  casoId: string
  code: string | null
  description: string | null
  active: boolean | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

async function findCid(caseId: string, cidId: string) {
  const rows = await prisma.$queryRawUnsafe<CidRow[]>(
    `
      SELECT
        cid.id::text AS id,
        cid.caso_id::text AS "casoId",
        cid.code,
        cid.description,
        cid.active
      FROM public.pre_judicial_cids cid
      INNER JOIN public.pre_judicial_casos c
        ON c.id = cid.caso_id
      WHERE
        (
          c.id::text = $1
          OR c.protocol_number::text = $1
          OR c.origin_protocol::text = $1
        )
        AND (
          cid.id::text = $2
          OR cid.code = $2
        )
      LIMIT 1
    `,
    caseId,
    cidId,
  )

  return rows[0] ?? null
}

async function updateCidActive(params: {
  caseId: string
  cidId: string
  active: boolean
  reason: string
  userId: string
  userName: string
  userEmail: string | null
}) {
  const { caseId, cidId, active, reason, userId, userName, userEmail } = params

  const cid = await findCid(caseId, cidId)

  if (!cid) {
    return {
      ok: false as const,
      status: 404,
      error: "CID pré judicial não encontrado.",
    }
  }

  if (cid.active === active) {
    return {
      ok: true as const,
      item: {
        id: cid.id,
        caseId: cid.casoId,
        active,
      },
    }
  }

  const movimentoId = `pre_mov_${randomUUID()}`
  const acao = active ? "reativar_cid_pre_judicial" : "inativar_cid_pre_judicial"

  const descricao = [
    active
      ? `CID reativado: ${cid.code} - ${cid.description}`
      : `CID inativado: ${cid.code} - ${cid.description}`,
    reason ? `Motivo: ${reason}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        UPDATE public.pre_judicial_cids
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
      cid.id,
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
      cid.casoId,
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
      cid.casoId,
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
          'pre_judicial_cids',
          $1,
          $2,
          $3,
          $4,
          $5,
          'PRE_JUDICIAL',
          NOW(),
          jsonb_build_object(
            'cid_id', $6::text,
            'active', $7::boolean,
            'code', $8::text,
            'description', $9::text
          ),
          jsonb_build_object(
            'cid_id', $6::text,
            'active', $10::boolean,
            'inactive_reason', $11::text,
            'movimento_id', $12::text
          ),
          jsonb_build_array(
            'pre_judicial_cids.active',
            'pre_judicial_cids.inactive_reason',
            'pre_judicial_movimentacoes'
          ),
          $13
        )
      `,
      acao,
      cid.casoId,
      userId,
      userName,
      userEmail,
      cid.id,
      Boolean(cid.active),
      cid.code || null,
      cid.description || null,
      active,
      reason || null,
      movimentoId,
      descricao,
    )
  })

  return {
    ok: true as const,
    item: {
      id: cid.id,
      caseId: cid.casoId,
      code: cid.code,
      description: cid.description,
      active,
      inactiveReason: active ? null : reason || null,
      movementId: movimentoId,
    },
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; cidId: string }> },
) {
  try {
    const { id, cidId } = await context.params
    const decodedCaseId = decodeURIComponent(id)
    const decodedCidId = decodeURIComponent(cidId)

    const body = await req.json().catch(() => ({}))

    const active =
      typeof body?.active === "boolean" ? body.active : Boolean(body?.active)

    const reason = text(body?.reason)

    const user = body?.user || {}
    const userId = text(user?.id || body?.userId || "sistema")
    const userName = text(user?.nome || user?.name || body?.userName || "Sistema")
    const userEmail = text(user?.email || body?.userEmail) || null

    const result = await updateCidActive({
      caseId: decodedCaseId,
      cidId: decodedCidId,
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
      "[PATCH /api/pre-judicial/casos/[id]/cids/[cidId]] erro:",
      error,
    )

    return NextResponse.json(
      { ok: false, error: "Erro ao atualizar CID pré judicial." },
      { status: 500 },
    )
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; cidId: string }> },
) {
  try {
    const { id, cidId } = await context.params
    const decodedCaseId = decodeURIComponent(id)
    const decodedCidId = decodeURIComponent(cidId)

    const body = await req.json().catch(() => ({}))

    const reason = text(body?.reason)

    const user = body?.user || {}
    const userId = text(user?.id || body?.userId || "sistema")
    const userName = text(user?.nome || user?.name || body?.userName || "Sistema")
    const userEmail = text(user?.email || body?.userEmail) || null

    const result = await updateCidActive({
      caseId: decodedCaseId,
      cidId: decodedCidId,
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
      "[DELETE /api/pre-judicial/casos/[id]/cids/[cidId]] erro:",
      error,
    )

    return NextResponse.json(
      { ok: false, error: "Erro ao inativar CID pré judicial." },
      { status: 500 },
    )
  }
}