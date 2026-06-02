import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PreJudicialCaseRow = {
  id: string
  protocolNumber: string | null
  patientName: string | null
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
        c.patient_name AS "patientName"
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

    const numero = text(body?.numero || body?.processNumber || body?.processo)
    const origem = text(body?.origem || body?.source)
    const observacao = text(body?.observacao || body?.observation || body?.notes)

    const user = body?.user || {}
    const userId = text(user?.id || body?.userId || "sistema")
    const userName = text(user?.nome || user?.name || body?.userName || "Sistema")
    const userEmail = text(user?.email || body?.userEmail)

    if (!numero) {
      return NextResponse.json(
        { ok: false, error: "Informe o número do processo." },
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
        FROM public.pre_judicial_processos_vinculados
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
        { ok: false, error: "Este processo já está vinculado ao caso." },
        { status: 409 },
      )
    }

    const processoId = `pre_procjud_${randomUUID()}`
    const movimentoId = `pre_mov_${randomUUID()}`

    const descricao = [
      `Processo vinculado ao Pré Judicial: ${numero}`,
      origem ? `Origem: ${origem}` : "",
      observacao ? `Observação: ${observacao}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.pre_judicial_processos_vinculados (
            id,
            caso_id,
            numero,
            origem,
            observacao,
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
            $4,
            $5,
            TRUE,
            $6,
            $7,
            $8,
            NOW(),
            NOW()
          )
        `,
        processoId,
        caso.id,
        numero,
        origem || null,
        observacao || null,
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
          UPDATE public.pre_judicial_casos
          SET
            updated_by = $2,
            updated_by_name = $3,
            updated_by_email = $4,
            updated_at = NOW()
          WHERE id::text = $1
        `,
        caso.id,
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
            'pre_judicial_processos_vinculados',
            'adicionar_processo_pre_judicial',
            $1,
            $2,
            $3,
            $4,
            'PRE_JUDICIAL',
            NOW(),
            jsonb_build_object(),
            jsonb_build_object(
              'processo_id', $5::text,
              'numero', $6::text,
              'origem', $7::text,
              'observacao', $8::text,
              'movimento_id', $9::text
            ),
            jsonb_build_array(
              'pre_judicial_processos_vinculados',
              'pre_judicial_movimentacoes'
            ),
            $10
          )
        `,
        caso.id,
        userId,
        userName,
        userEmail || null,
        processoId,
        numero,
        origem || null,
        observacao || null,
        movimentoId,
        descricao,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: processoId,
        caseId: caso.id,
        numero,
        origem: origem || null,
        observacao: observacao || null,
        active: true,
        movementId: movimentoId,
        createdAt: new Date().toISOString(),
        createdById: userId,
        createdByName: userName,
      },
    })
  } catch (error) {
    console.error("[POST /api/pre-judicial/casos/[id]/processos] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao adicionar processo ao Pré Judicial." },
      { status: 500 },
    )
  }
}