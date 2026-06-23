import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { ensureMunicipalityPortalAccessTable, normalizeEmail } from "@/lib/municipality-portal-access"
import { setMunicipalitySession } from "@/lib/municipality-portal-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type AccessRow = {
  id: string
  municipioId: string
  municipioNome: string
  email: string
  senhaHash: string | null
  ativo: boolean | null
}

export async function POST(req: NextRequest) {
  try {
    await ensureMunicipalityPortalAccessTable()

    const body = await req.json().catch(() => ({}))
    const email = normalizeEmail(body?.email)
    const senha = String(body?.senha ?? "")

    if (!email || !senha) {
      return NextResponse.json({ ok: false, error: "Informe e-mail e senha." }, { status: 400 })
    }

    const rows = await prisma.$queryRawUnsafe<AccessRow[]>(
      `
        SELECT
          id::text AS id,
          municipio_id::text AS "municipioId",
          municipio_nome AS "municipioNome",
          email,
          senha_hash AS "senhaHash",
          ativo
        FROM public.municipio_portal_acessos
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      email,
    )

    const access = rows[0]
    const saved = String(access?.senhaHash ?? "")

    if (!access || access.ativo === false || !saved) {
      return NextResponse.json({ ok: false, error: "Acesso não autorizado." }, { status: 401 })
    }

    const ok = await bcrypt.compare(senha, saved)
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Acesso não autorizado." }, { status: 401 })
    }

    await setMunicipalitySession({ municipalityId: access.municipioId, municipalityName: access.municipioNome, email: access.email })

    return NextResponse.json({ ok: true, user: { municipalityId: access.municipioId, municipalityName: access.municipioNome, email: access.email } })
  } catch (error) {
    console.error("[POST /api/municipio/acesso] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao acessar o portal municipal." }, { status: 500 })
  }
}
