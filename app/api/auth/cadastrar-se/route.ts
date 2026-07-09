import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function text(value: unknown) {
  return String(value ?? "").trim()
}

function onlyDigits(value: unknown) {
  return text(value).replace(/\D/g, "")
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizePerfil(value: unknown) {
  const raw = text(value).toUpperCase()

  if (raw === "REGULADOR") return "REGULADOR"
  if (raw === "OPERADOR") return "OPERADOR"
  if (raw === "VISUALIZADOR") return "VISUALIZADOR"
  if (raw === "MEDICO_SES") return "MEDICO_SES"

  return "OPERADOR"
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const nome = text(body?.nome)
    const email = text(body?.email).toLowerCase()
    const cpf = onlyDigits(body?.cpf)
    const telefone = text(body?.telefone)
    const vinculo = text(body?.vinculo)
    const perfilSolicitado = normalizePerfil(body?.perfilSolicitado)
    const justificativa = text(body?.justificativa)
    const senha = text(body?.senha)
    const confirmarSenha = text(body?.confirmarSenha)

    if (!nome) {
      return NextResponse.json(
        { ok: false, error: "Informe seu nome completo." },
        { status: 400 },
      )
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Informe um e-mail válido." },
        { status: 400 },
      )
    }

    if (cpf && cpf.length !== 11) {
      return NextResponse.json(
        { ok: false, error: "Informe um CPF válido com 11 dígitos." },
        { status: 400 },
      )
    }

    if (!vinculo) {
      return NextResponse.json(
        { ok: false, error: "Informe seu vínculo ou instituição." },
        { status: 400 },
      )
    }

    if (!justificativa || justificativa.length < 10) {
      return NextResponse.json(
        {
          ok: false,
          error: "Informe uma justificativa com pelo menos 10 caracteres.",
        },
        { status: 400 },
      )
    }

    if (!senha || senha.length < 8) {
      return NextResponse.json(
        { ok: false, error: "A senha deve ter pelo menos 8 caracteres." },
        { status: 400 },
      )
    }

    if (senha !== confirmarSenha) {
      return NextResponse.json(
        { ok: false, error: "As senhas não conferem." },
        { status: 400 },
      )
    }

    const usuarioExistente = await prisma.usuario.findFirst({
      where: {
        email,
      },
      select: {
        id: true,
      },
    })

    if (usuarioExistente) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Já existe um usuário cadastrado com este e-mail. Use a recuperação de senha ou procure o administrador.",
        },
        { status: 409 },
      )
    }

    const pendente = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        SELECT id::text AS id
        FROM public.usuarios_solicitacoes_acesso
        WHERE lower(email) = lower($1)
          AND status = 'pendente'
        LIMIT 1
      `,
      email,
    )

    if (pendente[0]) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Já existe uma solicitação pendente para este e-mail. Aguarde análise do administrador.",
        },
        { status: 409 },
      )
    }

    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.usuarios_solicitacoes_acesso
        ADD COLUMN IF NOT EXISTS termos_aceitos boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS termos_versao text,
        ADD COLUMN IF NOT EXISTS termos_aceitos_em timestamptz,
        ADD COLUMN IF NOT EXISTS termos_ip text,
        ADD COLUMN IF NOT EXISTS termos_user_agent text
    `)

    const senhaHash = await bcrypt.hash(senha, 10)

    const created = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        INSERT INTO public.usuarios_solicitacoes_acesso (
          nome,
          email,
          cpf,
          telefone,
          vinculo,
          perfil_solicitado,
          justificativa,
          senha_hash,
          status,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          'pendente',
          NOW(),
          NOW()
        )
        RETURNING id::text AS id
      `,
      nome,
      email,
      cpf || null,
      telefone || null,
      vinculo,
      perfilSolicitado,
      justificativa,
      senhaHash,
    )

    return NextResponse.json({
      ok: true,
      item: {
        id: created[0]?.id,
        nome,
        email,
        status: "pendente",
      },
    })
  } catch (error) {
    console.error("[POST /api/auth/cadastrar-se] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao registrar solicitação de acesso." },
      { status: 500 },
    )
  }
}