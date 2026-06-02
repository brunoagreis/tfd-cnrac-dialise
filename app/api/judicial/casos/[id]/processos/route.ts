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

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizarTipo(value: unknown) {
  const tipo = text(value).toUpperCase().replace(/\s+/g, "_").replace("-", "_")
  if (tipo === "PGE" || tipo === "PGE_NET" || tipo === "PGENET") return "PGE_NET"
  return "PROCESSO"
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)
    const body = await req.json().catch(() => ({}))

    const tipo = normalizarTipo(body?.tipo ?? body?.type)
    const numero = text(body?.numero ?? body?.number ?? body?.processNumber)

    const userId = text(body?.user?.id || body?.userId || "sistema")
    const userName = text(body?.user?.nome || body?.user?.name || body?.userName || "Sistema")
    const userEmail = text(body?.user?.email || body?.userEmail)

    if (!numero) {
      return NextResponse.json(
        {
          ok: false,
          error: tipo === "PGE_NET" ? "Informe o número do PGE.net." : "Informe o número do processo vinculado.",
        },
        { status: 400 },
      )
    }

    const rows = await prisma.$queryRawUnsafe<JudicialBaseRow[]>(
      `
        SELECT b.id::text AS "monitoramentoId", b.demanda_id::text AS "demandaId", b.nome_paciente AS "pacienteNome", COALESCE(d.protocolo::text, b.demanda_id::text) AS protocolo
        FROM public.judicial_monitoramento_base b
        LEFT JOIN public.demandas d ON d.id = b.demanda_id
        WHERE UPPER(COALESCE(b.origem_modulo, '')) = 'JUDICIAL'
          AND (b.id::text = $1 OR b.demanda_id::text = $1 OR b.origem_registro_id::text = $1 OR d.id::text = $1 OR d.protocolo::text = $1)
        ORDER BY b.id DESC
        LIMIT 1
      `,
      decodedId,
    )

    const processo = rows[0]
    if (!processo) {
      return NextResponse.json({ ok: false, error: "Processo judicial não encontrado." }, { status: 404 })
    }

    const vinculoId = `jproc_${randomUUID()}`

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.judicial_processos_vinculados (
            id, monitoramento_id, demanda_id, tipo, numero, ativo,
            created_by, created_by_name, created_by_email, created_at, updated_at
          )
          VALUES ($1, $2::bigint, $3, $4, $5, TRUE, $6, $7, $8, NOW(), NOW())
          ON CONFLICT (monitoramento_id, tipo, numero)
          WHERE ativo = TRUE
          DO UPDATE SET
            updated_at = NOW(),
            created_by = EXCLUDED.created_by,
            created_by_name = EXCLUDED.created_by_name,
            created_by_email = EXCLUDED.created_by_email
        `,
        vinculoId,
        processo.monitoramentoId,
        processo.demandaId || null,
        tipo,
        numero,
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
        `UPDATE public.judicial_monitoramento_base SET data_ultimo_monitoramento = NOW(), updated_at = NOW() WHERE id::text = $1`,
        processo.monitoramentoId,
      )

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.sistema_auditoria (
            tabela_nome, acao, registro_id, usuario_id, usuario_nome, usuario_email,
            modulo_codigo, data_hora, dados_anteriores, dados_novos,
            campos_alterados, observacao
          )
          VALUES (
            'judicial_processos_vinculados', 'registrar_processo_vinculado_judicial', $1, $2, $3, $4,
            'JUDICIAL', NOW(), jsonb_build_object(),
            jsonb_build_object('vinculo_id', $5::text, 'tipo', $6::text, 'numero', $7::text),
            jsonb_build_array('judicial_processos_vinculados', 'tipo', 'numero'),
            $8
          )
        `,
        processo.monitoramentoId,
        userId,
        userName,
        userEmail || null,
        vinculoId,
        tipo,
        numero,
        `${tipo === "PGE_NET" ? "PGE.net" : "Processo vinculado"} registrado: ${numero}`,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: vinculoId,
        monitoramentoId: processo.monitoramentoId,
        demandaId: processo.demandaId,
        protocolo: processo.protocolo,
        pacienteNome: processo.pacienteNome,
        tipo,
        numero,
        createdAt: new Date().toISOString(),
        createdById: userId,
        createdByName: userName,
      },
    })
  } catch (error) {
    console.error("[POST /api/judicial/casos/[id]/processos] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao registrar processo vinculado." }, { status: 500 })
  }
}
