import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendMunicipalityDemandNotification } from "@/lib/municipality-notifications"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DemandRow = {
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
  return ""
}

function observationValue(observacoes: unknown, label: string) {
  const lines = text(observacoes).split(/\r?\n/)
  const normalizedLabel = label.toUpperCase()

  const line = lines.find((item) => item.trim().toUpperCase().startsWith(`${normalizedLabel}:`))
  if (!line) return ""

  return line.slice(line.indexOf(":") + 1).trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const protocolo = text(body?.protocolo)

    if (!protocolo) {
      return NextResponse.json({ ok: false, error: "Informe o protocolo." }, { status: 400 })
    }

    const rows = await prisma.$queryRawUnsafe<DemandRow[]>(
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
        WHERE d.protocolo = $1
        LIMIT 1
      `,
      protocolo,
    )

    const demand = rows[0]

    if (!demand) {
      return NextResponse.json({ ok: false, error: "Protocolo não encontrado." }, { status: 404 })
    }

    const module = normalizeModule(demand.modulo)
    if (!module) {
      return NextResponse.json({ ok: false, error: "Módulo inválido no protocolo." }, { status: 400 })
    }

    const result = await sendMunicipalityDemandNotification({
      module: module as "tfd" | "cnrac" | "hemodialise" | "judicial" | "pre_judicial",
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

    return NextResponse.json({ ok: true, result })
  } catch (error) {
    console.error("[POST /api/email/municipio-demanda/protocolo] erro:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao reenviar e-mail ao município." },
      { status: 500 },
    )
  }
}
