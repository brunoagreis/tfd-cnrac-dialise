import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminRequest } from "@/lib/security/server-session"
import { sendMunicipalityDemandNotification } from "@/lib/municipality-notifications"
import { ensureMunicipalityEmailDispatchLogTable } from "@/lib/municipality-email-dispatch-log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type FilterInput = {
  nome?: string
  processo?: string
  protocolo?: string
  status?: string
  dataInicio?: string
  dataFim?: string
}

type EmailProtocolRow = {
  nomePaciente: string | null
  processo: string | null
  protocolo: string | null
  modulo: string | null
  municipio: string | null
  statusEmail: string | null
  enviadoEm: string | null
  ultimaTentativaEm: string | null
  erro: string | null
}

type DemandDetailRow = {
  protocolo: string | null
  modulo: string | null
  pacienteNome: string | null
  pacienteCpf: string | null
  pacienteCns: string | null
  pacienteTelefone: string | null
  pacienteEmail: string | null
  pacienteDataNascimento: string | null
  pacienteEndereco: string | null
  municipio: string | null
  localSolicitante: string | null
  emailSolicitante: string | null
  telefoneSolicitante: string | null
  localSolicitado: string | null
  tipoSolicitacao: string | null
  codigoSigtap: string | null
  descricaoSigtap: string | null
  cid10: string | null
  especialidade: string | null
  subespecialidade: string | null
  peso: string | null
  altura: string | null
  tipoSanguineo: string | null
  observacoesUnidade: string | null
  userSistema: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeModule(value: unknown) {
  const module = text(value).toLowerCase().replace(/\s+/g, "_").replace("-", "_")
  if (["tfd", "cnrac", "hemodialise", "judicial", "pre_judicial"].includes(module)) return module
  return "judicial"
}

function observationValue(observacoes: unknown, label: string) {
  const lines = text(observacoes).split(/\r?\n/)
  const normalizedLabel = label.toUpperCase()
  const line = lines.find((item) => item.trim().toUpperCase().startsWith(`${normalizedLabel}:`))
  if (!line) return ""
  return line.slice(line.indexOf(":") + 1).trim()
}

function processoSql() {
  return `
    COALESCE(
      NULLIF(TRIM(substring(d."observacoesUnidade" from 'AUTOS DA ACAO:\\s*([^\\r\\n]+)')), ''),
      NULLIF(TRIM(substring(d."observacoesUnidade" from 'AUTOS DA AÇÃO:\\s*([^\\r\\n]+)')), ''),
      ''
    )
  `
}

function buildWhere(filters: FilterInput) {
  const params: unknown[] = []
  const conditions = [
    `LOWER(COALESCE(d.modulo::text, '')) IN ('tfd', 'cnrac', 'hemodialise', 'judicial', 'pre_judicial')`,
  ]

  function add(value: unknown) {
    params.push(value)
    return `$${params.length}`
  }

  if (text(filters.nome)) conditions.push(`p.nome ILIKE ${add(`%${text(filters.nome)}%`)}`)
  if (text(filters.processo)) conditions.push(`${processoSql()} ILIKE ${add(`%${text(filters.processo)}%`)}`)
  if (text(filters.protocolo)) conditions.push(`d.protocolo ILIKE ${add(`%${text(filters.protocolo)}%`)}`)

  const status = text(filters.status).toLowerCase()
  if (status === "enviado") conditions.push(`COALESCE(le.status, '') = 'ENVIADO'`)
  if (status === "nao_enviado") conditions.push(`COALESCE(le.status, '') <> 'ENVIADO'`)

  if (text(filters.dataInicio)) conditions.push(`DATE(COALESCE(le.enviado_em, le.created_at)) >= ${add(text(filters.dataInicio))}::date`)
  if (text(filters.dataFim)) conditions.push(`DATE(COALESCE(le.enviado_em, le.created_at)) <= ${add(text(filters.dataFim))}::date`)

  return { where: conditions.join(" AND "), params }
}

async function listProtocols(filters: FilterInput, limit = 300) {
  await ensureMunicipalityEmailDispatchLogTable()

  const { where, params } = buildWhere(filters)

  return prisma.$queryRawUnsafe<EmailProtocolRow[]>(
    `
      SELECT
        p.nome AS "nomePaciente",
        ${processoSql()} AS processo,
        d.protocolo AS protocolo,
        LOWER(COALESCE(d.modulo::text, '')) AS modulo,
        COALESCE(NULLIF(TRIM(d."localSolicitado"), ''), p.municipio) AS municipio,
        COALESCE(le.status, 'NAO_ENVIADO') AS "statusEmail",
        le.enviado_em::text AS "enviadoEm",
        le.created_at::text AS "ultimaTentativaEm",
        le.erro AS erro
      FROM public.demandas d
      INNER JOIN public.pacientes p
        ON p.id = d."pacienteId"
      LEFT JOIN LATERAL (
        SELECT status, enviado_em, created_at, erro, message_id
        FROM public.email_municipio_disparos log
        WHERE log.protocolo = d.protocolo
          AND log.tipo = 'CADASTRO_MUNICIPAL'
        ORDER BY COALESCE(log.enviado_em, log.created_at) DESC, log.id DESC
        LIMIT 1
      ) le ON TRUE
      WHERE ${where}
      ORDER BY COALESCE(le.enviado_em, le.created_at, d."createdAt") DESC NULLS LAST, d."createdAt" DESC
      LIMIT ${Number(limit) || 300}
    `,
    ...params,
  )
}

async function fetchDemandDetails(protocolos: string[]) {
  if (protocolos.length === 0) return []

  const placeholders = protocolos.map((_, index) => `$${index + 1}`).join(", ")

  return prisma.$queryRawUnsafe<DemandDetailRow[]>(
    `
      SELECT
        d.protocolo::text AS protocolo,
        LOWER(COALESCE(d.modulo::text, '')) AS modulo,
        p.nome AS "pacienteNome",
        p.cpf AS "pacienteCpf",
        p."cartaoSus" AS "pacienteCns",
        COALESCE((
          SELECT string_agg(NULLIF(TRIM(tp.value), ''), ', ' ORDER BY tp.id)
          FROM public.telefone_paciente tp
          WHERE tp."pacienteId" = p.id
        ), '') AS "pacienteTelefone",
        p.email AS "pacienteEmail",
        p."dataNascimento"::text AS "pacienteDataNascimento",
        p.endereco AS "pacienteEndereco",
        COALESCE(NULLIF(TRIM(d."localSolicitado"), ''), p.municipio) AS municipio,
        d."localSolicitante" AS "localSolicitante",
        d."emailSolicitante" AS "emailSolicitante",
        COALESCE((
          SELECT string_agg(NULLIF(TRIM(ts.value), ''), ', ' ORDER BY ts.id)
          FROM public.telefone_solicitante ts
          WHERE ts."demandaId" = d.id
        ), '') AS "telefoneSolicitante",
        d."localSolicitado" AS "localSolicitado",
        d."tipoSolicitacao"::text AS "tipoSolicitacao",
        d."codigoSigtap" AS "codigoSigtap",
        d."descricaoSigtap" AS "descricaoSigtap",
        d.cid10 AS cid10,
        d.especialidade AS especialidade,
        d.subespecialidade AS subespecialidade,
        to_jsonb(d)->>'peso' AS peso,
        to_jsonb(d)->>'altura' AS altura,
        to_jsonb(d)->>'tipoSanguineo' AS "tipoSanguineo",
        d."observacoesUnidade" AS "observacoesUnidade",
        d."criadoPorNome" AS "userSistema"
      FROM public.demandas d
      INNER JOIN public.pacientes p
        ON p.id = d."pacienteId"
      WHERE d.protocolo IN (${placeholders})
      ORDER BY d."createdAt" DESC
    `,
    ...protocolos,
  )
}

function mapRow(row: EmailProtocolRow) {
  const sent = row.statusEmail === "ENVIADO"

  return {
    nomePaciente: text(row.nomePaciente),
    processo: text(row.processo),
    protocolo: text(row.protocolo),
    modulo: text(row.modulo),
    municipio: text(row.municipio),
    status: sent ? "enviado" : "nao_enviado",
    statusLabel: sent ? "Enviado" : "Não enviado",
    enviadoEm: row.enviadoEm,
    ultimaTentativaEm: row.ultimaTentativaEm,
    erro: text(row.erro),
  }
}

export async function GET(req: NextRequest) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response

  try {
    const url = new URL(req.url)
    const filters: FilterInput = {
      nome: url.searchParams.get("nome") || "",
      processo: url.searchParams.get("processo") || "",
      protocolo: url.searchParams.get("protocolo") || "",
      status: url.searchParams.get("status") || "",
      dataInicio: url.searchParams.get("dataInicio") || "",
      dataFim: url.searchParams.get("dataFim") || "",
    }

    const rows = await listProtocols(filters)

    return NextResponse.json({ ok: true, items: rows.map(mapRow) })
  } catch (error) {
    console.error("[GET /api/admin/judicial/emails-envios] erro:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao carregar envios." },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response

  try {
    const body = await req.json().catch(() => ({}))
    const allFiltered = Boolean(body?.allFiltered)
    const filters: FilterInput = body?.filters || {}

    let protocolos = Array.isArray(body?.protocolos)
      ? body.protocolos.map((item: unknown) => text(item)).filter(Boolean)
      : []

    if (allFiltered) {
      const rows = await listProtocols(filters, 500)
      protocolos = rows.map((row) => text(row.protocolo)).filter(Boolean)
    }

    protocolos = Array.from(new Set(protocolos)).slice(0, 500)

    if (protocolos.length === 0) {
      return NextResponse.json({ ok: false, error: "Nenhum protocolo selecionado." }, { status: 400 })
    }

    const details = await fetchDemandDetails(protocolos)
    const results = []

    for (const demand of details) {
      const result = await sendMunicipalityDemandNotification({
        module: normalizeModule(demand.modulo) as "tfd" | "cnrac" | "hemodialise" | "judicial" | "pre_judicial",
        protocolo: text(demand.protocolo),
        pacienteNome: text(demand.pacienteNome),
        pacienteCpf: text(demand.pacienteCpf),
        pacienteCns: text(demand.pacienteCns),
        pacienteTelefone: text(demand.pacienteTelefone),
        pacienteEmail: text(demand.pacienteEmail),
        pacienteDataNascimento: text(demand.pacienteDataNascimento),
        pacienteEndereco: text(demand.pacienteEndereco),
        municipio: text(demand.municipio),
        localSolicitante: text(demand.localSolicitante),
        emailSolicitante: text(demand.emailSolicitante),
        telefoneSolicitante: text(demand.telefoneSolicitante),
        localSolicitado: text(demand.localSolicitado),
        tipoSolicitacao: text(demand.tipoSolicitacao),
        codigoSigtap: text(demand.codigoSigtap),
        descricaoSigtap: text(demand.descricaoSigtap),
        cid10: text(demand.cid10),
        especialidade: text(demand.especialidade),
        subespecialidade: text(demand.subespecialidade),
        peso: text(demand.peso),
        altura: text(demand.altura),
        tipoSanguineo: text(demand.tipoSanguineo),
        observacoes: text(demand.observacoesUnidade),
        numeroProcesso: observationValue(demand.observacoesUnidade, "AUTOS DA ACAO"),
        pgeNet: observationValue(demand.observacoesUnidade, "PGE.NET"),
        numeroOficio: observationValue(demand.observacoesUnidade, "OFICIO/INTIMACAO"),
        tipoIntimacao: observationValue(demand.observacoesUnidade, "TIPO DE INTIMACAO"),
        dataRecebimento: observationValue(demand.observacoesUnidade, "DATA DE RECEBIMENTO"),
        dataReiteracao: observationValue(demand.observacoesUnidade, "DATA DA REITERACAO"),
        prazoDias: observationValue(demand.observacoesUnidade, "PRAZO (DIAS)"),
        prazoFinal: observationValue(demand.observacoesUnidade, "PRAZO FINAL"),
        userSistema: text(demand.userSistema),
      })

      results.push({ protocolo: text(demand.protocolo), result })
    }

    return NextResponse.json({ ok: true, total: results.length, results })
  } catch (error) {
    console.error("[POST /api/admin/judicial/emails-envios] erro:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao reenviar e-mails." },
      { status: 500 },
    )
  }
}
