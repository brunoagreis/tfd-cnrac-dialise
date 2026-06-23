import { NextResponse } from "next/server"
import { clearMunicipalitySession } from "@/lib/municipality-portal-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  await clearMunicipalitySession()
  return NextResponse.json({ ok: true })
}
