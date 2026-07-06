import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminRequest } from "@/lib/security/server-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SuggestionRow = {
  value: string | null
  label: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeCid(value: unknown) {
  return text(value).toUpperCase().replace(/[^A-Z0-9]/g, "")
}

function buildItems(rows: SuggestionRow[]) {
  const seen = new Set<string>()
  return rows
    .map((row) => ({
      value: text(row.value),
      label: text(row.label || row.value),
    }))
    .filter((item) => {
      const key = item.value.toUpperCase()
      if (!item.value || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

async function ensureManualAssignmentTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.judicial_monitoramento_atribuicoes_manuais (
      id BIGSERIAL PRIMARY KEY,
      monitoramento_id BIGINT NOT NULL,
      usuario_id TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
      usuario_email TEXT,
      origem_atribuicao TEXT NOT NULL DEFAULT 'MANUAL',
      motivo TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      atribuida_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      removida_em TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

export async function GET(req: NextRequest) {

  const adminGuard = await requireAdminRequest(req)
  if (!adminGuard.ok) return adminGuard.response

  try {
    const field = text(req.nextUrl.searchParams.get("field")).toLowerCase()
    const q = text(req.nextUrl.searchParams.get("q"))
    const search = `%${q.toLowerCase()}%`
    const cidSearch = `%${normalizeCid(q)}%`

    if (!q) {
      return NextResponse.json({ ok: true, items: [] })
    }

    let rows: SuggestionRow[] = []

    if (field === "nome") {
      rows = await prisma.$queryRawUnsafe<SuggestionRow[]>(
        `
          SELECT DISTINCT b.nome_paciente AS value, b.nome_paciente AS label
          FROM public.judicial_monitoramento_base b
          WHERE UPPER(COALESCE(b.origem_modulo, 'JUDICIAL')) = 'JUDICIAL'
            AND LOWER(COALESCE(b.nome_paciente, '')) LIKE $1
          ORDER BY b.nome_paciente
          LIMIT 20
        `,
        search,
      )
    } else if (field === "cpf") {
      rows = await prisma.$queryRawUnsafe<SuggestionRow[]>(
        `
          SELECT DISTINCT b.cpf AS value, b.cpf AS label
          FROM public.judicial_monitoramento_base b
          WHERE UPPER(COALESCE(b.origem_modulo, 'JUDICIAL')) = 'JUDICIAL'
            AND LOWER(COALESCE(b.cpf, '')) LIKE $1
          ORDER BY b.cpf
          LIMIT 20
        `,
        search,
      )
    } else if (field === "cns") {
      rows = await prisma.$queryRawUnsafe<SuggestionRow[]>(
        `
          SELECT DISTINCT b.cns AS value, b.cns AS label
          FROM public.judicial_monitoramento_base b
          WHERE UPPER(COALESCE(b.origem_modulo, 'JUDICIAL')) = 'JUDICIAL'
            AND LOWER(COALESCE(b.cns, '')) LIKE $1
          ORDER BY b.cns
          LIMIT 20
        `,
        search,
      )
    } else if (field === "processo") {
      rows = await prisma.$queryRawUnsafe<SuggestionRow[]>(
        `
          SELECT value, value AS label
          FROM (
            SELECT DISTINCT d.protocolo::text AS value
            FROM public.demandas d
            WHERE LOWER(COALESCE(d.protocolo::text, '')) LIKE $1
            UNION
            SELECT DISTINCT jp.numero::text AS value
            FROM public.judicial_processos_vinculados jp
            WHERE COALESCE(jp.ativo, TRUE) = TRUE
              AND jp.tipo = 'PROCESSO'
              AND LOWER(COALESCE(jp.numero::text, '')) LIKE $1
          ) x
          WHERE COALESCE(value, '') <> ''
          ORDER BY value
          LIMIT 20
        `,
        search,
      )
    } else if (field === "pgenet") {
      rows = await prisma.$queryRawUnsafe<SuggestionRow[]>(
        `
          SELECT DISTINCT jp.numero::text AS value, jp.numero::text AS label
          FROM public.judicial_processos_vinculados jp
          WHERE COALESCE(jp.ativo, TRUE) = TRUE
            AND jp.tipo = 'PGE_NET'
            AND LOWER(COALESCE(jp.numero::text, '')) LIKE $1
          ORDER BY jp.numero
          LIMIT 20
        `,
        search,
      )
    } else if (field === "cid") {
      rows = await prisma.$queryRawUnsafe<SuggestionRow[]>(
        `
          SELECT
            c.codigo::text AS value,
            c.codigo::text || ' - ' || COALESCE(c.descricao::text, '') AS label
          FROM public.admin_judicial_cid10 c
          WHERE COALESCE(c.ativo, TRUE) = TRUE
            AND (
              LOWER(COALESCE(c.codigo::text, '')) LIKE $1
              OR LOWER(COALESCE(c.descricao::text, '')) LIKE $1
              OR regexp_replace(UPPER(COALESCE(c.codigo::text, '')), '[^A-Z0-9]', '', 'g') LIKE $2
            )
          ORDER BY c.codigo
          LIMIT 20
        `,
        search,
        cidSearch,
      )
    } else if (field === "sigtap") {
      rows = await prisma.$queryRawUnsafe<SuggestionRow[]>(
        `
          SELECT
            s.codigo::text AS value,
            s.codigo::text || ' - ' || COALESCE(s.descricao::text, '') AS label
          FROM public.admin_judicial_sigtap s
          WHERE COALESCE(s.ativo, TRUE) = TRUE
            AND (
              LOWER(COALESCE(s.codigo::text, '')) LIKE $1
              OR LOWER(COALESCE(s.descricao::text, '')) LIKE $1
              OR regexp_replace(COALESCE(s.codigo::text, ''), '\\D', '', 'g') LIKE regexp_replace($1, '\\D', '', 'g')
            )
          ORDER BY s.codigo
          LIMIT 20
        `,
        search,
      )
    } else if (field === "especialidade") {
      rows = await prisma.$queryRawUnsafe<SuggestionRow[]>(
        `
          SELECT DISTINCT e.nome::text AS value, e.nome::text AS label
          FROM public.admin_judicial_especialidades e
          WHERE COALESCE(e.ativo, TRUE) = TRUE
            AND LOWER(COALESCE(e.nome::text, '')) LIKE $1
          ORDER BY e.nome
          LIMIT 20
        `,
        search,
      )
    } else if (field === "subespecialidade") {
      rows = await prisma.$queryRawUnsafe<SuggestionRow[]>(
        `
          SELECT DISTINCT s.nome::text AS value, s.nome::text AS label
          FROM public.admin_judicial_subespecialidades s
          WHERE COALESCE(s.ativo, TRUE) = TRUE
            AND LOWER(COALESCE(s.nome::text, '')) LIKE $1
          ORDER BY s.nome
          LIMIT 20
        `,
        search,
      )
    } else if (field === "atribuido") {
      await ensureManualAssignmentTable()
      rows = await prisma.$queryRawUnsafe<SuggestionRow[]>(
        `
          SELECT value, value AS label
          FROM (
            SELECT DISTINCT m.usuario_nome::text AS value
            FROM public.judicial_monitoramento_atribuicoes_manuais m
            WHERE m.ativo = TRUE AND LOWER(COALESCE(m.usuario_nome, '')) LIKE $1
            UNION
            SELECT DISTINCT a.usuario_nome::text AS value
            FROM public.judicial_monitoramento_atribuicoes a
            WHERE a.status IN ('ATRIBUIDO', 'EM_ANALISE', 'EM_MONITORAMENTO')
              AND LOWER(COALESCE(a.usuario_nome, '')) LIKE $1
          ) x
          WHERE COALESCE(value, '') <> ''
          ORDER BY value
          LIMIT 20
        `,
        search,
      )
    } else {
      rows = await prisma.$queryRawUnsafe<SuggestionRow[]>(
        `
          SELECT value, value AS label
          FROM (
            SELECT DISTINCT b.nome_paciente::text AS value FROM public.judicial_monitoramento_base b WHERE LOWER(COALESCE(b.nome_paciente, '')) LIKE $1
            UNION SELECT DISTINCT b.cpf::text AS value FROM public.judicial_monitoramento_base b WHERE LOWER(COALESCE(b.cpf, '')) LIKE $1
            UNION SELECT DISTINCT b.cns::text AS value FROM public.judicial_monitoramento_base b WHERE LOWER(COALESCE(b.cns, '')) LIKE $1
            UNION SELECT DISTINCT d.protocolo::text AS value FROM public.demandas d WHERE LOWER(COALESCE(d.protocolo::text, '')) LIKE $1
          ) x
          WHERE COALESCE(value, '') <> ''
          ORDER BY value
          LIMIT 20
        `,
        search,
      )
    }

    return NextResponse.json({ ok: true, items: buildItems(rows) })
  } catch (error) {
    console.error("[GET /api/admin/judicial/atribuicao-manual/sugestoes] erro:", error)
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: "Erro ao carregar sugestões.", detail }, { status: 500 })
  }
}
