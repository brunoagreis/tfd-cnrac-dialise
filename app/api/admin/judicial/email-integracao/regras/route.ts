import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ensureEmailTriageTables } from "@/lib/email-triage-processing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type UserRow = { id: string; nome: string | null; email: string | null }
type RuleRow = { id: string; nome: string; palavras: unknown; ativo: boolean | null; usuarios: unknown }

function text(value: unknown) {
  return String(value ?? "").trim()
}

function parseWords(value: unknown) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean)
  const raw = text(value)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(text).filter(Boolean)
  } catch {}
  return raw.split(/[,;\n]+/g).map((item) => item.trim()).filter(Boolean)
}

async function getUsersByIds(ids: string[]) {
  if (ids.length === 0) return []
  return prisma.$queryRawUnsafe<UserRow[]>(
    `
      SELECT id::text AS id, nome, email
      FROM public.usuarios
      WHERE id::text = ANY($1::text[])
      ORDER BY nome ASC
    `,
    ids,
  )
}

export async function GET() {
  try {
    await ensureEmailTriageTables()

    const [rules, users] = await Promise.all([
      prisma.$queryRawUnsafe<RuleRow[]>(`
        SELECT
          r.id::text AS id,
          r.nome,
          r.palavras_chave AS palavras,
          r.ativo,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', u.usuario_id,
                'nome', u.usuario_nome,
                'email', u.usuario_email
              ) ORDER BY u.usuario_nome
            ) FILTER (WHERE u.id IS NOT NULL AND u.ativo = TRUE),
            '[]'::jsonb
          ) AS usuarios
        FROM public.judicial_email_regras r
        LEFT JOIN public.judicial_email_regra_usuarios u
          ON u.regra_id = r.id
         AND u.ativo = TRUE
        GROUP BY r.id
        ORDER BY r.ordem ASC, r.nome ASC
      `),
      prisma.$queryRawUnsafe<UserRow[]>(`
        SELECT id::text AS id, nome, email
        FROM public.usuarios
        WHERE COALESCE((to_jsonb(usuarios)->>'ativo')::boolean, TRUE) = TRUE
        ORDER BY nome ASC
      `).catch(() => prisma.$queryRawUnsafe<UserRow[]>(`
        SELECT id::text AS id, nome, email
        FROM public.usuarios
        ORDER BY nome ASC
      `)),
    ])

    return NextResponse.json({
      ok: true,
      rules: rules.map((rule) => ({
        id: rule.id,
        nome: rule.nome,
        palavras: parseWords(rule.palavras),
        ativo: rule.ativo !== false,
        usuarios: Array.isArray(rule.usuarios) ? rule.usuarios : parseWords(rule.usuarios),
      })),
      users: users.map((user) => ({ id: user.id, nome: user.nome || "Usuário", email: user.email || "" })),
    })
  } catch (error) {
    console.error("[email-integracao/regras GET] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao carregar regras." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureEmailTriageTables()
    const body = await req.json().catch(() => ({}))

    const id = text(body?.id)
    const nome = text(body?.nome)
    const palavras = parseWords(body?.palavras)
    const usuarioIds = Array.isArray(body?.usuarioIds) ? body.usuarioIds.map(text).filter(Boolean) : []

    if (!nome) return NextResponse.json({ ok: false, error: "Informe o nome da regra." }, { status: 400 })
    if (palavras.length === 0) return NextResponse.json({ ok: false, error: "Informe ao menos uma palavra-chave." }, { status: 400 })

    const users = await getUsersByIds(usuarioIds)

    const result = await prisma.$transaction(async (tx) => {
      const rows = id
        ? await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `
              UPDATE public.judicial_email_regras
              SET nome = $2,
                  palavras_chave = $3::jsonb,
                  ativo = TRUE,
                  updated_at = NOW()
              WHERE id::text = $1
              RETURNING id::text AS id
            `,
            id,
            nome,
            JSON.stringify(palavras),
          )
        : await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `
              INSERT INTO public.judicial_email_regras (nome, palavras_chave, ativo, created_at, updated_at)
              VALUES ($1, $2::jsonb, TRUE, NOW(), NOW())
              ON CONFLICT (nome) DO UPDATE
              SET palavras_chave = EXCLUDED.palavras_chave,
                  ativo = TRUE,
                  updated_at = NOW()
              RETURNING id::text AS id
            `,
            nome,
            JSON.stringify(palavras),
          )

      const ruleId = rows[0]?.id
      if (!ruleId) throw new Error("Regra não salva.")

      await tx.$executeRawUnsafe(
        `UPDATE public.judicial_email_regra_usuarios SET ativo = FALSE, updated_at = NOW() WHERE regra_id = $1::bigint`,
        ruleId,
      )

      for (const user of users) {
        await tx.$executeRawUnsafe(
          `
            INSERT INTO public.judicial_email_regra_usuarios (
              regra_id, usuario_id, usuario_nome, usuario_email, ativo, created_at, updated_at
            )
            VALUES ($1::bigint, $2, $3, $4, TRUE, NOW(), NOW())
            ON CONFLICT (regra_id, usuario_id)
            DO UPDATE SET usuario_nome = EXCLUDED.usuario_nome,
                          usuario_email = EXCLUDED.usuario_email,
                          ativo = TRUE,
                          updated_at = NOW()
          `,
          ruleId,
          user.id,
          user.nome || "Usuário",
          user.email || null,
        )
      }

      return { id: ruleId }
    })

    return NextResponse.json({ ok: true, item: result })
  } catch (error) {
    console.error("[email-integracao/regras POST] erro:", error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro ao salvar regra." }, { status: 500 })
  }
}
