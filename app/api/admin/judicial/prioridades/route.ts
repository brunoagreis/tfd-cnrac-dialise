import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PriorityMode = "procedure" | "cid" | "specialty" | "subspecialty"

type PriorityRow = {
  id: string
  tipoPrioridade: string
  mode: PriorityMode
  value: string
  label: string
  expiresAt: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

type PriorityItemInput = {
  id?: string
  mode: PriorityMode
  value: string
  label: string
  expiresAt?: string | null
  createdAt?: string
}

type SanitizedPriorityItem = {
  mode: PriorityMode
  value: string
  label: string
  expiresAt: string
  createdAt: string
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeCode(value: unknown) {
  return normalizeText(value).replace(/\D/g, "")
}

function normalizeCid(value: unknown) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

function normalizeName(value: unknown) {
  return normalizeText(value).toUpperCase()
}

function isMode(value: unknown): value is PriorityMode {
  return value === "procedure" || value === "cid" || value === "specialty" || value === "subspecialty"
}

function isActiveItem(item: SanitizedPriorityItem) {
  if (!item.expiresAt) return true
  const expiresAt = new Date(`${item.expiresAt}T23:59:59.999`)
  return expiresAt >= new Date()
}

function sanitizeItems(items: PriorityItemInput[]) {
  return items
    .map((item) => {
      const mode = isMode(item?.mode) ? item.mode : null
      const rawValue = normalizeText(item?.value)
      const value =
        mode === "procedure"
          ? normalizeCode(rawValue)
          : mode === "cid"
            ? normalizeCid(rawValue)
            : normalizeName(rawValue)

      return {
        mode,
        value,
        label: normalizeText(item?.label),
        expiresAt: normalizeText(item?.expiresAt),
        createdAt: normalizeText(item?.createdAt),
      }
    })
    .filter((item): item is SanitizedPriorityItem => Boolean(item.mode && item.value && item.label))
}

function mapRow(row: PriorityRow) {
  return {
    id: row.id,
    mode: row.mode,
    value: row.value,
    label: row.label,
    expiresAt: row.expiresAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function prioritySetSql() {
  return `
    prioridade_monitoramento = 3,
    prioridade_motivo = $2,
    prioridade_atualizada_em = NOW(),
    data_proximo_monitoramento = CASE
      WHEN UPPER(COALESCE(jm.status_monitoramento_atual, '')) = 'MONITORAMENTO_AUTOMATICO'
        THEN NOW() - INTERVAL '1 minute'
      ELSE jm.data_proximo_monitoramento
    END,
    motivo_proximo_monitoramento = CASE
      WHEN UPPER(COALESCE(jm.status_monitoramento_atual, '')) = 'MONITORAMENTO_AUTOMATICO'
        THEN 'PRIORIDADE_ADMIN_MONITORAMENTO_AUTOMATICO'
      ELSE jm.motivo_proximo_monitoramento
    END,
    prazo_retorno_dias = CASE
      WHEN UPPER(COALESCE(jm.status_monitoramento_atual, '')) = 'MONITORAMENTO_AUTOMATICO'
        THEN 0
      ELSE jm.prazo_retorno_dias
    END,
    updated_at = NOW()
  `
}

async function applyPriorityEffects(items: SanitizedPriorityItem[]) {
  const activeItems = items.filter(isActiveItem)

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      UPDATE public.judicial_monitoramento_base
      SET
        prioridade_monitoramento = 0,
        prioridade_motivo = NULL,
        prioridade_atualizada_em = NOW(),
        updated_at = NOW()
      WHERE COALESCE(prioridade_motivo, '') LIKE 'ADMIN_PRIORIDADE_%'
    `)

    for (const item of activeItems) {
      const reason = `ADMIN_PRIORIDADE_${item.mode.toUpperCase()}: ${item.label}`

      if (item.mode === "procedure") {
        await tx.$executeRawUnsafe(
          `
            UPDATE public.judicial_monitoramento_base jm
            SET ${prioritySetSql()}
            WHERE COALESCE(jm.ativo_monitoramento, TRUE) = TRUE
              AND UPPER(COALESCE(jm.origem_modulo, '')) = 'JUDICIAL'
              AND (
                regexp_replace(COALESCE(jm.procedimento_codigo, ''), '\\D', '', 'g') = $1
                OR EXISTS (
                  SELECT 1
                  FROM public.demandas d
                  WHERE d.id = jm.demanda_id
                    AND regexp_replace(COALESCE(d."codigoSigtap", ''), '\\D', '', 'g') = $1
                )
                OR EXISTS (
                  SELECT 1
                  FROM public.judicial_procedimentos jp
                  WHERE jp.monitoramento_id = jm.id
                    AND COALESCE(jp.active, TRUE) = TRUE
                    AND regexp_replace(COALESCE(jp.sigtap_codigo, ''), '\\D', '', 'g') = $1
                )
              )
          `,
          item.value,
          reason,
        )
      }

      if (item.mode === "cid") {
        await tx.$executeRawUnsafe(
          `
            UPDATE public.judicial_monitoramento_base jm
            SET ${prioritySetSql()}
            WHERE COALESCE(jm.ativo_monitoramento, TRUE) = TRUE
              AND UPPER(COALESCE(jm.origem_modulo, '')) = 'JUDICIAL'
              AND (
                strpos(regexp_replace(UPPER(COALESCE(jm.cid_codigo, '')), '[^A-Z0-9]', '', 'g'), $1) > 0
                OR EXISTS (
                  SELECT 1
                  FROM public.demandas d
                  WHERE d.id = jm.demanda_id
                    AND strpos(regexp_replace(UPPER(COALESCE(d.cid10, '')), '[^A-Z0-9]', '', 'g'), $1) > 0
                )
              )
          `,
          item.value,
          reason,
        )
      }

      if (item.mode === "specialty") {
        await tx.$executeRawUnsafe(
          `
            UPDATE public.judicial_monitoramento_base jm
            SET ${prioritySetSql()}
            WHERE COALESCE(jm.ativo_monitoramento, TRUE) = TRUE
              AND UPPER(COALESCE(jm.origem_modulo, '')) = 'JUDICIAL'
              AND (
                EXISTS (
                  SELECT 1
                  FROM public.demandas d
                  WHERE d.id = jm.demanda_id
                    AND UPPER(COALESCE(d.especialidade, '')) = $1
                )
                OR EXISTS (
                  SELECT 1
                  FROM public.judicial_procedimentos jp
                  WHERE jp.monitoramento_id = jm.id
                    AND COALESCE(jp.active, TRUE) = TRUE
                    AND UPPER(COALESCE(jp.especialidade, '')) = $1
                )
              )
          `,
          item.value,
          reason,
        )
      }

      if (item.mode === "subspecialty") {
        await tx.$executeRawUnsafe(
          `
            UPDATE public.judicial_monitoramento_base jm
            SET ${prioritySetSql()}
            WHERE COALESCE(jm.ativo_monitoramento, TRUE) = TRUE
              AND UPPER(COALESCE(jm.origem_modulo, '')) = 'JUDICIAL'
              AND (
                EXISTS (
                  SELECT 1
                  FROM public.demandas d
                  WHERE d.id = jm.demanda_id
                    AND UPPER(COALESCE(d.subespecialidade, '')) = $1
                )
                OR EXISTS (
                  SELECT 1
                  FROM public.judicial_procedimentos jp
                  WHERE jp.monitoramento_id = jm.id
                    AND COALESCE(jp.active, TRUE) = TRUE
                    AND UPPER(COALESCE(jp.subespecialidade, '')) = $1
                )
              )
          `,
          item.value,
          reason,
        )
      }
    }
  })
}

async function triggerAutomaticCore(origin: string) {
  try {
    await fetch(`${origin}/api/judicial/monitoramento/core-automatico`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 500 }),
      cache: "no-store",
    })
  } catch (error) {
    console.error("[POST /api/admin/judicial/prioridades] erro ao disparar CORE automático:", error)
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tipoPrioridade =
      normalizeText(searchParams.get("tipoPrioridade")) || "monitoramento"

    const rows = await prisma.$queryRawUnsafe<PriorityRow[]>(
      `
        SELECT
          id::text AS id,
          tipo_prioridade AS "tipoPrioridade",
          modo AS mode,
          valor AS value,
          rotulo AS label,
          expires_at::text AS "expiresAt",
          ativo AS active,
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM public.admin_judicial_prioridades
        WHERE LOWER(tipo_prioridade) = LOWER($1)
          AND ativo = TRUE
        ORDER BY created_at, id
      `,
      tipoPrioridade,
    )

    return NextResponse.json({
      ok: true,
      tipoPrioridade,
      items: rows.map(mapRow),
    })
  } catch (error) {
    console.error("[GET /api/admin/judicial/prioridades] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar prioridades." },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const origin = new URL(req.url).origin

    const tipoPrioridade =
      normalizeText(body?.tipoPrioridade) || "monitoramento"

    const items = Array.isArray(body?.items)
      ? (body.items as PriorityItemInput[])
      : []

    await prisma.$executeRawUnsafe(
      `
        DELETE FROM public.admin_judicial_prioridades
        WHERE LOWER(tipo_prioridade) = LOWER($1)
      `,
      tipoPrioridade,
    )

    const sanitizedItems = sanitizeItems(items)

    for (const item of sanitizedItems) {
      await prisma.$executeRawUnsafe(
        `
          INSERT INTO public.admin_judicial_prioridades (
            tipo_prioridade,
            modo,
            valor,
            rotulo,
            expires_at,
            ativo,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            NULLIF($5, '')::date,
            TRUE,
            COALESCE(NULLIF($6, '')::timestamptz, NOW()),
            NOW()
          )
        `,
        tipoPrioridade,
        item.mode,
        item.value,
        item.label,
        item.expiresAt || "",
        item.createdAt || "",
      )
    }

    await applyPriorityEffects(sanitizedItems)

    const rows = await prisma.$queryRawUnsafe<PriorityRow[]>(
      `
        SELECT
          id::text AS id,
          tipo_prioridade AS "tipoPrioridade",
          modo AS mode,
          valor AS value,
          rotulo AS label,
          expires_at::text AS "expiresAt",
          ativo AS active,
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt"
        FROM public.admin_judicial_prioridades
        WHERE LOWER(tipo_prioridade) = LOWER($1)
          AND ativo = TRUE
        ORDER BY created_at, id
      `,
      tipoPrioridade,
    )

    await triggerAutomaticCore(origin)

    return NextResponse.json({
      ok: true,
      tipoPrioridade,
      items: rows.map(mapRow),
    })
  } catch (error) {
    console.error("[POST /api/admin/judicial/prioridades] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao salvar prioridades." },
      { status: 500 },
    )
  }
}
