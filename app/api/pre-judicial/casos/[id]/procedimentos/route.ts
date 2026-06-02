import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type PreJudicialCaseRow = {
  id: string
  protocolNumber: string | null
  patientName: string | null
}

type SigtapRow = {
  id: string
  codigo: string | null
  descricao: string | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

async function findPreJudicialCase(decodedId: string) {
  const rows = await prisma.$queryRawUnsafe<PreJudicialCaseRow[]>(
    `
      SELECT
        c.id::text AS id,
        c.protocol_number AS "protocolNumber",
        c.patient_name AS "patientName"
      FROM public.pre_judicial_casos c
      WHERE
        c.id::text = $1
        OR c.protocol_number::text = $1
        OR c.origin_protocol::text = $1
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

    const sigtapId = text(body?.sigtapId)
    const sigtapCode = text(body?.sigtapCode ?? body?.codigo)
    const descriptionInput = text(body?.description ?? body?.descricao)
    const specialty = text(body?.specialty ?? body?.especialidade)
    const subSpecialty = text(body?.subSpecialty ?? body?.subespecialidade)
    const situation = text(body?.situation ?? body?.situacao ?? "determinado")

    const user = body?.user || {}
    const userId = text(user?.id || body?.userId || "sistema")
    const userName = text(user?.nome || user?.name || body?.userName || "Sistema")
    const userEmail = text(user?.email || body?.userEmail)

    if (!sigtapId && !sigtapCode) {
      return NextResponse.json(
        { ok: false, error: "Selecione um procedimento SIGTAP." },
        { status: 400 },
      )
    }

    const caso = await findPreJudicialCase(decodedId)

    if (!caso) {
      return NextResponse.json(
        { ok: false, error: "Processo pré judicial não encontrado." },
        { status: 404 },
      )
    }

    const sigtapRows = await prisma.$queryRawUnsafe<SigtapRow[]>(
      `
        SELECT
          id::text AS id,
          codigo,
          descricao
        FROM public.admin_judicial_sigtap
        WHERE COALESCE(ativo, TRUE) = TRUE
          AND (
            ($1 <> '' AND id::text = $1)
            OR ($2 <> '' AND codigo = $2)
            OR ($3 <> '' AND descricao = $3)
          )
        ORDER BY id ASC
        LIMIT 1
      `,
      sigtapId,
      sigtapCode,
      descriptionInput,
    )

    const sigtap = sigtapRows[0]

    if (!sigtap && !sigtapCode) {
      return NextResponse.json(
        { ok: false, error: "Procedimento SIGTAP não encontrado no banco." },
        { status: 404 },
      )
    }

    const procedimentoId = `pre_proc_${randomUUID()}`
    const codigo = text(sigtap?.codigo || sigtapCode)
    const descricao = text(sigtap?.descricao || descriptionInput)

    if (!codigo || !descricao) {
      return NextResponse.json(
        { ok: false, error: "Código e descrição do procedimento são obrigatórios." },
        { status: 400 },
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.pre_judicial_procedimentos (
            id,
            caso_id,
            sigtap_code,
            description,
            specialty,
            sub_specialty,
            situation,
            active,
            created_by,
            created_by_name,
            created_by_email,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            TRUE,
            $8,
            $9,
            $10,
            NOW(),
            NOW()
          )
        `,
        procedimentoId,
        caso.id,
        codigo,
        descricao,
        specialty || null,
        subSpecialty || null,
        situation || null,
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
        `
          INSERT INTO public.pre_judicial_movimentacoes (
            id,
            caso_id,
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
            $2,
            'interacao',
            $3,
            '[]'::jsonb,
            $4,
            $5,
            $6,
            NOW()
          )
        `,
        `pre_mov_${randomUUID()}`,
        caso.id,
        `Procedimento SIGTAP adicionado: ${codigo} - ${descricao}`,
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.pre_judicial_casos
          SET
            updated_by = $2,
            updated_by_name = $3,
            updated_by_email = $4,
            updated_at = NOW()
          WHERE id::text = $1
        `,
        caso.id,
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
            'pre_judicial_procedimentos',
            'adicionar_procedimento_pre_judicial',
            $1,
            $2,
            $3,
            $4,
            'PRE_JUDICIAL',
            NOW(),
            jsonb_build_object(),
            jsonb_build_object(
              'procedimento_id', $5::text,
              'sigtap_code', $6::text,
              'description', $7::text,
              'specialty', $8::text,
              'sub_specialty', $9::text,
              'situation', $10::text
            ),
            jsonb_build_array(
              'pre_judicial_procedimentos',
              'pre_judicial_movimentacoes'
            ),
            $11
          )
        `,
        caso.id,
        userId,
        userName,
        userEmail || null,
        procedimentoId,
        codigo,
        descricao,
        specialty || null,
        subSpecialty || null,
        situation || null,
        `Procedimento SIGTAP adicionado ao Pré Judicial: ${codigo} - ${descricao}`,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: procedimentoId,
        caseId: caso.id,
        sigtapCode: codigo,
        description: descricao,
        specialty: specialty || undefined,
        subSpecialty: subSpecialty || undefined,
        situation: situation || undefined,
        active: true,
        createdAt: new Date().toISOString(),
        createdByName: userName,
      },
    })
  } catch (error) {
    console.error("[POST /api/pre-judicial/casos/[id]/procedimentos] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao adicionar procedimento pré judicial." },
      { status: 500 },
    )
  }
}