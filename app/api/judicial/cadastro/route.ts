import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CatalogMunicipioRow = {
  municipio: string | null
}

type CatalogSigtapRow = {
  id: string
  codigo: string
  descricao: string
  ativo: boolean | null
}

type CatalogCidRow = {
  id: string
  codigo: string
  descricao: string
  ativo: boolean | null
}

type CatalogEspecialidadeRow = {
  especialidadeId: string
  especialidadeNome: string
  subespecialidadeId: string
  subespecialidadeNome: string
}

type PacienteRow = {
  id: string
  nome: string | null
  cpf: string | null
  cartaoSus: string | null
  municipio: string | null
}

type ProcedureEntry = {
  sigtapCode: string
  description: string
  specialty: string
  subSpecialty: string
  situation?: string
}

type CidEntry = {
  code: string
  description: string
}

type ModuleEnumRow = {
  value: string
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase()
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "")
}

function buildId(prefix: string) {
  return `${prefix}${randomUUID().replace(/-/g, "")}`
}

async function buildProtocol(tx: typeof prisma) {
  const year = new Date().getFullYear()

  const rows = await tx.$queryRawUnsafe<Array<{ total: number | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM public.demandas
      WHERE LOWER(COALESCE(modulo::text, '')) = 'judicial'
    `,
  )

  const total = Number(rows?.[0]?.total ?? 0) + 1
  return `JUD-${year}-${String(total).padStart(5, "0")}`
}

async function ensureJudicialModuleEnumValue() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        INNER JOIN pg_enum e
          ON e.enumtypid = t.oid
        WHERE t.typname = 'Module'
          AND LOWER(e.enumlabel::text) = 'judicial'
      ) THEN
        ALTER TYPE public."Module" ADD VALUE 'judicial';
      END IF;
    END $$;
  `)
}

async function resolveModuleEnumValue(tx: typeof prisma, moduleName: string) {
  const rows = await tx.$queryRawUnsafe<ModuleEnumRow[]>(
    `
      SELECT e.enumlabel::text AS value
      FROM pg_type t
      INNER JOIN pg_enum e
        ON e.enumtypid = t.oid
      WHERE t.typname = 'Module'
        AND LOWER(e.enumlabel::text) = LOWER($1)
      ORDER BY e.enumsortorder
      LIMIT 1
    `,
    moduleName,
  )

  const value = normalizeText(rows[0]?.value)

  if (!value) {
    throw new Error(`Valor do módulo ${moduleName} não existe no enum Module do banco.`)
  }

  return value
}

export async function GET() {
  try {
    const [municipios, sigtap, cid10, especialidades] = await Promise.all([
      prisma.$queryRawUnsafe<CatalogMunicipioRow[]>(
        `
          SELECT DISTINCT
            NULLIF(TRIM(municipio), '') AS municipio
          FROM public.pacientes
          WHERE NULLIF(TRIM(municipio), '') IS NOT NULL
          ORDER BY municipio
        `,
      ),
      prisma.$queryRawUnsafe<CatalogSigtapRow[]>(
        `
          SELECT
            id::text AS id,
            codigo,
            descricao,
            ativo
          FROM public.admin_judicial_sigtap
          WHERE COALESCE(ativo, TRUE) = TRUE
          ORDER BY descricao
        `,
      ),
      prisma.$queryRawUnsafe<CatalogCidRow[]>(
        `
          SELECT
            id::text AS id,
            codigo,
            descricao,
            ativo
          FROM public.admin_judicial_cid10
          WHERE COALESCE(ativo, TRUE) = TRUE
          ORDER BY codigo
        `,
      ),
      prisma.$queryRawUnsafe<CatalogEspecialidadeRow[]>(
        `
          SELECT
            esp.id::text AS "especialidadeId",
            esp.nome AS "especialidadeNome",
            sub.id::text AS "subespecialidadeId",
            sub.nome AS "subespecialidadeNome"
          FROM public.admin_judicial_subespecialidades sub
          INNER JOIN public.admin_judicial_especialidades esp
            ON esp.id = sub.especialidade_id
          WHERE COALESCE(esp.ativo, TRUE) = TRUE
            AND COALESCE(sub.ativo, TRUE) = TRUE
          ORDER BY esp.nome, sub.nome
        `,
      ),
    ])

    return NextResponse.json({
      ok: true,
      municipios: municipios
        .map((row) => normalizeUpper(row.municipio))
        .filter(Boolean),
      sigtap: sigtap.map((row) => ({
        id: row.id,
        sigtapCode: onlyDigits(row.codigo),
        description: normalizeUpper(row.descricao),
      })),
      cid10: cid10.map((row) => ({
        id: row.id,
        code: normalizeUpper(row.codigo),
        description: normalizeUpper(row.descricao),
      })),
      especialidades: especialidades.map((row) => ({
        especialidadeId: row.especialidadeId,
        especialidadeNome: normalizeUpper(row.especialidadeNome),
        subespecialidadeId: row.subespecialidadeId,
        subespecialidadeNome: normalizeUpper(row.subespecialidadeNome),
      })),
    })
  } catch (error) {
    console.error("[GET /api/judicial/cadastro] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar catálogos do Judicial." },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureJudicialModuleEnumValue()

    const body = await req.json().catch(() => null)

    const pacienteId = normalizeText(body?.patientId)
    const isIntimation = normalizeText(body?.isIntimation).toLowerCase() === "nao" ? "nao" : "sim"
    const oficioNumber = normalizeUpper(body?.oficioNumber)
    const receivedAt = normalizeText(body?.receivedAt)
    const reiterationAt = normalizeText(body?.reiterationAt)
    const actionRecords = normalizeUpper(body?.actionRecords)
    const pgeNetNumber = normalizeUpper(body?.pgeNetNumber)
    const deadlineDays = Number(body?.deadlineDays ?? 0)
    const deadlineAt = normalizeText(body?.deadlineAt)
    const municipalityName = normalizeUpper(body?.municipalityName)
    const criadoPor = normalizeText(body?.criadoPor)
    const criadoPorNome = normalizeUpper(body?.criadoPorNome)

    const procedures = Array.isArray(body?.procedures)
      ? (body.procedures as ProcedureEntry[])
      : []

    const cids = Array.isArray(body?.cids)
      ? (body.cids as CidEntry[])
      : []

    const primaryProcedure = procedures[0]
    const primaryCid = cids[0]

    if (
      !pacienteId ||
      !oficioNumber ||
      !receivedAt ||
      !actionRecords ||
      !pgeNetNumber ||
      !deadlineDays ||
      !municipalityName
    ) {
      return NextResponse.json(
        { ok: false, error: "Preencha os campos obrigatórios do Judicial." },
        { status: 400 },
      )
    }

    if (!primaryProcedure) {
      return NextResponse.json(
        { ok: false, error: "Informe ao menos 1 procedimento." },
        { status: 400 },
      )
    }

    if (
      !primaryProcedure.sigtapCode ||
      !primaryProcedure.description ||
      !primaryProcedure.specialty ||
      !primaryProcedure.subSpecialty
    ) {
      return NextResponse.json(
        { ok: false, error: "O procedimento principal precisa ter SIGTAP, descrição, especialidade e subespecialidade." },
        { status: 400 },
      )
    }

    if (!primaryCid || !primaryCid.code || !primaryCid.description) {
      return NextResponse.json(
        { ok: false, error: "Informe ao menos 1 CID com código e descrição." },
        { status: 400 },
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const pacienteRows = await tx.$queryRawUnsafe<PacienteRow[]>(
        `
          SELECT
            id::text AS id,
            nome,
            cpf,
            "cartaoSus" AS "cartaoSus",
            municipio
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
      const moduleEnumValue = await resolveModuleEnumValue(tx, "judicial")

      const observacoesBloco = [
        `TIPO DE INTIMAÇÃO: ${isIntimation === "sim" ? "SIM" : "NÃO"}`,
        `OFÍCIO/INTIMAÇÃO: ${oficioNumber}`,
        `DATA DE RECEBIMENTO: ${receivedAt}`,
        reiterationAt ? `DATA DA REITERAÇÃO: ${reiterationAt}` : "",
        `AUTOS DA AÇÃO: ${actionRecords}`,
        `PGE.NET: ${pgeNetNumber}`,
        `PRAZO (DIAS): ${deadlineDays}`,
        deadlineAt ? `PRAZO FINAL: ${deadlineAt}` : "",
        procedures.length > 1
          ? `PROCEDIMENTOS ADICIONAIS: ${procedures
              .slice(1)
              .map(
                (item) =>
                  `${onlyDigits(item.sigtapCode)} - ${normalizeUpper(item.description)} - ${normalizeUpper(item.specialty)} - ${normalizeUpper(item.subSpecialty)}`,
              )
              .join(" | ")}`
          : "",
        cids.length > 1
          ? `CIDS ADICIONAIS: ${cids
              .slice(1)
              .map((item) => `${normalizeUpper(item.code)} - ${normalizeUpper(item.description)}`)
              .join(" | ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")

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
            $1, $2, $3, $4::"Module", 'JUDICIAL', NULL, TRUE, $5, $6, $7, $8, $9, $10, $11, 'nao_se_aplica', $12, $13, NOW(), NOW()
          )
        `,
        demandaId,
        protocolo,
        pacienteId,
        moduleEnumValue,
        onlyDigits(primaryProcedure.sigtapCode),
        normalizeUpper(primaryProcedure.description),
        normalizeUpper(primaryCid.code),
        normalizeUpper(primaryProcedure.specialty),
        normalizeUpper(primaryProcedure.subSpecialty),
        observacoesBloco,
        municipalityName,
        criadoPor || null,
        criadoPorNome || null,
      )

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
            $1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, NOW(), FALSE, TRUE, 'PENDENTE', 'JUDICIAL', 'demandas', $10, NOW(), NOW()
          )
          ON CONFLICT (origem_modulo, origem_tabela, origem_registro_id)
          DO UPDATE SET
            demanda_id = EXCLUDED.demanda_id,
            paciente_id = EXCLUDED.paciente_id,
            nome_paciente = EXCLUDED.nome_paciente,
            cpf = EXCLUDED.cpf,
            cns = EXCLUDED.cns,
            procedimento_codigo = EXCLUDED.procedimento_codigo,
            procedimento_descricao = EXCLUDED.procedimento_descricao,
            cid_codigo = EXCLUDED.cid_codigo,
            cid_descricao = EXCLUDED.cid_descricao,
            data_ultimo_monitoramento = NOW(),
            ativo_monitoramento = TRUE,
            status_monitoramento_atual = 'PENDENTE',
            updated_at = NOW()
        `,
        demandaId,
        pacienteId,
        normalizeUpper(paciente.nome),
        normalizeText(paciente.cpf),
        normalizeText(paciente.cartaoSus),
        onlyDigits(primaryProcedure.sigtapCode),
        normalizeUpper(primaryProcedure.description),
        normalizeUpper(primaryCid.code),
        normalizeUpper(primaryCid.description),
        demandaId,
      )

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.interacoes (
            id,
            "demandaId",
            texto,
            pendencia,
            "createdAt",
            "createdBy",
            "createdByName",
            "createdByCpf",
            "assinaturaUrl"
          )
          VALUES (
            $1, $2, $3, NULL, NOW(), $4, $5, NULL, NULL
          )
        `,
        buildId("int_"),
        demandaId,
        `CADASTRO JUDICIAL INICIAL\n${observacoesBloco}`,
        criadoPor || null,
        criadoPorNome || null,
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
    console.error("[POST /api/judicial/cadastro] erro:", error)

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao salvar cadastro do Judicial." },
      { status: 500 },
    )
  }
}
