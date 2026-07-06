import { NextResponse } from "next/server"
import { requireAdminRequest } from "@/lib/security/server-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response
  return NextResponse.json({ ok: false, error: "Rota em implantação." }, { status: 501 })
}
