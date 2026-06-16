import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type JudicialBaseRow = {
  monitoramentoId: string
  demandaId: string | null
  cidCodigoBase: string | null
  cidDescricaoBase: string | null
  cid10: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function splitValues(value: unknown) {
  return text(value)
    .split(/[|;\n]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function removeCidAtIndex(codes: string[], descriptions: string[], targetCode: string) {
  const normalizedTarget = targetCode.toUpperCase()
  const index = codes.findIndex((code) => code.toUpperCase() === normalizedTarget)

  if (index < 0) {
    return {
      found: false,
      removedCode: "",
      removedDescription: "",
      nextCodes: codes,
      nextDescriptions: descriptions,
    }
  }

  return {
    found: true,
    removedCode: codes[index] || targetCode,
    removedDescription: descriptions[index] || codes[index] || targetCode,
    nextCodes: codes.filter((_, itemIndex) => itemIndex !== index),
    nextDescriptions: descriptions.filter((_, itemIndex) => itemIndex !== index),
  }
}

async function findJudicialCase(decodedId: string) {
  const rows = await prisma.$queryRawUnsafe<JudicialBaseRow[]>(
    `
      SELECT
        b.id::text AS "monitoramentoId",
        b.demanda_id::text AS "demandaId",
        b.cid_codigo AS "cidCodigoBase",
        b.cid_descricao AS "cidDescricaoBase",
        d.cid10 AS cid10
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

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; cidId: string }> },
) {
  try {
    const { id, cidId } = await context.params
    const decodedId = decodeURIComponent(id)
    const decodedCid = decodeURIComponent(cidId)
    const body = await req.json().catch(() => ({}))

    const userId = text(body?.user?.id || body?.userId || "sistema")
    const userName = text(body?.user?.nome || body?.user?.name || body?.userName || "Sistema")
    const userEmail = text(body?.user?.email || body?.userEmail)
    const reason = text(body?.reason || body?.motivo || "CID inativado pelo usuário.")

    const processo = await findJudicialCase(decodedId)

    if (!processo) {
      return NextResponse.json(
        { ok: false, error: "Processo judicial não encontrado." },
        { status: 404 },
      )
    }

    const codes = splitValues(processo.cid10 || processo.cidCodigoBase)
    const descriptions = splitValues(processo.cidDescricaoBase)
    const result = removeCidAtIndex(codes, descriptions, decodedCid)

    if (!result.found) {
      return NextResponse.json(
        { ok: false, error: "CID não encontrado neste processo." },
        { status: 404 },
      )
    }

    const nextCodesText = result.nextCodes.join(" | ")
    const nextDescriptionsText = result.nextDescriptions.join(" | ")

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_base
          SET
            cid_codigo = NULLIF($2, ''),
            cid_descricao = NULLIF($3, ''),
            updated_at = NOW()
          WHERE id::text = $1
        `,
        processo.monitoramentoId,
        nextCodesText,
        nextDescriptionsText,
      )

      if (processo.demandaId) {
        await tx.$executeRawUnsafe(
          `
            UPDATE public.demandas
            SET
              cid10 = NULLIF($2, ''),
              "updatedAt" = NOW()
            WHERE id = $1
          `,
          processo.demandaId,
          nextCodesText,
        )
      }

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
            '[]'::jsonb,
            $5,
            $6,
            $7,
            NOW()
          )
        `,
        `jmov_cid_inativo_${randomUUID()}`,
        processo.monitoramentoId,
        processo.demandaId || null,
        `CID inativado: ${result.removedCode} - ${result.removedDescription}. Motivo: ${reason}`,
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
            'judicial_monitoramento_base',
            'inativar_cid_judicial',
            $1,
            $2,
            $3,
            $4,
            'JUDICIAL',
            NOW(),
            jsonb_build_object('cid_codigo', $5::text, 'cid_descricao', $6::text),
            jsonb_build_object('cid_codigo', $7::text, 'cid_descricao', $8::text),
            jsonb_build_array('cid_codigo', 'cid_descricao'),
            $9
          )
        `,
        processo.monitoramentoId,
        userId,
        userName,
        userEmail || null,
        text(processo.cid10 || processo.cidCodigoBase),
        text(processo.cidDescricaoBase),
        nextCodesText,
        nextDescriptionsText,
        `CID inativado: ${result.removedCode} - ${result.removedDescription}. Motivo: ${reason}`,
      )
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[DELETE /api/judicial/casos/[id]/cids/[cidId]] erro:", error)
    const detail = error instanceof Error ? error.message : String(error)

    return NextResponse.json(
      { ok: false, error: "Erro ao inativar CID judicial.", detail },
      { status: 500 },
    )
  }
}
