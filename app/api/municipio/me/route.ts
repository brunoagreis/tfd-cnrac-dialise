import { NextResponse } from "next/server"
import { getMunicipalitySession } from "@/lib/municipality-portal-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getMunicipalitySession()
  if (!session) {
    return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 })
  }

  return NextResponse.json({ ok: true, user: session })
}
