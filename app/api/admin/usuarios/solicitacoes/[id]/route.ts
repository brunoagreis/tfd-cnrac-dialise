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
  senhaHash: string | null
  status: string | null
}

const UI_TO_DB_ROLE: Record<string, string> = {
  ADMIN: "admin",
  MEDICO_SES: "judicial",
  REGULADOR: "regulacao",
  OPERADOR: "pre_judicial",
  VISUALIZADOR: "hospital",
  UNIDADE_HOSPITALAR: "unidade",
}

const DB_TO_UI_ROLE: Record<string, string> = {
  admin: "ADMIN",
  judicial: "MEDICO_SES",
  regulacao: "REGULADOR",
  pre_judicial: "OPERADOR",
  hospital: "VISUALIZADOR",
  unidade: "UNIDADE_HOSPITALAR",
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizePerfil(value: unknown) {
  const perfil = text(value).toUpperCase()

  if (perfil === "ADMIN") return "ADMIN"
  if (perfil === "MEDICO_SES") return "MEDICO_SES"
  if (perfil === "REGULADOR") return "REGULADOR"
  if (perfil === "OPERADOR") return "OPERADOR"
  if (perfil === "VISUALIZADOR") return "VISUALIZADOR"
  if (perfil === "UNIDADE_HOSPITALAR") return "UNIDADE_HOSPITALAR"

  return "OPERADOR"
}

function toDbRole(value: unknown) {
  const perfil = normalizePerfil(value)
  return UI_TO_DB_ROLE[perfil] || "pre_judicial"
}

function serializeUser(user: any) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    role: DB_TO_UI_ROLE[user.role] ?? user.role,
    ativo: Boolean(user.ativo),
    unidadeId: user.unidadeId ?? null,
    unidadeNome: user.unidade?.nome ?? null,
    telefone: user.telefone ?? null,
    cargo: user.cargo ?? null,
  }
}

async function getSolicitacao(id: string) {
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
        senha_hash AS "senhaHash",
        status
      FROM public.usuarios_solicitacoes_acesso
      WHERE id::text = $1
      LIMIT 1
    `,
    id,
  )

  return rows[0] ?? null
}

async function getEnumValues() {
  const rows = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
    `
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'UserRole'
      ORDER BY e.enumsortorder
    `,
  )

  return rows.map((item) => item.enumlabel)
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response

  try {
    const { id } = await context.params
    const body = await req.json().catch(() => ({}))

    const action = text(body?.action).toLowerCase()
    const motivo = text(body?.motivo)
    const adminId = text(body?.admin?.id || body?.adminId || "sistema")
    const adminNome = text(body?.admin?.nome || body?.adminNome || "Sistema")
    const adminEmail = text(body?.admin?.email || body?.adminEmail)

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Solicitação não informada." },
        { status: 400 },
      )
    }

    if (!["aprovar", "recusar"].includes(action)) {
      return NextResponse.json(
        { ok: false, error: "Ação inválida." },
        { status: 400 },
      )
    }

    const solicitacao = await getSolicitacao(id)

    if (!solicitacao) {
      return NextResponse.json(
        { ok: false, error: "Solicitação não encontrada." },
        { status: 404 },
      )
    }

    if (solicitacao.status !== "pendente") {
      return NextResponse.json(
        { ok: false, error: "Esta solicitação já foi analisada." },
        { status: 409 },
      )
    }

    if (action === "recusar") {
      await prisma.$executeRawUnsafe(
        `
          UPDATE public.usuarios_solicitacoes_acesso
          SET
            status = 'recusada',
            motivo_recusa = $2,
            recusado_por = $3,
            recusado_por_nome = $4,
            recusado_em = NOW(),
            updated_at = NOW()
          WHERE id::text = $1
            AND status = 'pendente'
        `,
        id,
        motivo || "Recusada pelo administrador.",
        adminId,
        adminNome,
      )

      return NextResponse.json({
        ok: true,
        item: {
          id,
          status: "recusada",
        },
      })
    }

    const nome = text(solicitacao.nome)
    const email = text(solicitacao.email).toLowerCase()
    const senhaHash = text(solicitacao.senhaHash)
    const dbRole = toDbRole(solicitacao.perfilSolicitado)

    if (!nome || !email || !senhaHash) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A solicitação está incompleta. Nome, e-mail e senha são obrigatórios.",
        },
        { status: 400 },
      )
    }

    const enumValues = await getEnumValues()

    if (!enumValues.includes(dbRole)) {
      return NextResponse.json(
        {
          ok: false,
          error: `O perfil solicitado exige o valor "${dbRole}" no enum UserRole. Rode o ALTER TYPE para incluir esse valor.`,
          debug: {
            perfilSolicitado: solicitacao.perfilSolicitado,
            dbRole,
            enumValues,
          },
        },
        { status: 500 },
      )
    }

    const usuarioExistente = await prisma.usuario.findFirst({
      where: { email },
      select: { id: true },
    })

    if (usuarioExistente) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Já existe um usuário cadastrado com este e-mail. Recuse a solicitação ou use outro e-mail.",
        },
        { status: 409 },
      )
    }

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.usuario.create({
        data: {
          nome,
          email,
          telefone: text(solicitacao.telefone) || null,
          cargo: text(solicitacao.vinculo) || null,
          senhaHash,
          role: dbRole as any,
          ativo: true,
          unidadeId: null,
        },
      })

      await tx.$executeRawUnsafe(
        `
          UPDATE public.usuarios_solicitacoes_acesso
          SET
            status = 'aprovada',
            usuario_criado_id = $2,
            aprovado_por = $3,
            aprovado_por_nome = $4,
            aprovado_em = NOW(),
            updated_at = NOW()
          WHERE id::text = $1
            AND status = 'pendente'
        `,
        id,
        user.id,
        adminId,
        adminNome,
      )

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.sistema_auditoria (
            tabela_nome,
            acao,
            registro_id,
            usuario_id,
            usuario_nome,
            usuario_email,
            modulo_codigo,
            data_hora,
            dados_anteriores,
            dados_novos,
            campos_alterados,
            observacao
          )
          VALUES (
            'usuarios_solicitacoes_acesso',
            'aprovar_solicitacao_acesso',
            $1,
            $2,
            $3,
            $4,
            'USUARIOS',
            NOW(),
            jsonb_build_object(
              'solicitacao_id', $1::text,
              'status', 'pendente'
            ),
            jsonb_build_object(
              'solicitacao_id', $1::text,
              'status', 'aprovada',
              'usuario_criado_id', $5::text,
              'email', $6::text,
              'role', $7::text
            ),
            jsonb_build_array(
              'usuarios_solicitacoes_acesso.status',
              'usuarios_solicitacoes_acesso.usuario_criado_id',
              'usuarios'
            ),
            $8
          )
        `,
        id,
        adminId,
        adminNome,
        adminEmail || null,
        user.id,
        email,
        dbRole,
        `Solicitação de acesso aprovada para ${nome} (${email}).`,
      )

      return user
    })

    return NextResponse.json({
      ok: true,
      item: {
        id,
        status: "aprovada",
      },
      user: serializeUser(createdUser),
    })
  } catch (error) {
    console.error("[PATCH /api/admin/usuarios/solicitacoes/[id]] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao atualizar solicitação de acesso." },
      { status: 500 },
    )
  }
}