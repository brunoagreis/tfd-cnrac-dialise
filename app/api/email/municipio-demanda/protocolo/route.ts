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
  municipio: string | null
  codigoSigtap: string | null
  descricaoSigtap: string | null
  cid10: string | null
  especialidade: string | null
  subespecialidade: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeModule(value: unknown) {
  const module = text(value).toLowerCase().replace(/\s+/g, "_").replace("-", "_")
  if (["tfd", "cnrac", "hemodialise", "judicial", "pre_judicial"].includes(module)) return module
  return ""
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
          COALESCE(NULLIF(TRIM(d."localSolicitado"), ''), p.municipio) AS municipio,
          d."codigoSigtap" AS "codigoSigtap",
          d."descricaoSigtap" AS "descricaoSigtap",
          d.cid10 AS cid10,
          d.especialidade AS especialidade,
          d.subespecialidade AS subespecialidade
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
      municipio: text(demand.municipio),
      codigoSigtap: text(demand.codigoSigtap),
      descricaoSigtap: text(demand.descricaoSigtap),
      cid10: text(demand.cid10),
      especialidade: text(demand.especialidade),
      subespecialidade: text(demand.subespecialidade),
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
