import { prisma } from "@/lib/prisma"

type DemandForMonitorRow = {
  demandaId: string
  pacienteId: string
  protocolo: string | null
  modulo: string | null
  nomePaciente: string | null
  cpf: string | null
  cns: string | null
  codigoSigtap: string | null
  descricaoSigtap: string | null
  cid10: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function upper(value: unknown) {
  return text(value).toUpperCase()
}

export async function ensureMunicipalityPortalNotificationTables() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.judicial_monitoramento_base
      ADD COLUMN IF NOT EXISTS interacao_municipio_pendente BOOLEAN NOT NULL DEFAULT FALSE
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.judicial_monitoramento_base
      ADD COLUMN IF NOT EXISTS interacao_municipio_em TIMESTAMPTZ
  `)

  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.judicial_monitoramento_base
      ADD COLUMN IF NOT EXISTS interacao_municipio_protocolo TEXT
  `)

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.municipio_portal_leituras (
      id BIGSERIAL PRIMARY KEY,
      protocolo TEXT NOT NULL,
      municipio_id BIGINT NOT NULL,
      municipio_nome TEXT NOT NULL,
      email TEXT NOT NULL,
      lido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (protocolo, municipio_id)
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS municipio_portal_leituras_protocolo_idx
      ON public.municipio_portal_leituras (protocolo)
  `)
}

export async function markMunicipalityDemandRead(input: {
  protocolo: string
  municipioId: string
  municipioNome: string
  email: string
}) {
  await ensureMunicipalityPortalNotificationTables()

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO public.municipio_portal_leituras (
        protocolo,
        municipio_id,
        municipio_nome,
        email,
        lido_em,
        updated_at
      )
      VALUES ($1, $2::bigint, $3, $4, NOW(), NOW())
      ON CONFLICT (protocolo, municipio_id)
      DO UPDATE SET
        municipio_nome = EXCLUDED.municipio_nome,
        email = EXCLUDED.email,
        lido_em = NOW(),
        updated_at = NOW()
    `,
    input.protocolo,
    input.municipioId,
    input.municipioNome,
    input.email,
  )
}

export async function flagDemandForMunicipalityInteraction(input: {
  demandaId: string
  protocolo: string
}) {
  await ensureMunicipalityPortalNotificationTables()

  const rows = await prisma.$queryRawUnsafe<DemandForMonitorRow[]>(
    `
      SELECT
        d.id::text AS "demandaId",
        d."pacienteId" AS "pacienteId",
        d.protocolo,
        UPPER(COALESCE(d.modulo::text, 'JUDICIAL')) AS modulo,
        p.nome AS "nomePaciente",
        p.cpf,
        p."cartaoSus" AS cns,
        d."codigoSigtap" AS "codigoSigtap",
        d."descricaoSigtap" AS "descricaoSigtap",
        d.cid10
      FROM public.demandas d
      INNER JOIN public.pacientes p
        ON p.id = d."pacienteId"
      WHERE d.id::text = $1
      LIMIT 1
    `,
    input.demandaId,
  )

  const demand = rows[0]
  if (!demand) return

  const modulo = upper(demand.modulo) || "JUDICIAL"
  const motivo = `Interação do município no protocolo ${text(demand.protocolo) || input.protocolo}`

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO public.judicial_monitoramento_base (
        modulo_codigo,
        demanda_id,
        paciente_id,
        nome_paciente,
        cpf,
        cns,
        procedimento_codigo,
        procedimento_descricao,
        cid_codigo,
        data_ultimo_monitoramento,
        data_proximo_monitoramento,
        motivo_proximo_monitoramento,
        prazo_retorno_dias,
        pendente_dia_anterior,
        ativo_monitoramento,
        status_monitoramento_atual,
        origem_modulo,
        origem_tabela,
        origem_registro_id,
        interacao_municipio_pendente,
        interacao_municipio_em,
        interacao_municipio_protocolo,
        created_at,
        updated_at
      )
      VALUES (
        'JUDICIAL',
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        NOW(),
        CURRENT_DATE + INTERVAL '1 day',
        $9,
        1,
        TRUE,
        TRUE,
        'INTERACAO_MUNICIPIO',
        $10,
        'demandas',
        $1,
        TRUE,
        NOW(),
        $11,
        NOW(),
        NOW()
      )
      ON CONFLICT (modulo_codigo, demanda_id)
      DO UPDATE SET
        paciente_id = EXCLUDED.paciente_id,
        nome_paciente = EXCLUDED.nome_paciente,
        cpf = EXCLUDED.cpf,
        cns = EXCLUDED.cns,
        procedimento_codigo = EXCLUDED.procedimento_codigo,
        procedimento_descricao = EXCLUDED.procedimento_descricao,
        cid_codigo = EXCLUDED.cid_codigo,
        data_ultimo_monitoramento = NOW(),
        data_proximo_monitoramento = CURRENT_DATE + INTERVAL '1 day',
        motivo_proximo_monitoramento = EXCLUDED.motivo_proximo_monitoramento,
        prazo_retorno_dias = 1,
        pendente_dia_anterior = TRUE,
        ativo_monitoramento = TRUE,
        status_monitoramento_atual = 'INTERACAO_MUNICIPIO',
        origem_modulo = EXCLUDED.origem_modulo,
        origem_tabela = 'demandas',
        origem_registro_id = EXCLUDED.origem_registro_id,
        interacao_municipio_pendente = TRUE,
        interacao_municipio_em = NOW(),
        interacao_municipio_protocolo = EXCLUDED.interacao_municipio_protocolo,
        updated_at = NOW()
    `,
    demand.demandaId,
    demand.pacienteId,
    text(demand.nomePaciente) || "SEM NOME",
    text(demand.cpf) || null,
    text(demand.cns) || null,
    text(demand.codigoSigtap) || null,
    text(demand.descricaoSigtap) || null,
    text(demand.cid10) || null,
    motivo,
    modulo,
    text(demand.protocolo) || input.protocolo,
  )
}
