import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CaseRow = {
  monitoramentoId: string
  demandaId: string | null
  origemRegistroId: string | null
}

type ProcedimentoRow = {
  id: string
  monitoramentoId: string
  demandaId: string | null
  sigtapCodigo: string | null
  sigtapDescricao: string | null
  especialidade: string | null
  subespecialidade: string | null
  active: boolean | null
}

function text(value: unknown) {
  return String(value ?? "").trim()
}

async function findCase(caseId: string) {
  const rows = await prisma.$queryRawUnsafe<CaseRow[]>(
    `
      SELECT
        b.id::text AS "monitoramentoId",
        b.demanda_id::text AS "demandaId",
        b.origem_registro_id::text AS "origemRegistroId"
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
    caseId,
  )

  return rows[0] ?? null
}

async function findProcedure(params: {
  monitoramentoId: string
  demandaId?: string | null
  origemRegistroId?: string | null
  procedimentoId: string
  sigtapCode?: string
}) {
  const { monitoramentoId, demandaId, origemRegistroId, procedimentoId, sigtapCode } = params

  const normalizedProcedimentoId = text(procedimentoId).replace(/\D/g, "")
  const normalizedSigtapCode = text(sigtapCode).replace(/\D/g, "")

  const rows = await prisma.$queryRawUnsafe<ProcedimentoRow[]>(
    `
      SELECT
        p.id::text AS id,
        p.monitoramento_id::text AS "monitoramentoId",
        p.demanda_id::text AS "demandaId",
        p.sigtap_codigo AS "sigtapCodigo",
        p.sigtap_descricao AS "sigtapDescricao",
        p.especialidade,
        p.subespecialidade,
        p.active
      FROM public.judicial_procedimentos p
      WHERE
        p.id::text = $2
        OR (
          (
            p.monitoramento_id::text = $1
            OR ($4 <> '' AND p.demanda_id::text = $4)
            OR ($5 <> '' AND p.demanda_id::text = $5)
          )
          AND (
            p.sigtap_codigo = $2
            OR ($3 <> '' AND p.sigtap_codigo = $3)
            OR ($6 <> '' AND regexp_replace(COALESCE(p.sigtap_codigo, ''), '[^0-9]', '', 'g') = $6)
            OR ($7 <> '' AND regexp_replace(COALESCE(p.sigtap_codigo, ''), '[^0-9]', '', 'g') = $7)
          )
        )
      ORDER BY
        CASE
          WHEN p.id::text = $2 THEN 0
          WHEN p.sigtap_codigo = $2 THEN 1
          WHEN $3 <> '' AND p.sigtap_codigo = $3 THEN 2
          WHEN $7 <> '' AND regexp_replace(COALESCE(p.sigtap_codigo, ''), '[^0-9]', '', 'g') = $7 THEN 3
          WHEN $6 <> '' AND regexp_replace(COALESCE(p.sigtap_codigo, ''), '[^0-9]', '', 'g') = $6 THEN 4
          ELSE 5
        END,
        COALESCE(p.updated_at, p.created_at) DESC,
        p.id ASC
      LIMIT 1
    `,
    monitoramentoId,
    procedimentoId,
    sigtapCode || "",
    demandaId || "",
    origemRegistroId || "",
    normalizedProcedimentoId,
    normalizedSigtapCode,
  )

  return rows[0] ?? null
}


async function createInactiveVirtualProcedure(params: {
  monitoramentoId: string
  demandaId?: string | null
  sigtapCode: string
  sigtapDescription?: string
  specialty?: string
  subSpecialty?: string
  reason?: string
  userId: string
  userName: string
  userEmail?: string | null
}) {
  const {
    monitoramentoId,
    demandaId,
    sigtapCode,
    sigtapDescription,
    specialty,
    subSpecialty,
    reason,
    userId,
    userName,
    userEmail,
  } = params

  const procedimentoId = `jproc_virtual_${randomUUID()}`
  const codigo = text(sigtapCode)
  const descricao = text(sigtapDescription) || "Procedimento nao informado"

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        INSERT INTO public.judicial_procedimentos (
          id,
          monitoramento_id,
          demanda_id,
          sigtap_id,
          sigtap_codigo,
          sigtap_descricao,
          especialidade,
          subespecialidade,
          active,
          inactive_reason,
          created_by,
          created_by_name,
          created_by_email,
          updated_by,
          updated_by_name,
          updated_by_email,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2::bigint,
          $3,
          NULL,
          $4,
          $5,
          $6,
          $7,
          FALSE,
          $8,
          $9,
          $10,
          $11,
          $9,
          $10,
          $11,
          NOW(),
          NOW()
        )
      `,
      procedimentoId,
      monitoramentoId,
      demandaId || null,
      codigo,
      descricao,
      text(specialty) || null,
      text(subSpecialty) || null,
      reason || null,
      userId,
      userName,
      userEmail || null,
    )

    await tx.$executeRawUnsafe(
      `
        UPDATE public.judicial_monitoramento_base
        SET
          data_ultimo_monitoramento = NOW(),
          updated_at = NOW()
        WHERE id::text = $1
      `,
      monitoramentoId,
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
          'judicial_procedimentos',
          'remover_procedimento_judicial_virtual',
          $1,
          $2,
          $3,
          $4,
          'JUDICIAL',
          NOW(),
          jsonb_build_object(
            'origem', 'procedimento_virtual_demanda',
            'sigtap_codigo', $5::text,
            'sigtap_descricao', $6::text,
            'especialidade', $7::text,
            'subespecialidade', $8::text
          ),
          jsonb_build_object(
            'procedimento_id', $9::text,
            'active', FALSE,
            'inactive_reason', $10::text
          ),
          jsonb_build_array(
            'judicial_procedimentos',
            'active',
            'inactive_reason'
          ),
          $11
        )
      `,
      monitoramentoId,
      userId,
      userName,
      userEmail || null,
      codigo,
      descricao,
      text(specialty) || null,
      text(subSpecialty) || null,
      procedimentoId,
      reason || null,
      `Procedimento SIGTAP virtual removido/inativado: ${codigo} - ${descricao}`,
    )
  })

  return {
    id: procedimentoId,
    monitoramentoId,
    demandaId: demandaId || null,
    sigtapCodigo: codigo,
    sigtapDescricao: descricao,
    especialidade: text(specialty) || null,
    subespecialidade: text(subSpecialty) || null,
    active: false,
  } satisfies ProcedimentoRow
}
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; procedimentoId: string }> },
) {
  try {
    const { id, procedimentoId } = await context.params
    const decodedCaseId = decodeURIComponent(id)
    const decodedProcedimentoId = decodeURIComponent(procedimentoId)

    const body = await req.json().catch(() => ({}))

    const reason = text(body?.reason)
    const sigtapCode = text(body?.sigtapCode ?? body?.codigo)

    
    const sigtapDescription = text(body?.description ?? body?.descricao ?? body?.sigtapDescription ?? body?.sigtapDescricao)
    const specialty = text(body?.specialty ?? body?.especialidade)
    const subSpecialty = text(body?.subSpecialty ?? body?.subespecialidade)
    const userId = text(body?.user?.id || body?.userId || "sistema")
    const userName = text(
      body?.user?.nome ||
        body?.user?.name ||
        body?.userName ||
        "Sistema",
    )
    const userEmail = text(body?.user?.email || body?.userEmail)

    const caseRow = await findCase(decodedCaseId)

    if (!caseRow) {
      return NextResponse.json(
        { ok: false, error: "Processo judicial não encontrado." },
        { status: 404 },
      )
    }

    let procedimento = await findProcedure({
      monitoramentoId: caseRow.monitoramentoId,
      demandaId: caseRow.demandaId,
      origemRegistroId: caseRow.origemRegistroId,
      procedimentoId: decodedProcedimentoId,
      sigtapCode,
    })

    if (!procedimento) {
      const isVirtualProcedure =
        decodedProcedimentoId.endsWith("-procedimento") && sigtapCode

      if (isVirtualProcedure) {
        procedimento = await createInactiveVirtualProcedure({
          monitoramentoId: caseRow.monitoramentoId,
          demandaId: caseRow.demandaId || caseRow.origemRegistroId,
          sigtapCode,
          sigtapDescription,
          specialty,
          subSpecialty,
          reason: reason || undefined,
          userId,
          userName,
          userEmail: userEmail || null,
        })

        return NextResponse.json({
          ok: true,
          item: {
            id: procedimento.id,
            monitoramentoId: procedimento.monitoramentoId,
            demandaId: procedimento.demandaId,
            sigtapCode: procedimento.sigtapCodigo,
            description: procedimento.sigtapDescricao,
            active: false,
            inactiveReason: reason || null,
          },
        })
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            "Procedimento judicial não encontrado. Atualize a página e tente novamente.",
        },
        { status: 404 },
      )
    }
    if (procedimento.active === false) {
      return NextResponse.json({
        ok: true,
        item: {
          id: procedimento.id,
          active: false,
        },
      })
    }

    const descricao = [
      `Procedimento SIGTAP removido/inativado: ${procedimento.sigtapCodigo} - ${procedimento.sigtapDescricao}`,
      reason ? `Motivo: ${reason}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_procedimentos
          SET
            active = FALSE,
            inactive_reason = $2,
            updated_by = $3,
            updated_by_name = $4,
            updated_by_email = $5,
            updated_at = NOW()
          WHERE id::text = $1
        `,
        procedimento.id,
        reason || null,
        userId,
        userName,
        userEmail || null,
      )

      await tx.$executeRawUnsafe(
        `
          UPDATE public.judicial_monitoramento_base
          SET
            data_ultimo_monitoramento = NOW(),
            updated_at = NOW()
          WHERE id::text = $1
        `,
        procedimento.monitoramentoId,
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
            'judicial_procedimentos',
            'remover_procedimento_judicial',
            $1,
            $2,
            $3,
            $4,
            'JUDICIAL',
            NOW(),
            jsonb_build_object(
              'procedimento_id', $5::text,
              'active', TRUE,
              'sigtap_codigo', $6::text,
              'sigtap_descricao', $7::text,
              'especialidade', $8::text,
              'subespecialidade', $9::text
            ),
            jsonb_build_object(
              'procedimento_id', $5::text,
              'active', FALSE,
              'inactive_reason', $10::text
            ),
            jsonb_build_array(
              'judicial_procedimentos',
              'active',
              'inactive_reason'
            ),
            $11
          )
        `,
        procedimento.monitoramentoId,
        userId,
        userName,
        userEmail || null,
        procedimento.id,
        procedimento.sigtapCodigo || null,
        procedimento.sigtapDescricao || null,
        procedimento.especialidade || null,
        procedimento.subespecialidade || null,
        reason || null,
        descricao,
      )
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: procedimento.id,
        monitoramentoId: procedimento.monitoramentoId,
        demandaId: procedimento.demandaId,
        sigtapCode: procedimento.sigtapCodigo,
        description: procedimento.sigtapDescricao,
        active: false,
        inactiveReason: reason || null,
      },
    })
  } catch (error) {
    console.error(
      "[DELETE /api/judicial/casos/[id]/procedimentos/[procedimentoId]] erro:",
      error,
    )

    return NextResponse.json(
      { ok: false, error: "Erro ao remover procedimento judicial." },
      { status: 500 },
    )
  }
}