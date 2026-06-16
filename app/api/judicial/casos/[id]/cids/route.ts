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

type CidRow = {
  codigo: string | null
  descricao: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

function splitValues(value: unknown) {
  return text(value)
    .split(/[|;,\n]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function appendUnique(values: string[], next: string) {
  const clean = text(next)
  if (!clean) return values
  const normalized = clean.toUpperCase()
  if (values.some((item) => item.toUpperCase() === normalized)) return values
  return [...values, clean]
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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const decodedId = decodeURIComponent(id)
    const body = await req.json().catch(() => ({}))

    const codeInput = text(body?.code ?? body?.codigo)
    const descriptionInput = text(body?.description ?? body?.descricao)
    const userId = text(body?.user?.id || body?.userId || "sistema")
    const userName = text(body?.user?.nome || body?.user?.name || body?.userName || "Sistema")
    const userEmail = text(body?.user?.email || body?.userEmail)

    if (!codeInput && !descriptionInput) {
      return NextResponse.json(
        { ok: false, error: "Selecione um CID." },
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

    const cidRows = await prisma.$queryRawUnsafe<CidRow[]>(
      `
        SELECT
          codigo,
          descricao
        FROM public.admin_judicial_cid10
        WHERE COALESCE(codigo::text, '') <> ''
          AND COALESCE(descricao::text, '') <> ''
          AND (
            ($1 <> '' AND codigo::text = $1)
            OR ($2 <> '' AND descricao::text = $2)
          )
        ORDER BY codigo ASC
        LIMIT 1
      `,
      codeInput,
      descriptionInput,
    )

    const cid = cidRows[0]
    const code = text(cid?.codigo || codeInput).toUpperCase()
    const description = text(cid?.descricao || descriptionInput).toUpperCase()

    if (!code || !description) {
      return NextResponse.json(
        { ok: false, error: "Código e descrição do CID são obrigatórios." },
        { status: 400 },
      )
    }

    const currentCodes = splitValues(processo.cid10 || processo.cidCodigoBase)
    const currentDescriptions = splitValues(processo.cidDescricaoBase)
    const nextCodes = appendUnique(currentCodes, code)
    const nextDescriptions = appendUnique(currentDescriptions, description)
    const joinedCodes = nextCodes.join(" | ")
    const joinedDescriptions = nextDescriptions.join(" | ")
    const cidRegistroId = `jcid_${randomUUID()}`

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_base
          SET
            cid_codigo = $2,
            cid_descricao = $3,
            updated_at = NOW()
          WHERE id::text = $1
        `,
        processo.monitoramentoId,
        joinedCodes,
        joinedDescriptions,
      )

      if (processo.demandaId) {
        await tx.$executeRawUnsafe(
          `
            UPDATE public.demandas
            SET
              cid10 = $2,
              "updatedAt" = NOW()
            WHERE id = $1
          `,
          processo.demandaId,
          joinedCodes,
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
        `jmov_cid_${randomUUID()}`,
        processo.monitoramentoId,
        processo.demandaId || null,
        `CID adicionado: ${code} - ${description}`,
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
            'adicionar_cid_judicial',
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
        joinedCodes,
        joinedDescriptions,
        `CID adicionado: ${code} - ${description}`,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: cidRegistroId,
        code,
        description,
        active: true,
        createdAt: new Date().toISOString(),
        createdByName: userName,
      },
    })
  } catch (error) {
    console.error("[POST /api/judicial/casos/[id]/cids] erro:", error)
    const detail = error instanceof Error ? error.message : String(error)

    return NextResponse.json(
      { ok: false, error: "Erro ao adicionar CID judicial.", detail },
      { status: 500 },
    )
  }
}
