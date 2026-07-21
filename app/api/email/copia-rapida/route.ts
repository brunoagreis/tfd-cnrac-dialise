import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { requireLoggedRequest } from "@/lib/security/server-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type QuickCopyEmailRow = {
  id: string
  nome: string | null
  email: string
  createdByName: string | null
  createdAt: string
  ativo: boolean
}

type SessionActor = {
  id: string
  email: string
  nome?: string
  name?: string
}

const createSchema = z.object({
  nome: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email().max(254),
})

const updateSchema = z.object({
  id: z.string().trim().min(1),
  nome: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email().max(254),
})

const deleteSchema = z.object({
  id: z.string().trim().min(1),
})

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeEmail(value: unknown) {
  return text(value).toLowerCase()
}

// EMAIL_COPIA_RAPIDA_EDITAR_EXCLUIR
async function ensureQuickCopyEmailTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.email_copia_rapida (
      id TEXT PRIMARY KEY,
      nome TEXT,
      email TEXT NOT NULL,
      email_normalizado TEXT NOT NULL UNIQUE,
      created_by_id TEXT,
      created_by_name TEXT,
      created_by_email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ativo BOOLEAN NOT NULL DEFAULT TRUE
    )
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.email_copia_rapida
    ADD COLUMN IF NOT EXISTS updated_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `)
}

function mapRow(row: QuickCopyEmailRow) {
  return {
    id: text(row.id),
    nome: text(row.nome),
    email: text(row.email),
    createdByName: text(row.createdByName),
    createdAt: text(row.createdAt),
  }
}

function actorFromSession(session: SessionActor) {
  const id = text(session.id)
  const email = text(session.email)

  return {
    id,
    email,
    name:
      text(session.nome) ||
      text(session.name) ||
      email ||
      "Usuário do SIGAJUS",
  }
}

async function recordAudit(input: {
  action: string
  recordId: string
  actor: ReturnType<typeof actorFromSession>
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  fields: string[]
  observation: string
}) {
  try {
    await prisma.$executeRawUnsafe(
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
          'email_copia_rapida',
          $1,
          $2,
          $3,
          $4,
          $5,
          'JUDICIAL',
          NOW(),
          $6::jsonb,
          $7::jsonb,
          $8::jsonb,
          $9
        )
      `,
      input.action,
      input.recordId,
      input.actor.id,
      input.actor.name,
      input.actor.email,
      input.before
        ? JSON.stringify(input.before)
        : null,
      input.after
        ? JSON.stringify(input.after)
        : null,
      JSON.stringify(input.fields),
      input.observation,
    )
  } catch (error) {
    console.error(
      "EMAIL_COPIA_RAPIDA_AUDIT_WARNING",
      error,
    )
  }
}

async function findById(id: string) {
  const rows =
    await prisma.$queryRawUnsafe<
      QuickCopyEmailRow[]
    >(
      `
        SELECT
          id::text AS id,
          nome,
          email,
          created_by_name AS "createdByName",
          created_at::text AS "createdAt",
          ativo
        FROM public.email_copia_rapida
        WHERE id::text = $1
        LIMIT 1
      `,
      id,
    )

  return rows[0] || null
}

export async function GET(req: NextRequest) {
  const guard = await requireLoggedRequest(req)
  if (!guard.ok) return guard.response

  try {
    await ensureQuickCopyEmailTable()

    const rows =
      await prisma.$queryRawUnsafe<
        QuickCopyEmailRow[]
      >(
        `
          SELECT
            id::text AS id,
            nome,
            email,
            created_by_name AS "createdByName",
            created_at::text AS "createdAt",
            ativo
          FROM public.email_copia_rapida
          WHERE ativo = TRUE
          ORDER BY
            COALESCE(NULLIF(TRIM(nome), ''), email),
            email
        `,
      )

    return NextResponse.json({
      ok: true,
      items: rows.map(mapRow),
    })
  } catch (error) {
    console.error(
      "[GET /api/email/copia-rapida] erro:",
      error,
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar e-mails.",
      },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireLoggedRequest(req)
  if (!guard.ok) return guard.response

  try {
    const body = await req.json().catch(() => null)
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Informe um endereço de e-mail válido.",
        },
        { status: 400 },
      )
    }

    await ensureQuickCopyEmailTable()

    const actor = actorFromSession(
      guard.session as SessionActor,
    )

    const nome = text(parsed.data.nome)
    const email = normalizeEmail(parsed.data.email)

    const existingRows =
      await prisma.$queryRawUnsafe<
        QuickCopyEmailRow[]
      >(
        `
          SELECT
            id::text AS id,
            nome,
            email,
            created_by_name AS "createdByName",
            created_at::text AS "createdAt",
            ativo
          FROM public.email_copia_rapida
          WHERE email_normalizado = $1
          LIMIT 1
        `,
        email,
      )

    const existing = existingRows[0]

    if (existing) {
      if (existing.ativo) {
        return NextResponse.json({
          ok: true,
          item: mapRow(existing),
          created: false,
          reactivated: false,
        })
      }

      const updatedRows =
        await prisma.$queryRawUnsafe<
          QuickCopyEmailRow[]
        >(
          `
            UPDATE public.email_copia_rapida
            SET
              nome = NULLIF($2, ''),
              email = $3,
              email_normalizado = $3,
              ativo = TRUE,
              updated_at = NOW()
            WHERE id::text = $1
            RETURNING
              id::text AS id,
              nome,
              email,
              created_by_name AS "createdByName",
              created_at::text AS "createdAt",
              ativo
          `,
          existing.id,
          nome,
          email,
        )

      const item = updatedRows[0]

      await recordAudit({
        action: "reativar_email_copia_rapida",
        recordId: item.id,
        actor,
        before: {
          nome: existing.nome,
          email: existing.email,
          ativo: existing.ativo,
        },
        after: {
          nome: item.nome,
          email: item.email,
          ativo: item.ativo,
        },
        fields: ["nome", "email", "ativo"],
        observation:
          `E-mail de cópia rápida reativado: ${email}`,
      })

      return NextResponse.json({
        ok: true,
        item: mapRow(item),
        created: false,
        reactivated: true,
      })
    }

    const id =
      `email_copia_${randomUUID().replace(/-/g, "")}`

    const insertedRows =
      await prisma.$queryRawUnsafe<
        QuickCopyEmailRow[]
      >(
        `
          INSERT INTO public.email_copia_rapida (
            id,
            nome,
            email,
            email_normalizado,
            created_by_id,
            created_by_name,
            created_by_email,
            created_at,
            updated_at,
            ativo
          )
          VALUES (
            $1,
            NULLIF($2, ''),
            $3,
            $3,
            $4,
            $5,
            $6,
            NOW(),
            NOW(),
            TRUE
          )
          RETURNING
            id::text AS id,
            nome,
            email,
            created_by_name AS "createdByName",
            created_at::text AS "createdAt",
            ativo
        `,
        id,
        nome,
        email,
        actor.id,
        actor.name,
        actor.email,
      )

    const item = insertedRows[0]

    await recordAudit({
      action: "cadastrar_email_copia_rapida",
      recordId: item.id,
      actor,
      before: null,
      after: {
        nome: item.nome,
        email: item.email,
        ativo: item.ativo,
      },
      fields: ["nome", "email", "ativo"],
      observation:
        `E-mail de cópia rápida cadastrado: ${email}`,
    })

    return NextResponse.json(
      {
        ok: true,
        item: mapRow(item),
        created: true,
        reactivated: false,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error(
      "[POST /api/email/copia-rapida] erro:",
      error,
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao cadastrar e-mail.",
      },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireLoggedRequest(req)
  if (!guard.ok) return guard.response

  try {
    const body = await req.json().catch(() => null)
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dados inválidos para edição.",
        },
        { status: 400 },
      )
    }

    await ensureQuickCopyEmailTable()

    const actor = actorFromSession(
      guard.session as SessionActor,
    )

    const id = text(parsed.data.id)
    const nome = text(parsed.data.nome)
    const email = normalizeEmail(parsed.data.email)

    const current = await findById(id)

    if (!current || !current.ativo) {
      return NextResponse.json(
        {
          ok: false,
          error: "E-mail não encontrado.",
        },
        { status: 404 },
      )
    }

    const duplicateRows =
      await prisma.$queryRawUnsafe<
        Array<{ id: string }>
      >(
        `
          SELECT id::text AS id
          FROM public.email_copia_rapida
          WHERE email_normalizado = $1
            AND id::text <> $2
          LIMIT 1
        `,
        email,
        id,
      )

    if (duplicateRows.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Este e-mail já está cadastrado em outro registro.",
        },
        { status: 409 },
      )
    }

    const updatedRows =
      await prisma.$queryRawUnsafe<
        QuickCopyEmailRow[]
      >(
        `
          UPDATE public.email_copia_rapida
          SET
            nome = NULLIF($2, ''),
            email = $3,
            email_normalizado = $3,
            updated_at = NOW()
          WHERE id::text = $1
            AND ativo = TRUE
          RETURNING
            id::text AS id,
            nome,
            email,
            created_by_name AS "createdByName",
            created_at::text AS "createdAt",
            ativo
        `,
        id,
        nome,
        email,
      )

    const item = updatedRows[0]

    await recordAudit({
      action: "editar_email_copia_rapida",
      recordId: item.id,
      actor,
      before: {
        nome: current.nome,
        email: current.email,
        ativo: current.ativo,
      },
      after: {
        nome: item.nome,
        email: item.email,
        ativo: item.ativo,
      },
      fields: ["nome", "email"],
      observation:
        `E-mail de cópia rápida alterado para: ${email}`,
    })

    return NextResponse.json({
      ok: true,
      item: mapRow(item),
      updated: true,
    })
  } catch (error) {
    console.error(
      "[PATCH /api/email/copia-rapida] erro:",
      error,
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao editar e-mail.",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await requireLoggedRequest(req)
  if (!guard.ok) return guard.response

  try {
    const body = await req.json().catch(() => null)
    const parsed = deleteSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Identificador inválido.",
        },
        { status: 400 },
      )
    }

    await ensureQuickCopyEmailTable()

    const actor = actorFromSession(
      guard.session as SessionActor,
    )

    const id = text(parsed.data.id)
    const current = await findById(id)

    if (!current || !current.ativo) {
      return NextResponse.json(
        {
          ok: false,
          error: "E-mail não encontrado.",
        },
        { status: 404 },
      )
    }

    await prisma.$executeRawUnsafe(
      `
        UPDATE public.email_copia_rapida
        SET
          ativo = FALSE,
          updated_at = NOW()
        WHERE id::text = $1
      `,
      id,
    )

    await recordAudit({
      action: "excluir_email_copia_rapida",
      recordId: id,
      actor,
      before: {
        nome: current.nome,
        email: current.email,
        ativo: true,
      },
      after: {
        nome: current.nome,
        email: current.email,
        ativo: false,
      },
      fields: ["ativo"],
      observation:
        `E-mail de cópia rápida excluído: ${current.email}`,
    })

    return NextResponse.json({
      ok: true,
      id,
      email: current.email,
      deleted: true,
    })
  } catch (error) {
    console.error(
      "[DELETE /api/email/copia-rapida] erro:",
      error,
    )

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao excluir e-mail.",
      },
      { status: 500 },
    )
  }
}
