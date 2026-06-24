import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  return NextResponse.json({ ok: false, error: "Rota em implantação." }, { status: 501 })
}
