import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type JudicialBaseRow = {
  monitoramentoId: string
  demandaId: string | null
  pacienteNome: string | null
  protocolo: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function normalizeSystem(value: unknown): "CORE" | "SISREG" | "OUTRO" {
  const system = text(value).toUpperCase()
  if (system === "SISREG") return "SISREG"
  if (system === "OUTRO") return "OUTRO"
  return "CORE"
}

function bool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  const normalized = text(value).toLowerCase()
  if (["1", "true", "sim", "yes", "s"].includes(normalized)) return true
  if (["0", "false", "nao", "não", "no", "n"].includes(normalized)) return false
  return fallback
}

async function findJudicialCase(decodedId: string) {
  const rows = await prisma.$queryRawUnsafe<JudicialBaseRow[]>(
    `
      SELECT
        b.id::text AS "monitoramentoId",
        b.demanda_id::text AS "demandaId",
        b.nome_paciente AS "pacienteNome",
        COALESCE(d.protocolo::text, b.demanda_id::text) AS protocolo
      FROM public.judicial_monitoramento_base b
      LEFT JOIN public.demandas d
        ON d.id = b.demanda_id
      WHERE UPPER(COALESCE(b.origem_modulo, '')) = 'JUDICIAL'
        AND (
          b.id::text = $1
          OR b.demanda_id::text = $1
          OR b.origem_registro_id::text = $1
          OR d.id::text = $1
          OR d.protocolo::text = $1
        )
      ORDER BY b.id DESC
      LIMIT 1
    `,
    decodedId,
  )

  return rows[0] ?? null
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)
    const body = await req.json().catch(() => ({}))

    const system = normalizeSystem(body?.system)
    const number = text(body?.number ?? body?.numero)
    const requestedInclusion = bool(body?.requestedInclusion ?? body?.requested_inclusion)
    const hasJudicialMark = bool(body?.hasJudicialMark ?? body?.has_judicial_mark, true)
    const attachmentName = text(body?.attachmentName ?? body?.attachment_name)
    const attachmentUrl = text(body?.attachmentUrl ?? body?.attachment_url)
    const attachmentRelativePath = text(body?.attachmentRelativePath ?? body?.attachment_relative_path)
    const notes = text(body?.notes ?? body?.observacoes)

    const userId = text(body?.user?.id || body?.userId || "sistema")
    const userName = text(
      body?.user?.nome ||
        body?.user?.name ||
        body?.userName ||
        "Sistema",
    )
    const userEmail = text(body?.user?.email || body?.userEmail)

    if (!number) {
      return NextResponse.json(
        { ok: false, error: "Informe o número da ficha." },
        { status: 400 },
      )
    }

    const processo = await findJudicialCase(decodedId)

    if (!processo) {
      return NextResponse.json(
        { ok: false, error: "Processo judicial não encontrado." },
        { status: 404 },
      )
    }

    const fichaId = `jf_${randomUUID()}`
    const movementId = `jmov_ficha_${randomUUID()}`
    const attachments = attachmentName
      ? [
          {
            name: attachmentName,
            url: attachmentUrl || undefined,
            relativePath: attachmentRelativePath || undefined,
          },
        ]
      : []

    const movimentoDescricao = [
      `Ficha ${system} cadastrada: ${number}`,
      requestedInclusion ? "Inclusão solicitada: sim" : "Inclusão solicitada: não",
      hasJudicialMark ? "Marca judicial: sim" : "Marca judicial: não",
      notes ? `Observações: ${notes}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.judicial_fichas (
            id,
            monitoramento_id,
            demanda_id,
            system,
            number,
            requested_inclusion,
            has_judicial_mark,
            attachment_name,
            attachment_url,
            attachment_relative_path,
            notes,
            active,
            created_by,
            created_by_name,
            created_by_email,
            created_at,
            updated_at,
            updated_by,
            updated_by_name,
            updated_by_email
          )
          VALUES (
            $1,
            $2::bigint,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            TRUE,
            $12,
            $13,
            $14,
            NOW(),
            NOW(),
            $12,
            $13,
            $14
          )
        `,
        fichaId,
        processo.monitoramentoId,
        processo.demandaId || null,
        system,
        number,
        requestedInclusion,
        hasJudicialMark,
        attachmentName || null,
        attachmentUrl || null,
        attachmentRelativePath || null,
        notes || null,
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_base
          SET
            ficha_core = CASE WHEN $2 = 'CORE' THEN $3 ELSE ficha_core END,
            status_monitoramento_atual = CASE
              WHEN $2 IN ('CORE', 'SISREG') THEN 'MONITORAMENTO_AUTOMATICO'
              ELSE status_monitoramento_atual
            END,
            data_ultimo_monitoramento = NOW(),
            updated_at = NOW()
          WHERE id::text = $1
        `,
        processo.monitoramentoId,
        system,
        number,
      )

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.judicial_movimentacoes (
            id,
            monitoramento_id,
            demanda_id,
            type,
            description,
            attachments,
            created_by,
            created_by_name,
            created_by_email,
            created_at
          )
          VALUES (
            $1,
            $2::bigint,
            $3,
            'monitoramento',
            $4,
            $5::jsonb,
            $6,
            $7,
            $8,
            NOW()
          )
        `,
        movementId,
        processo.monitoramentoId,
        processo.demandaId || null,
        movimentoDescricao,
        JSON.stringify(attachments),
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
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
            'judicial_fichas',
            'cadastrar_ficha_judicial',
            $1,
            $2,
            $3,
            $4,
            'JUDICIAL',
            NOW(),
            jsonb_build_object(),
            jsonb_build_object(
              'ficha_id', $5::text,
              'monitoramento_id', $6::text,
              'system', $7::text,
              'number', $8::text,
              'requested_inclusion', $9::boolean,
              'has_judicial_mark', $10::boolean,
              'notes', $11::text
            ),
            jsonb_build_array(
              'judicial_fichas',
              'system',
              'number',
              'requested_inclusion',
              'has_judicial_mark',
              'notes'
            ),
            $12
          )
        `,
        processo.monitoramentoId,
        userId,
        userName,
        userEmail || null,
        fichaId,
        processo.monitoramentoId,
        system,
        number,
        requestedInclusion,
        hasJudicialMark,
        notes || null,
        movimentoDescricao,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: fichaId,
        monitoramentoId: processo.monitoramentoId,
        demandaId: processo.demandaId,
        protocolo: processo.protocolo,
        pacienteNome: processo.pacienteNome,
        system,
        number,
      },
    })
  } catch (error) {
    console.error("[POST /api/judicial/casos/[id]/fichas] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao cadastrar ficha judicial." },
      { status: 500 },
    )
  }
}
