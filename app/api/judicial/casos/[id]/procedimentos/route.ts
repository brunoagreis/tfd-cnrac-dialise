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

type SigtapRow = {
  id: string
  codigo: string | null
  descricao: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)

    const body = await req.json().catch(() => ({}))

    const sigtapId = text(body?.sigtapId)
    const sigtapCode = text(body?.sigtapCode ?? body?.codigo)
    const specialty = text(body?.specialty ?? body?.especialidade)
    const subSpecialty = text(body?.subSpecialty ?? body?.subespecialidade)

    const userId = text(body?.user?.id || body?.userId || "sistema")
    const userName = text(
      body?.user?.nome ||
        body?.user?.name ||
        body?.userName ||
        "Sistema",
    )
    const userEmail = text(body?.user?.email || body?.userEmail)

    if (!sigtapId && !sigtapCode) {
      return NextResponse.json(
        { ok: false, error: "Selecione um procedimento SIGTAP." },
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

    const sigtapRows = await prisma.$queryRawUnsafe<SigtapRow[]>(
      `
        SELECT
          id::text AS id,
          codigo,
          descricao
        FROM public.admin_judicial_sigtap
        WHERE COALESCE(ativo, TRUE) = TRUE
          AND (
            ($1 <> '' AND id::text = $1)
            OR ($2 <> '' AND codigo = $2)
          )
        ORDER BY id ASC
        LIMIT 1
      `,
      sigtapId,
      sigtapCode,
    )

    const sigtap = sigtapRows[0]

    if (!sigtap) {
      return NextResponse.json(
        { ok: false, error: "Procedimento SIGTAP não encontrado no banco." },
        { status: 404 },
      )
    }

    const procedimentoId = `jproc_sig_${randomUUID()}`
    const codigo = text(sigtap.codigo)
    const descricao = text(sigtap.descricao)

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.judicial_procedimentos (
            id,
            monitoramento_id,
            demanda_id,
            sigtap_id,
            sigtap_codigo,
            sigtap_descricao,
            especialidade,
            subespecialidade,
            active,
            created_by,
            created_by_name,
            created_by_email,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2::bigint,
            $3,
            $4::bigint,
            $5,
            $6,
            $7,
            $8,
            TRUE,
            $9,
            $10,
            $11,
            NOW(),
            NOW()
          )
        `,
        procedimentoId,
        processo.monitoramentoId,
        processo.demandaId || null,
        sigtap.id,
        codigo,
        descricao,
        specialty || null,
        subSpecialty || null,
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_base
          SET
            data_ultimo_monitoramento = NOW(),
            updated_at = NOW()
          WHERE id::text = $1
        `,
        processo.monitoramentoId,
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
            'judicial_procedimentos',
            'adicionar_procedimento_judicial',
            $1,
            $2,
            $3,
            $4,
            'JUDICIAL',
            NOW(),
            jsonb_build_object(),
            jsonb_build_object(
              'procedimento_id', $5::text,
              'sigtap_codigo', $6::text,
              'sigtap_descricao', $7::text,
              'especialidade', $8::text,
              'subespecialidade', $9::text
            ),
            jsonb_build_array(
              'judicial_procedimentos',
              'sigtap_codigo',
              'sigtap_descricao',
              'especialidade',
              'subespecialidade'
            ),
            $10
          )
        `,
        processo.monitoramentoId,
        userId,
        userName,
        userEmail || null,
        procedimentoId,
        codigo,
        descricao,
        specialty || null,
        subSpecialty || null,
        `Procedimento SIGTAP adicionado: ${codigo} - ${descricao}`,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: procedimentoId,
        monitoramentoId: processo.monitoramentoId,
        demandaId: processo.demandaId,
        sigtapId: sigtap.id,
        sigtapCode: codigo,
        description: descricao,
        specialty: specialty || null,
        subSpecialty: subSpecialty || null,
        active: true,
        createdAt: new Date().toISOString(),
        createdById: userId,
        createdByName: userName,
      },
    })
  } catch (error) {
    console.error("[POST /api/judicial/casos/[id]/procedimentos] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao adicionar procedimento judicial." },
      { status: 500 },
    )
  }
}