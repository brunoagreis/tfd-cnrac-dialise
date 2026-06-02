import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CnracFilaRow = {
  id: string
  protocolo: string
  pacienteId: string
  pacienteNome: string
  pacienteCpf: string | null
  pacienteCartaoSus: string | null
  modulo: string
  emailSolicitante: string | null
  codigoSigtap: string | null
  descricaoSigtap: string | null
  cid10: string | null
  especialidade: string | null
  subespecialidade: string | null
  statusMonitoramentoAtual: string | null
  criadoEm: string
  atualizadoEm: string
  acaoJudicial: boolean | null
}

type PacienteDbRow = {
  id: string
  nome: string | null
  cpf: string | null
  cartaoSus: string | null
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeStatus(value: unknown) {
  const status = String(value ?? "").trim().toLowerCase()

  if (status === "finalizado" || status === "resolvido") return "resolvido"
  if (status === "devolvida" || status === "devolvido") return "devolvida"

  return "pendente"
}

function buildId(prefix: string) {
  return `${prefix}${randomUUID().replace(/-/g, "")}`
}

function digitsOnly(value: unknown) {
  return String(value ?? "").replace(/\D/g, "")
}

async function buildProtocol(tx: typeof prisma) {
  const year = new Date().getFullYear()

  const rows = await tx.$queryRawUnsafe<Array<{ total: number | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM public.demandas
      WHERE LOWER(COALESCE(modulo::text, '')) = 'cnrac'
    `,
  )

  const total = Number(rows?.[0]?.total ?? 0) + 1
  return `CNRAC-${year}-${String(total).padStart(5, "0")}`
}

export async function GET(req: NextRequest) {
  try {
    const email = normalizeText(req.nextUrl.searchParams.get("email")).toLowerCase()

    const params: unknown[] = []
    const whereParts = [
      `UPPER(COALESCE(b.origem_modulo, '')) = 'CNRAC'`,
      `b.ativo_monitoramento = TRUE`,
    ]

    if (email) {
      params.push(email)
      whereParts.push(`LOWER(COALESCE(d."emailSolicitante", '')) = $${params.length}`)
    }

    const rows = await prisma.$queryRawUnsafe<CnracFilaRow[]>(
      `
        SELECT
          b.id::text AS id,
          COALESCE(NULLIF(b.ficha_core, ''), d.protocolo::text, b.demanda_id::text, b.id::text) AS protocolo,
          COALESCE(b.paciente_id::text, d."pacienteId"::text) AS "pacienteId",
          COALESCE(NULLIF(b.nome_paciente, ''), p.nome, 'SEM NOME') AS "pacienteNome",
          COALESCE(NULLIF(b.cpf, ''), NULLIF(p.cpf, '')) AS "pacienteCpf",
          COALESCE(NULLIF(b.cns, ''), NULLIF(p."cartaoSus", '')) AS "pacienteCartaoSus",
          'cnrac' AS modulo,
          NULLIF(d."emailSolicitante", '') AS "emailSolicitante",
          COALESCE(NULLIF(b.procedimento_codigo, ''), NULLIF(d."codigoSigtap", '')) AS "codigoSigtap",
          COALESCE(NULLIF(b.procedimento_descricao, ''), NULLIF(d."descricaoSigtap", '')) AS "descricaoSigtap",
          COALESCE(NULLIF(b.cid_codigo, ''), NULLIF(d.cid10, '')) AS cid10,
          NULLIF(d.especialidade, '') AS especialidade,
          NULLIF(d.subespecialidade, '') AS subespecialidade,
          NULLIF(b.status_monitoramento_atual, '') AS "statusMonitoramentoAtual",
          COALESCE(d."createdAt", b.created_at, NOW())::text AS "criadoEm",
          COALESCE(d."updatedAt", b.updated_at, d."createdAt", NOW())::text AS "atualizadoEm",
          COALESCE(d."acaoJudicial", FALSE) AS "acaoJudicial"
        FROM public.judicial_monitoramento_base b
        LEFT JOIN public.demandas d
          ON d.id::text = b.origem_registro_id
        LEFT JOIN public.pacientes p
          ON p.id::text = COALESCE(b.paciente_id::text, d."pacienteId"::text)
        WHERE ${whereParts.join(" AND ")}
        ORDER BY COALESCE(d."createdAt", b.created_at, NOW()) DESC, b.id DESC
      `,
      ...params,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        protocolo: row.protocolo,
        pacienteId: row.pacienteId,
        pacienteNome: row.pacienteNome,
        pacienteCpf: row.pacienteCpf ?? "",
        pacienteCartaoSus: row.pacienteCartaoSus ?? "",
        modulo: "cnrac",
        emailSolicitante: row.emailSolicitante ?? "",
        codigoSigtap: row.codigoSigtap ?? "",
        descricaoSigtap: row.descricaoSigtap ?? "",
        cid10: row.cid10 ?? "",
        especialidade: row.especialidade ?? "",
        subespecialidade: row.subespecialidade ?? "",
        status: normalizeStatus(row.statusMonitoramentoAtual),
        criadoEm: row.criadoEm,
        atualizadoEm: row.atualizadoEm,
        acaoJudicial: Boolean(row.acaoJudicial),
        interacoesCount: 0,
        anexosCount: 0,
        pendenciaAtual: null,
      })),
    })
  } catch (error) {
    console.error("[GET /api/cnrac/demandas] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar fila do CNRAC." },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    const pacienteId = normalizeText(body?.pacienteId)
    const localSolicitante = normalizeText(body?.localSolicitante)
    const emailSolicitante = normalizeText(body?.emailSolicitante)
    const codigoSigtap = digitsOnly(body?.codigoSigtap)
    const descricaoSigtap = normalizeText(body?.descricaoSigtap)
    const cid10 = normalizeText(body?.cid10).toUpperCase()
    const especialidade = normalizeText(body?.especialidade)
    const subespecialidade = normalizeText(body?.subespecialidade)
    const localSolicitado = normalizeText(body?.localSolicitado)
    const observacoesUnidade = normalizeText(body?.observacoesUnidade)
    const tipoSolicitacao = normalizeText(body?.tipoSolicitacao).toLowerCase()
    const criadoPor = normalizeText(body?.criadoPor)
    const criadoPorNome = normalizeText(body?.criadoPorNome)
    const acaoJudicial = Boolean(body?.acaoJudicial)

    const telefoneSolicitante = Array.isArray(body?.telefoneSolicitante)
      ? body.telefoneSolicitante.map((v: unknown) => normalizeText(v)).filter(Boolean)
      : []

    const tipoSolicitacaoFinal =
      tipoSolicitacao === "definitiva"
        ? "definitiva"
        : tipoSolicitacao === "nao_se_aplica"
          ? "nao_se_aplica"
          : "transito"

    if (!pacienteId || !localSolicitante || !codigoSigtap || !descricaoSigtap || !cid10 || !especialidade) {
      return NextResponse.json(
        { ok: false, error: "Campos obrigatórios não informados." },
        { status: 400 },
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const pacienteRows = await tx.$queryRawUnsafe<PacienteDbRow[]>(
        `
          SELECT
            id::text AS id,
            nome,
            cpf,
            "cartaoSus" AS "cartaoSus"
          FROM public.pacientes
          WHERE id::text = $1
          LIMIT 1
        `,
        pacienteId,
      )

      const paciente = pacienteRows[0]

      if (!paciente) {
        throw new Error("Paciente não encontrado.")
      }

      const demandaId = buildId("dem_")
      const protocolo = await buildProtocol(tx)

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.demandas (
            id,
            protocolo,
            "pacienteId",
            modulo,
            "localSolicitante",
            "emailSolicitante",
            "acaoJudicial",
            "codigoSigtap",
            "descricaoSigtap",
            cid10,
            especialidade,
            subespecialidade,
            "observacoesUnidade",
            "localSolicitado",
            "tipoSolicitacao",
            "criadoPor",
            "criadoPorNome",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            $1, $2, $3, 'cnrac', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
          )
        `,
        demandaId,
        protocolo,
        pacienteId,
        localSolicitante,
        emailSolicitante || null,
        acaoJudicial,
        codigoSigtap,
        descricaoSigtap,
        cid10,
        especialidade,
        subespecialidade || null,
        observacoesUnidade || null,
        localSolicitado || null,
        tipoSolicitacaoFinal,
        criadoPor || null,
        criadoPorNome || null,
      )

      for (const telefone of telefoneSolicitante) {
        await tx.$executeRawUnsafe(
          `
            INSERT INTO public.telefone_solicitante (
              id,
              "demandaId",
              value
            )
            VALUES ($1, $2, $3)
          `,
          buildId("tls_"),
          demandaId,
          telefone,
        )
      }

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.judicial_monitoramento_base (
            demanda_id,
            paciente_id,
            ficha_core,
            nome_paciente,
            cpf,
            cns,
            procedimento_codigo,
            procedimento_descricao,
            cid_codigo,
            cid_descricao,
            data_ultimo_monitoramento,
            pendente_dia_anterior,
            ativo_monitoramento,
            status_monitoramento_atual,
            origem_modulo,
            origem_tabela,
            origem_registro_id,
            created_at,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, NULL, FALSE, TRUE, 'PENDENTE', 'CNRAC', 'demandas', $10, NOW(), NOW()
          )
          ON CONFLICT (origem_modulo, origem_tabela, origem_registro_id)
          DO UPDATE SET
            demanda_id = EXCLUDED.demanda_id,
            paciente_id = EXCLUDED.paciente_id,
            ficha_core = EXCLUDED.ficha_core,
            nome_paciente = EXCLUDED.nome_paciente,
            cpf = EXCLUDED.cpf,
            cns = EXCLUDED.cns,
            procedimento_codigo = EXCLUDED.procedimento_codigo,
            procedimento_descricao = EXCLUDED.procedimento_descricao,
            cid_codigo = EXCLUDED.cid_codigo,
            ativo_monitoramento = TRUE,
            status_monitoramento_atual = 'PENDENTE',
            updated_at = NOW()
        `,
        demandaId,
        pacienteId,
        protocolo,
        paciente.nome ?? "SEM NOME",
        paciente.cpf ?? null,
        paciente.cartaoSus ?? null,
        codigoSigtap,
        descricaoSigtap,
        cid10,
        demandaId,
      )

      return {
        id: demandaId,
        protocolo,
      }
    })

    return NextResponse.json({
      ok: true,
      item: result,
    })
  } catch (error) {
    console.error("[POST /api/cnrac/demandas] erro:", error)

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao salvar demanda do CNRAC." },
      { status: 500 },
    )
  }
}