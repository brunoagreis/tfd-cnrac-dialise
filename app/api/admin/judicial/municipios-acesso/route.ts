import { NextRequest, NextResponse } from "next/server"
import { requireAdminRequest } from "@/lib/security/server-session"
import {
  listMunicipalityPortalAccesses,
  setMunicipalityAccessActive,
  setMunicipalityAccessPassword,
} from "@/lib/municipality-portal-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(value: unknown) {
  return String(value ?? "").trim()
}

export async function GET(req: Request) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response

  try {
    const items = await listMunicipalityPortalAccesses()
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error("[GET /api/admin/judicial/municipios-acesso] erro:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao carregar acessos municipais." },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response

  try {
    const body = await req.json().catch(() => ({}))
    const id = text(body?.id)
    const password = String(body?.password ?? "")
    const hasActive = typeof body?.ativo === "boolean"

    if (!id) {
      return NextResponse.json({ ok: false, error: "Informe o acesso municipal." }, { status: 400 })
    }

    if (password) await setMunicipalityAccessPassword(id, password)
    if (hasActive) await setMunicipalityAccessActive(id, Boolean(body.ativo))

    const items = await listMunicipalityPortalAccesses()
    return NextResponse.json({ ok: true, items })
  } catch (error) {
    console.error("[POST /api/admin/judicial/municipios-acesso] erro:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao salvar acesso municipal." },
      { status: 500 },
    )
  }
}
