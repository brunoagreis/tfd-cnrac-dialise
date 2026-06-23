import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DemandRow = {
  id: string
  protocolo: string | null
  modulo: string | null
  createdAt: string | null
  updatedAt: string | null
  status: string | null
  pacienteNome: string | null
  pacienteCpf: string | null
  pacienteCns: string | null
  municipio: string | null
  localSolicitante: string | null
  localSolicitado: string | null
  codigoSigtap: string | null
  descricaoSigtap: string | null
  cid10: string | null
  especialidade: string | null
  subespecialidade: string | null
  observacoesUnidade: string | null
}

type InteracaoRow = {
  id: string
  texto: string | null
  pendencia: string | null
  createdAt: string | null
  createdByName: string | null
}

type MovimentoRow = {
  id: string
  type: string | null
  description: string | null
  createdAt: string | null
  createdByName: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function moduleLabel(value: unknown) {
  const key = text(value).toLowerCase().replace(/\s+/g, "_").replace("-", "_")
  const labels: Record<string, string> = {
    tfd: "TFD",
    cnrac: "CNRAC",
    hemodialise: "Hemodiálise",
    judicial: "Judicial",
    pre_judicial: "Pré Judicial",
  }
  return labels[key] || text(value).toUpperCase() || "-"
}

function maskName(value: unknown) {
  const name = text(value)
  if (!name) return "-"
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() || ""}***`)
    .join(" ")
}

function onlyDigits(value: unknown) {
  return text(value).replace(/\D/g, "")
}

function maskCpf(value: unknown) {
  const digits = onlyDigits(value)
  if (!digits) return "-"
  return `${digits.slice(0, 1)}***`
}

function maskCns(value: unknown) {
  const digits = onlyDigits(value)
  if (!digits) return "-"
  return `${digits.slice(0, 2)}***`
}

function maskProcess(value: unknown) {
  const raw = text(value)
  if (!raw) return "-"
  const digits = raw.replace(/\D/g, "")
  if (digits.length <= 4) return "****"
  return `${digits.slice(0, 4)}-${digits.slice(4, 9) || "00000"}-${digits.slice(9, 13) || "0000"}****`
}

function observationValue(observacoes: unknown, label: string) {
  const lines = text(observacoes).split(/\r?\n/)
  const normalizedLabel = label.toUpperCase()
  const line = lines.find((item) => item.trim().toUpperCase().startsWith(`${normalizedLabel}:`))
  if (!line) return ""
  return line.slice(line.indexOf(":") + 1).trim()
}

function sanitizeMovementText(value: unknown) {
  return text(value)
    .replace(/Link:\s*\/api\/\S+/gi, "")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "***")
    .replace(/\b\d{11}\b/g, "***")
    .replace(/\b\d{15}\b/g, "***")
    .trim()
}

function movementTypeLabel(value: unknown) {
  const key = text(value).toLowerCase()
  const labels: Record<string, string> = {
    monitoramento: "Monitoramento",
    manifestacao_municipio: "Manifestação ao município",
    agendamento: "Agendamento",
    envio_agendamento_demanda: "Envio ao agendamento",
    encerramento_processo: "Encerramento",
  }
  return labels[key] || "Movimentação"
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const protocolo = text(url.searchParams.get("protocolo"))

    if (!protocolo) {
      return NextResponse.json({ ok: false, error: "Informe o protocolo." }, { status: 400 })
    }

    const rows = await prisma.$queryRawUnsafe<DemandRow[]>(
      `
        SELECT
          d.id::text AS id,
          d.protocolo::text AS protocolo,
          LOWER(COALESCE(d.modulo::text, '')) AS modulo,
          d."createdAt"::text AS "createdAt",
          d."updatedAt"::text AS "updatedAt",
          COALESCE(to_jsonb(d)->>'status', '') AS status,
          p.nome AS "pacienteNome",
          p.cpf AS "pacienteCpf",
          p."cartaoSus" AS "pacienteCns",
          COALESCE(NULLIF(TRIM(d."localSolicitado"), ''), p.municipio) AS municipio,
          d."localSolicitante" AS "localSolicitante",
          d."localSolicitado" AS "localSolicitado",
          d."codigoSigtap" AS "codigoSigtap",
          d."descricaoSigtap" AS "descricaoSigtap",
          d.cid10 AS cid10,
          d.especialidade AS especialidade,
          d.subespecialidade AS subespecialidade,
          d."observacoesUnidade" AS "observacoesUnidade"
        FROM public.demandas d
        INNER JOIN public.pacientes p ON p.id = d."pacienteId"
        WHERE d.protocolo = $1
        LIMIT 1
      `,
      protocolo,
    )

    const demand = rows[0]
    if (!demand) {
      return NextResponse.json({ ok: false, error: "Protocolo não encontrado." }, { status: 404 })
    }

    const interacoes = await prisma.$queryRawUnsafe<InteracaoRow[]>(
      `
        SELECT
          id::text AS id,
          texto,
          pendencia,
          "createdAt"::text AS "createdAt",
          "createdByName" AS "createdByName"
        FROM public.interacoes
        WHERE "demandaId" = $1
        ORDER BY "createdAt" DESC, id DESC
      `,
      demand.id,
    )

    const judicialMovements = await prisma.$queryRawUnsafe<MovimentoRow[]>(
      `
        SELECT
          jm.id::text AS id,
          jm.type,
          jm.description,
          jm.created_at::text AS "createdAt",
          jm.created_by_name AS "createdByName"
        FROM public.judicial_movimentacoes jm
        INNER JOIN public.judicial_monitoramento_base b
          ON b.id = jm.monitoramento_id
        WHERE b.demanda_id::text = $1
           OR b.origem_registro_id::text = $1
        ORDER BY jm.created_at DESC, jm.id DESC
      `,
      demand.id,
    ).catch(() => [] as MovimentoRow[])

    const processo = observationValue(demand.observacoesUnidade, "AUTOS DA ACAO") || observationValue(demand.observacoesUnidade, "AUTOS DA AÇÃO")

    const movements = [
      ...interacoes.map((item) => ({
        id: `int-${item.id}`,
        tipo: "Monitoramento",
        descricao: sanitizeMovementText([item.pendencia, item.texto].map(text).filter(Boolean).join("\n")),
        criadoEm: item.createdAt,
        criadoPor: text(item.createdByName) || "Sistema",
      })),
      ...judicialMovements.map((item) => ({
        id: `mov-${item.id}`,
        tipo: movementTypeLabel(item.type),
        descricao: sanitizeMovementText(item.description),
        criadoEm: item.createdAt,
        criadoPor: text(item.createdByName) || "Sistema",
      })),
    ]
      .filter((item) => item.descricao)
      .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")))

    return NextResponse.json({
      ok: true,
      item: {
        protocolo: text(demand.protocolo),
        modulo: moduleLabel(demand.modulo),
        status: text(demand.status) || "Em acompanhamento",
        criadoEm: demand.createdAt,
        atualizadoEm: demand.updatedAt,
        paciente: {
          nome: maskName(demand.pacienteNome),
          cpf: maskCpf(demand.pacienteCpf),
          cns: maskCns(demand.pacienteCns),
          municipio: text(demand.municipio) || "-",
        },
        processo: maskProcess(processo),
        procedimento: {
          codigo: text(demand.codigoSigtap) || "-",
          descricao: text(demand.descricaoSigtap) || "-",
          cid10: text(demand.cid10) || "-",
          especialidade: text(demand.especialidade) || "-",
          subespecialidade: text(demand.subespecialidade) || "-",
        },
        movimentos: movements,
      },
    })
  } catch (error) {
    console.error("[GET /api/consulta/protocolo] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao consultar protocolo." }, { status: 500 })
  }
}
