import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type JudicialCaseListRow = {
  id: string
  monitoramentoId: string | null
  atribuicaoId: string | null
  demandaId: string | null
  pacienteId: string | null
  protocolo: string | null
  nomePaciente: string | null
  cpf: string | null
  cns: string | null
  fichaCore: string | null
  procedimentoCodigoBase: string | null
  procedimentoDescricaoBase: string | null
  procedimentoCodigoDemanda: string | null
  procedimentoDescricaoDemanda: string | null
  cidCodigoBase: string | null
  cidDescricaoBase: string | null
  cidCodigoDemanda: string | null
  especialidade: string | null
  subespecialidade: string | null
  municipioPaciente: string | null
  statusMonitoramentoAtual: string | null
  dataUltimoMonitoramento: string | null
  origemModulo: string | null
  origemTabela: string | null
  origemRegistroId: string | null
  ativoMonitoramento: boolean | null
  atribuicaoStatus: string | null
  atribuicaoDataReferencia: string | null
  atribuidaEm: string | null
  usuarioAtribuidoNome: string | null
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function toUpperSafe(value: unknown) {
  return normalizeText(value).toUpperCase()
}

function isTruthyParam(value: string) {
  return ["1", "true", "sim", "yes"].includes(value)
}

function formatStatus(value: unknown) {
  const raw = normalizeText(value)
  if (!raw) return "Pendente"

  return raw
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ")
}

export async function GET(req: NextRequest) {
  try {
    const q = normalizeText(req.nextUrl.searchParams.get("q")).toLowerCase()
    const status = normalizeText(req.nextUrl.searchParams.get("status")).toLowerCase()
    const somenteAtivos = normalizeText(req.nextUrl.searchParams.get("somenteAtivos")).toLowerCase()
    const somenteAtribuidos = isTruthyParam(
      normalizeText(req.nextUrl.searchParams.get("somenteAtribuidos")).toLowerCase(),
    )
    const incluirMonitoradosHoje = isTruthyParam(
      normalizeText(req.nextUrl.searchParams.get("incluirMonitoradosHoje")).toLowerCase(),
    )
    const usuarioId = normalizeText(req.nextUrl.searchParams.get("usuarioId"))
    const usuarioEmail = normalizeText(req.nextUrl.searchParams.get("usuarioEmail")).toLowerCase()

    const params: unknown[] = []
    const whereParts: string[] = [`UPPER(COALESCE(b.origem_modulo, '')) = 'JUDICIAL'`]
    const atribuicaoHojeWhereParts: string[] = [`a.data_referencia = CURRENT_DATE`]

    if (usuarioId) {
      params.push(usuarioId)
      atribuicaoHojeWhereParts.push(`a.usuario_id = $${params.length}`)
    } else if (usuarioEmail) {
      params.push(usuarioEmail)
      atribuicaoHojeWhereParts.push(`LOWER(COALESCE(a.usuario_email, '')) = $${params.length}`)
    }

    if (somenteAtribuidos) {
      if (incluirMonitoradosHoje) {
        atribuicaoHojeWhereParts.push(`a.status <> 'CANCELADO'`)
      } else {
        atribuicaoHojeWhereParts.push(
          `a.status IN ('ATRIBUIDO', 'EM_ANALISE', 'EM_MONITORAMENTO')`,
        )
      }
    }

    if (somenteAtivos !== "false") {
      whereParts.push(`COALESCE(b.ativo_monitoramento, TRUE) = TRUE`)
    }

    if (somenteAtribuidos) {
      whereParts.push(`ah.monitoramento_id IS NOT NULL`)
    }

    if (status && status !== "todos") {
      params.push(status)
      whereParts.push(`LOWER(COALESCE(b.status_monitoramento_atual, '')) = $${params.length}`)
    }

    if (q) {
      params.push(`%${q}%`)
      const idx = params.length
      whereParts.push(`
        (
          LOWER(COALESCE(d.protocolo, '')) LIKE $${idx}
          OR LOWER(COALESCE(b.nome_paciente, '')) LIKE $${idx}
          OR LOWER(COALESCE(b.cpf, '')) LIKE $${idx}
          OR LOWER(COALESCE(b.cns, '')) LIKE $${idx}
          OR LOWER(COALESCE(b.ficha_core, '')) LIKE $${idx}
          OR LOWER(COALESCE(b.procedimento_codigo, '')) LIKE $${idx}
          OR LOWER(COALESCE(b.procedimento_descricao, '')) LIKE $${idx}
          OR LOWER(COALESCE(d."codigoSigtap", '')) LIKE $${idx}
          OR LOWER(COALESCE(d."descricaoSigtap", '')) LIKE $${idx}
          OR LOWER(COALESCE(b.cid_codigo, '')) LIKE $${idx}
          OR LOWER(COALESCE(b.cid_descricao, '')) LIKE $${idx}
          OR LOWER(COALESCE(d.cid10, '')) LIKE $${idx}
          OR LOWER(COALESCE(d.especialidade, '')) LIKE $${idx}
          OR LOWER(COALESCE(d.subespecialidade, '')) LIKE $${idx}
          OR LOWER(COALESCE(p.municipio, '')) LIKE $${idx}
        )
      `)
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : ""
    const atribuicaoHojeWhereSql = `WHERE ${atribuicaoHojeWhereParts.join(" AND ")}`
    const orderSql = somenteAtribuidos
      ? `
        ORDER BY
          CASE WHEN ah.status = 'FINALIZADO' THEN 1 ELSE 0 END,
          ah.bloco_numero NULLS LAST,
          ah.ordem_no_bloco NULLS LAST,
          ah.atribuida_em NULLS LAST,
          b.id DESC
      `
      : `
        ORDER BY
          COALESCE(b.data_ultimo_monitoramento, b.updated_at, b.created_at) DESC,
          b.id DESC
      `

    const rows = await prisma.$queryRawUnsafe<JudicialCaseListRow[]>(
      `
        WITH atribuicao_hoje AS (
          SELECT DISTINCT ON (a.monitoramento_id)
            a.id::text AS atribuicao_id,
            a.monitoramento_id::text AS monitoramento_id,
            a.data_referencia::text AS data_referencia,
            a.status,
            a.atribuida_em,
            a.usuario_nome,
            a.bloco_numero,
            a.ordem_no_bloco
          FROM public.judicial_monitoramento_atribuicoes a
          ${atribuicaoHojeWhereSql}
          ORDER BY a.monitoramento_id, a.created_at DESC, a.id DESC
        ),
        ultima_atribuicao AS (
          SELECT DISTINCT ON (a.monitoramento_id)
            a.id::text AS atribuicao_id,
            a.monitoramento_id::text AS monitoramento_id,
            a.data_referencia::text AS data_referencia,
            a.status,
            a.atribuida_em,
            a.usuario_nome
          FROM public.judicial_monitoramento_atribuicoes a
          ORDER BY a.monitoramento_id, a.data_referencia DESC, a.created_at DESC, a.id DESC
        )
        SELECT
          b.id::text AS id,
          b.id::text AS "monitoramentoId",
          COALESCE(ah.atribuicao_id, ua.atribuicao_id) AS "atribuicaoId",
          b.demanda_id AS "demandaId",
          b.paciente_id AS "pacienteId",
          d.protocolo,
          b.nome_paciente AS "nomePaciente",
          b.cpf,
          b.cns,
          b.ficha_core AS "fichaCore",
          b.procedimento_codigo AS "procedimentoCodigoBase",
          b.procedimento_descricao AS "procedimentoDescricaoBase",
          d."codigoSigtap" AS "procedimentoCodigoDemanda",
          d."descricaoSigtap" AS "procedimentoDescricaoDemanda",
          b.cid_codigo AS "cidCodigoBase",
          b.cid_descricao AS "cidDescricaoBase",
          d.cid10 AS "cidCodigoDemanda",
          d.especialidade,
          d.subespecialidade,
          p.municipio AS "municipioPaciente",
          b.status_monitoramento_atual AS "statusMonitoramentoAtual",
          b.data_ultimo_monitoramento::text AS "dataUltimoMonitoramento",
          b.origem_modulo AS "origemModulo",
          b.origem_tabela AS "origemTabela",
          b.origem_registro_id AS "origemRegistroId",
          b.ativo_monitoramento AS "ativoMonitoramento",
          COALESCE(ah.status, ua.status) AS "atribuicaoStatus",
          COALESCE(ah.data_referencia, ua.data_referencia)::text AS "atribuicaoDataReferencia",
          COALESCE(ah.atribuida_em, ua.atribuida_em)::text AS "atribuidaEm",
          ah.usuario_nome AS "usuarioAtribuidoNome"
        FROM public.judicial_monitoramento_base b
        LEFT JOIN public.demandas d
          ON d.id = b.demanda_id
        LEFT JOIN public.pacientes p
          ON p.id = b.paciente_id
        LEFT JOIN atribuicao_hoje ah
          ON ah.monitoramento_id = b.id::text
        LEFT JOIN ultima_atribuicao ua
          ON ua.monitoramento_id = b.id::text
        ${whereSql}
        ${orderSql}
      `,
      ...params,
    )

    const items = rows.map((row) => ({
      id: row.id,
      monitoramentoId: row.monitoramentoId ?? row.id,
      atribuicaoId: row.atribuicaoId ?? "",
      demandaId: row.demandaId ?? "",
      pacienteId: row.pacienteId ?? "",
      protocolo: row.protocolo ?? row.demandaId ?? `MON-${row.id}`,
      nomePaciente: row.nomePaciente ?? "SEM NOME",
      cpf: row.cpf ?? "",
      cns: row.cns ?? "",
      fichaCore: row.fichaCore ?? "",
      procedimentoCodigo: row.procedimentoCodigoDemanda ?? row.procedimentoCodigoBase ?? "",
      procedimentoDescricao: row.procedimentoDescricaoDemanda ?? row.procedimentoDescricaoBase ?? "",
      cidCodigo: row.cidCodigoDemanda ?? row.cidCodigoBase ?? "",
      cidDescricao: row.cidDescricaoBase ?? "",
      especialidade: row.especialidade ?? "",
      subespecialidade: row.subespecialidade ?? "",
      municipioEnvolvido: row.municipioPaciente ?? "",
      statusMonitoramentoAtual: row.statusMonitoramentoAtual ?? "",
      statusLabel: formatStatus(row.statusMonitoramentoAtual),
      origemModulo: toUpperSafe(row.origemModulo),
      origemTabela: row.origemTabela ?? "",
      origemRegistroId: row.origemRegistroId ?? "",
      ativoMonitoramento: Boolean(row.ativoMonitoramento),
      dataUltimoMonitoramento: row.dataUltimoMonitoramento ?? "",
      atribuicaoStatus: row.atribuicaoStatus ?? "",
      atribuicaoStatusLabel: formatStatus(row.atribuicaoStatus),
      atribuicaoDataReferencia: row.atribuicaoDataReferencia ?? "",
      atribuidaEm: row.atribuidaEm ?? "",
      usuarioAtribuidoNome: row.usuarioAtribuidoNome ?? "",
    }))

    return NextResponse.json({
      ok: true,
      items,
    })
  } catch (error) {
    console.error("[GET /api/judicial/casos] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar casos da Judicialização." },
      { status: 500 },
    )
  }
}
