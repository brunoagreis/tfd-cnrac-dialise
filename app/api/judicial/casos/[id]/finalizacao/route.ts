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
  statusAnterior: string | null
  demandaExiste: boolean | null
}

const STATUS_PERMITIDOS = [
  "pendente",
  "resolvido",
  "cumprido",
  "bloqueio",
  "sequestro",
  "obito",
  "devolvida",
] as const

type StatusFinalizacao = (typeof STATUS_PERMITIDOS)[number]

function text(value: unknown) {
  return String(value ?? "").trim()
}

function parseMoney(value: unknown) {
  const raw = text(value)
  if (!raw) return null
  const normalized = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
  const number = Number(normalized)
  if (!Number.isFinite(number)) return null
  return number
}

function normalizarStatus(value: unknown): StatusFinalizacao | null {
  const status = text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  if (status === "pendente") return "pendente"
  if (status === "resolvido" || status === "resolver") return "resolvido"
  if (status === "cumprido" || status === "cumprida") return "cumprido"
  if (status === "bloqueio") return "bloqueio"
  if (status === "sequestro") return "sequestro"
  if (status === "obito") return "obito"
  if (status === "arquivado") return "arquivado"
  if (status === "devolvida" || status === "devolvido") return "devolvida"
  return null
}

function statusParaBanco(status: StatusFinalizacao) {
  if (status === "devolvida") return "DEVOLVIDA"
  if (status === "arquivado") return "ARQUIVADO"
  if (status === "obito") return "OBITO"
  if (status === "cumprido") return "CUMPRIDO"
  return status.toUpperCase()
}

function statusParaTexto(status: StatusFinalizacao) {
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

function normalizarPendingLocation(value: unknown) {
  const local = text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
  if (local === "ses") return "ses"
  if (local === "core") return "core"
  if (local === "municipio") return "municipio"
  return ""
}

function pendingLocationParaTexto(value: unknown) {
  const local = normalizarPendingLocation(value)
  if (local === "ses") return "Pendente SES"
  if (local === "core") return "Pendente CORE"
  if (local === "municipio") return "Pendente Município"
  return ""
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
    const reason = text(body?.reason)
    const pendingLocation = normalizarPendingLocation(body?.pendingLocation)
    const valorEstado = parseMoney(body?.valorEstado ?? body?.stateAmount)
    const valorMunicipio = parseMoney(body?.valorMunicipio ?? body?.municipalityAmount)

    const userId = text(body?.user?.id || body?.userId || "sistema")
    const userName = text(body?.user?.nome || body?.user?.name || body?.userName || "Sistema")
    const userEmail = text(body?.user?.email || body?.userEmail)
    const userCpf = text(body?.user?.cpf || body?.userCpf)

    if (!status) {
      return NextResponse.json({ ok: false, error: "Status de finalização inválido." }, { status: 400 })
    }

    if (status === "pendente") {
      if (!pendingLocation) {
        return NextResponse.json({ ok: false, error: "Informe onde está pendente: Pendente SES, Pendente CORE ou Pendente Município." }, { status: 400 })
      }
      if (!reason) {
        return NextResponse.json({ ok: false, error: "Justifique a pendência antes de salvar." }, { status: 400 })
      }
    }

    if ((status === "resolvido" || status === "cumprido") && !reason) {
      return NextResponse.json({ ok: false, error: status === "cumprido" ? "Justifique o cumprimento antes de salvar." : "Justifique a resolução antes de salvar." }, { status: 400 })
    }

    if ((status === "obito" || status === "arquivado") && !reason) {
      return NextResponse.json({ ok: false, error: status === "obito" ? "Justifique o óbito antes de salvar." : "Justifique o arquivamento antes de salvar." }, { status: 400 })
    }

    if (status === "bloqueio" || status === "sequestro") {
      if (valorEstado === null || valorEstado <= 0) {
        return NextResponse.json({ ok: false, error: status === "bloqueio" ? "Informe o valor do bloqueio para o Estado." : "Informe o valor do sequestro para o Estado." }, { status: 400 })
      }
      if (valorMunicipio === null || valorMunicipio <= 0) {
        return NextResponse.json({ ok: false, error: status === "bloqueio" ? "Informe o valor do bloqueio para o Município." : "Informe o valor do sequestro para o Município." }, { status: 400 })
      }
    }

    const rows = await prisma.$queryRawUnsafe<JudicialBaseRow[]>(
      `
        SELECT
          b.id::text AS "monitoramentoId",
          b.demanda_id::text AS "demandaId",
          b.nome_paciente AS "pacienteNome",
          COALESCE(d.protocolo::text, b.demanda_id::text) AS protocolo,
          b.status_monitoramento_atual AS "statusAnterior",
          CASE WHEN d.id IS NULL THEN FALSE ELSE TRUE END AS "demandaExiste"
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

    const statusBanco = statusParaBanco(status)
    const statusTexto = statusParaTexto(status)
    const localPendenteTexto = pendingLocationParaTexto(pendingLocation)
    const finalizacaoId = `jfin_${randomUUID()}`

    const descricao = [
      `FINALIZAÇÃO DA DEMANDA: ${statusTexto}`,
      localPendenteTexto ? `Pendente em: ${localPendenteTexto}` : "",
      reason ? `Justificativa: ${reason}` : "",
      status === "bloqueio" && valorEstado !== null ? `Valor do bloqueio para o Estado: R$ ${valorEstado.toFixed(2)}` : "",
      status === "bloqueio" && valorMunicipio !== null ? `Valor do bloqueio para o Município: R$ ${valorMunicipio.toFixed(2)}` : "",
      status === "sequestro" && valorEstado !== null ? `Valor do sequestro para o Estado: R$ ${valorEstado.toFixed(2)}` : "",
      status === "sequestro" && valorMunicipio !== null ? `Valor do sequestro para o Município: R$ ${valorMunicipio.toFixed(2)}` : "",
    ].filter(Boolean).join("\n")

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_base
          SET status_monitoramento_atual = $2,
              ativo_monitoramento = CASE WHEN $2 IN ('RESOLVIDO', 'OBITO') THEN FALSE ELSE ativo_monitoramento END,
              data_ultimo_monitoramento = NOW(),
              updated_at = NOW()
          WHERE id::text = $1
        `,
        processo.monitoramentoId,
        statusBanco,
      )

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.judicial_finalizacoes (
            id, monitoramento_id, demanda_id, status, pending_location, reason,
            valor_estado, valor_municipio, created_by, created_by_name,
            created_by_email, created_at
          )
          VALUES ($1, $2::bigint, $3, $4, $5, $6, $7::numeric, $8::numeric, $9, $10, $11, NOW())
        `,
        finalizacaoId,
        processo.monitoramentoId,
        processo.demandaId || null,
        status,
        pendingLocation || null,
        reason || null,
        valorEstado,
        valorMunicipio,
        userId,
        userName,
        userEmail || null,
      )

      if (processo.demandaExiste && processo.demandaId) {
        await tx.$executeRawUnsafe(
          `
            INSERT INTO public.interacoes (id, "demandaId", texto, pendencia, "createdAt", "createdBy", "createdByName", "createdByCpf")
            VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7)
          `,
          randomUUID(),
          processo.demandaId,
          descricao,
          status === "pendente" ? reason : null,
          userId,
          userName,
          userCpf || null,
        )
      }

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.sistema_auditoria (
            tabela_nome, acao, registro_id, usuario_id, usuario_nome, usuario_email,
            modulo_codigo, data_hora, dados_anteriores, dados_novos,
            campos_alterados, observacao
          )
          VALUES (
            'judicial_finalizacoes', 'finalizar_demanda_judicial', $1, $2, $3, $4,
            'JUDICIAL', NOW(),
            jsonb_build_object('status_monitoramento_atual', $5::text),
            jsonb_build_object('finalizacao_id', $6::text, 'status_monitoramento_atual', $7::text, 'status_finalizacao', $8::text, 'pendingLocation', $9::text, 'reason', $10::text, 'valor_estado', $11::numeric, 'valor_municipio', $12::numeric),
            jsonb_build_array('status_monitoramento_atual', 'judicial_finalizacoes', 'valor_estado', 'valor_municipio'),
            $13
          )
        `,
        processo.monitoramentoId,
        userId,
        userName,
        userEmail || null,
        processo.statusAnterior || null,
        finalizacaoId,
        statusBanco,
        status,
        pendingLocation || null,
        reason || null,
        valorEstado,
        valorMunicipio,
        descricao,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: finalizacaoId,
        monitoramentoId: processo.monitoramentoId,
        demandaId: processo.demandaId,
        protocolo: processo.protocolo,
        pacienteNome: processo.pacienteNome,
        status,
        statusBanco,
        statusLabel: statusTexto,
        pendingLocation: pendingLocation || null,
        reason: reason || null,
        valorEstado,
        valorMunicipio,
        createdAt: new Date().toISOString(),
        createdById: userId,
        createdByName: userName,
      },
    })
  } catch (error) {
    console.error("[POST /api/judicial/casos/[id]/finalizacao] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao finalizar demanda judicial." }, { status: 500 })
  }
}
