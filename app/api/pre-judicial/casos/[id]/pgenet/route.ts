import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PreJudicialCaseRow = {
  id: string
  protocolNumber: string | null
  patientName: string | null
  pgeNetAnterior: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

async function findPreJudicialCase(decodedId: string) {
  const rows = await prisma.$queryRawUnsafe<PreJudicialCaseRow[]>(
    `
      SELECT
        c.id::text AS id,
        c.protocol_number AS "protocolNumber",
        c.patient_name AS "patientName",
        c.pge_net_number AS "pgeNetAnterior"
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

    const numero = text(body?.numero || body?.pgeNetNumber || body?.pgenet)

    const user = body?.user || {}
    const userId = text(user?.id || body?.userId || "sistema")
    const userName = text(user?.nome || user?.name || body?.userName || "Sistema")
    const userEmail = text(user?.email || body?.userEmail)

    if (!numero) {
      return NextResponse.json(
        { ok: false, error: "Informe o número do PGE.net." },
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

    const duplicado = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        SELECT id::text AS id
        FROM public.pre_judicial_pgenet
        WHERE caso_id = $1
          AND numero = $2
          AND COALESCE(active, TRUE) = TRUE
        LIMIT 1
      `,
      caso.id,
      numero,
    )

    if (duplicado[0]) {
      return NextResponse.json(
        { ok: false, error: "Este PGE.net já está vinculado ao caso." },
        { status: 409 },
      )
    }

    const pgeId = `pre_pge_${randomUUID()}`
    const movimentoId = `pre_mov_${randomUUID()}`
    const descricao = `PGE.net vinculado ao Pré Judicial: ${numero}`

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.pre_judicial_pgenet (
            id,
            caso_id,
            numero,
            active,
            created_by,
            created_by_name,
            created_by_email,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            TRUE,
            $4,
            $5,
            $6,
            NOW(),
            NOW()
          )
        `,
        pgeId,
        caso.id,
        numero,
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.pre_judicial_casos
          SET
            pge_net_number = $2,
            updated_by = $3,
            updated_by_name = $4,
            updated_by_email = $5,
            updated_at = NOW()
          WHERE id::text = $1
        `,
        caso.id,
        numero,
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
        caso.id,
        descricao,
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
            'pre_judicial_pgenet',
            'adicionar_pgenet_pre_judicial',
            $1,
            $2,
            $3,
            $4,
            'PRE_JUDICIAL',
            NOW(),
            jsonb_build_object(
              'pge_net_anterior', $5::text
            ),
            jsonb_build_object(
              'pgenet_id', $6::text,
              'numero', $7::text,
              'movimento_id', $8::text
            ),
            jsonb_build_array(
              'pre_judicial_pgenet',
              'pre_judicial_casos.pge_net_number',
              'pre_judicial_movimentacoes'
            ),
            $9
          )
        `,
        caso.id,
        userId,
        userName,
        userEmail || null,
        caso.pgeNetAnterior || null,
        pgeId,
        numero,
        movimentoId,
        descricao,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: pgeId,
        caseId: caso.id,
        numero,
        active: true,
        movementId: movimentoId,
        createdAt: new Date().toISOString(),
        createdById: userId,
        createdByName: userName,
      },
    })
  } catch (error) {
    console.error("[POST /api/pre-judicial/casos/[id]/pgenet] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao adicionar PGE.net ao Pré Judicial." },
      { status: 500 },
    )
  }
}