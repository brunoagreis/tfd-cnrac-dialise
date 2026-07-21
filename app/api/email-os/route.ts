import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { ensureEmailOsRoutingColumns, inferEmailOsModule, normalizeEmailOsModule } from "@/lib/email-os-routing"

import { readServerSession } from "@/lib/security/server-session"
import { finalizeEmailMessage } from "@/lib/email-triage-mailbox"
import { reconcileEmailOsWithExistingJudicialCases } from "@/lib/judicial-email-os-reconcile"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type OsRow = {
  id: string
  protocolo: string | null
  assunto: string | null
  remetente: string | null
  recebidoEm: string | null
  pgeNet: string | null
  processo: string | null
  classificador: string | null
  regraNome: string | null
  corpoResumo: string | null
  anexos: unknown
  status: string | null
  moduloDestino: string | null
  responsavelId: string | null
  responsavelNome: string | null
  responsavelEmail: string | null
  convertidoProtocolo: string | null
  createdAt: string | null
}

type UserRow = { id: string; nome: string | null; email: string | null }

function isDeliveryStatusFailureSubject(value: unknown) {
  return String(value ?? "").trim().toLowerCase() === "delivery status notification (failure)"
}

function text(value: unknown) { return String(value ?? "").trim() }
function digits(value: unknown) { return text(value).replace(/\D/g, "") }
function parseArray(value: unknown) { if (Array.isArray(value)) return value; if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : [] } catch { return [] } } return [] }
function parseObject(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function files(value: unknown, osId = "") {
  return parseArray(value).map((item, index) => {
    const record = parseObject(item)

    const name = text(
      record.name ||
        record.filename ||
        record.originalName ||
        record.arquivoNomeOriginal ||
        record.storedName ||
        "anexo",
    )

    const rawUrl = text(record.url || record.relativePath || record.arquivoPath || record.path)

    return {
      name,
      url: `/api/email-os/anexo?osId=${encodeURIComponent(osId)}&index=${index}&disposition=inline`,
      downloadUrl: `/api/email-os/anexo?osId=${encodeURIComponent(osId)}&index=${index}&disposition=attachment`,
      rawUrl,
      relativePath: text(record.relativePath || record.arquivoPath || record.path || rawUrl),
      storedName: text(record.storedName || record.filename || name),
      mimeType: text(record.mimeType || record.contentType),
      size: Number(record.size || 0),
    }
  })
}

async function findUser(id: string) { const rows = await prisma.$queryRawUnsafe<UserRow[]>(`SELECT id::text AS id, nome, email FROM public.usuarios WHERE id::text = $1 LIMIT 1`, id); return rows[0] || null }


function normalizeEmailOsAccessValue(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function isEmailOsAdminSession(session: any) {
  const role = normalizeEmailOsAccessValue(
    session?.role ??
    session?.perfil ??
    session?.tipo ??
    session?.nivel ??
    session?.perfilCodigo ??
    session?.perfil_codigo ??
    "",
  )

  return (
    role === "admin" ||
    role === "administrador" ||
    role.includes("admin") ||
    session?.isAdmin === true
  )
}

function isEmailOsResponsibleForSession(item: any, session: any) {
  if (!item || !session) return false
  if (isEmailOsAdminSession(session)) return true

  const sessionIds = [
    session?.id,
    session?.userId,
    session?.usuarioId,
    session?.usuario_id,
  ].map(normalizeEmailOsAccessValue).filter(Boolean)

  const sessionEmails = [
    session?.email,
    session?.login,
  ].map(normalizeEmailOsAccessValue).filter(Boolean)

  const sessionNames = [
    session?.nome,
    session?.name,
    session?.username,
  ].map(normalizeEmailOsAccessValue).filter(Boolean)

  const responsibleIds = [
    item?.responsavelId,
    item?.responsavel_id,
    item?.responsavelUsuarioId,
    item?.responsavel_usuario_id,
    item?.usuarioResponsavelId,
    item?.usuario_responsavel_id,
  ].map(normalizeEmailOsAccessValue).filter(Boolean)

  const responsibleEmails = [
    item?.responsavelEmail,
    item?.responsavel_email,
    item?.emailResponsavel,
    item?.email_responsavel,
  ].map(normalizeEmailOsAccessValue).filter(Boolean)

  const responsibleNames = [
    item?.responsavelNome,
    item?.responsavel_nome,
    item?.responsavel,
  ].map(normalizeEmailOsAccessValue).filter(Boolean)

  const matchesId = responsibleIds.some((id) => sessionIds.includes(id))
  const matchesEmail = responsibleEmails.some((email) => sessionEmails.includes(email))
  const matchesName = responsibleNames.some((name) => sessionNames.includes(name))

  return matchesId || matchesEmail || matchesName
}

function filterEmailOsItemsForSession<T>(items: T[], session: any): T[] {
  if (!Array.isArray(items)) return []
  if (isEmailOsAdminSession(session)) return items
  return items.filter((item) => isEmailOsResponsibleForSession(item, session))
}

function requireEmailOsSession(req: NextRequest) {
  const session = readServerSession(req)

  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { ok: false, error: "Sessão expirada. Faça login novamente.", items: [] },
        { status: 401 },
      ),
    }
  }

  return { session, response: null }
}

export async function GET(req: NextRequest) {
  // EMAIL_OS_AUTO_INATIVA_DSN
  await prisma.$executeRawUnsafe(`
    UPDATE public.judicial_email_os
    SET status = 'INATIVA', updated_at = NOW()
    WHERE LOWER(TRIM(COALESCE(assunto, ''))) = 'delivery status notification (failure)'
      AND COALESCE(status, 'AGUARDANDO_CADASTRO') NOT IN ('CONVERTIDA', 'CADASTRADA', 'CADASTRADO', 'CONCLUIDA', 'CONCLUÍDA', 'INATIVA')
  `).catch((error) => console.error("[GET /api/email-os] auto inativar DSN:", error))

  try {

    // EMAIL_OS_RECONCILE_EXISTING_JUDICIAL_ON_GET
    await reconcileEmailOsWithExistingJudicialCases().catch((error) => {
      console.error("[EMAIL_OS_RECONCILE_EXISTING_JUDICIAL_ON_GET]", error)
    })

    const moduleParam = normalizeEmailOsModule(req.nextUrl.searchParams.get("modulo"))
    const emailOsSessionGuard = requireEmailOsSession(req)
    if (emailOsSessionGuard.response) return emailOsSessionGuard.response
    const emailOsSession = emailOsSessionGuard.session
    // EMAIL_OS_PESQUISAR_VINCULO_MANUAL
    const emailOsGetAction = text(req.nextUrl.searchParams.get("action")).toLowerCase()

    if (emailOsGetAction === "pesquisar_vinculo") {
      const termo = text(req.nextUrl.searchParams.get("termo"))
      const termoDigits = digits(termo)

      if (termo.length < 3) {
        return NextResponse.json(
          { ok: false, error: "Informe ao menos 3 caracteres para pesquisar." },
          { status: 400 },
        )
      }

      const termoLike = `%${termo}%`

      const resultados = await prisma.$queryRawUnsafe<Array<{
        id: string
        protocolo: string | null
        modulo: string | null
        pacienteNome: string | null
        pacienteCpf: string | null
        pacienteCns: string | null
        processo: string | null
        pgeNet: string | null
        cid: string | null
        codigoSigtap: string | null
        descricaoSigtap: string | null
        especialidade: string | null
        subespecialidade: string | null
        status: string | null
      }>>(
        `
          SELECT
            d.id::text AS id,
            d.protocolo::text AS protocolo,
            LOWER(COALESCE(d.modulo::text, '')) AS modulo,
            p.nome AS "pacienteNome",
            p.cpf AS "pacienteCpf",
            p."cartaoSus" AS "pacienteCns",
            COALESCE(
              NULLIF(proc.processos, ''),
              NULLIF(TRIM(substring(d."observacoesUnidade" from 'AUTOS DA ACAO:\\s*([^\\r\\n]+)')), ''),
              NULLIF(TRIM(substring(d."observacoesUnidade" from 'AUTOS DA AÇÃO:\\s*([^\\r\\n]+)')), ''),
              ''
            ) AS processo,
            COALESCE(proc.pge_net, '') AS "pgeNet",
            COALESCE(d.cid10::text, '') AS cid,
            COALESCE(d."codigoSigtap"::text, '') AS "codigoSigtap",
            COALESCE(d."descricaoSigtap"::text, '') AS "descricaoSigtap",
            COALESCE(d.especialidade::text, '') AS especialidade,
            COALESCE(d.subespecialidade::text, '') AS subespecialidade,
            COALESCE(to_jsonb(d)->>'status', '') AS status
          FROM public.demandas d
          INNER JOIN public.pacientes p
            ON p.id = d."pacienteId"
          LEFT JOIN LATERAL (
            SELECT
              b.id
            FROM public.judicial_monitoramento_base b
            WHERE b.demanda_id = d.id
            ORDER BY b.id DESC
            LIMIT 1
          ) monitoramento ON TRUE
          LEFT JOIN LATERAL (
            SELECT
              COALESCE(
                string_agg(
                  NULLIF(TRIM(pv.numero), ''),
                  ' | ' ORDER BY pv.created_at
                ) FILTER (
                  WHERE UPPER(COALESCE(pv.tipo, '')) = 'PGE_NET'
                    AND COALESCE(pv.ativo, TRUE) = TRUE
                ),
                ''
              ) AS pge_net,
              COALESCE(
                string_agg(
                  NULLIF(TRIM(pv.numero), ''),
                  ' | ' ORDER BY pv.created_at
                ) FILTER (
                  WHERE UPPER(COALESCE(pv.tipo, '')) <> 'PGE_NET'
                    AND COALESCE(pv.ativo, TRUE) = TRUE
                ),
                ''
              ) AS processos
            FROM public.judicial_processos_vinculados pv
            WHERE pv.monitoramento_id = monitoramento.id
          ) proc ON TRUE
          WHERE LOWER(COALESCE(d.modulo::text, '')) IN ('judicial', 'pre_judicial')
            AND (
              d.protocolo::text ILIKE $1
              OR COALESCE(proc.pge_net, '') ILIKE $1
              OR COALESCE(proc.processos, '') ILIKE $1
              OR COALESCE(d."observacoesUnidade", '') ILIKE $1
              OR (
                $2 <> ''
                AND REGEXP_REPLACE(COALESCE(d.protocolo::text, ''), '\\D', '', 'g') = $2
              )
              OR (
                $2 <> ''
                AND REGEXP_REPLACE(COALESCE(d."observacoesUnidade", ''), '\\D', '', 'g')
                    LIKE '%' || $2 || '%'
              )
              OR EXISTS (
                SELECT 1
                FROM public.judicial_processos_vinculados pesquisa_pv
                WHERE pesquisa_pv.monitoramento_id = monitoramento.id
                  AND COALESCE(pesquisa_pv.ativo, TRUE) = TRUE
                  AND (
                    pesquisa_pv.numero ILIKE $1
                    OR (
                      $2 <> ''
                      AND REGEXP_REPLACE(
                        COALESCE(pesquisa_pv.numero, ''),
                        '\\D',
                        '',
                        'g'
                      ) = $2
                    )
                  )
              )
            )
          ORDER BY d."createdAt" DESC
          LIMIT 20
        `,
        termoLike,
        termoDigits,
      )

      return NextResponse.json({
        ok: true,
        items: resultados.map((item) => ({
          id: text(item.id),
          protocolo: text(item.protocolo),
          modulo: text(item.modulo),
          pacienteNome: text(item.pacienteNome),
          pacienteCpf: text(item.pacienteCpf),
          pacienteCns: text(item.pacienteCns),
          processo: text(item.processo),
          pgeNet: text(item.pgeNet),
          cid: text(item.cid),
          codigoSigtap: text(item.codigoSigtap),
          descricaoSigtap: text(item.descricaoSigtap),
          especialidade: text(item.especialidade),
          subespecialidade: text(item.subespecialidade),
          status: text(item.status),
        })),
      })
    }
    const rows = await prisma.$queryRawUnsafe<OsRow[]>(`
      SELECT id::text AS id, protocolo, assunto, remetente, recebido_em::text AS "recebidoEm", pge_net AS "pgeNet", processo, classificador, regra_nome AS "regraNome", corpo_resumo AS "corpoResumo", anexos, status, modulo_destino AS "moduloDestino", responsavel_id AS "responsavelId", responsavel_nome AS "responsavelNome", responsavel_email AS "responsavelEmail", convertido_protocolo AS "convertidoProtocolo", created_at::text AS "createdAt"
      FROM public.judicial_email_os
      WHERE COALESCE(status, 'AGUARDANDO_CADASTRO') NOT IN ('CONVERTIDA', 'CADASTRADA', 'CADASTRADO', 'CONCLUIDA', 'CONCLUÍDA', 'INATIVA')
      ORDER BY created_at DESC, id DESC
      LIMIT 200
    `).catch((error) => {
      console.error("[GET /api/email-os] erro na consulta:", error)
      return [] as OsRow[]
    })
    const items = rows.map((row) => { const modulo = normalizeEmailOsModule(row.moduloDestino || inferEmailOsModule(row.assunto, row.classificador)); return { id: row.id, protocolo: row.protocolo || `OS-${row.id}`, assunto: row.assunto || "", remetente: row.remetente || "", recebidoEm: row.recebidoEm || "", pgeNet: row.pgeNet || "", processo: row.processo || "", classificador: row.classificador || "", regraNome: row.regraNome || "", corpoResumo: row.corpoResumo || "", status: row.status || "AGUARDANDO_CADASTRO", moduloDestino: modulo, responsavelId: row.responsavelId || "", responsavelNome: row.responsavelNome || "", responsavelEmail: row.responsavelEmail || "", convertidoProtocolo: row.convertidoProtocolo || "", createdAt: row.createdAt || "", anexos: files(row.anexos, row.id) } }).filter((item) => isEmailOsAdminSession(emailOsSession) ? item.moduloDestino === moduleParam : true)
    const authorizedItems = filterEmailOsItemsForSession(items, emailOsSession)

    // EMAIL_OS_TOTAL_ATIVAS_AGUARDANDO_CADASTRO
    const assignedActiveRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `
        SELECT
          COUNT(*)::int AS total
        FROM public.judicial_email_os os
        WHERE UPPER(
          TRIM(
            COALESCE(
              os.status,
              'AGUARDANDO_CADASTRO'
            )
          )
        ) NOT IN (
          'CONVERTIDA',
          'CADASTRADA',
          'CADASTRADO',
          'INATIVA'
        )
          AND UPPER(
            TRIM(
              COALESCE(
                os.status,
                'AGUARDANDO_CADASTRO'
              )
            )
          ) NOT LIKE 'CONCLU%'
          AND COALESCE(
            NULLIF(TRIM(os.responsavel_id::text), ''),
            NULLIF(TRIM(os.responsavel_email), ''),
            NULLIF(TRIM(os.responsavel_nome), '')
          ) IS NOT NULL
          AND LOWER(
            REPLACE(
              TRIM(
                COALESCE(
                  os.modulo_destino,
                  ''
                )
              ),
              '-',
              '_'
            )
          ) = $1::text
      `,
      moduleParam,
    )

    const totalAssignedActive = Math.max(
      0,
      Number(assignedActiveRows[0]?.total ?? 0),
    )

    return NextResponse.json({
      ok: true,
      items: authorizedItems,
      totals: {
        assignedActive: totalAssignedActive,
      },
    })
  } catch (error) {
    console.error("[GET /api/email-os] erro:", error)
    return NextResponse.json({ ok: true, items: [] })
  }
}

export async function POST(req: NextRequest) {
  try {

    // EMAIL_OS_RECONCILE_EXISTING_JUDICIAL_ON_POST
    await reconcileEmailOsWithExistingJudicialCases().catch((error) => {
      console.error("[EMAIL_OS_RECONCILE_EXISTING_JUDICIAL_ON_POST]", error)
    })

    await ensureEmailOsRoutingColumns()
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || "").trim().toLowerCase()

    const emailOsMutationSessionGuard = requireEmailOsSession(req)
    if (emailOsMutationSessionGuard.response) return emailOsMutationSessionGuard.response
    const emailOsMutationSession = emailOsMutationSessionGuard.session

    if (["inativar", "transferir", "atribuir", "reatribuir", "alterar_responsavel"].includes(action) && !isEmailOsAdminSession(emailOsMutationSession)) {
      return NextResponse.json(
        { ok: false, error: "Apenas administradores podem transferir ou inativar ordens de serviço." },
        { status: 403 },
      )
    }

    // EMAIL_OS_VINCULAR_DEMANDA_EXISTENTE
    if (action === "vincular_demanda_existente") {
      const osId = text(body?.osId || body?.id || body?.emailOsId)
      const demandaId = text(body?.demandaId || body?.destinoId)

      if (!osId) {
        return NextResponse.json(
          { ok: false, error: "ID da OS não informado." },
          { status: 400 },
        )
      }

      if (!demandaId) {
        return NextResponse.json(
          { ok: false, error: "Demanda de destino não informada." },
          { status: 400 },
        )
      }

      const sessionValue = emailOsMutationSession as any

      const actorId = text(
        sessionValue?.user?.id ||
        sessionValue?.id ||
        body?.user?.id ||
        body?.userId ||
        "sistema",
      )

      const actorName = text(
        sessionValue?.user?.nome ||
        sessionValue?.user?.name ||
        sessionValue?.nome ||
        sessionValue?.name ||
        body?.user?.nome ||
        body?.user?.name ||
        body?.userName ||
        "Usuário",
      )

      const actorEmail = text(
        sessionValue?.user?.email ||
        sessionValue?.email ||
        body?.user?.email ||
        body?.userEmail,
      ).toLowerCase()

      const resultado = await prisma.$transaction(async (tx) => {
        const osRows = await tx.$queryRawUnsafe<Array<{
          id: string
          protocolo: string | null
          assunto: string | null
          remetente: string | null
          pgeNet: string | null
          processo: string | null
          corpoResumo: string | null
          anexos: unknown
          convertidoDemandaId: string | null
          convertidoProtocolo: string | null
        }>>(
          `
            SELECT
              id::text AS id,
              protocolo,
              assunto,
              remetente,
              pge_net AS "pgeNet",
              processo,
              corpo_resumo AS "corpoResumo",
              anexos,
              convertido_demanda_id::text AS "convertidoDemandaId",
              convertido_protocolo AS "convertidoProtocolo"
            FROM public.judicial_email_os
            WHERE id::text = $1::text
            LIMIT 1
            FOR UPDATE
          `,
          osId,
        )

        const os = osRows[0]

        if (!os) {
          return {
            ok: false as const,
            status: 404,
            error: "Ordem de Serviço não encontrada.",
          }
        }

        if (
          text(os.convertidoDemandaId) &&
          text(os.convertidoDemandaId) !== demandaId
        ) {
          return {
            ok: false as const,
            status: 409,
            error:
              "Esta OS já está vinculada a outra demanda. O vínculo não foi alterado.",
          }
        }

        const demandas = await tx.$queryRawUnsafe<Array<{
          id: string
          protocolo: string | null
          modulo: string | null
          pacienteNome: string | null
          monitoramentoId: string | null
        }>>(
          `
            SELECT
              d.id::text AS id,
              d.protocolo::text AS protocolo,
              LOWER(COALESCE(d.modulo::text, '')) AS modulo,
              p.nome AS "pacienteNome",
              monitoramento.id::text AS "monitoramentoId"
            FROM public.demandas d
            INNER JOIN public.pacientes p
              ON p.id = d."pacienteId"
            LEFT JOIN LATERAL (
              SELECT b.id
              FROM public.judicial_monitoramento_base b
              WHERE b.demanda_id = d.id
              ORDER BY b.id DESC
              LIMIT 1
            ) monitoramento ON TRUE
            WHERE d.id::text = $1
            LIMIT 1
            FOR UPDATE OF d
          `,
          demandaId,
        )

        const demanda = demandas[0]

        if (!demanda) {
          return {
            ok: false as const,
            status: 404,
            error: "Demanda de destino não encontrada.",
          }
        }

        if (!["judicial", "pre_judicial"].includes(text(demanda.modulo))) {
          return {
            ok: false as const,
            status: 400,
            error:
              "Nesta etapa, o vínculo está disponível somente para Judicial e Pré-Judicial.",
          }
        }

        if (!text(demanda.monitoramentoId)) {
          return {
            ok: false as const,
            status: 409,
            error:
              "A demanda encontrada ainda não possui monitoramento judicial vinculado.",
          }
        }

        const marker = `OS vinculada manualmente: ${os.id}`
        const anexos = parseArray(os.anexos)

        // EMAIL_OS_VINCULO_MOVIMENTACAO_COMPLETA
        const description = [
          "ORDEM DE SERVIÇO VINCULADA À DEMANDA",
          marker,
          `Protocolo da OS: ${text(os.protocolo) || os.id}`,
          `Assunto: ${text(os.assunto) || "Sem assunto"}`,
          `Remetente: ${text(os.remetente) || "-"}`,
          `PGE.net informado na OS: ${text(os.pgeNet) || "-"}`,
          `Processo informado na OS: ${text(os.processo) || "-"}`,
          "",
          "Texto da Ordem de Serviço:",
          text(os.corpoResumo) || "Sem texto disponível.",
          "",
          `Vinculada por: ${actorName}`,
        ].join("\n")

        const movementId = "jmov_email_os_manual_" + randomUUID()

        const movimentacoesCriadas = await tx.$executeRawUnsafe(
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
            SELECT
              $1::text,
              $2::bigint,
              $3::text,
              'monitoramento'::text,
              $4::text,
              COALESCE($5::jsonb, '[]'::jsonb),
              $6::text,
              $7::text,
              NULLIF($8::text, ''),
              NOW()
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.judicial_movimentacoes existente
              WHERE existente.monitoramento_id = $2::bigint
                AND existente.description ILIKE $9::text
            )
          `,
          movementId,
          demanda.monitoramentoId,
          demanda.id,
          description,
          JSON.stringify(anexos),
          actorId,
          actorName,
          actorEmail,
          `%${marker}%`,
        )

        await tx.$executeRawUnsafe(
          `
            UPDATE public.judicial_email_os
            SET
              status = 'CONVERTIDA',
              modulo_destino = $2::text,
              convertido_demanda_id = $3::text,
              convertido_protocolo = $4::text,
              convertido_em = COALESCE(convertido_em, NOW()),
              corpo_resumo = CASE
                WHEN COALESCE(corpo_resumo, '') ILIKE '%DEMANDA VINCULADA NO SIGAJUS%'
                  THEN corpo_resumo
                ELSE CONCAT(
                  COALESCE(corpo_resumo, ''),
                  E'\n\nDEMANDA VINCULADA NO SIGAJUS: ',
                  $4::text
                )
              END,
              updated_at = NOW()
            WHERE id::text = $1
          `,
          os.id,
          demanda.modulo,
          demanda.id,
          demanda.protocolo || demanda.id,
        )

        await tx.$executeRawUnsafe(
          `
            UPDATE public.judicial_email_processados
            SET
              demanda_id = $2::text,
              status = 'DEMANDA_CADASTRADA',
              updated_at = NOW(),
              lido_em = COALESCE(lido_em, NOW())
            WHERE os_id::text = $1::text
          `,
          os.id,
          demanda.id,
        )

        return {
          ok: true as const,
          osId: os.id,
          demandaId: demanda.id,
          protocolo: text(demanda.protocolo),
          pacienteNome: text(demanda.pacienteNome),
          movementId,
          movimentacaoCriada: Number(movimentacoesCriadas) > 0,
          anexosVinculados: anexos.length,
        }
      })

      if (!resultado.ok) {
        return NextResponse.json(
          { ok: false, error: resultado.error },
          { status: resultado.status },
        )
      }

      return NextResponse.json(resultado)
    }
    if (action === "inativar") {
      const user = emailOsMutationSession

      const id = String(body?.id || "").trim()
      if (!id) {
        return NextResponse.json({ ok: false, error: "ID da OS obrigatório." }, { status: 400 })
      }

      const updated = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `UPDATE public.judicial_email_os
         SET status = 'INATIVA', updated_at = NOW()
         WHERE id::text = $1
            OR protocolo = $1
            OR message_id = $1
         RETURNING id::text AS id`,
        id,
      )

      if (!updated.length) {
        return NextResponse.json(
          { ok: false, error: "OS não localizada para inativação." },
          { status: 404 },
        )
      }
      return NextResponse.json({ ok: true })
    }
    if (["marcar_cadastrada", "marcar_cadastrado", "concluir_cadastro", "converter", "convertida"].includes(action)) {
      // EMAIL_OS_CONVERTER_VINCULO_DEMANDA
      const id = text(body?.id || body?.osId || body?.emailOsId)
      const protocoloDestino = text(body?.protocolo || body?.demandaProtocolo || body?.protocoloDestino)
      const demandaIdDestino = text(body?.demandaId || body?.convertidoDemandaId || body?.convertido_demanda_id)
      const moduloDestino = normalizeEmailOsModule(body?.modulo || body?.moduloDestino)

      if (!id) {
        return NextResponse.json({ ok: false, error: "ID da OS obrigatório." }, { status: 400 })
      }

      const demandaRows = await prisma.$queryRawUnsafe<Array<{ id: string; protocolo: string }>>(
        `
          SELECT id::text AS id, protocolo::text AS protocolo
          FROM public.demandas
          WHERE ($1 <> '' AND id::text = $1)
             OR ($2 <> '' AND protocolo = $2)
          ORDER BY "createdAt" DESC
          LIMIT 1
        `,
        demandaIdDestino,
        protocoloDestino,
      )

      const demandaVinculada = demandaRows[0] || null
      const finalDemandaId = demandaVinculada?.id || demandaIdDestino || null
      const finalProtocolo = demandaVinculada?.protocolo || protocoloDestino || null

      await prisma.$executeRawUnsafe(
        `
          UPDATE public.judicial_email_os
          SET
            status = 'CONVERTIDA',
            modulo_destino = COALESCE(NULLIF($2, ''), modulo_destino),
            convertido_demanda_id = COALESCE(NULLIF($4, ''), convertido_demanda_id),
            convertido_protocolo = COALESCE(NULLIF($5, ''), convertido_protocolo),
            convertido_em = COALESCE(convertido_em, NOW()),
            corpo_resumo = CASE
              WHEN NULLIF($3, '') IS NULL THEN corpo_resumo
              WHEN COALESCE(corpo_resumo, '') ILIKE '%DEMANDA CADASTRADA NO SIGAJUS%' THEN corpo_resumo
              ELSE CONCAT(COALESCE(corpo_resumo, ''), E'\\n\\nDEMANDA CADASTRADA NO SIGAJUS: ', $3)
            END,
            updated_at = NOW()
          WHERE id::text = $1
        `,
        id,
        moduloDestino,
        finalProtocolo || protocoloDestino,
        finalDemandaId || "",
        finalProtocolo || "",
      )

      // EMAIL_OS_VINCULAR_IRMAS_POR_PGENET_PROCESSO
      if (finalDemandaId || finalProtocolo) {
        const origemOsRows = await prisma.$queryRawUnsafe<Array<{
          id: string
          protocolo: string | null
          assunto: string | null
          remetente: string | null
          recebidoEm: string | null
          pgeNet: string | null
          processo: string | null
          corpoResumo: string | null
          anexos: unknown
        }>>(
          `
            SELECT
              id::text AS id,
              protocolo,
              assunto,
              remetente,
              recebido_em::text AS "recebidoEm",
              pge_net AS "pgeNet",
              processo,
              corpo_resumo AS "corpoResumo",
              anexos
            FROM public.judicial_email_os
            WHERE id::text = $1
            LIMIT 1
          `,
          id,
        )

        const origemOs = origemOsRows[0] || null
        const pgeRaw = text(origemOs?.pgeNet)
        const processoRaw = text(origemOs?.processo)
        const pgeDigits = digits(pgeRaw)
        const processoDigits = digits(processoRaw)
        const pgeLike = pgeRaw ? "%" + pgeRaw + "%" : ""
        const processoLike = processoRaw ? "%" + processoRaw + "%" : ""

        const osVinculadas = await prisma.$queryRawUnsafe<Array<{
          id: string
          protocolo: string | null
          assunto: string | null
          remetente: string | null
          recebidoEm: string | null
          pgeNet: string | null
          processo: string | null
          corpoResumo: string | null
          anexos: unknown
        }>>(
          `
            SELECT
              id::text AS id,
              protocolo,
              assunto,
              remetente,
              recebido_em::text AS "recebidoEm",
              pge_net AS "pgeNet",
              processo,
              corpo_resumo AS "corpoResumo",
              anexos
            FROM public.judicial_email_os
            WHERE id::text = $1
               OR (
                 COALESCE(status, 'AGUARDANDO_CADASTRO') NOT IN ('CONVERTIDA', 'CADASTRADA', 'CADASTRADO', 'CONCLUIDA', 'CONCLUÍDA', 'INATIVA')
                 AND (
                   ($2 <> '' AND REGEXP_REPLACE(COALESCE(pge_net, ''), '\\D', '', 'g') = $2)
                   OR ($3 <> '' AND REGEXP_REPLACE(COALESCE(processo, ''), '\\D', '', 'g') = $3)
                   OR ($4 <> '' AND pge_net ILIKE $4)
                   OR ($5 <> '' AND processo ILIKE $5)
                 )
               )
            ORDER BY recebido_em ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
          `,
          id,
          pgeDigits,
          processoDigits,
          pgeLike,
          processoLike,
        )

        const monitoramentoRows = await prisma.$queryRawUnsafe<Array<{
          monitoramentoId: string
          demandaId: string | null
          protocolo: string | null
        }>>(
          `
            SELECT
              b.id::text AS "monitoramentoId",
              b.demanda_id::text AS "demandaId",
              COALESCE(d.protocolo::text, b.demanda_id::text) AS protocolo
            FROM public.judicial_monitoramento_base b
            LEFT JOIN public.demandas d ON d.id = b.demanda_id
            WHERE ($1 <> '' AND b.demanda_id::text = $1)
               OR ($2 <> '' AND d.protocolo::text = $2)
            ORDER BY b.id DESC
            LIMIT 1
          `,
          finalDemandaId || "",
          finalProtocolo || "",
        )

        const monitoramento = monitoramentoRows[0] || null

        for (const os of osVinculadas) {
          await prisma.$executeRawUnsafe(
            `
              UPDATE public.judicial_email_os
              SET
                status = 'CONVERTIDA',
                modulo_destino = COALESCE(NULLIF($2, ''), modulo_destino),
                convertido_demanda_id = COALESCE(NULLIF($3, ''), convertido_demanda_id),
                convertido_protocolo = COALESCE(NULLIF($4, ''), convertido_protocolo),
                convertido_em = COALESCE(convertido_em, NOW()),
                corpo_resumo = CASE
                  WHEN COALESCE(corpo_resumo, '') ILIKE '%DEMANDA CADASTRADA NO SIGAJUS%' THEN corpo_resumo
                  ELSE CONCAT(COALESCE(corpo_resumo, ''), E'\n\nDEMANDA CADASTRADA NO SIGAJUS: ', $4)
                END,
                updated_at = NOW()
              WHERE id::text = $1
            `,
            os.id,
            moduloDestino,
            finalDemandaId || "",
            finalProtocolo || "",
          )

          if (finalDemandaId) {
            await prisma.$executeRawUnsafe(
              `
                UPDATE public.judicial_email_processados
                SET
                  demanda_id = $2,
                  status = 'DEMANDA_CADASTRADA',
                  updated_at = NOW(),
                  lido_em = COALESCE(lido_em, NOW())
                WHERE os_id::text = $1
              `,
              os.id,
              finalDemandaId,
            )
          }

          if (monitoramento?.monitoramentoId) {
            const anexosJson = JSON.stringify(parseArray(os.anexos))
            const marker = "OS vinculada automaticamente: " + os.id
            const description = [
              "E-MAIL/OS VINCULADO AUTOMATICAMENTE AO PROCESSO",
              marker,
              "Protocolo OS: " + text(os.protocolo),
              "Assunto: " + text(os.assunto),
              "Remetente: " + text(os.remetente),
              "PGE.net: " + text(os.pgeNet || pgeRaw),
              "Processo: " + text(os.processo || processoRaw),
              "Resumo: " + text(os.corpoResumo).slice(0, 4000),
            ].filter(Boolean).join("\n")

            await prisma.$executeRawUnsafe(
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
                  created_at
                )
                SELECT
                  $1::text,
                  $2::bigint,
                  NULLIF($3::text, ''),
                  'monitoramento'::text,
                  $4::text,
                  COALESCE($5::jsonb, '[]'::jsonb),
                  'sistema-email'::text,
                  'Integração de e-mail'::text,
                  NOW()
                WHERE NOT EXISTS (
                  SELECT 1
                  FROM public.judicial_movimentacoes
                  WHERE monitoramento_id = $2::bigint
                    AND description ILIKE $6::text
                )
              `,
              "jmov_email_os_" + randomUUID(),
              monitoramento.monitoramentoId,
              monitoramento.demandaId || finalDemandaId || null,
              description,
              anexosJson,
              "%" + marker + "%",
            )
          }
        }

        if (monitoramento?.monitoramentoId) {
          await prisma.$executeRawUnsafe(
            `
              UPDATE public.judicial_monitoramento_base
              SET
                ativo_monitoramento = TRUE,
                status_monitoramento_atual = 'PENDENTE',
                pendente_dia_anterior = FALSE,
                data_proximo_monitoramento = CURRENT_DATE + INTERVAL '1 day',
                motivo_proximo_monitoramento = 'RETORNO_OS_INCORPORADA_1_DIA',
                prazo_retorno_dias = 1,
                prioridade_monitoramento = GREATEST(COALESCE(prioridade_monitoramento, 0), 3),
                prioridade_motivo = 'OS incorporada ao processo; monitorar no dia seguinte com prioridade máxima.',
                prioridade_atualizada_em = NOW(),
                prioridade_atualizada_por = 'sistema-email-os',
                updated_at = NOW()
              WHERE id::text = $1
            `,
            monitoramento.monitoramentoId,
          )
        }
      }

      if (finalDemandaId) {
        await prisma.$executeRawUnsafe(
          `
            UPDATE public.judicial_email_processados
            SET
              demanda_id = $2,
              status = 'DEMANDA_CADASTRADA',
              updated_at = NOW(),
              lido_em = COALESCE(lido_em, NOW())
            WHERE os_id::text = $1
          `,
          id,
          finalDemandaId,
        )
      }

      return NextResponse.json({ ok: true, demandaId: finalDemandaId, protocolo: finalProtocolo })
    }

    const osId = text(body?.osId)
    const modulo = normalizeEmailOsModule(body?.modulo)
    const responsavelId = text(body?.responsavelId)
    if (!responsavelId) return NextResponse.json({ ok: false, error: "Informe o responsável." }, { status: 400 })
    const user = await findUser(responsavelId)
    if (!user) return NextResponse.json({ ok: false, error: "Responsável não encontrado." }, { status: 404 })

    if (!osId && text(body?.uid)) {
      const uid = text(body?.uid)
      const messageId = text(body?.messageId || uid)
      const assunto = text(body?.subject) || "E-mail sem assunto"
      const corpoResumo = text(body?.bodyText || body?.corpoResumo || body?.body || `Criado pela prévia da integração de e-mail. UID: ${uid}`).slice(0, 10000)
      const anexos = Array.isArray(body?.attachments) ? body.attachments : []
      const protocolo = `OS-EMAIL-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string; protocolo: string }>>(
        `INSERT INTO public.judicial_email_os (protocolo, message_id, assunto, remetente, recebido_em, pge_net, processo, detectado_em, classificador, corpo_resumo, anexos, status, modulo_destino, responsavel_id, responsavel_nome, responsavel_email, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7,$8,$9,$10,$11::jsonb,'ATRIBUIDA',$12,$13,$14,$15,NOW(),NOW())
         RETURNING id::text AS id, protocolo`,
        protocolo,
        messageId,
        assunto,
        text(body?.from),
        text(body?.date) || new Date().toISOString(),
        text(body?.pgeNet) || null,
        text(body?.processo) || null,
        text(body?.detectedIn) || null,
        text(body?.classifier) || null,
        corpoResumo,
        JSON.stringify(anexos),
        modulo,
        user.id,
        user.nome || "Usuário",
        user.email || null,
      )
      const created = rows[0]
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.judicial_email_processados (message_uid, message_id, assunto, remetente, recebido_em, pge_net, processo, detectado_em, classificador, status, os_id, raw_metadata, processado_em, lido_em, deleted_em, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7,$8,$9,'OS_CRIADA',$10::bigint,$11::jsonb,NOW(),NOW(),NOW(),NOW(),NOW())
         ON CONFLICT (message_id) WHERE message_id IS NOT NULL AND message_id <> '' DO UPDATE SET status='OS_CRIADA', os_id=EXCLUDED.os_id, raw_metadata=EXCLUDED.raw_metadata, lido_em=NOW(), deleted_em=NOW(), updated_at=NOW()`,
        uid,
        messageId,
        assunto,
        text(body?.from),
        text(body?.date) || new Date().toISOString(),
        text(body?.pgeNet) || null,
        text(body?.processo) || null,
        text(body?.detectedIn) || null,
        text(body?.classifier) || null,
        created?.id || null,
        JSON.stringify({ manual: true, modulo, responsavelId: user.id, bodyText: corpoResumo, attachments: anexos, os: { protocolo: created?.protocolo, attachments: anexos } }),
      )
      void finalizeEmailMessage(uid).catch((error) => console.error("[POST /api/email-os] finalizacao IMAP:", error))
      return NextResponse.json({ ok: true, os: created })
    }

    if (!osId) return NextResponse.json({ ok: false, error: "Informe a OS." }, { status: 400 })
    await prisma.$executeRawUnsafe(`UPDATE public.judicial_email_os SET modulo_destino = $2, responsavel_id = $3, responsavel_nome = $4, responsavel_email = $5, status = 'ATRIBUIDA', transferido_em = NOW(), updated_at = NOW() WHERE id::text = $1`, osId, modulo, user.id, user.nome || "Usuário", user.email || null)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[POST /api/email-os] erro:", error)
    return NextResponse.json({ ok: false, error: "Erro ao transferir OS." }, { status: 500 })
  }
}
