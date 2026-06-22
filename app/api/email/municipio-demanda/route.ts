import { NextRequest, NextResponse } from "next/server"
import { sendMunicipalityDemandNotification } from "@/lib/municipality-notifications"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
    const module = normalizeModule(body?.module ?? body?.modulo)

    if (!module) {
      return NextResponse.json({ ok: false, error: "Módulo inválido." }, { status: 400 })
    }

    const result = await sendMunicipalityDemandNotification({
      module: module as "tfd" | "cnrac" | "hemodialise" | "judicial" | "pre_judicial",
      protocolo: text(body?.protocolo),
      pacienteNome: text(body?.pacienteNome),
      pacienteCpf: text(body?.pacienteCpf),
      pacienteCns: text(body?.pacienteCns),
      municipio: text(body?.municipio),
      codigoSigtap: text(body?.codigoSigtap),
      descricaoSigtap: text(body?.descricaoSigtap),
      cid10: text(body?.cid10),
      especialidade: text(body?.especialidade),
      subespecialidade: text(body?.subespecialidade),
    })

    return NextResponse.json({ ok: true, result })
  } catch (error) {
    console.error("[POST /api/email/municipio-demanda] erro:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao enviar e-mail ao município." },
      { status: 500 },
    )
  }
}
