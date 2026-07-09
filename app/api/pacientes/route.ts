import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PacienteRow = {
  id: string
  cpf: string | null
  cartaoSus: string | null
  nome: string | null
  dataNascimento: string | null
  email: string | null
  municipio: string | null
  endereco: string | null
  telefone: string | null
  telefones: string[] | null
  cep: string | null
  bairro: string | null
  createdAt: string | null
  updatedAt: string | null
  totalDemandas: number | bigint | null
}

type MunicipioRow = {
  municipalityName: string | null
}

const MAX_PATIENT_PHONES = 5
const MAX_PATIENT_PHONE_LENGTH = 30

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "")
}

function buildId(prefix: string) {
  return prefix + randomUUID().replace(/-/g, "")
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).replace(/\s+/g, " ").toUpperCase()
}

function cleanPatientPhone(value: unknown) {
  return String(value ?? "")
    .replace(/[^0-9()+\-\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PATIENT_PHONE_LENGTH)
}

function normalizePatientPhones(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(/\s*(?:\||;|,|\n)\s*/)
        .filter(Boolean)

  return source
    .map(cleanPatientPhone)
    .filter(Boolean)
    .filter((phone, index, array) => array.indexOf(phone) === index)
    .slice(0, MAX_PATIENT_PHONES)
}

function normalizePatient(row: PacienteRow) {
  const telefones = normalizePatientPhones(row.telefones ?? row.telefone)

  return {
    id: row.id,
    cpf: row.cpf ?? "",
    cartaoSus: row.cartaoSus ?? "",
    cns: row.cartaoSus ?? "",
    nome: row.nome ?? "SEM NOME",
    dataNascimento: row.dataNascimento ?? "",
    email: row.email ?? "",
    municipio: row.municipio ?? "",
    endereco: row.endereco ?? "",
    telefone: telefones[0] ?? "",
    telefones,
    cep: row.cep ?? "",
    bairro: row.bairro ?? "",
    cidade: row.municipio ?? "",
    criadoEm: row.createdAt ?? "",
    atualizadoEm: row.updatedAt ?? "",
    totalDemandas: Number(row.totalDemandas ?? 0),
  }
}

function patientSelectSql(whereSql: string) {
  return `
    SELECT
      p.id::text AS id,
      NULLIF(p.cpf, '') AS cpf,
      NULLIF(p."cartaoSus", '') AS "cartaoSus",
      NULLIF(p.nome, '') AS nome,
      p."dataNascimento"::text AS "dataNascimento",
      NULLIF(p.email, '') AS email,
      NULLIF(p.municipio, '') AS municipio,
      NULLIF(p.endereco, '') AS endereco,
      NULLIF((
        SELECT tp.value
        FROM public.telefone_paciente tp
        WHERE tp."pacienteId" = p.id
        ORDER BY tp.id
        LIMIT 1
      ), '') AS telefone,
      COALESCE((
        SELECT array_agg(phone ORDER BY id)
        FROM (
          SELECT tp.id, NULLIF(TRIM(tp.value), '') AS phone
          FROM public.telefone_paciente tp
          WHERE tp."pacienteId" = p.id
        ) phones
        WHERE phone IS NOT NULL
      ), ARRAY[]::text[]) AS telefones,
      NULL::text AS cep,
      NULL::text AS bairro,
      p."createdAt"::text AS "createdAt",
      p."updatedAt"::text AS "updatedAt",
      (
        SELECT COUNT(d.id)
        FROM public.demandas d
        WHERE d."pacienteId" = p.id
      ) AS "totalDemandas"
    FROM public.pacientes p
    ${whereSql}
  `
}

async function resolveMunicipioOficial(municipio: string) {
  const municipioRows = await prisma.$queryRawUnsafe<MunicipioRow[]>(
    `
      SELECT municipio_nome AS "municipalityName"
      FROM public.admin_judicial_municipios_contatos
      WHERE LOWER(TRIM(municipio_nome)) = LOWER(TRIM($1))
      LIMIT 1
    `,
    municipio,
  )

  return normalizeUpper(municipioRows[0]?.municipalityName)
}

export async function GET(req: NextRequest) {
  try {
    const search = normalizeText(req.nextUrl.searchParams.get("q")).toLowerCase()
    const searchDigits = onlyDigits(search)
    const searchLike = `%${search}%`
    const searchDigitsLike = `%${searchDigits}%`

    const rows = await prisma.$queryRawUnsafe<PacienteRow[]>(
      patientSelectSql(`
        WHERE (
          $1::text = ''
          OR LOWER(COALESCE(p.nome, '')) LIKE $2::text
          OR LOWER(COALESCE(p.municipio, '')) LIKE $2::text
          OR LOWER(COALESCE(p.cpf, '')) LIKE $2::text
          OR LOWER(COALESCE(p."cartaoSus", '')) LIKE $2::text
          OR (
            $3::text <> ''
            AND regexp_replace(COALESCE(p.cpf, ''), '\\D', '', 'g') LIKE $4::text
          )
          OR (
            $3::text <> ''
            AND regexp_replace(COALESCE(p."cartaoSus", ''), '\\D', '', 'g') LIKE $4::text
          )
          OR EXISTS (
            SELECT 1
            FROM public.telefone_paciente tp
            WHERE tp."pacienteId" = p.id
              AND (
                LOWER(COALESCE(tp.value, '')) LIKE $2::text
                OR (
                  $3::text <> ''
                  AND regexp_replace(COALESCE(tp.value, ''), '\\D', '', 'g') LIKE $4::text
                )
              )
          )
        )
        ORDER BY COALESCE(p.nome, '') ASC
      `),
      search,
      searchLike,
      searchDigits,
      searchDigitsLike,
    )

    return NextResponse.json({
      ok: true,
      items: rows.map(normalizePatient),
    })
  } catch (error) {
    console.error("[GET /api/pacientes] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao listar pacientes." },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    const cpf = onlyDigits(body?.cpf)
    const cartaoSus = onlyDigits(body?.cns ?? body?.cartaoSus)
    const nome = normalizeUpper(body?.nome)
    const dataNascimento = normalizeText(body?.dataNascimento)
    const telefonesPaciente = normalizePatientPhones(body?.telefones ?? body?.telefone)
    const email = normalizeText(body?.email).toLowerCase()
    const endereco = normalizeText(body?.endereco)
    const numero = normalizeText(body?.numero)
    const complemento = normalizeText(body?.complemento)
    const cep = normalizeText(body?.cep)
    const bairro = normalizeText(body?.bairro)
    const municipio = normalizeUpper(body?.cidade ?? body?.municipio)

    if (cpf.length !== 11 || !nome || !dataNascimento || !endereco || !numero || !bairro || !municipio) {
      return NextResponse.json(
        { ok: false, error: "Informe CPF, nome, nascimento, endereço, número, bairro e município." },
        { status: 400 },
      )
    }

    const municipioOficial = await resolveMunicipioOficial(municipio)

    if (!municipioOficial) {
      return NextResponse.json(
        { ok: false, error: "Selecione um município cadastrado em Admin Judicial > Municípios." },
        { status: 400 },
      )
    }

    const enderecoCompleto = [
      endereco,
      numero ? `Nº ${numero}` : "",
      complemento,
      bairro ? `BAIRRO ${bairro}` : "",
      cep ? `CEP ${cep}` : "",
    ]
      .filter(Boolean)
      .join(" - ")

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id::text AS id FROM public.pacientes WHERE cpf = $1 LIMIT 1`,
        cpf,
      )

      const id = existing[0]?.id || buildId("pac_")

      if (existing[0]?.id) {
        await tx.$executeRawUnsafe(
          `
            UPDATE public.pacientes
            SET
              "cartaoSus" = $2,
              nome = $3,
              "dataNascimento" = $4::date,
              email = $5,
              municipio = $6,
              endereco = $7,
              "updatedAt" = NOW()
            WHERE id = $1
          `,
          id,
          cartaoSus,
          nome,
          dataNascimento,
          email || null,
          municipioOficial,
          enderecoCompleto,
        )

        await tx.$executeRawUnsafe(
          `DELETE FROM public.telefone_paciente WHERE "pacienteId" = $1`,
          id,
        )
      } else {
        await tx.$executeRawUnsafe(
          `
            INSERT INTO public.pacientes (
              id,
              cpf,
              "cartaoSus",
              nome,
              "dataNascimento",
              email,
              municipio,
              endereco,
              "createdAt",
              "updatedAt"
            )
            VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, NOW(), NOW())
          `,
          id,
          cpf,
          cartaoSus,
          nome,
          dataNascimento,
          email || null,
          municipioOficial,
          enderecoCompleto,
        )
      }

      for (const telefone of telefonesPaciente) {
        await tx.$executeRawUnsafe(
          `INSERT INTO public.telefone_paciente (id, "pacienteId", value) VALUES ($1, $2, $3)`,
          buildId("tel_"),
          id,
          telefone,
        )
      }

      const rows = await tx.$queryRawUnsafe<PacienteRow[]>(
        patientSelectSql(`WHERE p.id = $1 LIMIT 1`),
        id,
      )

      return rows[0]
    })

    return NextResponse.json({ ok: true, item: normalizePatient(result) })
  } catch (error) {
    console.error("[POST /api/pacientes] erro:", error)

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao salvar paciente." },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)

    const id = normalizeText(body?.id)
    const cpf = onlyDigits(body?.cpf)
    const cartaoSus = onlyDigits(body?.cns ?? body?.cartaoSus)
    const nome = normalizeUpper(body?.nome)
    const dataNascimento = normalizeText(body?.dataNascimento)
    const telefonesPaciente = normalizePatientPhones(body?.telefones ?? body?.telefone)
    const email = normalizeText(body?.email).toLowerCase()
    const endereco = normalizeText(body?.endereco)
    const numero = normalizeText(body?.numero)
    const complemento = normalizeText(body?.complemento)
    const cep = normalizeText(body?.cep)
    const bairro = normalizeText(body?.bairro)
    const municipio = normalizeUpper(body?.cidade ?? body?.municipio)

    if (!id || cpf.length !== 11 || !nome || !dataNascimento || !endereco || !municipio) {
      return NextResponse.json(
        { ok: false, error: "Informe ID, CPF, nome, nascimento, endereço e município." },
        { status: 400 },
      )
    }

    const municipioOficial = await resolveMunicipioOficial(municipio)

    if (!municipioOficial) {
      return NextResponse.json(
        { ok: false, error: "Selecione um município cadastrado em Admin Judicial > Municípios." },
        { status: 400 },
      )
    }

    const enderecoCompleto = [
      endereco,
      numero ? `Nº ${numero}` : "",
      complemento,
      bairro ? `BAIRRO ${bairro}` : "",
      cep ? `CEP ${cep}` : "",
    ]
      .filter(Boolean)
      .join(" - ")

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          UPDATE public.pacientes
          SET
            cpf = $2,
            "cartaoSus" = $3,
            nome = $4,
            "dataNascimento" = $5::date,
            email = $6,
            municipio = $7,
            endereco = $8,
            "updatedAt" = NOW()
          WHERE id = $1
        `,
        id,
        cpf,
        cartaoSus,
        nome,
        dataNascimento,
        email || null,
        municipioOficial,
        enderecoCompleto,
      )

      await tx.$executeRawUnsafe(
        `DELETE FROM public.telefone_paciente WHERE "pacienteId" = $1`,
        id,
      )

      for (const telefone of telefonesPaciente) {
        await tx.$executeRawUnsafe(
          `INSERT INTO public.telefone_paciente (id, "pacienteId", value) VALUES ($1, $2, $3)`,
          buildId("tel_"),
          id,
          telefone,
        )
      }

      const rows = await tx.$queryRawUnsafe<PacienteRow[]>(
        patientSelectSql(`WHERE p.id = $1 LIMIT 1`),
        id,
      )

      return rows[0]
    })

    return NextResponse.json({ ok: true, item: normalizePatient(result) })
  } catch (error) {
    console.error("[PATCH /api/pacientes] erro:", error)

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao atualizar paciente." },
      { status: 500 },
    )
  }
}
