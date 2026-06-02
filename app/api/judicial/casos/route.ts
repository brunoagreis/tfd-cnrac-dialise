import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type JudicialCaseListRow = {
  id: string
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
  atribuidaEm: string | null
  usuarioAtribuidoNome: string | null
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function toUpperSafe(value: unknown) {
  return normalizeText(value).toUpperCase()
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

    const params: unknown[] = []
    const whereParts: string[] = [`UPPER(COALESCE(b.origem_modulo, '')) = 'JUDICIAL'`]

    if (somenteAtivos !== "false") {
      whereParts.push(`COALESCE(b.ativo_monitoramento, TRUE) = TRUE`)
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

    const rows = await prisma.$queryRawUnsafe<JudicialCaseListRow[]>(
      `
        WITH ultima_atribuicao AS (
          SELECT DISTINCT ON (a.monitoramento_id)
            a.monitoramento_id::text AS monitoramento_id,
            a.status,
            a.atribuida_em,
            a.usuario_nome
          FROM public.judicial_monitoramento_atribuicoes a
          ORDER BY a.monitoramento_id, a.data_referencia DESC, a.created_at DESC, a.id DESC
        )
        SELECT
          b.id::text AS id,
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
          ua.status AS "atribuicaoStatus",
          ua.atribuida_em::text AS "atribuidaEm",
          ua.usuario_nome AS "usuarioAtribuidoNome"
        FROM public.judicial_monitoramento_base b
        LEFT JOIN public.demandas d
          ON d.id = b.demanda_id
        LEFT JOIN public.pacientes p
          ON p.id = b.paciente_id
        LEFT JOIN ultima_atribuicao ua
          ON ua.monitoramento_id = b.id::text
        ${whereSql}
        ORDER BY
          COALESCE(b.data_ultimo_monitoramento, b.updated_at, b.created_at) DESC,
          b.id DESC
      `,
      ...params,
    )

    const items = rows.map((row) => ({
      id: row.id,
      monitoramentoId: row.id,
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