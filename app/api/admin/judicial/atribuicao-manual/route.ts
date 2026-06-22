import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ManualAssignmentRow = {
  monitoramentoId: string
  protocolo: string | null
  nomePaciente: string | null
  cpf: string | null
  cns: string | null
  fichaCore: string | null
  processoNumeros: string | null
  pgenetNumeros: string | null
  sigtapCodigo: string | null
  sigtapDescricao: string | null
  cidCodigo: string | null
  cidDescricao: string | null
  especialidade: string | null
  subespecialidade: string | null
  statusMonitoramentoAtual: string | null
  usuarioAtribuidoId: string | null
  usuarioAtribuidoNome: string | null
  usuarioAtribuidoEmail: string | null
  origemAtribuicao: string | null
  atribuidoEm: string | null
}

type UserRow = {
  id: string
  nome: string | null
  email: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeText(value: unknown) {
  return text(value).replace(/\s+/g, " ")
}

function truthy(value: string) {
  return ["1", "true", "sim", "yes"].includes(value.toLowerCase())
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

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS judicial_monitoramento_atribuicoes_manuais_uniq_ativa
    ON public.judicial_monitoramento_atribuicoes_manuais (monitoramento_id)
    WHERE ativo = TRUE
  `)
}

function addIlikeFilter(whereParts: string[], params: unknown[], columnSql: string, value: string) {
  const clean = normalizeText(value).toLowerCase()
  if (!clean) return
  params.push(`%${clean}%`)
  whereParts.push(`LOWER(COALESCE(${columnSql}, '')) LIKE $${params.length}`)
}

export async function GET(req: NextRequest) {
  try {
    await ensureManualAssignmentTable()

    const searchParams = req.nextUrl.searchParams
    const tab = text(searchParams.get("tab") || "assigned")
    const page = Math.max(1, Number(searchParams.get("page") || 1) || 1)
    const pageSize = Math.max(10, Math.min(100, Number(searchParams.get("pageSize") || 25) || 25))
    const offset = (page - 1) * pageSize

    const params: unknown[] = []
    const whereParts: string[] = [
      `UPPER(COALESCE(b.origem_modulo, 'JUDICIAL')) = 'JUDICIAL'`,
      `COALESCE(b.ativo_monitoramento, TRUE) = TRUE`,
    ]

    if (tab === "unassigned") {
      whereParts.push(`manual.monitoramento_id IS NULL AND aberta.monitoramento_id IS NULL`)
    } else {
      whereParts.push(`manual.monitoramento_id IS NOT NULL OR aberta.monitoramento_id IS NOT NULL`)
    }

    const q = normalizeText(searchParams.get("q"))
    if (q) {
      params.push(`%${q.toLowerCase()}%`)
      const idx = params.length
      whereParts.push(`
        (
          LOWER(COALESCE(b.nome_paciente, '')) LIKE $${idx}
          OR LOWER(COALESCE(b.cpf, '')) LIKE $${idx}
          OR LOWER(COALESCE(b.cns, '')) LIKE $${idx}
          OR LOWER(COALESCE(d.protocolo, '')) LIKE $${idx}
          OR LOWER(COALESCE(b.ficha_core, '')) LIKE $${idx}
          OR LOWER(COALESCE(proc.processo_numeros, '')) LIKE $${idx}
          OR LOWER(COALESCE(proc.pgenet_numeros, '')) LIKE $${idx}
          OR LOWER(COALESCE(b.cid_codigo, d.cid10, '')) LIKE $${idx}
          OR LOWER(COALESCE(b.cid_descricao, '')) LIKE $${idx}
          OR LOWER(COALESCE(b.procedimento_codigo, d."codigoSigtap", '')) LIKE $${idx}
          OR LOWER(COALESCE(b.procedimento_descricao, d."descricaoSigtap", '')) LIKE $${idx}
          OR LOWER(COALESCE(d.especialidade, '')) LIKE $${idx}
          OR LOWER(COALESCE(d.subespecialidade, '')) LIKE $${idx}
          OR LOWER(COALESCE(manual.usuario_nome, aberta.usuario_nome, '')) LIKE $${idx}
        )
      `)
    }

    addIlikeFilter(whereParts, params, "b.nome_paciente", text(searchParams.get("nome")))
    addIlikeFilter(whereParts, params, "b.cpf", text(searchParams.get("cpf")))
    addIlikeFilter(whereParts, params, "b.cns", text(searchParams.get("cns")))
    addIlikeFilter(whereParts, params, "d.protocolo", text(searchParams.get("processo")))
    addIlikeFilter(whereParts, params, "proc.processo_numeros", text(searchParams.get("processo")))
    addIlikeFilter(whereParts, params, "proc.pgenet_numeros", text(searchParams.get("pgenet")))
    addIlikeFilter(whereParts, params, "COALESCE(b.cid_codigo, d.cid10)", text(searchParams.get("cid")))
    addIlikeFilter(whereParts, params, "COALESCE(b.procedimento_codigo, d.\"codigoSigtap\")", text(searchParams.get("sigtap")))
    addIlikeFilter(whereParts, params, "d.especialidade", text(searchParams.get("especialidade")))
    addIlikeFilter(whereParts, params, "d.subespecialidade", text(searchParams.get("subespecialidade")))

    if (tab !== "unassigned") {
      addIlikeFilter(whereParts, params, "COALESCE(manual.usuario_nome, aberta.usuario_nome)", text(searchParams.get("atribuido")))
    }

    const whereSql = `WHERE ${whereParts.join(" AND ")}`
    const baseSql = `
      FROM public.judicial_monitoramento_base b
      LEFT JOIN public.demandas d ON d.id = b.demanda_id
      LEFT JOIN (
        SELECT
          monitoramento_id::text AS monitoramento_id,
          STRING_AGG(numero, ' | ' ORDER BY numero) FILTER (WHERE tipo = 'PROCESSO') AS processo_numeros,
          STRING_AGG(numero, ' | ' ORDER BY numero) FILTER (WHERE tipo = 'PGE_NET') AS pgenet_numeros
        FROM public.judicial_processos_vinculados
        WHERE COALESCE(ativo, TRUE) = TRUE
        GROUP BY monitoramento_id::text
      ) proc ON proc.monitoramento_id = b.id::text
      LEFT JOIN (
        SELECT DISTINCT ON (m.monitoramento_id)
          m.monitoramento_id::text AS monitoramento_id,
          m.usuario_id,
          m.usuario_nome,
          m.usuario_email,
          m.origem_atribuicao,
          m.atribuida_em
        FROM public.judicial_monitoramento_atribuicoes_manuais m
        WHERE m.ativo = TRUE
        ORDER BY m.monitoramento_id, m.atribuida_em DESC, m.id DESC
      ) manual ON manual.monitoramento_id = b.id::text
      LEFT JOIN (
        SELECT DISTINCT ON (a.monitoramento_id)
          a.monitoramento_id::text AS monitoramento_id,
          a.usuario_id,
          a.usuario_nome,
          a.usuario_email,
          a.atribuida_em,
          a.motivo_prioridade
        FROM public.judicial_monitoramento_atribuicoes a
        WHERE a.status IN ('ATRIBUIDO', 'EM_ANALISE', 'EM_MONITORAMENTO')
        ORDER BY a.monitoramento_id, a.data_referencia DESC, a.created_at DESC, a.id DESC
      ) aberta ON aberta.monitoramento_id = b.id::text
      ${whereSql}
    `

    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total ${baseSql}`,
      ...params,
    )

    params.push(pageSize)
    params.push(offset)

    const rows = await prisma.$queryRawUnsafe<ManualAssignmentRow[]>(
      `
        SELECT
          b.id::text AS "monitoramentoId",
          d.protocolo,
          b.nome_paciente AS "nomePaciente",
          b.cpf,
          b.cns,
          b.ficha_core AS "fichaCore",
          proc.processo_numeros AS "processoNumeros",
          proc.pgenet_numeros AS "pgenetNumeros",
          COALESCE(b.procedimento_codigo, d."codigoSigtap") AS "sigtapCodigo",
          COALESCE(b.procedimento_descricao, d."descricaoSigtap") AS "sigtapDescricao",
          COALESCE(b.cid_codigo, d.cid10) AS "cidCodigo",
          b.cid_descricao AS "cidDescricao",
          d.especialidade,
          d.subespecialidade,
          b.status_monitoramento_atual AS "statusMonitoramentoAtual",
          COALESCE(manual.usuario_id, aberta.usuario_id) AS "usuarioAtribuidoId",
          COALESCE(manual.usuario_nome, aberta.usuario_nome) AS "usuarioAtribuidoNome",
          COALESCE(manual.usuario_email, aberta.usuario_email) AS "usuarioAtribuidoEmail",
          CASE
            WHEN manual.monitoramento_id IS NOT NULL THEN 'MANUAL'
            WHEN aberta.motivo_prioridade LIKE '0%' THEN 'PRIORIDADE'
            ELSE 'AUTOMATICA'
          END AS "origemAtribuicao",
          COALESCE(manual.atribuida_em, aberta.atribuida_em)::text AS "atribuidoEm"
        ${baseSql}
        ORDER BY
          CASE WHEN manual.monitoramento_id IS NOT NULL THEN 0 WHEN aberta.monitoramento_id IS NOT NULL THEN 1 ELSE 2 END,
          b.nome_paciente ASC NULLS LAST,
          b.id DESC
        LIMIT $${params.length - 1}::int OFFSET $${params.length}::int
      `,
      ...params,
    )

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      total: Number(countRows[0]?.total ?? 0),
      items: rows.map((row) => ({
        monitoramentoId: row.monitoramentoId,
        protocolo: row.protocolo ?? row.monitoramentoId,
        nomePaciente: row.nomePaciente ?? "SEM NOME",
        cpf: row.cpf ?? "",
        cns: row.cns ?? "",
        fichaCore: row.fichaCore ?? "",
        processoNumeros: row.processoNumeros ?? "",
        pgenetNumeros: row.pgenetNumeros ?? "",
        sigtapCodigo: row.sigtapCodigo ?? "",
        sigtapDescricao: row.sigtapDescricao ?? "",
        cidCodigo: row.cidCodigo ?? "",
        cidDescricao: row.cidDescricao ?? "",
        especialidade: row.especialidade ?? "",
        subespecialidade: row.subespecialidade ?? "",
        statusMonitoramentoAtual: row.statusMonitoramentoAtual ?? "",
        usuarioAtribuidoId: row.usuarioAtribuidoId ?? "",
        usuarioAtribuidoNome: row.usuarioAtribuidoNome ?? "",
        usuarioAtribuidoEmail: row.usuarioAtribuidoEmail ?? "",
        origemAtribuicao: row.origemAtribuicao ?? "",
        atribuidoEm: row.atribuidoEm ?? "",
      })),
    })
  } catch (error) {
    console.error("[GET /api/admin/judicial/atribuicao-manual] erro:", error)
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: "Erro ao carregar atribuições manuais.", detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureManualAssignmentTable()

    const body = await req.json().catch(() => ({}))
    const monitoramentoIds = Array.isArray(body?.monitoramentoIds)
      ? body.monitoramentoIds.map((item: unknown) => text(item)).filter(Boolean)
      : []
    const usuarioId = text(body?.usuarioId)

    if (monitoramentoIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Selecione pelo menos um processo." }, { status: 400 })
    }

    if (!usuarioId) {
      return NextResponse.json({ ok: false, error: "Selecione o usuário responsável." }, { status: 400 })
    }

    const userRows = await prisma.$queryRawUnsafe<UserRow[]>(
      `
        SELECT id::text AS id, nome, email
        FROM public.usuarios
        WHERE id::text = $1
        LIMIT 1
      `,
      usuarioId,
    )

    const user = userRows[0]
    if (!user) {
      return NextResponse.json({ ok: false, error: "Usuário não localizado." }, { status: 404 })
    }

    const usuarioNome = text(user.nome) || "Usuário"
    const usuarioEmail = text(user.email).toLowerCase()

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_atribuicoes_manuais
          SET ativo = FALSE,
              removida_em = NOW(),
              updated_at = NOW(),
              motivo = CASE
                WHEN COALESCE(motivo, '') = '' THEN 'Substituída por nova atribuição manual.'
                ELSE motivo || E'\nSubstituída por nova atribuição manual.'
              END
          WHERE ativo = TRUE
            AND monitoramento_id::text = ANY($1::text[])
        `,
        monitoramentoIds,
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_atribuicoes
          SET status = 'CANCELADO',
              observacao = CASE
                WHEN COALESCE(observacao, '') = '' THEN 'Cancelada por atribuição manual.'
                ELSE observacao || E'\nCancelada por atribuição manual.'
              END,
              updated_at = NOW()
          WHERE monitoramento_id::text = ANY($1::text[])
            AND status IN ('ATRIBUIDO', 'EM_ANALISE', 'EM_MONITORAMENTO')
        `,
        monitoramentoIds,
      )

      const inserted = await tx.$queryRawUnsafe<Array<{ monitoramentoId: string }>>(
        `
          INSERT INTO public.judicial_monitoramento_atribuicoes_manuais (
            monitoramento_id,
            usuario_id,
            usuario_nome,
            usuario_email,
            origem_atribuicao,
            motivo,
            ativo,
            atribuida_em,
            created_at,
            updated_at
          )
          SELECT
            b.id,
            $2,
            $3,
            $4,
            'MANUAL',
            'Atribuição manual pela administração judicial.',
            TRUE,
            NOW(),
            NOW(),
            NOW()
          FROM public.judicial_monitoramento_base b
          WHERE b.id::text = ANY($1::text[])
          RETURNING monitoramento_id::text AS "monitoramentoId"
        `,
        monitoramentoIds,
        usuarioId,
        usuarioNome,
        usuarioEmail || null,
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_base
          SET status_monitoramento_atual = 'ATRIBUIDO',
              prioridade_monitoramento = GREATEST(COALESCE(prioridade_monitoramento, 0), 3),
              data_proximo_monitoramento = NULL,
              motivo_proximo_monitoramento = 'ATRIBUICAO_MANUAL',
              updated_at = NOW()
          WHERE id::text = ANY($1::text[])
        `,
        monitoramentoIds,
      )

      return inserted
    })

    return NextResponse.json({
      ok: true,
      quantidade: result.length,
      usuario: {
        id: usuarioId,
        nome: usuarioNome,
        email: usuarioEmail,
      },
      monitoramentoIds: result.map((item) => item.monitoramentoId),
    })
  } catch (error) {
    console.error("[POST /api/admin/judicial/atribuicao-manual] erro:", error)
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: "Erro ao atribuir processos manualmente.", detail }, { status: 500 })
  }
}
