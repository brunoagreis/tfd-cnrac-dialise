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

const STATUS_PROCESSO_PERMITIDOS = [
  "em_andamento",
  "descumprimento",
  "decisao_judicial_prazo",
] as const

type StatusProcesso = (typeof STATUS_PROCESSO_PERMITIDOS)[number]

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizarStatusProcesso(value: unknown): StatusProcesso | null {
  const status = text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")

  if (status === "em_andamento") return "em_andamento"
  if (status === "descumprimento" || status === "descumprido") return "descumprimento"
  if (status === "decisao_judicial_prazo" || status === "decisao_judicial_com_prazo" || status === "decisao_com_prazo") return "decisao_judicial_prazo"
  return null
}

function statusParaTexto(status: StatusProcesso) {
  const labels: Record<StatusProcesso, string> = {
    em_andamento: "Em andamento",
    descumprimento: "Descumprimento",
    decisao_judicial_prazo: "Decisão judicial com prazo",
  }
  return labels[status]
}

function normalizarData(value: unknown) {
  const raw = text(value)
  if (!raw) return ""
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    return ""
  }
  return date.toISOString().slice(0, 10)
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)
    const body = await req.json().catch(() => ({}))

    const status = normalizarStatusProcesso(body?.status)
    const reason = text(body?.reason)
    const prazoInicio = normalizarData(body?.prazoInicio ?? body?.deadlineStart)
    const prazoDescricao = text(body?.prazoDescricao ?? body?.deadlineDescription)

    const userId = text(body?.user?.id || body?.userId || "sistema")
    const userName = text(body?.user?.nome || body?.user?.name || body?.userName || "Sistema")
    const userEmail = text(body?.user?.email || body?.userEmail)

    if (!status) {
      return NextResponse.json({ ok: false, error: "Status do processo judicial inválido." }, { status: 400 })
    }

    if ((status === "em_andamento" || status === "descumprimento") && !reason) {
      return NextResponse.json({ ok: false, error: "Justifique o status do processo judicial." }, { status: 400 })
    }

    if (status === "decisao_judicial_prazo") {
      if (!prazoInicio) {
        return NextResponse.json({ ok: false, error: "Informe a data de início do prazo judicial." }, { status: 400 })
      }
      if (!prazoDescricao) {
        return NextResponse.json({ ok: false, error: "Informe o prazo da decisão judicial. Exemplo: 5 dias, 10 dias, 1 mês." }, { status: 400 })
      }
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

    const statusId = `jstat_${randomUUID()}`
    const statusTexto = statusParaTexto(status)
    const descricao = [
      `STATUS DO PROCESSO JUDICIAL: ${statusTexto}`,
      reason ? `Justificativa: ${reason}` : "",
      prazoInicio ? `Início do prazo: ${prazoInicio}` : "",
      prazoDescricao ? `Prazo: ${prazoDescricao}` : "",
    ].filter(Boolean).join("\n")

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.judicial_status_processo (
            id, monitoramento_id, demanda_id, status, reason, prazo_inicio,
            prazo_descricao, created_by, created_by_name, created_by_email, created_at
          )
          VALUES ($1, $2::bigint, $3, $4, $5, $6::date, $7, $8, $9, $10, NOW())
        `,
        statusId,
        processo.monitoramentoId,
        processo.demandaId || null,
        status,
        descricao,
        prazoInicio || null,
        prazoDescricao || null,
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
            'judicial_status_processo', 'registrar_status_processo_judicial', $1, $2, $3, $4,
            'JUDICIAL', NOW(), jsonb_build_object(),
            jsonb_build_object('status_id', $5::text, 'status', $6::text, 'reason', $7::text, 'prazo_inicio', $8::text, 'prazo_descricao', $9::text),
            jsonb_build_array('judicial_status_processo', 'status', 'reason', 'prazo_inicio', 'prazo_descricao'),
            $10
          )
        `,
        processo.monitoramentoId,
        userId,
        userName,
        userEmail || null,
        statusId,
        status,
        descricao,
        prazoInicio || null,
        prazoDescricao || null,
        descricao,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: statusId,
        monitoramentoId: processo.monitoramentoId,
        demandaId: processo.demandaId,
        protocolo: processo.protocolo,
        pacienteNome: processo.pacienteNome,
        status,
        statusLabel: statusTexto,
        reason: descricao,
        prazoInicio: prazoInicio || null,
        prazoDescricao: prazoDescricao || null,
        createdAt: new Date().toISOString(),
        createdById: userId,
        createdByName: userName,
      },
    })
  } catch (error) {
    console.error("[POST /api/judicial/casos/[id]/status-processo] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao registrar status do processo judicial." }, { status: 500 })
  }
}
