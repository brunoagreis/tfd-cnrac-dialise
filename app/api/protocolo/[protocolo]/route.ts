import { NextRequest, NextResponse } from "next/server"
import { requireAdminRequest } from "@/lib/security/server-session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ProtocoloRow = {
  demandaId: string
  protocolo: string
  modulo: string
  pacienteId: string
  pacienteNome: string | null
  pacienteCpf: string | null
  pacienteCartaoSus: string | null
  pacienteDataNascimento: string | null
  pacienteEmail: string | null
  pacienteMunicipio: string | null
  pacienteEndereco: string | null
  localSolicitante: string | null
  emailSolicitante: string | null
  codigoSigtap: string | null
  descricaoSigtap: string | null
  cid10: string | null
  especialidade: string | null
  subespecialidade: string | null
  observacoesUnidade: string | null
  localSolicitado: string | null
  tipoSolicitacao: string | null
  acaoJudicial: boolean | null
  criadoPor: string | null
  criadoPorNome: string | null
  createdAt: string | null
  updatedAt: string | null
  statusMonitoramentoAtual: string | null
}

type TelefoneSolicitanteRow = {
  value: string | null
}

function normalizeStatus(value: unknown) {
  const status = String(value ?? "").trim().toLowerCase()

  if (status === "finalizado" || status === "resolvido") return "resolvido"
  if (status === "devolvida" || status === "devolvido") return "devolvida"

  return "pendente"
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ protocolo: string }> },
) {
  try {
    const adminGuard = await requireAdminRequest(req)
    if (!adminGuard.ok) return adminGuard.response

    const { protocolo } = await context.params
    const decodedProtocol = decodeURIComponent(protocolo)

    const rows = await prisma.$queryRawUnsafe<ProtocoloRow[]>(
      `
        SELECT
          d.id::text AS "demandaId",
          d.protocolo::text AS protocolo,
          LOWER(COALESCE(d.modulo::text, 'tfd')) AS modulo,
          d."pacienteId"::text AS "pacienteId",
          p.nome AS "pacienteNome",
          p.cpf AS "pacienteCpf",
          p."cartaoSus" AS "pacienteCartaoSus",
          p."dataNascimento"::text AS "pacienteDataNascimento",
          p.email AS "pacienteEmail",
          p.municipio AS "pacienteMunicipio",
          p.endereco AS "pacienteEndereco",
          d."localSolicitante" AS "localSolicitante",
          d."emailSolicitante" AS "emailSolicitante",
          d."codigoSigtap" AS "codigoSigtap",
          d."descricaoSigtap" AS "descricaoSigtap",
          d.cid10 AS cid10,
          d.especialidade AS especialidade,
          d.subespecialidade AS subespecialidade,
          d."observacoesUnidade" AS "observacoesUnidade",
          d."localSolicitado" AS "localSolicitado",
          d."tipoSolicitacao"::text AS "tipoSolicitacao",
          d."acaoJudicial" AS "acaoJudicial",
          d."criadoPor" AS "criadoPor",
          d."criadoPorNome" AS "criadoPorNome",
          d."createdAt"::text AS "createdAt",
          d."updatedAt"::text AS "updatedAt",
          CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.interacoes i
    WHERE i."demandaId" = d.id
      AND i.pendencia = 'finalizar_demanda'
  )
  THEN 'RESOLVIDO'
  ELSE b.status_monitoramento_atual
END AS "statusMonitoramentoAtual"
        FROM public.demandas d
        INNER JOIN public.pacientes p
          ON p.id = d."pacienteId"
        LEFT JOIN public.judicial_monitoramento_base b
          ON b.origem_tabela = 'demandas'
         AND b.origem_registro_id = d.id::text
        WHERE d.protocolo = $1
        LIMIT 1
      `,
      decodedProtocol,
    )

    const row = rows[0]

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Protocolo não encontrado." },
        { status: 404 },
      )
    }

    const telefones = await prisma.$queryRawUnsafe<TelefoneSolicitanteRow[]>(
      `
        SELECT value
        FROM public.telefone_solicitante
        WHERE "demandaId" = $1
        ORDER BY id
      `,
      row.demandaId,
    )

    return NextResponse.json({
      ok: true,
      item: {
        demanda: {
          id: row.demandaId,
          protocolo: row.protocolo,
          pacienteId: row.pacienteId,
          modulo: row.modulo,
          localSolicitante: row.localSolicitante ?? "",
          telefoneSolicitante: telefones.map((t) => t.value ?? "").filter(Boolean),
          emailSolicitante: row.emailSolicitante ?? "",
          codigoSigtap: row.codigoSigtap ?? "",
          descricaoSigtap: row.descricaoSigtap ?? "",
          cid10: row.cid10 ?? "",
          especialidade: row.especialidade ?? "",
          subespecialidade: row.subespecialidade ?? "",
          peso: "",
          altura: "",
          tipoSanguineo: "",
          observacoesUnidade: row.observacoesUnidade ?? "",
tipoSolicitacao:
  row.tipoSolicitacao === "definitiva"
    ? "definitiva"
    : row.tipoSolicitacao === "nao_se_aplica"
      ? "nao_se_aplica"
      : row.tipoSolicitacao === "inclusao"
        ? "inclusao"
        : row.tipoSolicitacao === "substituicao"
          ? "substituicao"
          : row.tipoSolicitacao === "alta"
            ? "alta"
            : row.tipoSolicitacao === "outros"
              ? "outros"
              : "transito",
          localSolicitado: row.localSolicitado ?? "",
          acaoJudicial: Boolean(row.acaoJudicial),
          status: normalizeStatus(row.statusMonitoramentoAtual),
          anexos: [],
          interacoes: [],
          criadoEm: row.createdAt ?? "",
          atualizadoEm: row.updatedAt ?? "",
          criadoPor: row.criadoPor ?? "",
          criadoPorNome: row.criadoPorNome ?? "",
        },
        paciente: {
          id: row.pacienteId,
          cpf: row.pacienteCpf ?? "",
          cartaoSus: row.pacienteCartaoSus ?? "",
          nome: row.pacienteNome ?? "SEM NOME",
          dataNascimento: row.pacienteDataNascimento ?? "",
          telefones: [],
          email: row.pacienteEmail ?? "",
          municipio: row.pacienteMunicipio ?? "",
          endereco: row.pacienteEndereco ?? "",
          criadoEm: "",
          atualizadoEm: "",
        },
      },
    })
  } catch (error) {
    console.error("[GET /api/protocolo/[protocolo]] erro:", error)

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar protocolo." },
      { status: 500 },
    )
  }
}