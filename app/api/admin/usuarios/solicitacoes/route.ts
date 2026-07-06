import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminRequest } from "@/lib/security/server-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SolicitacaoRow = {
  id: string
  nome: string | null
  email: string | null
  cpf: string | null
  telefone: string | null
  vinculo: string | null
  perfilSolicitado: string | null
  justificativa: string | null
  status: string | null
  createdAt: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function perfilLabel(value: string) {
  const perfil = text(value).toUpperCase()

  if (perfil === "ADMIN") return "Administrador"
  if (perfil === "REGULADOR") return "Regulador"
  if (perfil === "OPERADOR") return "Operador"
  if (perfil === "MEDICO_SES") return "Médico SES"
  if (perfil === "VISUALIZADOR") return "Visualizador"

  return perfil || "Não informado"
}

export async function GET(_req: NextRequest) {

  const adminGuard = await requireAdminRequest(_req)
  if (!adminGuard.ok) return adminGuard.response

  try {
    const rows = await prisma.$queryRawUnsafe<SolicitacaoRow[]>(
      `
        SELECT
          id::text AS id,
          nome,
          email,
          cpf,
          telefone,
          vinculo,
          perfil_solicitado AS "perfilSolicitado",
          justificativa,
          status,
          created_at::text AS "createdAt"
        FROM public.usuarios_solicitacoes_acesso
        WHERE status = 'pendente'
        ORDER BY created_at DESC
      `,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map((item) => ({
        id: item.id,
        nome: item.nome || "",
        email: item.email || "",
        cpf: item.cpf || "",
        telefone: item.telefone || "",
        vinculo: item.vinculo || "",
        perfilSolicitado: item.perfilSolicitado || "",
        perfilSolicitadoLabel: perfilLabel(item.perfilSolicitado || ""),
        justificativa: item.justificativa || "",
        status: item.status || "pendente",
        createdAt: item.createdAt || "",
      })),
    })
  } catch (error) {
    console.error("[GET /api/admin/usuarios/solicitacoes] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar solicitações de acesso." },
      { status: 500 },
    )
  }
}