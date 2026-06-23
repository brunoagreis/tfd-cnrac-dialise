import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getMunicipalitySession } from "@/lib/municipality-portal-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DemandRow = {
  id: string
  protocolo: string | null
  modulo: string | null
  nomePaciente: string | null
  processo: string | null
  municipio: string | null
  codigoSigtap: string | null
  descricaoSigtap: string | null
  cid10: string | null
  especialidade: string | null
  subespecialidade: string | null
  observacoes: string | null
  createdAt: string | null
}

type InteractionRow = {
  id: string
  texto: string | null
  createdAt: string | null
  createdByName: string | null
}

type UploadRow = {
  id: string
  nomeArquivo: string | null
  tamanho: number | null
  createdAt: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function processoSql() {
  return `
    COALESCE(
      NULLIF(TRIM(substring(d."observacoesUnidade" from 'AUTOS DA ACAO:\\s*([^\\r\\n]+)')), ''),
      NULLIF(TRIM(substring(d."observacoesUnidade" from 'AUTOS DA AÇÃO:\\s*([^\\r\\n]+)')), ''),
      ''
    )
  `
}

async function ensureUploadTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.municipio_portal_anexos (
      id BIGSERIAL PRIMARY KEY,
      protocolo TEXT NOT NULL,
      demanda_id TEXT NOT NULL,
      municipio_id BIGINT NOT NULL,
      municipio_nome TEXT NOT NULL,
      email TEXT NOT NULL,
      nome_arquivo TEXT NOT NULL,
      mime_type TEXT,
      tamanho INTEGER,
      conteudo BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS municipio_portal_anexos_protocolo_idx
      ON public.municipio_portal_anexos (protocolo)
  `)
}

async function getDemandForMunicipality(protocolo: string, municipio: string) {
  const rows = await prisma.$queryRawUnsafe<DemandRow[]>(
    `
      SELECT
        d.id::text AS id,
        d.protocolo,
        LOWER(COALESCE(d.modulo::text, '')) AS modulo,
        p.nome AS "nomePaciente",
        ${processoSql()} AS processo,
        COALESCE(NULLIF(TRIM(d."localSolicitado"), ''), p.municipio) AS municipio,
        d."codigoSigtap" AS "codigoSigtap",
        d."descricaoSigtap" AS "descricaoSigtap",
        d.cid10,
        d.especialidade,
        d.subespecialidade,
        d."observacoesUnidade" AS observacoes,
        d."createdAt"::text AS "createdAt"
      FROM public.demandas d
      INNER JOIN public.pacientes p ON p.id = d."pacienteId"
      WHERE d.protocolo = $1
        AND LOWER(TRIM(COALESCE(NULLIF(TRIM(d."localSolicitado"), ''), p.municipio, ''))) = LOWER(TRIM($2))
      LIMIT 1
    `,
    protocolo,
    municipio,
  )

  return rows[0] || null
}

function mapDemand(row: DemandRow) {
  return {
    id: row.id,
    protocolo: text(row.protocolo),
    modulo: text(row.modulo),
    nomePaciente: text(row.nomePaciente),
    processo: text(row.processo),
    municipio: text(row.municipio),
    codigoSigtap: text(row.codigoSigtap),
    descricaoSigtap: text(row.descricaoSigtap),
    cid10: text(row.cid10),
    especialidade: text(row.especialidade),
    subespecialidade: text(row.subespecialidade),
    observacoes: text(row.observacoes),
    createdAt: row.createdAt,
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getMunicipalitySession()
    if (!session) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 })

    await ensureUploadTable()

    const url = new URL(req.url)
    const protocolo = text(url.searchParams.get("protocolo"))

    if (protocolo) {
      const demand = await getDemandForMunicipality(protocolo, session.municipalityName)
      if (!demand) return NextResponse.json({ ok: false, error: "Protocolo não encontrado para este município." }, { status: 404 })

      const interactions = await prisma.$queryRawUnsafe<InteractionRow[]>(
        `
          SELECT id::text AS id, texto, "createdAt"::text AS "createdAt", "createdByName" AS "createdByName"
          FROM public.interacoes
          WHERE "demandaId" = $1
          ORDER BY "createdAt" DESC, id DESC
        `,
        demand.id,
      )

      const uploads = await prisma.$queryRawUnsafe<UploadRow[]>(
        `
          SELECT id::text AS id, nome_arquivo AS "nomeArquivo", tamanho, created_at::text AS "createdAt"
          FROM public.municipio_portal_anexos
          WHERE protocolo = $1
            AND municipio_id = $2::bigint
          ORDER BY created_at DESC, id DESC
        `,
        protocolo,
        session.municipalityId,
      )

      return NextResponse.json({
        ok: true,
        item: mapDemand(demand),
        interactions: interactions.map((item) => ({
          id: item.id,
          texto: text(item.texto),
          createdAt: item.createdAt,
          createdByName: text(item.createdByName),
        })),
        uploads: uploads.map((item) => ({
          id: item.id,
          nomeArquivo: text(item.nomeArquivo),
          tamanho: item.tamanho || 0,
          createdAt: item.createdAt,
        })),
      })
    }

    const q = text(url.searchParams.get("q"))
    const params: unknown[] = [session.municipalityName]
    const conditions = [`LOWER(TRIM(COALESCE(NULLIF(TRIM(d."localSolicitado"), ''), p.municipio, ''))) = LOWER(TRIM($1))`]

    if (q) {
      params.push(`%${q}%`)
      conditions.push(`(p.nome ILIKE $2 OR d.protocolo ILIKE $2 OR ${processoSql()} ILIKE $2)`)
    }

    const rows = await prisma.$queryRawUnsafe<DemandRow[]>(
      `
        SELECT
          d.id::text AS id,
          d.protocolo,
          LOWER(COALESCE(d.modulo::text, '')) AS modulo,
          p.nome AS "nomePaciente",
          ${processoSql()} AS processo,
          COALESCE(NULLIF(TRIM(d."localSolicitado"), ''), p.municipio) AS municipio,
          d."codigoSigtap" AS "codigoSigtap",
          d."descricaoSigtap" AS "descricaoSigtap",
          d.cid10,
          d.especialidade,
          d.subespecialidade,
          d."observacoesUnidade" AS observacoes,
          d."createdAt"::text AS "createdAt"
        FROM public.demandas d
        INNER JOIN public.pacientes p ON p.id = d."pacienteId"
        WHERE ${conditions.join(" AND ")}
        ORDER BY d."createdAt" DESC
        LIMIT 300
      `,
      ...params,
    )

    return NextResponse.json({ ok: true, items: rows.map(mapDemand) })
  } catch (error) {
    console.error("[GET /api/municipio/demandas] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao carregar demandas do município." }, { status: 500 })
  }
}

export { ensureUploadTable, getDemandForMunicipality }
