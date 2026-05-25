import { NextResponse } from "next/server"

const FAKE_USERS = [
  {
    id: "1",
    nome: "Administrador Fake",
    email: "admin@saude.gov.br",
    senha: "admin123",
    role: "ADMIN",
    ativo: true,
    unidadeId: null,
    unidadeNome: null,
  },
  {
    id: "2",
    nome: "Operador Fake",
    email: "operador@saude.gov.br",
    senha: "operador123",
    role: "OPERADOR",
    ativo: true,
    unidadeId: null,
    unidadeNome: null,
  },
  {
    id: "3",
    nome: "Unidade Fake",
    email: "unidade@saude.gov.br",
    senha: "unidade123",
    role: "UNIDADE_HOSPITALAR",
    ativo: true,
    unidadeId: "u1",
    unidadeNome: "UBS Exemplo",
  },
]

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const email = String(body?.email ?? "").trim().toLowerCase()
    const senha = String(body?.senha ?? "")

    if (!email || !senha) {
      return NextResponse.json(
        { ok: false, error: "Email e senha são obrigatórios." },
        { status: 400 },
      )
    }

    const user = FAKE_USERS.find(
      (u) => u.email.toLowerCase() === email && u.senha === senha && u.ativo,
    )

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Credenciais inválidas." },
        { status: 401 },
      )
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        ativo: user.ativo,
        unidadeId: user.unidadeId,
        unidadeNome: user.unidadeNome,
      },
    })
  } catch (error) {
    console.error("LOGIN_ERROR", error)
    return NextResponse.json(
      { ok: false, error: "Erro interno no login." },
      { status: 500 },
    )
  }
}